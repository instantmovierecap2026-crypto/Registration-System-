import React, { useState, useEffect, useRef } from 'react';
import { Registration, GradeSetting, Class, AdminLog, DashboardStats, GradeAnalytics } from '../types';
import { 
  Users, CheckCircle2, Clock, XCircle, Search, Filter, Cpu, Sliders, FileSpreadsheet, 
  Trash2, Eye, ShieldAlert, Award, ArrowLeft, RefreshCw, LogOut, ChevronRight, Check,
  Bot, Sparkles, BookOpen, Calendar, HelpCircle, Activity, LayoutDashboard, Database,
  SlidersHorizontal, History, Settings, FileText
} from 'lucide-react';

interface AdminPanelProps {
  adminPassword: string;
  onLogout: () => void;
}

export default function AdminPanel({ adminPassword, onLogout }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'applications' | 'classes' | 'settings' | 'logs'>('dashboard');
  
  // Loaded state arrays
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [gradeSettings, setGradeSettings] = useState<GradeSetting[]>([]);
  const [adminLogs, setAdminLogs] = useState<AdminLog[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modals / Specific Previews
  const [previewStudent, setPreviewStudent] = useState<Registration | null>(null);
  const [previewAttachmentType, setPreviewAttachmentType] = useState<'transcript' | 'receipt' | null>(null);
  const [rejectionModalStudent, setRejectionModalStudent] = useState<Registration | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Sizing inputs
  const [grade10Size, setGrade10Size] = useState<number>(60);
  const [grade11Size, setGrade11Size] = useState<number>(60);
  const [grade12Size, setGrade12Size] = useState<number>(60);

  // Selected class detail view
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [classSearchQuery, setClassSearchQuery] = useState('');

  // AI strategic report
  const [aiReportContent, setAiReportContent] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Toast State
  const [toastPanelMsg, setToastPanelMsg] = useState('');
  const [toastPanelType, setToastPanelType] = useState<'info' | 'success' | 'error'>('info');

  const showToast = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToastPanelMsg(msg);
    setToastPanelType(type);
    setTimeout(() => setToastPanelMsg(''), 4000);
  };

  // Fetch full data suite
  const refreshData = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      // 1. Fetch registrations
      const rRes = await fetch('/api/admin/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword })
      });
      const rData = await rRes.json();
      if (rData.success) setRegistrations(rData.list);

      // 2. Fetch logs
      const lRes = await fetch('/api/admin/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword })
      });
      const lData = await lRes.json();
      if (lData.success) setAdminLogs(lData.list);

      // 3. Fetch classes
      const cRes = await fetch('/api/admin/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword })
      });
      const cData = await cRes.json();
      if (cData.success) setClasses(cData.list);

      // 4. Fetch grade-settings
      const gRes = await fetch('/api/admin/grade-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword })
      });
      const gData = await gRes.json();
      if (gData.success) {
        setGradeSettings(gData.list);
        // Sync custom capacities values
        gData.list.forEach((s: GradeSetting) => {
          if (s.grade === '10') setGrade10Size(s.students_per_class);
          if (s.grade === '11') setGrade11Size(s.students_per_class);
          if (s.grade === '12') setGrade12Size(s.students_per_class);
        });
      }
    } catch (err) {
      setErrorMessage('Server connection error. Failed to retrieve server states.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [adminPassword]);

  // Session Activity tracker to lock admin after 5m inactivity.
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const resetTimeout = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        showToast('Administrative session expired due to inactivity', 'info');
        // Let state change propagate
        setTimeout(() => onLogout(), 1500);
      }, 5 * 60 * 1000); // 5 minutes inactivity
    };

    window.addEventListener('mousemove', resetTimeout);
    window.addEventListener('keypress', resetTimeout);
    resetTimeout();

    return () => {
      window.removeEventListener('mousemove', resetTimeout);
      window.removeEventListener('keypress', resetTimeout);
      clearTimeout(timeout);
    };
  }, []);

  // Compute stats metrics dynamically
  const stats: DashboardStats = React.useMemo(() => {
    const total = registrations.length;
    const pending = registrations.filter(r => r.status === 'Pending Review').length;
    const approved = registrations.filter(r => r.status === 'Approved').length;
    const rejected = registrations.filter(r => r.status === 'Rejected').length;

    const gradeStats: { [grade: string]: GradeAnalytics } = {
      '10': { grade: '10', totalStudents: 0, approvedStudents: 0, maleCount: 0, femaleCount: 0, numberOfClasses: 0 },
      '11': { grade: '11', totalStudents: 0, approvedStudents: 0, maleCount: 0, femaleCount: 0, numberOfClasses: 0 },
      '12': { grade: '12', totalStudents: 0, approvedStudents: 0, maleCount: 0, femaleCount: 0, numberOfClasses: 0 }
    };

    registrations.forEach(r => {
      const gStr = String(r.promoted_grade);
      if (gradeStats[gStr]) {
        gradeStats[gStr].totalStudents += 1;
        if (r.status === 'Approved') {
          gradeStats[gStr].approvedStudents += 1;
          if (r.sex === 'Male') gradeStats[gStr].maleCount += 1;
          else gradeStats[gStr].femaleCount += 1;
        }
      }
    });

    classes.forEach(c => {
      const gStr = String(c.grade);
      if (gradeStats[gStr]) {
        gradeStats[gStr].numberOfClasses += 1;
      }
    });

    return {
      totalStudents: total,
      pendingApplications: pending,
      approvedApplications: approved,
      rejectedApplications: rejected,
      gradeStats
    };
  }, [registrations, classes]);

  // Action: Approve Application
  const handleApprove = async (studentId: string) => {
    try {
      const res = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword, studentId })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Student enrollment approved successfully!', 'success');
        refreshData();
      } else {
        showToast(`Approval failed: ${data.message}`, 'error');
      }
    } catch (err) {
      showToast('Connection error during approval.', 'error');
    }
  };

  // Action: Reject Application
  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectionModalStudent || !rejectionReason.trim()) return;

    try {
      const res = await fetch('/api/admin/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          password: adminPassword, 
          studentId: rejectionModalStudent.id, 
          reason: rejectionReason 
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Rejected student application : ${rejectionModalStudent.full_name}`, 'success');
        setRejectionModalStudent(null);
        setRejectionReason('');
        refreshData();
      } else {
        showToast(`Rejection write failed: ${data.message}`, 'error');
      }
    } catch (err) {
      showToast('Connection error during rejection save.', 'error');
    }
  };

  // Action: Delete Application
  const handleDelete = async (studentId: string) => {
    if (!confirm('Warning: Are you absolutely sure you want to permanently delete this student record? This operation is irreversible.')) return;

    try {
      const res = await fetch('/api/admin/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword, studentId })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Application deleted securely from servers.', 'success');
        setPreviewStudent(null);
        refreshData();
      } else {
        showToast(`Deletion failed: ${data.message}`, 'error');
      }
    } catch (err) {
      showToast('Connection error during delete doc.', 'error');
    }
  };

  // Action: Update grade seat parameters
  const handleSaveSettings = async (grade: string, size: number) => {
    try {
      const res = await fetch('/api/admin/save-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword, grade, students_per_class: size })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Grade ${grade} limit updated to ${size} seats!`, 'success');
        refreshData();
      } else {
        showToast(`Limits config failed: ${data.message}`, 'error');
      }
    } catch (err) {
      showToast('Error syncing grade settings.', 'error');
    }
  };

  // Action: Trigger Backend Smart Balanced Allocator
  const handleTriggerSmartAssignment = async (grade: string) => {
    if (!confirm(`Trigger balanced allocation for Grade ${grade}? This will group students by score metrics, isolate special talent class ${grade}A, and balanced regular buckets by gender.`)) return;

    showToast(`Executing Smart Balanced placement for Grade ${grade}...`, 'info');
    try {
      const res = await fetch('/api/admin/smart-assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword, grade })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Successfully assigned balanced rosters for Grade ${grade}!`, 'success');
        refreshData();
      } else {
        showToast(`Smart allocator failure: ${data.message}`, 'error');
      }
    } catch (err) {
      showToast('Connection error triggering placements.', 'error');
    }
  };

  // Action: Trigger Gemini AI Principal Copilot Strategy assessment
  const generateAICopilotReport = async () => {
    setAiLoading(true);
    setAiReportContent('');
    try {
      const statsSummary = {
        overall: {
          totalRegistered: stats.totalStudents,
          pending: stats.pendingApplications,
          approved: stats.approvedApplications,
          rejected: stats.rejectedApplications
        },
        gradeBreakdowns: {
          Grade10: stats.gradeStats['10'],
          Grade11: stats.gradeStats['11'],
          Grade12: stats.gradeStats['12']
        }
      };

      const res = await fetch('/api/ai/dashboard-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword, statsSummary })
      });
      const data = await res.json();
      if (data.success) {
        setAiReportContent(data.text);
        showToast('Strategic copilot advice compiled successfully!', 'success');
      } else {
        setAiReportContent('Failed to generate report: ' + data.message);
      }
    } catch (err) {
      setAiReportContent('Network error while requesting strategic analytics report.');
    } finally {
      setAiLoading(false);
    }
  };

  // Pure JS CSV exporter with UTF-8 Bom for raw Excel integrity
  const exportToCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) {
      showToast('No record metrics matching parameters to compile CSV.', 'error');
      return;
    }

    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(obj => 
      Object.values(obj).map(val => {
        const cell = val === null || val === undefined ? '' : String(val);
        // Escape characters for CSV strings formats
        if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(',')
    );

    const compiledStr = [headers, ...rows].join('\n');
    const u8Bom = "\uFEFF";
    const blob = new Blob([u8Bom + compiledStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast(`Compiled report "${filename}.csv" downloaded successfully!`, 'success');
  };

  // Filtering Logic for applications list
  const filteredRegistrations = React.useMemo(() => {
    return registrations.filter(r => {
      const matchSearch = r.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          r.tracking_id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchGrade = filterGrade ? String(r.promoted_grade) === filterGrade : true;
      const matchStatus = filterStatus ? r.status === filterStatus : true;
      return matchSearch && matchGrade && matchStatus;
    });
  }, [registrations, searchQuery, filterGrade, filterStatus]);

  // Selected class student lists
  const selectedClassStudents = React.useMemo(() => {
    if (!selectedClass) return [];
    return registrations
      .filter(r => r.class_assignment === selectedClass.class_name)
      .filter(r => r.full_name.toLowerCase().includes(classSearchQuery.toLowerCase()))
      .sort((a, b) => a.full_name.localeCompare(b.full_name)); // Alphabetical sorting as requested!
  }, [selectedClass, registrations, classSearchQuery]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-6" id="admin-main-scope">
      
      {/* Toast Notification element */}
      {toastPanelMsg && (
        <div className={`fixed top-4 right-4 z-50 rounded-lg p-4 shadow-xl border flex items-center gap-2 animate-bounce ${
          toastPanelType === 'success' ? 'bg-emerald-900/90 text-emerald-100 border-emerald-500' :
          toastPanelType === 'error' ? 'bg-rose-950/90 text-rose-100 border-rose-500' :
          'bg-slate-900/90 text-amber-200 border-amber-600/30'
        }`}>
          <Activity className="w-4 h-4 animate-spin text-amber-400" />
          <span className="text-xs font-semibold">{toastPanelMsg}</span>
        </div>
      )}

      {/* Top Header Controls bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-5 mb-6 gap-4 bg-slate-950/40 p-4 rounded-xl">
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-6 h-6 text-amber-500" />
          <div>
            <h1 className="text-lg font-bold text-slate-100">Chercher High Administration System</h1>
            <p className="text-[11px] text-slate-400">Secure registrar core module — Zero-auth front bypass enabled</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={refreshData}
            disabled={loading}
            className="p-2.5 bg-slate-900 hover:bg-slate-855 border border-slate-800 text-slate-300 hover:text-white rounded-lg transition-all outline-none"
            title="Reload Server state documents"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          
          <button
            onClick={onLogout}
            className="bg-rose-950 hover:bg-rose-900 border border-rose-600/30 text-rose-200 text-xs font-semibold px-4 py-2.5 rounded-lg transition-all flex items-center gap-1.5 focus:ring-1 focus:ring-rose-500"
          >
            <LogOut className="w-4 h-4" />
            <span>Close Console</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="bg-rose-950/50 border border-rose-600/20 text-rose-200 p-4 rounded-xl text-xs flex items-center gap-2 mb-6">
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Primary Sidebar Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* Navigation Sidebar */}
        <div className="lg:col-span-1 space-y-2">
          
          {/* Dashboard Tab */}
          <button
            onClick={() => { setActiveTab('dashboard'); setSelectedClass(null); }}
            className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left outline-none ${
              activeTab === 'dashboard' ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-slate-950 shadow-md shadow-amber-600/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Consul Analytics</span>
          </button>

          {/* Applications Tab */}
          <button
            onClick={() => { setActiveTab('applications'); setSelectedClass(null); }}
            className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left outline-none ${
              activeTab === 'applications' ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-slate-950 shadow-md shadow-amber-600/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Student Applications</span>
            <span className="ml-auto bg-slate-950/45 text-amber-500 font-mono text-[9px] px-1.5 py-0.5 rounded font-bold">
              {registrations.length}
            </span>
          </button>

          {/* Classes Tab */}
          <button
            onClick={() => { setActiveTab('classes'); }}
            className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left outline-none ${
              activeTab === 'classes' ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-slate-950 shadow-md shadow-amber-600/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Placement & Classes</span>
            <span className="ml-auto bg-slate-950/45 text-amber-500 font-mono text-[9px] px-1.5 py-0.5 rounded font-bold text-slate-400">
              {classes.length}
            </span>
          </button>

          {/* Logs Tab */}
          <button
            onClick={() => { setActiveTab('logs'); setSelectedClass(null); }}
            className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left outline-none relative overflow-hidden ${
              activeTab === 'logs' ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-slate-950 shadow-md shadow-amber-600/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Access Audit Logs</span>
          </button>

        </div>

        {/* Content body panels */}
        <div className="lg:col-span-4 min-h-[500px]">
          
          {/* TAB 1: ANALYTICS DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* Statistic Cards Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Stat 1: Total registrations */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase font-mono text-slate-500">Demographic Registry</p>
                    <h3 className="text-xl font-black text-slate-100 mt-1">{stats.totalStudents}</h3>
                    <p className="text-[9px] text-slate-400 mt-0.5">Fully saved records</p>
                  </div>
                  <div className="p-2.5 bg-slate-950 text-amber-400 rounded-lg">
                    <Users className="w-4 h-4" />
                  </div>
                </div>

                {/* Stat 2: Pending registrations */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase font-mono text-slate-500">Pipeline Pending</p>
                    <h3 className="text-xl font-black text-amber-500 mt-1">{stats.pendingApplications}</h3>
                    <p className="text-[9px] text-slate-400 mt-0.5">Awaiting verification</p>
                  </div>
                  <div className="p-2.5 bg-slate-950 text-amber-500 rounded-lg animate-pulse">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>

                {/* Stat 3: Approved ones */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase font-mono text-slate-500">Approved Cleared</p>
                    <h3 className="text-xl font-black text-emerald-500 mt-1">{stats.approvedApplications}</h3>
                    <p className="text-[9px] text-slate-400 mt-0.5">Fees and metrics verified</p>
                  </div>
                  <div className="p-2.5 bg-slate-950 text-emerald-500 rounded-lg">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>

                {/* Stat 4: Rejected ones */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase font-mono text-slate-500">Validation Denied</p>
                    <h3 className="text-xl font-black text-rose-500 mt-1">{stats.rejectedApplications}</h3>
                    <p className="text-[9px] text-slate-400 mt-0.5">Discarded credentials</p>
                  </div>
                  <div className="p-2.5 bg-slate-950 text-rose-500 rounded-lg">
                    <XCircle className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* CSV Export All tools */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-center md:text-left">
                  <h4 className="text-sm font-bold text-slate-200">Export Institutional Records Database</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Export student lists parameters structured cleanly into spreadsheet Excel formats.</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => exportToCSV(registrations, 'Chercher_Secondary_Entire_School')}
                    className="bg-amber-600 hover:bg-amber-700 text-slate-950 px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Entire Institutional Registry</span>
                  </button>
                </div>
              </div>

              {/* Grade-based specification Bento section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {['10', '11', '12'].map((gKey) => {
                  const gStat = stats.gradeStats[gKey];
                  return (
                    <div key={gKey} className="bg-slate-900 border border-slate-800 hover:border-slate-750 rounded-2xl p-5 space-y-4 transition-all">
                      <div className="flex justify-between items-center border-b border-slate-850 pb-2.5">
                        <span className="font-extrabold text-base text-slate-100">Grade {gKey} Cohort</span>
                        <span className="bg-slate-950 text-amber-500 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-600/10">COHORT PROFILE</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                        <div>
                          <p className="text-slate-500 text-[10px] uppercase font-sans">Total Registrants</p>
                          <p className="text-sm font-black text-slate-300 mt-0.5">{gStat.totalStudents}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-[10px] uppercase font-sans">Approved Cleared</p>
                          <p className="text-sm font-black text-emerald-400 mt-0.5">{gStat.approvedStudents}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-[10px] uppercase font-sans">Male / Female Ratio</p>
                          <p className="text-[11.5px] text-slate-300 mt-0.5">
                            ♂️{gStat.maleCount} : ♀️{gStat.femaleCount}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-[10px] uppercase font-sans">Formed Classes</p>
                          <p className="text-sm font-black text-amber-400 mt-0.5">{gStat.numberOfClasses}</p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-850 flex items-center justify-between">
                        <button
                          onClick={() => {
                            const gradeRegistrants = registrations.filter(r => String(r.promoted_grade) === gKey);
                            exportToCSV(gradeRegistrants, `Chercher_Secondary_Grade_${gKey}`);
                          }}
                          className="bg-slate-950 hover:bg-slate-950 border border-slate-800 text-slate-300 px-3 py-1.5 rounded-lg text-[9.5px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <FileSpreadsheet className="w-3 h-3 text-emerald-500" />
                          <span>Export Grade CSV</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* AI strategic report summary section */}
              <div className="bg-[#1a1200] border border-amber-600/15 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-amber-600/10 pb-3">
                  <div className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-amber-400 animate-pulse" />
                    <div>
                      <h4 className="text-sm font-black text-amber-300">Principal Strategic academic AI Copilot Assistant</h4>
                      <p className="text-[10px] text-amber-400/60 mt-0.5">Advanced strategical cohort reporting on gender proportions & class load sizes</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={generateAICopilotReport}
                    disabled={aiLoading}
                    className="bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-slate-950 text-xs font-black px-4 py-2 rounded-xl flex items-center gap-1 shadow-md shadow-amber-600/5 cursor-pointer outline-none active:scale-95 transition-all"
                  >
                    {aiLoading ? (
                      <>
                        <Activity className="w-3.5 h-3.5 animate-spin" />
                        <span>Compiling Advice...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Consult Insights report</span>
                      </>
                    )}
                  </button>
                </div>

                {aiReportContent ? (
                  <div className="bg-slate-950/80 rounded-xl p-5 border border-amber-500/10 max-h-[400px] overflow-y-auto leading-relaxed text-xs text-slate-200 font-sans space-y-3 prose-dark">
                    <div className="whitespace-pre-wrap">{aiReportContent}</div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-450 text-xs leading-normal font-mono">
                    💡 Click the consultant button above to analyze cohort registrations counts and gender disproportions.
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: APPLICATIONS LIST TABLE */}
          {activeTab === 'applications' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* Row Search Filter block */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center">
                
                {/* Query Search */}
                <div className="flex-1 w-full relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    placeholder="Search by full applicant name, tracking ID..."
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-600 transition-all font-sans"
                  />
                </div>

                {/* Select grade details */}
                <div className="w-full md:w-40 flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                  <select
                    value={filterGrade}
                    onChange={(e) => { setFilterGrade(e.target.value); setCurrentPage(1); }}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-600 font-sans"
                  >
                    <option value="">All Cohorts</option>
                    <option value="10">Grade 10</option>
                    <option value="11">Grade 11</option>
                    <option value="12">Grade 12</option>
                  </select>
                </div>

                {/* Select state values */}
                <div className="w-full md:w-44 flex items-center gap-2">
                  <select
                    value={filterStatus}
                    onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-600 font-sans"
                  >
                    <option value="">All States</option>
                    <option value="Pending Review">Pending Review</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>

              </div>

              {/* Document Registry Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold font-sans">
                        <th className="p-4">Student Profile Details</th>
                        <th className="p-4">Tracking Code</th>
                        <th className="p-4">Grade</th>
                        <th className="p-4 text-center">Score Avg</th>
                        <th className="p-4">Status & Action</th>
                        <th className="p-4 text-right">Attachments</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300 whitespace-nowrap">
                      {filteredRegistrations.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-550 italic font-mono">
                            No student applications registrations found matching criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredRegistrations
                          .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                          .map((r) => (
                            <tr key={r.id} className="hover:bg-slate-850/30 transition-all font-sans">
                              {/* Student Detail Column */}
                              <td className="p-4">
                                <div className="font-bold text-slate-150">{r.full_name}</div>
                                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                  Age: {r.age} • Gender: {r.sex}
                                </div>
                              </td>

                              {/* Tracking ID */}
                              <td className="p-4 font-mono font-bold text-amber-500 tracking-wider">
                                {r.tracking_id}
                              </td>

                              {/* Cohort promoted */}
                              <td className="p-4 font-semibold text-slate-400">
                                Grade {r.promoted_grade}
                              </td>

                              {/* Averages */}
                              <td className="p-4 text-center font-mono font-bold text-slate-100">
                                {r.average}%
                              </td>

                              {/* State badge / Control Approve Reject */}
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  {r.status === 'Pending Review' ? (
                                    <>
                                      <button
                                        onClick={() => handleApprove(r.id)}
                                        className="bg-emerald-950 text-emerald-400 hover:bg-emerald-900 border border-emerald-600/30 font-bold px-2.5 py-1.5 rounded text-[10px] cursor-pointer"
                                      >
                                        Approve
                                      </button>
                                      <button
                                        onClick={() => setRejectionModalStudent(r)}
                                        className="bg-rose-950 text-rose-400 hover:bg-rose-900 border border-rose-600/30 font-bold px-2.5 py-1.5 rounded text-[10px] cursor-pointer"
                                      >
                                        Reject
                                      </button>
                                    </>
                                  ) : (
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                      r.status === 'Approved' ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-500/20' : 'bg-rose-600/15 text-rose-400 border border-rose-500/20'
                                    }`}>
                                      {r.status === 'Approved' ? <Check className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                      {r.status}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Image Preview links right */}
                              <td className="p-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => { setPreviewStudent(r); setPreviewAttachmentType('transcript'); }}
                                    className="p-1.5 hover:bg-slate-800 hover:text-white rounded text-slate-400 transition-all cursor-pointer"
                                    title="View student transcript results card"
                                  >
                                    <Eye className="w-4 h-4 text-amber-500" />
                                  </button>
                                  <button
                                    onClick={() => { setPreviewStudent(r); setPreviewAttachmentType('receipt'); }}
                                    className="p-1.5 hover:bg-slate-800 hover:text-white rounded text-slate-400 transition-all cursor-pointer"
                                    title="Inspect clear deposit banking screenshot"
                                  >
                                    <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(r.id)}
                                    className="p-1.5 hover:bg-rose-950/40 hover:text-rose-500 rounded text-slate-600 transition-all cursor-pointer"
                                    title="Permanently remove application record"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Table Control pagination footer list */}
                {filteredRegistrations.length > itemsPerPage && (
                  <div className="bg-slate-950/60 p-4 border-t border-slate-800 flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-mono">
                      Showing records {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredRegistrations.length)} of {filteredRegistrations.length} matching
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-2.5 py-1 bg-slate-900 border border-slate-800 hover:bg-slate-855 rounded text-slate-300 disabled:opacity-40"
                      >
                        Prev
                      </button>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredRegistrations.length / itemsPerPage), p + 1))}
                        disabled={currentPage * itemsPerPage >= filteredRegistrations.length}
                        className="px-2.5 py-1 bg-slate-900 border border-slate-800 hover:bg-slate-855 rounded text-slate-300 disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 3: PLACEMENTS AND CLASSES SECTIONS */}
          {activeTab === 'classes' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* Placement config panel and smart assign actions split */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Sizing Capacity configs Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="border-b border-slate-850 pb-2 mb-2">
                    <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                      <Settings className="w-4 h-4 text-amber-500" />
                      Class Target Sizing Capacity
                    </span>
                    <p className="text-[10px] text-slate-500 mt-1">Configure student seats limits per section class.</p>
                  </div>

                  {/* Grade 10 limits */}
                  <div className="flex items-center justify-between text-xs gap-3">
                    <span className="text-slate-400 font-sans">Grade 10 class limit:</span>
                    <div className="flex gap-1.5 items-center">
                      <input
                        type="number"
                        value={grade10Size}
                        onChange={(e) => setGrade10Size(Number(e.target.value))}
                        className="w-16 bg-slate-950 border border-slate-850 rounded px-2.5 py-1 font-mono text-center text-amber-400 outline-none"
                      />
                      <button
                        onClick={() => handleSaveSettings('10', grade10Size)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded cursor-pointer"
                      >
                        Set
                      </button>
                    </div>
                  </div>

                  {/* Grade 11 limits */}
                  <div className="flex items-center justify-between text-xs gap-3">
                    <span className="text-slate-400 font-sans">Grade 11 class limit:</span>
                    <div className="flex gap-1.5 items-center">
                      <input
                        type="number"
                        value={grade11Size}
                        onChange={(e) => setGrade11Size(Number(e.target.value))}
                        className="w-16 bg-slate-950 border border-slate-850 rounded px-2.5 py-1 font-mono text-center text-amber-400 outline-none"
                      />
                      <button
                        onClick={() => handleSaveSettings('11', grade11Size)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded cursor-pointer"
                      >
                        Set
                      </button>
                    </div>
                  </div>

                  {/* Grade 12 limits */}
                  <div className="flex items-center justify-between text-xs gap-3">
                    <span className="text-slate-400 font-sans">Grade 12 class limit:</span>
                    <div className="flex gap-1.5 items-center">
                      <input
                        type="number"
                        value={grade12Size}
                        onChange={(e) => setGrade12Size(Number(e.target.value))}
                        className="w-16 bg-slate-950 border border-slate-850 rounded px-2.5 py-1 font-mono text-center text-amber-400 outline-none"
                      />
                      <button
                        onClick={() => handleSaveSettings('12', grade12Size)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded cursor-pointer"
                      >
                        Set
                      </button>
                    </div>
                  </div>
                </div>

                {/* Smart Allocator System parameters buttons */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 md:col-span-2">
                  <div className="border-b border-slate-850 pb-2 mb-2">
                    <h3 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                      <Cpu className="w-4 h-4 text-amber-500 animate-pulse" />
                      Smart Balanced Gender auto-placement engine
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-1">Execute the placement. It groups approved students, balances gender ratios, and targets class capacities.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    {/* Run 10 */}
                    <button
                      onClick={() => handleTriggerSmartAssignment('10')}
                      className="bg-slate-950 hover:bg-slate-900 text-slate-200 border border-slate-800 px-4 py-3.5 rounded-xl transition-all flex flex-col items-center justify-center space-y-1 group hover:border-amber-500/50 cursor-pointer text-xs"
                    >
                      <span className="font-extrabold group-hover:text-amber-400 transition-all">Placement Grade 10</span>
                      <span className="text-[10px] text-slate-500 mt-1 font-mono">Limit = {grade10Size} seat/s</span>
                    </button>

                    {/* Run 11 */}
                    <button
                      onClick={() => handleTriggerSmartAssignment('11')}
                      className="bg-slate-950 hover:bg-slate-900 text-slate-200 border border-slate-800 px-4 py-3.5 rounded-xl transition-all flex flex-col items-center justify-center space-y-1 group hover:border-amber-500/50 cursor-pointer text-xs"
                    >
                      <span className="font-extrabold group-hover:text-amber-400 transition-all">Placement Grade 11</span>
                      <span className="text-[10px] text-slate-500 mt-1 font-mono">Limit = {grade11Size} seat/s</span>
                    </button>

                    {/* Run 12 */}
                    <button
                      onClick={() => handleTriggerSmartAssignment('12')}
                      className="bg-slate-950 hover:bg-slate-900 text-slate-200 border border-slate-800 px-4 py-3.5 rounded-xl transition-all flex flex-col items-center justify-center space-y-1 group hover:border-amber-500/50 cursor-pointer text-xs"
                    >
                      <span className="font-extrabold group-hover:text-amber-400 transition-all">Placement Grade 12</span>
                      <span className="text-[10px] text-slate-500 mt-1 font-mono">Limit = {grade12Size} seat/s</span>
                    </button>
                  </div>
                </div>

              </div>

              {/* Formed roster cards lists */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5 border-b border-slate-850 pb-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  Formed Class Sections spec
                </h3>

                {selectedClass ? (
                  // Detail specific Class students lists
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 animate-in zoom-in-95 duration-150">
                    <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-850 pb-3 gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setSelectedClass(null); setClassSearchQuery(''); }}
                          className="p-1.5 bg-slate-950 border border-slate-850 text-slate-400 hover:text-white rounded cursor-pointer"
                        >
                          <ArrowLeft className="w-4 h-4" />
                        </button>
                        <div>
                          <h4 className="font-bold text-slate-100 flex items-center gap-1.5">
                            Class Section: {selectedClass.class_name} ({selectedClass.class_type})
                          </h4>
                          <p className="text-[10px] text-slate-500 font-mono">
                            Total Students Clear: {selectedClassStudents.length} • Grade {selectedClass.grade}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          value={classSearchQuery}
                          onChange={(e) => setClassSearchQuery(e.target.value)}
                          placeholder="Filter class roster by name..."
                          className="bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 outline-none w-52 focus:border-amber-600"
                        />
                        <button
                          onClick={() => {
                            const trimmedData = selectedClassStudents.map(s => ({
                              full_name: s.full_name,
                              sex: s.sex,
                              age: s.age,
                              average: s.average,
                            }));
                            exportToCSV(trimmedData, `Chercher_Secondary_Class_${selectedClass.class_name}_Roster`);
                          }}
                          className="bg-amber-600 hover:bg-amber-700 text-slate-950 px-3.5 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          <span>Export Class CSV</span>
                        </button>
                      </div>
                    </div>

                    {/* Class List Table */}
                    <div className="overflow-x-auto border border-slate-850 rounded-lg">
                      <table className="w-full text-left text-xs border-collapse font-sans">
                        <thead>
                          <tr className="bg-slate-950/60 text-slate-500 font-semibold border-b border-slate-850">
                            <th className="p-3">Rank No.</th>
                            <th className="p-3">Student Name</th>
                            <th className="p-3">Sex</th>
                            <th className="p-3">Age</th>
                            <th className="p-3 text-right">Academic Score Average</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850 text-slate-300">
                          {selectedClassStudents.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-6 text-center text-slate-550 italic font-mono">
                                No roster students match search query parameters.
                              </td>
                            </tr>
                          ) : (
                            selectedClassStudents.map((s, idx) => (
                              <tr key={s.id} className="hover:bg-slate-850/20 transition-all">
                                <td className="p-3 font-mono text-slate-500 font-medium">{idx + 1}</td>
                                <td className="p-3 font-bold text-slate-250">{s.full_name}</td>
                                <td className="p-3 text-slate-400">{s.sex}</td>
                                <td className="p-3 text-slate-400 font-mono">{s.age} y/o</td>
                                <td className="p-3 text-right font-mono font-bold text-amber-500">{s.average}%</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  // B_Grid lists Classes cards
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {classes.length === 0 ? (
                      <p className="p-6 text-[11px] text-slate-500 font-mono italic md:col-span-4">
                        No class records placed yet. Trigger placement allocations in the card above.
                      </p>
                    ) : (
                      classes.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => setSelectedClass(c)}
                          className="bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 rounded-xl p-4.5 cursor-pointer transition-all space-y-2 flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-extrabold text-base text-slate-100">{c.class_name}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-bold ${
                                c.class_type === 'Special' ? 'bg-amber-400/10 text-amber-400 border border-amber-500/20' : 'bg-slate-850 text-slate-400'
                              }`}>{c.class_type}</span>
                            </div>
                            <p className="text-[10px] text-slate-500 font-mono mt-1">Grade {c.grade} Program</p>
                          </div>

                          <div className="flex items-center justify-between text-xs font-mono pt-3 border-t border-slate-900">
                            <span className="text-slate-450 text-[10px]">ROSTER SIZE:</span>
                            <span className="font-bold text-slate-200">{c.total_students} student/s</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 4: SYSTEM AUDIT LOGGER */}
          {activeTab === 'logs' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="border-b border-slate-850 pb-2">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-rose-500" />
                  Intruder and access audit tracker
                </h3>
                <p className="text-[10px] text-slate-500 mt-1">
                  Chronological records. Track security, brute force locking trigger attempts, and registrations modifications.
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden font-mono text-[10.5px]">
                <div className="max-h-[500px] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-950 border-b border-slate-800 text-slate-500 ">
                        <th className="p-3">Timestamp Clock</th>
                        <th className="p-3">Audit Details Action Log</th>
                        <th className="p-3 text-right">Access IP Context</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 text-slate-350">
                      {adminLogs.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="p-6 text-center italic text-slate-550">
                            No security activities registered on servers.
                          </td>
                        </tr>
                      ) : (
                        adminLogs.map((log, index) => (
                          <tr key={index} className="hover:bg-slate-850/20">
                            <td className="p-3 text-slate-450 whitespace-nowrap">
                              {new Date(log.timestamp).toLocaleString('en-US', { timeZone: 'UTC' })}
                            </td>
                            <td className={`p-3 font-semibold ${
                              log.action.includes('SUCCESS') ? 'text-emerald-400' :
                              log.action.includes('FAIL') || log.action.includes('LOCKED') ? 'text-rose-400' : 'text-slate-300'
                            }`}>
                              {log.action}
                            </td>
                            <td className="p-3 text-right text-slate-500 whitespace-nowrap">
                              {log.ip_address}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>
      </div>

      {/* MODAL WINDOW 1: IMAGE & ATTACHMENT PREVIEWS */}
      {previewStudent && previewAttachmentType && (
        <div className="fixed inset-0 z-55 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 animate-in zoom-in-95 duration-150 relative">
            <button
              onClick={() => { setPreviewStudent(null); setPreviewAttachmentType(null); }}
              className="absolute right-4 top-4 text-slate-500 hover:text-white p-1 rounded-full bg-slate-950"
            >
              <XCircle className="w-6 h-6" />
            </button>

            <div className="border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-slate-200">
                Attachment: {previewAttachmentType === 'transcript' ? 'Report Card Transcript' : 'Banking Fee Clear screenshot'}
              </h3>
              <p className="text-[10.5px] text-slate-500 mt-1 font-mono">
                Student Name: {previewStudent.full_name} • ID: {previewStudent.tracking_id}
              </p>
            </div>

            {/* Container */}
            <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-850 flex items-center justify-center min-h-[350px] max-h-[480px]">
              {(() => {
                const targetUrl = previewAttachmentType === 'transcript' ? previewStudent.transcript_url : previewStudent.receipt_url;
                if (targetUrl.toLowerCase().endsWith('.pdf')) {
                  return (
                    <div className="text-center p-6 space-y-2">
                      <FileText className="w-12 h-12 text-amber-500 mx-auto" />
                      <p className="text-xs text-slate-400">PDF document is uploaded. You can view or download it via the link below.</p>
                      <a 
                        href={targetUrl} 
                        target="_blank" 
                        rel="referrer" 
                        className="inline-block bg-amber-600 hover:bg-amber-700 text-slate-950 px-4 py-2 rounded font-bold text-xs"
                      >
                        Open PDF in New Window
                      </a>
                    </div>
                  );
                } else {
                  return (
                    <img
                      src={targetUrl}
                      alt="Student uploaded attachment"
                      referrerPolicy="no-referrer"
                      className="max-w-full max-h-[450px] object-contain"
                    />
                  );
                }
              })()}
            </div>

            <div className="flex justify-between items-center pt-2">
              <a
                href={previewAttachmentType === 'transcript' ? previewStudent.transcript_url : previewStudent.receipt_url}
                target="_blank"
                rel="referrer"
                className="text-amber-500 hover:text-amber-400 text-xs font-semibold underline flex items-center gap-1"
              >
                <span>Download attachment index</span>
              </a>
              <button
                onClick={() => { setPreviewStudent(null); setPreviewAttachmentType(null); }}
                className="bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL WINDOW 2: REJECTION REASON PROMPT */}
      {rejectionModalStudent && (
        <div className="fixed inset-0 z-55 bg-slate-950/80 flex items-center justify-center p-4">
          <form onSubmit={handleRejectSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-slate-100">Reject Application: {rejectionModalStudent.full_name}</h3>
              <p className="text-[10px] text-slate-500 mt-1">Specify rejection indicators to student dashboard tracker.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-300">Specify reason for rejection *</label>
              <textarea
                required
                rows={4}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Incomplete transcript records, or CBE banking screenshot reference doesn't match dues."
                className="w-full bg-slate-950 border border-slate-8xx border-slate-800 rounded-lg p-3 text-xs text-slate-200 placeholder:text-slate-650 focus:outline-none focus:border-rose-600 transition-all font-sans"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setRejectionModalStudent(null); setRejectionReason(''); }}
                className="bg-slate-850 hover:bg-slate-800 text-slate-300 px-4 py-2 rounded-lg text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-rose-950 text-rose-400 hover:bg-rose-900 border border-rose-600/30 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                Confirm Rejection
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
