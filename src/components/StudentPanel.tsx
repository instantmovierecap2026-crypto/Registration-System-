import React, { useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Registration } from '../types';
import { 
  School, CheckCircle, Clock, AlertTriangle, Search, Upload, FileText, 
  CreditCard, Phone, ArrowRight, Activity, HelpCircle, User, Award, BookOpen, Sparkles
} from 'lucide-react';

export default function StudentPanel() {
  // Tracking ID search states
  const [trackingId, setTrackingId] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [foundApp, setFoundApp] = useState<Registration | null>(null);
  const [searchError, setSearchError] = useState('');

  // Form submission states
  const [isRegistering, setIsRegistering] = useState(false);
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState<number | ''>('');
  const [sex, setSex] = useState<'Male' | 'Female' | ''>('');
  const [promotedGrade, setPromotedGrade] = useState<'10' | '11' | '12' | ''>('');
  const [average, setAverage] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'CBE' | 'SINQEE BANK' | 'TELEBIRR' | ''>('');
  
  // File upload states
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  
  const [transcriptProgress, setTranscriptProgress] = useState(0);
  const [receiptProgress, setReceiptProgress] = useState(0);
  const [transcriptUrl, setTranscriptUrl] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');

  const [formError, setFormError] = useState('');
  const [successTrackingId, setSuccessTrackingId] = useState('');
  const [loadingSubmit, setLoadingSubmit] = useState(false);

  // Toast Notification System
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'info' | 'success' | 'error'>('info');

  const showToast = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToastMsg(msg);
    setToastType(type);
    setTimeout(() => setToastMsg(''), 4500);
  };

  // Image pre-compression and Jpeg conversion helper
  const compressImage = (file: File, maxWidth = 1200, maxQuality = 0.70): Promise<Blob | File> => {
    return new Promise((resolve) => {
      if (file.type === 'application/pdf' || !file.type.startsWith('image/')) {
        // Return original file instantly if not an image or is pdf
        resolve(file);
        return;
      }

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Resize bound
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                // Return compressed jpeg Blob
                resolve(blob);
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            maxQuality
          );
        };
      };
      reader.onerror = () => {
        resolve(file);
      };
    });
  };

  // Cloudinary direct unsigned upload utilizing XMLHttpRequest for upload progress tracker
  const uploadToCloudinary = async (
    file: File, 
    folderName: string, 
    setProgress: React.Dispatch<React.SetStateAction<number>>
  ): Promise<string> => {
    // 1. Validation limits (5MB)
    if (file.size > 5 * 1024 * 1024) {
      throw new Error(`File "${file.name}" exceeds the maximum 5MB size limit.`);
    }

    // 2. Pre-compressing file if image
    setProgress(10); // show pre-processing starts
    const preparedFileBlob = await compressImage(file);
    setProgress(25); // compression done

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', 'https://api.cloudinary.com/v1_1/dgwspegi5/upload', true);
      
      const formData = new FormData();
      formData.append('file', preparedFileBlob, file.name.substring(0, file.name.lastIndexOf('.')) + '.jpg');
      formData.append('upload_preset', 'school_registration');
      formData.append('folder', folderName);

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          // Map slider progress values cleanly from 30% to 100%
          const percent = Math.round(30 + (e.loaded / e.total) * 70);
          setProgress(percent);
        }
      });

      xhr.onload = () => {
        if (xhr.status === 200) {
          const res = JSON.parse(xhr.responseText);
          setProgress(100);
          resolve(res.secure_url);
        } else {
          console.error("Cloudinary Error response: ", xhr.responseText);
          reject(new Error("Cloudinary server upload failure"));
        }
      };

      xhr.onerror = () => {
        reject(new Error("Network connection error encountered during upload"));
      };

      xhr.send(formData);
    });
  };

  // Hanlde tracking lookup
  const handleSearchTracking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingId.trim()) return;

    setSearchLoading(true);
    setSearchError('');
    setFoundApp(null);

    const formattedId = trackingId.toUpperCase().trim();
    try {
      const docRef = doc(db, 'registrations', formattedId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setFoundApp(docSnap.data() as Registration);
        showToast('Application record parsed successfully', 'success');
      } else {
        setSearchError('No registration record found for this tracking ID. Please review the spelling or enroll again.');
        showToast('Record not found', 'error');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `registrations/${formattedId}`);
      setSearchError('A systems read error occurred. Check your network or contact admin.');
    } finally {
      setSearchLoading(false);
    }
  };

  // Handle new enrollment submission
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // Field Validations
    if (!fullName.trim() || !age || !sex || !promotedGrade || !average || !paymentMethod) {
      setFormError('Please fill in all general demographic information details.');
      return;
    }

    const avgNum = parseFloat(average);
    if (isNaN(avgNum) || avgNum < 0 || avgNum > 100) {
      setFormError('Averages must be a numeric score bound between 0 and 100.');
      return;
    }

    if (!transcriptFile) {
      setFormError('You must upload an image or PDF of your last year transcript.');
      return;
    }

    if (!receiptFile) {
      setFormError('You must upload a screenshot of your bank transaction receipt.');
      return;
    }

    setLoadingSubmit(true);
    try {
      // Step 1: Upload Transcript to folder transcripts
      showToast('Compiling and uploading Transcript to Cloudinary...', 'info');
      const finalTranscriptUrl = await uploadToCloudinary(
        transcriptFile, 
        'school-registration/transcripts', 
        setTranscriptProgress
      );

      // Step 2: Upload Receipt to folder receipts
      showToast('Processing and uploading Bank Receipt...', 'info');
      const finalReceiptUrl = await uploadToCloudinary(
        receiptFile, 
        'school-registration/receipts', 
        setReceiptProgress
      );

      // Step 3: Generate tracking ID and Save database
      const trackingCode = `CSS-2026-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      
      const payload: Registration = {
        id: trackingCode,
        full_name: fullName.trim(),
        age: Number(age),
        sex: sex as 'Male' | 'Female',
        promoted_grade: Number(promotedGrade),
        average: avgNum,
        transcript_url: finalTranscriptUrl,
        receipt_url: finalReceiptUrl,
        payment_method: paymentMethod as 'CBE' | 'SINQEE BANK' | 'TELEBIRR',
        status: 'Pending Review',
        class_assignment: null,
        rejection_reason: null,
        tracking_id: trackingCode,
        created_at: new Date().toISOString()
      };

      await setDoc(doc(db, 'registrations', trackingCode), payload);

      setSuccessTrackingId(trackingCode);
      showToast('Registration submitted successfully! Please write down your tracking code.', 'success');
      
      // Reset form variables
      setFullName('');
      setAge('');
      setSex('');
      setPromotedGrade('');
      setAverage('');
      setPaymentMethod('');
      setTranscriptFile(null);
      setReceiptFile(null);
      setTranscriptProgress(0);
      setReceiptProgress(0);
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'An error occurred during submission. File sizes may be too large.');
      showToast('Registration failed', 'error');
    } finally {
      setLoadingSubmit(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-8" id="student-main-content">
      {/* Toast Notification element */}
      {toastMsg && (
        <div className={`fixed top-4 right-4 z-50 rounded-lg p-4 shadow-xl border flex items-center gap-2 animate-bounce ${
          toastType === 'success' ? 'bg-emerald-900/90 text-emerald-100 border-emerald-500' :
          toastType === 'error' ? 'bg-rose-950/90 text-rose-100 border-rose-500' :
          'bg-slate-900/90 text-amber-200 border-amber-600/30'
        }`}>
          <Activity className="w-4 h-4 animate-spin text-amber-400" />
          <span className="text-xs font-semibold">{toastMsg}</span>
        </div>
      )}

      {/* Hero section */}
      <div className="bg-gradient-to-br from-[#800000] via-[#5c0000] to-slate-950 rounded-2xl md:rounded-3xl p-6 md:p-12 shadow-2xl relative overflow-hidden text-white border border-[#9d0000]/20 mb-8">
        <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-5 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-400 via-[#800000] to-slate-900" />
        
        <div className="max-w-2xl relative z-10 space-y-4">
          <div className="inline-flex items-center gap-1.5 bg-amber-600/20 text-amber-400 px-3.5 py-1.5 rounded-full text-xs font-semibold border border-amber-500/20 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            Chercher Secondary School Online Portal
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">
            Select Your Future. <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-white">
              Enroll and Learn
            </span>
          </h1>
          <p className="text-sm md:text-base text-slate-300 leading-relaxed max-w-xl">
            Welcome to the Chercher state-of-the-art admissions site. Submit your transcript verification, execute banking fee deposit clearances seamlessly, and get assigned your smart balanced class today.
          </p>

          <div className="flex flex-wrap gap-4 pt-2">
            <button
              onClick={() => {
                setSuccessTrackingId('');
                setIsRegistering(true);
                const el = document.getElementById('registration-section-form');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="bg-amber-600 hover:bg-amber-700 text-slate-950 text-xs font-bold px-6 py-3.5 rounded-xl flex items-center gap-2 transform active:scale-95 transition-all outline-none"
            >
              <span>Enroll Now</span>
              <ArrowRight className="w-4 h-4 text-slate-950" />
            </button>
            <button
              onClick={() => {
                const el = document.getElementById('tracking-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold px-6 py-3.5 rounded-xl cursor-pointer"
            >
              Verify Tracking Status
            </button>
          </div>
        </div>

        <div className="hidden lg:flex items-center absolute right-12 bottom-8 top-8 w-[380px] justify-center text-slate-400/5 hover:text-amber-500/10 cursor-default transition-all duration-1000">
          <School size={280} strokeWidth={0.8} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column (Form & Payments) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Main Registration Form */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl" id="registration-section-form">
            <div className="border-b border-slate-800 pb-4 mb-6">
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-500" />
                Registrar Office Student Enrollment Form
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Provide accurate metrics. Over-crowding class-balance and smart placement will be applied immediately upon approval.
              </p>
            </div>

            {successTrackingId ? (
              <div className="bg-emerald-950/40 border border-emerald-500/20 rounded-xl p-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
                <div className="w-12 h-12 bg-emerald-500 text-slate-950 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10 mb-2">
                  <CheckCircle className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-emerald-200">Application Submitted Clearance</h3>
                <p className="text-xs text-slate-300 max-w-md mx-auto">
                  Your details have been registered into Chercher Secondary School Firestore servers under "Pending Review". Copy or save the secure validation tracker ID below:
                </p>
                
                <div className="inline-flex items-center justify-center gap-2 bg-slate-950 border border-emerald-600/30 rounded-lg px-6 py-3 select-all cursor-pointer hover:border-emerald-500 transition-all">
                  <span className="font-mono text-xl font-bold text-amber-400 tracking-widest">{successTrackingId}</span>
                </div>

                <div className="text-xs text-slate-500 leading-relaxed font-mono">
                  Use this ID in the status tracker block to check for grade placement or rejection feedback. No user password required.
                </div>

                <div className="pt-2">
                  <button 
                    onClick={() => setSuccessTrackingId('')}
                    className="text-xs text-amber-400 hover:text-amber-300 underline font-semibold"
                  >
                    Submit Another Application
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-6">
                {formError && (
                  <div className="bg-rose-950/55 border border-rose-600/30 text-rose-200 p-4 rounded-lg text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      Full Name (English block letters) *
                    </label>
                    <input
                      required
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Kedir Ahmed Mohammed"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-600 transition-all font-sans"
                    />
                  </div>

                  {/* Age */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Age *
                    </label>
                    <input
                      required
                      type="number"
                      min="10"
                      max="25"
                      value={age}
                      onChange={(e) => setAge(e.target.value ? Number(e.target.value) : '')}
                      placeholder="e.g. 16"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-600 transition-all font-sans"
                    />
                  </div>

                  {/* Sex */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Sex *
                    </label>
                    <select
                      required
                      value={sex}
                      onChange={(e) => setSex(e.target.value as 'Male' | 'Female')}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-600 transition-all font-sans"
                    >
                      <option value="">-- Choose Sex --</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>

                  {/* Promoted To Grade */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Promoted To Grade *
                    </label>
                    <select
                      required
                      value={promotedGrade}
                      onChange={(e) => setPromotedGrade(e.target.value as '10' | '11' | '12')}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-600 transition-all font-sans"
                    >
                      <option value="">-- Select Grade --</option>
                      <option value="10">Grade 10</option>
                      <option value="11">Grade 11</option>
                      <option value="12">Grade 12</option>
                    </select>
                  </div>

                  {/* Last Year Average */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-slate-400" />
                      Last Year Average Performance (%) *
                    </label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={average}
                      onChange={(e) => setAverage(e.target.value)}
                      placeholder="e.g. 84.75"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-600 transition-all font-sans"
                    />
                  </div>

                  {/* Payment Network Method */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Clearance Payment Agency *
                    </label>
                    <select
                      required
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as 'CBE' | 'SINQEE BANK' | 'TELEBIRR')}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-600 transition-all font-sans"
                    >
                      <option value="">-- Choose Account Paid --</option>
                      <option value="CBE">CBE (Commercial Bank of Ethiopia)</option>
                      <option value="SINQEE BANK">SINQEE Bank (Oromia coop)</option>
                      <option value="TELEBIRR">Telebirr Wallet</option>
                    </select>
                  </div>
                </div>

                {/* Upload File Selectors */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  
                  {/* Transcript Upload */}
                  <div className="border border-slate-850 bg-slate-950/60 rounded-xl p-4 flex flex-col justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                        <Upload className="w-3.5 h-3.5 text-amber-500" />
                        Verification Transcript Verification File *
                      </span>
                      <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                        Upload last grade results card. PNG, JPG, WEBP, or PDF. Max 5MB file sizes only.
                      </p>
                    </div>

                    <div className="mt-4">
                      {transcriptFile ? (
                        <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded px-3 py-2">
                          <div className="flex items-center gap-2 overflow-hidden mr-2">
                            <FileText className="w-4 h-4 text-amber-500 flex-shrink-0" />
                            <span className="text-[10px] text-slate-300 truncate">{transcriptFile.name}</span>
                          </div>
                          <button 
                            type="button" 
                            onClick={() => { setTranscriptFile(null); setTranscriptProgress(0); }}
                            className="text-slate-550 hover:text-[#ff3b3b] text-[10px]"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <label className="w-full flex flex-col items-center justify-center border-2 border-dashed border-slate-800 hover:border-amber-600/50 bg-slate-950/85 hover:bg-slate-900/60 p-4 rounded-lg cursor-pointer transition-all">
                          <Upload className="w-5 h-5 text-slate-500 mb-1" />
                          <span className="text-[10px] text-slate-400">Choose Transcript document</span>
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                setTranscriptFile(e.target.files[0]);
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                      )}

                      {/* Progress bar */}
                      {transcriptProgress > 0 && (
                        <div className="mt-2 space-y-1">
                          <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-amber-500 h-full transition-all duration-300 animate-pulse" style={{ width: `${transcriptProgress}%` }} />
                          </div>
                          <div className="text-[9.5px] text-slate-500 text-right font-mono">
                            {transcriptProgress === 100 ? 'Clearance Complete!' : `Uploading Process: ${transcriptProgress}%`}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Payment Receipt Upload */}
                  <div className="border border-slate-850 bg-slate-950/60 rounded-xl p-4 flex flex-col justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                        <Upload className="w-3.5 h-3.5 text-amber-500" />
                        Verification Clear Banking Receipt Screenshot *
                      </span>
                      <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                        Screenshot proof of deposit transfer with reference index numbers distinct. PNG, JPG, or PDF. Max 5MB limit.
                      </p>
                    </div>

                    <div className="mt-4">
                      {receiptFile ? (
                        <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded px-3 py-2">
                          <div className="flex items-center gap-2 overflow-hidden mr-2">
                            <FileText className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                            <span className="text-[10px] text-slate-300 truncate">{receiptFile.name}</span>
                          </div>
                          <button 
                            type="button" 
                            onClick={() => { setReceiptFile(null); setReceiptProgress(0); }}
                            className="text-slate-550 hover:text-[#ff3b3b] text-[10px]"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <label className="w-full flex flex-col items-center justify-center border-2 border-dashed border-slate-800 hover:border-amber-600/50 bg-slate-950/85 hover:bg-slate-900/60 p-4 rounded-lg cursor-pointer transition-all">
                          <Upload className="w-5 h-5 text-slate-500 mb-1" />
                          <span className="text-[10px] text-slate-400">Choose Deposit receipt slip</span>
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                setReceiptFile(e.target.files[0]);
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                      )}

                      {/* Progress bar */}
                      {receiptProgress > 0 && (
                        <div className="mt-2 space-y-1">
                          <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-amber-500 h-full transition-all duration-300 animate-pulse" style={{ width: `${receiptProgress}%` }} />
                          </div>
                          <div className="text-[9.5px] text-slate-500 text-right font-mono">
                            {receiptProgress === 100 ? 'Verification Cleared!' : `Uploading Process: ${receiptProgress}%`}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                </div>

                <div className="pt-4 border-t border-slate-800">
                  <button
                    type="submit"
                    disabled={loadingSubmit}
                    className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 disabled:opacity-40 text-slate-950 font-bold py-3.5 rounded-xl transition-all shadow-lg text-xs outline-none uppercase tracking-wider flex items-center justify-center gap-2 transform active:scale-98"
                  >
                    {loadingSubmit ? (
                      <>
                        <Activity className="w-4 h-4 animate-spin text-slate-950" />
                        <span>Uploading Files & Clearing Application... Please hold...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>Submit Secure Application to Registrar Server</span>
                      </>
                    )}
                  </button>
                  <p className="text-[9.5px] text-slate-500 text-center mt-2 font-mono">
                    By submitting, you represent that the transcript is unmanipulated and match physical records perfectly.
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Right column (Checking tracking & Bank Cards) */}
        <div className="space-y-8">
          
          {/* Tracking Lookup Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl" id="tracking-section">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-1.5 mb-2">
              <Search className="w-4 h-4 text-amber-500" />
              Secure Registration Validator Tracker
            </h2>
            <p className="text-[11px] text-slate-400 mb-4 leading-normal">
              No login required. Verify eligibility status, retrieve approved tags, and fetch your assigned classroom section.
            </p>

            <form onSubmit={handleSearchTracking} className="flex gap-2">
              <input
                required
                type="text"
                value={trackingId}
                onChange={(e) => setTrackingId(e.target.value)}
                placeholder="e.g. CSS-2026-F6Y1B2"
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-600 transition-all font-mono uppercase focus:ring-1 focus:ring-amber-500/20"
              />
              <button
                type="submit"
                disabled={searchLoading}
                className="bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded-lg px-3.5 transition-all flex items-center justify-center outline-none"
              >
                {searchLoading ? (
                  <Activity className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </button>
            </form>

            {searchError && (
              <p className="text-[10px] text-[#ff4d4d] bg-[#ff4d4d]/10 border border-[#ff4d4d]/20 p-2.5 rounded mt-3 leading-normal">
                {searchError}
              </p>
            )}

            {foundApp && (
              <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-850 space-y-3.5 text-xs animate-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between border-b border-slate-900 pb-2.5">
                  <div>
                    <h4 className="font-bold text-slate-200">{foundApp.full_name}</h4>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">Grade {foundApp.promoted_grade} • Average: {foundApp.average}%</p>
                  </div>
                  
                  {/* Status Badges */}
                  {foundApp.status === 'Pending Review' && (
                    <span className="bg-amber-600/10 text-amber-500 border border-amber-600/20 px-2.5 py-1 rounded-full text-[10px] font-semibold flex items-center gap-1">
                      <Clock className="w-3 h-3 animate-pulse" />
                      Pending
                    </span>
                  )}
                  {foundApp.status === 'Approved' && (
                    <span className="bg-emerald-600/15 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full text-[10px] font-semibold flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Approved
                    </span>
                  )}
                  {foundApp.status === 'Rejected' && (
                    <span className="bg-rose-600/15 text-rose-400 border border-rose-500/20 px-2.5 py-1 rounded-full text-[10px] font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Rejected
                    </span>
                  )}
                </div>

                {/* Sub-details according to state */}
                {foundApp.status === 'Pending Review' && (
                  <div className="space-y-1 bg-amber-500/5 text-amber-400/90 p-3 rounded-lg border border-amber-500/10 text-[10px] leading-relaxed">
                    Registrars are auditing transcript receipts against physical registers. Classroom placement lists run automatically under smart balance quotas next.
                  </div>
                )}

                {foundApp.status === 'Rejected' && (
                  <div className="bg-rose-500/5 text-rose-400/90 p-3 rounded-lg border border-rose-500/10 text-[10px] leading-relaxed space-y-0.5">
                    <span className="font-semibold block text-[10.5px]">Reason for Rejection:</span>
                    <span>{foundApp.rejection_reason || 'Incomplete banking slip reference.'}</span>
                  </div>
                )}

                {foundApp.status === 'Approved' && (
                  <div className="bg-gradient-to-br from-emerald-500/5 to-slate-950 text-emerald-400/95 p-4 rounded-xl border border-emerald-500/15 text-[10.5px] leading-relaxed">
                    <div className="font-bold flex items-center gap-1 mb-1.5 text-xs text-white">
                      💡 Enrollment Admissions Complete
                    </div>
                    <span>Your transaction reference verified. </span>
                    <div className="mt-2.5 bg-slate-950/80 p-2.5 rounded-lg border border-slate-900 flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400">CURRENT CLASS SECTOR:</span>
                      {foundApp.class_assignment ? (
                        <span className="text-amber-400 font-extrabold text-sm tracking-wider animate-pulse">{foundApp.class_assignment}</span>
                      ) : (
                        <span className="text-slate-500 font-medium">Pending auto-allocation...</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Styled Payment details block */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-amber-400" />
                Chercher Board Payment Channels
              </h2>
              <p className="text-[10px] text-slate-500 mt-1">
                Settle admissions dues via standard channels only. Capture full details with clear indices for registration uploads.
              </p>
            </div>

            {/* Bank Card 1 */}
            <div className="bg-slate-950/80 border border-slate-850 hover:border-slate-800 rounded-xl p-4 transition-all">
              <div className="flex justify-between items-center text-xs mb-2">
                <span className="font-extrabold tracking-wider text-slate-300">Commercial Bank of Ethiopia</span>
                <span className="text-amber-500 font-mono text-[9px] font-bold px-1.5 py-0.5 bg-amber-500/10 rounded">CBE</span>
              </div>
              <div className="font-mono text-base font-bold text-slate-200 tracking-wider">10393930293</div>
              <div className="text-[9px] text-slate-550 mt-1">Beneficiary: CHERCHER SECONDARY BOARD INC</div>
            </div>

            {/* Bank Card 2 */}
            <div className="bg-slate-950/80 border border-slate-850 hover:border-slate-800 rounded-xl p-4 transition-all">
              <div className="flex justify-between items-center text-xs mb-2">
                <span className="font-extrabold tracking-wider text-slate-300">SINQEE BANK</span>
                <span className="text-emerald-400 font-mono text-[9px] font-bold px-1.5 py-0.5 bg-emerald-400/10 rounded">SINQEE</span>
              </div>
              <div className="font-mono text-base font-bold text-slate-200 tracking-wider">2939939393</div>
              <div className="text-[9px] text-slate-550 mt-1">Beneficiary: CHERCHER HIGH EDUCATION CLEARANCE</div>
            </div>

            {/* Bank Card 3 */}
            <div className="bg-slate-950/80 border border-slate-850 hover:border-slate-800 rounded-xl p-4 transition-all">
              <div className="flex justify-between items-center text-xs mb-2">
                <span className="font-extrabold tracking-wider text-slate-300">TELEBIRR PAY</span>
                <span className="text-amber-400 font-mono text-[9px] font-bold px-1.5 py-0.5 bg-amber-400/10 rounded">TELEBIRR</span>
              </div>
              <div className="font-mono text-base font-bold text-slate-200 tracking-wider">3939393939</div>
              <div className="text-[9px] text-slate-550 mt-1">Merchant Pay ID : CHERCHER SCHOOL DEPOSIT ORG</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
