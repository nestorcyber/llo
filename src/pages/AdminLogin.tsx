import React, { useState } from 'react';
import { Shield, Lock, Mail, ArrowLeft, AlertCircle, KeyRound, Check } from 'lucide-react';
import { StaffProfile, StaffRole } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { dataStore } from '../lib/data-store';
import niforixLogo from '../assets/niforix-logo.png';

interface Props {
  onLoginSuccess: (user: StaffProfile) => void;
  onBackToVolunteerPage: () => void;
}

const STAFF_PASSWORDS: Record<string, string> = {
  'admin@llo.com': 'adminllo',
  'manager@llo.com': 'managerllo',
  'viewer@llo.com': 'viewerllo',
  // Backward compatibility aliases
  'owner@llowerri.org': 'adminllo',
  'manager@llowerri.org': 'managerllo',
  'viewer@llowerri.org': 'viewerllo',
};

export const AdminLogin: React.FC<Props> = ({ onLoginSuccess, onBackToVolunteerPage }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();

    try {
      if (isSupabaseConfigured && supabase) {
        // Authenticate with Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (authError) {
          setError(authError.message);
          setLoading(false);
          return;
        }

        if (authData.user) {
          // Fetch staff profile
          const { data: profile, error: profError } = await supabase
            .from('staff_profiles')
            .select('*')
            .eq('id', authData.user.id)
            .maybeSingle();

          if (profError || !profile) {
            setError('Account authenticated, but no staff profile is assigned. Please contact the system owner.');
            setLoading(false);
            return;
          }

          if (!profile.is_active) {
            setError('This staff account has been deactivated.');
            setLoading(false);
            return;
          }

          onLoginSuccess(profile);
          return;
        }
      }

      // Offline / Local Development authentication check
      const staffList = dataStore.getStaff();
      const matched = staffList.find(s => s.email.toLowerCase() === normalizedEmail);

      if (!matched) {
        setError(`No staff member found with email "${email}". Available accounts: admin@llo.com, manager@llo.com, viewer@llo.com.`);
        setLoading(false);
        return;
      }

      if (!matched.is_active) {
        setError('This staff account has been deactivated.');
        setLoading(false);
        return;
      }

      // Verify assigned password
      const expectedPassword =
        STAFF_PASSWORDS[normalizedEmail] ||
        (matched.role === 'owner' ? 'adminllo' : `${matched.role}llo`);

      if (password !== expectedPassword) {
        setError(`Incorrect password for ${email}. (Password format: adminllo for admin, managerllo for manager)`);
        setLoading(false);
        return;
      }

      onLoginSuccess(matched);
    } catch (err: any) {
      setError(err?.message || 'Authentication error.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillCredentials = (staffEmail: string, staffRole: StaffRole) => {
    setError(null);
    setEmail(staffEmail);
    const pwd = STAFF_PASSWORDS[staffEmail] || (staffRole === 'owner' ? 'adminllo' : `${staffRole}llo`);
    setPassword(pwd);
  };

  const handleQuickDemoLogin = (role: StaffRole) => {
    const staffList = dataStore.getStaff();
    const matched = staffList.find(s => s.role === role);
    if (matched) {
      setEmail(matched.email);
      const pwd = STAFF_PASSWORDS[matched.email] || (role === 'owner' ? 'adminllo' : `${role}llo`);
      setPassword(pwd);
      onLoginSuccess(matched);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center px-4 py-8 font-sans">
      <div className="w-full max-w-md">
        <button
          onClick={onBackToVolunteerPage}
          className="text-xs text-slate-400 hover:text-white flex items-center space-x-1.5 mb-6 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Volunteer Check-in</span>
        </button>

        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-linkedin flex items-center justify-center mx-auto mb-3 shadow-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h1 className="font-heading text-xl font-bold text-white">Administrator Portal</h1>
            <p className="text-xs text-slate-400 mt-1">LinkedIn Local Owerri Operations Team</p>
          </div>

          {/* Quick Credentials Info Box */}
          <div className="mb-6 p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-xs">
            <div className="flex items-center space-x-1.5 text-slate-300 font-bold mb-2">
              <KeyRound className="w-3.5 h-3.5 text-linkedin-light" />
              <span>Available Staff Accounts (Click to Fill):</span>
            </div>
            <div className="space-y-1.5 font-mono text-[11px]">
              <div
                onClick={() => handleFillCredentials('admin@llo.com', 'owner')}
                className="flex items-center justify-between p-1.5 rounded hover:bg-slate-800 cursor-pointer transition text-slate-300 hover:text-white"
              >
                <span>Admin: <strong className="text-amber-400">admin@llo.com</strong></span>
                <span className="text-slate-400">pwd: <code className="text-white">adminllo</code></span>
              </div>
              <div
                onClick={() => handleFillCredentials('manager@llo.com', 'manager')}
                className="flex items-center justify-between p-1.5 rounded hover:bg-slate-800 cursor-pointer transition text-slate-300 hover:text-white"
              >
                <span>Manager: <strong className="text-blue-400">manager@llo.com</strong></span>
                <span className="text-slate-400">pwd: <code className="text-white">managerllo</code></span>
              </div>
              <div
                onClick={() => handleFillCredentials('viewer@llo.com', 'viewer')}
                className="flex items-center justify-between p-1.5 rounded hover:bg-slate-800 cursor-pointer transition text-slate-300 hover:text-white"
              >
                <span>Viewer: <strong className="text-emerald-400">viewer@llo.com</strong></span>
                <span className="text-slate-400">pwd: <code className="text-white">viewerllo</code></span>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-5 p-3.5 bg-red-900/40 border border-red-700/50 rounded-xl flex items-start space-x-2.5 text-red-200 text-xs animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Staff Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@llo.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:border-linkedin focus:ring-1 focus:ring-linkedin"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="adminllo"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:border-linkedin focus:ring-1 focus:ring-linkedin"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-linkedin hover:bg-linkedin-dark text-white font-heading font-bold rounded-xl text-sm shadow transition flex items-center justify-center space-x-2 shadow-linkedin/20"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In as Administrator'}</span>
            </button>
          </form>

          {/* Direct One-Click Role Login */}
          <div className="mt-8 pt-6 border-t border-slate-700">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2.5 text-center">
              Instant One-Click Login:
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('owner')}
                className="p-2.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 border border-slate-600 text-left transition text-xs group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-400 block">Admin</span>
                  <Check className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition" />
                </div>
                <span className="text-[10px] text-slate-400">adminllo</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('manager')}
                className="p-2.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 border border-slate-600 text-left transition text-xs group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-400 block">Manager</span>
                  <Check className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition" />
                </div>
                <span className="text-[10px] text-slate-400">managerllo</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('viewer')}
                className="p-2.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 border border-slate-600 text-left transition text-xs group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-400 block">Viewer</span>
                  <Check className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition" />
                </div>
                <span className="text-[10px] text-slate-400">viewerllo</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-center space-x-2 text-xs text-slate-400">
          <span>Powered by</span>
          <img
            src={niforixLogo}
            alt="Niforix"
            className="h-5 object-contain inline-block bg-white/95 px-2 py-0.5 rounded shadow-sm"
          />
        </div>
      </div>
    </div>
  );
};
