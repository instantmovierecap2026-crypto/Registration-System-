import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

// Load Firebase applet configuration
let firebaseConfig: any = null;
try {
  if (process.env.FIREBASE_APPLET_CONFIG) {
    firebaseConfig = JSON.parse(process.env.FIREBASE_APPLET_CONFIG);
  } else if (process.env.FIREBASE_PROJECT_ID) {
    firebaseConfig = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      firestoreDatabaseId: process.env.FIREBASE_DATABASE_ID || undefined
    };
  } else {
    const rawConfig = fs.readFileSync(path.resolve('./firebase-applet-config.json'), 'utf-8');
    firebaseConfig = JSON.parse(rawConfig);
  }
} catch (err) {
  console.warn("Failed to read firebase-applet-config.json or parse environment alternatives", err);
}

// Initialize Firebase Admin SDK
// This will connect securely bypassing standard Firestore rules allowing server-controlled modifications
const firebaseAdminApp = firebaseConfig ? initializeApp({
  projectId: firebaseConfig.projectId,
}) : null;
const adminDb = (firebaseConfig && firebaseAdminApp) ? getFirestore(firebaseAdminApp, firebaseConfig.firestoreDatabaseId) : null;

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory rate limiting state for Admin login
interface RateLimitState {
  count: number;
  lockedUntil: number;
}
const loginAttempts: { [ip: string]: RateLimitState } = {};

const getClientIp = (req: express.Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
};

// Rate limit helper check
const checkRateLimit = (ip: string): { allowed: boolean; remainingSec: number } => {
  const state = loginAttempts[ip];
  if (!state) return { allowed: true, remainingSec: 0 };
  
  if (Date.now() < state.lockedUntil) {
    const diff = Math.ceil((state.lockedUntil - Date.now()) / 1000);
    return { allowed: false, remainingSec: diff };
  }
  
  // Lock expired, reset
  if (Date.now() >= state.lockedUntil && state.count >= 5) {
    delete loginAttempts[ip];
  }
  return { allowed: true, remainingSec: 0 };
};

// Record attempt helper
const recordAttempt = (ip: string, success: boolean) => {
  if (success) {
    delete loginAttempts[ip];
    return;
  }
  
  if (!loginAttempts[ip]) {
    loginAttempts[ip] = { count: 0, lockedUntil: 0 };
  }
  
  loginAttempts[ip].count += 1;
  if (loginAttempts[ip].count >= 5) {
    // Lock for 15 minutes
    loginAttempts[ip].lockedUntil = Date.now() + 15 * 60 * 1000;
  }
};

// Verify Admin password middleware/helper
const isPasswordCorrect = (attempt: string): boolean => {
  if (!attempt) return false;
  
  // Clean user attempt: strip whitespace and surrounding double/single quotes
  const cleanAttempt = attempt.trim().replace(/^["']|["']$/g, '').trim();
  const defaultFallback = 'Nahom@110108';
  
  // If attempt matches the standard preset backup, allow access
  if (cleanAttempt === defaultFallback || attempt === defaultFallback) {
    return true;
  }
  
  // Extract and clean ADMIN_PASSWORD from process.env if provided
  let envPass = process.env.ADMIN_PASSWORD;
  if (envPass) {
    const cleanEnv = envPass.trim().replace(/^["']|["']$/g, '').trim();
    if (cleanEnv && (cleanAttempt === cleanEnv || attempt === envPass)) {
      return true;
    }
  }
  
  return false;
};

// Log admin action helper
const logAdminAction = async (action: string, ip: string) => {
  try {
    await adminDb.collection('admin_logs').add({
      action,
      timestamp: new Date().toISOString(),
      ip_address: ip,
    });
  } catch (err) {
    console.error('Failed to write admin log to Firestore', err);
  }
};

// API Route: Verify admin password
app.post('/api/admin/verify', async (req, res) => {
  const ip = getClientIp(req);
  const { password } = req.body;
  
  const limit = checkRateLimit(ip);
  if (!limit.allowed) {
    await logAdminAction(`ADMIN LOGIN LOCKED - Bruteforce protection triggered from IP`, ip);
    return res.status(429).json({
      success: false,
      message: `Too many failed attempts. Temporary lockout. Try again in ${limit.remainingSec}s.`
    });
  }
  
  if (isPasswordCorrect(password)) {
    recordAttempt(ip, true);
    await logAdminAction(`ADMIN LOGIN SUCCESS`, ip);
    return res.json({ success: true, message: 'Password matches' });
  } else {
    recordAttempt(ip, false);
    const state = loginAttempts[ip];
    const trackingLeft = state ? (5 - state.count) : 5;
    await logAdminAction(`ADMIN LOGIN FAIL - Incorrect password attempted`, ip);
    return res.status(401).json({
      success: false,
      message: 'Incorrect password',
      attemptsRemaining: trackingLeft > 0 ? trackingLeft : 0
    });
  }
});

// Middleware to verify admin authentication server-side before execution of privileged routes
const requireAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const { password } = req.body;
  const ip = getClientIp(req);
  
  if (!password || !isPasswordCorrect(password)) {
    await logAdminAction(`UNAUTHORIZED ACCESS TARGETED: ${req.path}`, ip);
    return res.status(403).json({ success: false, message: 'Unauthorized permission denied.' });
  }
  next();
};

// API Route: Get all registrations (Admin read proxy)
app.post('/api/admin/registrations', requireAdmin, async (req, res) => {
  try {
    const snap = await adminDb.collection('registrations').get();
    const list: any[] = [];
    snap.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() });
    });
    return res.json({ success: true, list });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// API Route: Get all administrative audit logs
app.post('/api/admin/logs', requireAdmin, async (req, res) => {
  try {
    const snap = await adminDb.collection('admin_logs').orderBy('timestamp', 'desc').get();
    const list: any[] = [];
    snap.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() });
    });
    return res.json({ success: true, list });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// API Route: Get all classes
app.post('/api/admin/classes', requireAdmin, async (req, res) => {
  try {
    const snap = await adminDb.collection('classes').get();
    const list: any[] = [];
    snap.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() });
    });
    return res.json({ success: true, list });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// API Route: Get all grade settings
app.post('/api/admin/grade-settings', requireAdmin, async (req, res) => {
  try {
    const snap = await adminDb.collection('grade_settings').get();
    const list: any[] = [];
    snap.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() });
    });
    return res.json({ success: true, list });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// API Route: Approve student registration
app.post('/api/admin/approve', requireAdmin, async (req, res) => {
  const { studentId } = req.body;
  const ip = getClientIp(req);
  
  if (!studentId) {
    return res.status(400).json({ success: false, message: 'studentId is required' });
  }
  
  try {
    const studentRef = adminDb.collection('registrations').doc(studentId);
    const snap = await studentRef.get();
    
    if (!snap.exists) {
      return res.status(404).json({ success: false, message: 'Student application not found' });
    }
    
    await studentRef.update({
      status: 'Approved',
      rejection_reason: null,
    });
    
    await logAdminAction(`APPROVED Student Application for: ${snap.data()?.full_name} (${studentId})`, ip);
    return res.json({ success: true, message: 'Student registration approved successfully' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// API Route: Reject student registration
app.post('/api/admin/reject', requireAdmin, async (req, res) => {
  const { studentId, reason } = req.body;
  const ip = getClientIp(req);
  
  if (!studentId || !reason) {
    return res.status(400).json({ success: false, message: 'studentId and reason are required' });
  }
  
  try {
    const studentRef = adminDb.collection('registrations').doc(studentId);
    const snap = await studentRef.get();
    
    if (!snap.exists) {
      return res.status(404).json({ success: false, message: 'Student application not found' });
    }
    
    await studentRef.update({
      status: 'Rejected',
      rejection_reason: reason,
      class_assignment: null // Clear if they had one
    });
    
    await logAdminAction(`REJECTED Student Application for: ${snap.data()?.full_name} (${studentId}) - Reason: ${reason}`, ip);
    return res.json({ success: true, message: 'Student registration rejected successfully' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// API Route: Delete student registration
app.post('/api/admin/delete', requireAdmin, async (req, res) => {
  const { studentId } = req.body;
  const ip = getClientIp(req);
  
  if (!studentId) {
    return res.status(400).json({ success: false, message: 'studentId is required' });
  }
  
  try {
    const studentRef = adminDb.collection('registrations').doc(studentId);
    const snap = await studentRef.get();
    
    if (!snap.exists) {
      return res.status(404).json({ success: false, message: 'Student application not found' });
    }
    
    const studentName = snap.data()?.full_name;
    await studentRef.delete();
    
    await logAdminAction(`DELETED Student Application of: ${studentName} (${studentId})`, ip);
    return res.json({ success: true, message: 'Student registration deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// API Route: Save grade configs
app.post('/api/admin/save-settings', requireAdmin, async (req, res) => {
  const { grade, students_per_class } = req.body;
  const ip = getClientIp(req);
  
  if (!grade || typeof students_per_class !== 'number') {
    return res.status(400).json({ success: false, message: 'grade and students_per_class are required' });
  }
  
  try {
    const settingRef = adminDb.collection('grade_settings').doc(String(grade));
    await settingRef.set({
      grade: String(grade),
      students_per_class,
    });
    
    await logAdminAction(`UPDATED Grade Config for Grade ${grade}: Size of ${students_per_class} students/class`, ip);
    return res.json({ success: true, message: `Successfully updated config for Grade ${grade}` });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// API Route: Smart Class Assignment System!
app.post('/api/admin/smart-assignment', requireAdmin, async (req, res) => {
  const { grade } = req.body;
  const ip = getClientIp(req);
  
  if (!grade) {
    return res.status(400).json({ success: false, message: 'grade is required' });
  }
  
  try {
    // 1. Get Grade Setting (default to 60)
    let classSize = 60;
    const settingRef = adminDb.collection('grade_settings').doc(String(grade));
    const settingSnap = await settingRef.get();
    if (settingSnap.exists) {
      classSize = settingSnap.data()?.students_per_class || 60;
    }
    
    // 2. Fetch all APPROVED students for this grade
    const studentsSnap = await adminDb.collection('registrations')
      .where('promoted_grade', '==', parseInt(grade))
      .where('status', '==', 'Approved')
      .get();
      
    const students: any[] = [];
    studentsSnap.forEach(doc => {
      students.push({ id: doc.id, ...doc.data() });
    });
    
    if (students.length === 0) {
      return res.status(400).json({
        success: false,
        message: `No approved students found for Grade ${grade}. Cannot assign classes.`
      });
    }
    
    // 3. Sort students by average descending
    students.sort((a, b) => b.average - a.average);
    
    // 4. Create special class from TOP students (matching classSize)
    // Class name e.g. "10A", "11A", or "12A"
    const parsedGrade = String(grade);
    const specialClassName = `${parsedGrade}A`;
    
    const specialClassSize = Math.min(classSize, students.length);
    const specialClassStudents = students.slice(0, specialClassSize);
    const remainingStudents = students.slice(specialClassSize);
    
    // Set updates list for batching
    const batch = adminDb.batch();
    
    // Assign special class
    for (const student of specialClassStudents) {
      const ref = adminDb.collection('registrations').doc(student.id);
      batch.update(ref, { class_assignment: specialClassName });
    }
    
    // 5. Regular class assignment with GENDER BALANCE
    // Segregate remaining students into Male and Female
    const males = remainingStudents.filter(s => s.sex === 'Male');
    const females = remainingStudents.filter(s => s.sex === 'Female');
    
    // Calculate total regular students and regular class size requirements
    const totalRemaining = remainingStudents.length;
    const numberOfRegularClasses = Math.ceil(totalRemaining / classSize);
    
    // Create regular class identifiers, e.g., B, C, D, etc.
    const alphabet = 'BCDEFGHIJKLMNOPQRSTUVWXYZ';
    const regularClassNames: string[] = [];
    for (let i = 0; i < numberOfRegularClasses; i++) {
      const idx = i < alphabet.length ? i : alphabet.length - 1;
      const suffix = i < alphabet.length ? alphabet[idx] : `${alphabet[alphabet.length - 1]}${i}`;
      regularClassNames.push(`${parsedGrade}${suffix}`);
    }
    
    // Initialize empty class buckets
    const regularClasses: { [className: string]: any[] } = {};
    for (const clsName of regularClassNames) {
      regularClasses[clsName] = [];
    }
    
    // Smart distribution of Males
    let mIdx = 0;
    while (mIdx < males.length) {
      for (const clsName of regularClassNames) {
        if (mIdx < males.length) {
          regularClasses[clsName].push(males[mIdx]);
          mIdx++;
        }
      }
    }
    
    // Smart distribution of Females
    let fIdx = 0;
    while (fIdx < females.length) {
      for (const clsName of regularClassNames) {
        if (fIdx < females.length) {
          regularClasses[clsName].push(females[fIdx]);
          fIdx++;
        }
      }
    }
    
    // Write remaining students back into Firestore
    for (const clsName of regularClassNames) {
      for (const student of regularClasses[clsName]) {
        const ref = adminDb.collection('registrations').doc(student.id);
        batch.update(ref, { class_assignment: clsName });
      }
    }
    
    // Commit all class updates
    await batch.commit();
    
    // 6. Regenerate statistical metrics for Classes collection
    const classStats: { [className: string]: { total: number, type: 'Special' | 'Regular' } } = {};
    classStats[specialClassName] = { total: specialClassStudents.length, type: 'Special' };
    
    for (const clsName of regularClassNames) {
      classStats[clsName] = { total: regularClasses[clsName].length, type: 'Regular' };
    }
    
    // Save classes specifications in classes collection
    const classesBatch = adminDb.batch();
    
    // Find all outstanding grade classes first to overwrite or clean up
    const classesCleanupSnap = await adminDb.collection('classes')
      .where('grade', '==', parsedGrade)
      .get();
      
    classesCleanupSnap.forEach(doc => {
      classesBatch.delete(doc.ref);
    });
    
    // Save new class lists
    for (const [clsName, info] of Object.entries(classStats)) {
      const ref = adminDb.collection('classes').doc(clsName);
      classesBatch.set(ref, {
        id: clsName,
        grade: parsedGrade,
        class_name: clsName,
        class_type: info.type,
        total_students: info.total
      });
    }
    
    await classesBatch.commit();
    
    await logAdminAction(`TRIGGERED SMART SYSTEM: Grade ${parsedGrade} class allocation done successfully matching class capacity ${classSize}. Placed ${specialClassSize} in Special Class ${specialClassName} and remaining ${totalRemaining} into balanced regular classes: ${regularClassNames.join(', ')}`, ip);
    
    return res.json({
      success: true,
      message: `Successfully executed smart class assignment for Grade ${grade}`,
      assignedClasses: [specialClassName, ...regularClassNames],
    });
  } catch (error: any) {
    console.error("Smart Assignment Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// API Route: AI Registration Advisor (Student chatbot)
app.post('/api/ai/registration-advisor', async (req, res) => {
  const { message, history } = req.body;
  if (!message) {
    return res.status(400).json({ success: false, message: 'Message is required' });
  }
  
  try {
    const formattedHistory = (history || []).map((h: any) => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }]
    }));
    
    const schoolContext = `
      You are the official Chercher Secondary School Registration & Placement AI Advisor. 
      Help students, parents, and prospective applicants understand the school's registration rules, payment options, and requirements.
      Keep answers warm, clear, polite, and encouraging.
      
      CHERCHER SECONDARY SCHOOL INFO:
      - Location: Chiro (Chercher) town, West Hararghe Zone, Oromia, Ethiopia.
      - Grade Levels: Grades 10, 11, and 12.
      - Slogan: "Nurturing Excellence, Shaping Futures!"
      - School colors: Maroon, Gold, and White.
      - Principal: Mr. Abera Kebede.
      
      REGISTRATION PROCESS:
      1. Students fill out the online registration form.
      2. Payment of registration fees must be made, and transcipts uploaded.
      3. Applications will go into "Pending Review" status.
      4. Once approved, school system will run the Smart Class Assignment algorithm.
      5. Top students with the highest averages are assigned to class 'A' as the "Special Class" (e.g. 10A, 11A, 12A).
      6. Remaining students are balanced fairly by gender and distributed split evenly among Regular classes ('B', 'C', etc.).
      7. Students can search using their "Tracking ID" (received upon submission) to check their registration approval of "Pending", "Approved", or "Rejected", and see their Class assigned if completed.
      
      PAYMENT CHANNELS (Card lists):
      - Commercial Bank of Ethiopia (CBE): Account Number: 10393930293 (Account holder: Chercher Secondary School Board)
      - SINQEE BANK: Account Number: 2939939393
      - TELEBIRR: Merchant / Utility Number: 3939393939
      
      UPLOAD REQUIREMENTS:
      - Max file size: 5MB.
      - Supported files: JPG, JPEG, PNG, WEBP, PDF.
      - Required documents: (1) Last year's report card/Transcript image, and (2) Bank payment receipt screenshot.
      
      Respond directly to user queries using these details. Speak from the school's perspective. Keep things structured with formatting where useful.
    `;
    
    // Add current message to chat contents by constructing with history
    const chat = ai.chats.create({
      model: 'gemini-3.5-flash',
      history: formattedHistory,
      config: {
        systemInstruction: schoolContext,
      }
    });
    
    const response = await chat.sendMessage({ message });
    return res.json({ success: true, text: response.text });
  } catch (error: any) {
    console.error("AI Advisor error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// API Route: AI Dashboard Analytics Report (Admin insights)
app.post('/api/ai/dashboard-insights', requireAdmin, async (req, res) => {
  const { statsSummary } = req.body;
  if (!statsSummary) {
    return res.status(400).json({ success: false, message: 'Stats details are required' });
  }
  
  try {
    const prompt = `
      You are the Principal's strategic academic AI copilot for Chercher Secondary School.
      Analyze the current school enrollment statistics and write an elegant, professional, and visually engaging executive analysis report of our school registration.
      
      CURRENT STATISTICAL ENROLLMENT SYNOPSIS:
      ${JSON.stringify(statsSummary, null, 2)}
      
      REPORT REQUISITES:
      1. Overall status assessment (Enrollment pace, approval ratios, pending pipelines).
      2. Grade-by-grade breakdowns analyzing gender balances, average cohort statistics, and adequacy of class sizing configs.
      3. Actionable structural observations (e.g. highlight critical gender disproportions in specific grades, or mention if classes need revision to avoid over-crowdedness).
      4. Recommendations to achieve peak scholastic performance and perfect scheduling.
      
      Tone: Prestigious, educational, insightful, Ethiopian-school context supportive. Avoid developer jargon. Write clean, markdown formatting with clear bold titles.
    `;
    
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
    });
    
    return res.json({ success: true, text: response.text });
  } catch (error: any) {
    console.error("AI Dashboard Insights error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Vite middleware / client build serving setup
if (process.env.NODE_ENV !== 'production') {
  const configureVite = async () => {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  };
  configureVite();
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

if (process.env.NETLIFY !== 'true') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Chercher Secondary School full-stack server running on http://localhost:${PORT}`);
  });
}

export default app;
