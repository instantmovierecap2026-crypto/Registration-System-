import React, { useState } from 'react';
import StudentPanel from './components/StudentPanel';
import AdminPanel from './components/AdminPanel';
import AIAssistant from './components/AIAssistant';
import { School, ShieldAlert, Lock, ArrowRight, ShieldCheck, HelpCircle } from 'lucide-react';

export default function App() {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [verifiedPassword, setVerifiedPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);

  // Trigger server authentication check (highly secured brute-force proxy)
  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);

    try {
      const response = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: passwordInput })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setVerifiedPassword(passwordInput);
        setIsAdminMode(true);
        setShowLoginModal(false);
        setPasswordInput('');
      } else {
        setLoginError(data.message || 'Incorrect password verification. Lockout counters applied.');
      }
    } catch (err: any) {
      setLoginError('Server network offline. Make sure the backend dev server is active.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogout = () => {
    setVerifiedPassword('');
    setIsAdminMode(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col justify-between">
      
      {/* Top Banner Navigation */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30">
        <div className="w-full max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-600/10 text-amber-500 rounded-lg border border-amber-600/10">
              <School className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold tracking-tight text-white block text-sm">Chercher Secondary School</span>
              <span className="text-[10px] text-amber-500 font-semibold uppercase tracking-wider block -mt-0.5">Academic Portal</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {isAdminMode ? (
              <button
                onClick={handleAdminLogout}
                className="bg-slate-900 hover:bg-slate-850 text-slate-300 text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer transition-all border border-slate-800"
              >
                Exit Administrator mode
              </button>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="bg-amber-600 hover:bg-amber-700 text-slate-950 text-xs font-extrabold px-4 py-2 rounded-lg cursor-pointer transition-all uppercase tracking-wider"
              >
                Administrative Access
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container Area */}
      <main className="flex-1">
        {isAdminMode ? (
          <AdminPanel 
            adminPassword={verifiedPassword} 
            onLogout={handleAdminLogout} 
          />
        ) : (
          <StudentPanel />
        )}
      </main>

      {/* Modern Institutional Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-8 mt-12 text-slate-500 text-xs">
        <div className="w-full max-w-7xl mx-auto px-4 md:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <School className="w-4 h-4 text-slate-650" />
            <span className="font-semibold text-slate-400">Chercher Secondary School • Enrollment System</span>
          </div>
          <div className="text-center md:text-right text-[10.5px]">
            <span>© 2026 Chercher Secondary. Built for offline-first scalability under strict security controls on Cloud Run container services.</span>
          </div>
        </div>
      </footer>

      {/* Interactive Floating AI Chat Assistant */}
      {!isAdminMode && <AIAssistant />}

      {/* SECURE ADMIN LOGIN MODAL */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95 duration-200 relative shadow-2xl">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-amber-600/10 border border-amber-600/20 text-amber-500 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <Lock className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-base font-extrabold text-slate-100">Registrar Verification Security Panel</h3>
              <p className="text-xs text-slate-400">
                Provide secure credentials to enter the balanced student placement and admissions control center.
              </p>
            </div>

            <form onSubmit={handleVerifyPassword} className="space-y-4">
              {loginError && (
                <div className="bg-rose-950/60 border border-rose-500/20 p-3 rounded-lg text-xs text-rose-300 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  <span className="leading-snug">{loginError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Access Key Password</label>
                <input
                  required
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 placeholder:text-slate-750 focus:outline-none focus:border-amber-600 font-mono tracking-widest text-center"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowLoginModal(false);
                    setPasswordInput('');
                    setLoginError('');
                  }}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-slate-950 py-2.5 rounded-lg text-xs font-bold transition-all uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Unlock</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
