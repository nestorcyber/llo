import React, { useState } from 'react';
import { Shield, Lock, Mail, ArrowLeft, AlertCircle } from 'lucide-react';
import { StaffProfile, StaffRole } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { dataStore } from '../lib/data-store';

interface Props {
  onLoginSuccess: (user: StaffProfile) => void;
  onBackToVolunteerPage: () => void;
}

export const AdminLogin: React.FC<Props> = ({ onLoginSuccess, onBackToVolunteerPage }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSupabaseConfigured && supabase) {
        // Authenticate with Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
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

      // Offline / Local Development demo login check
      const staffList = dataStore.getStaff();
      const matched = staffList.find(s => s.email.toLowerCase() === email.toLowerCase());

      if (matched) {
        if (!matched.is_active) {
          setError('This staff account has been deactivated.');
          setLoading(false);
          return;
        }
        onLoginSuccess(matched);
      } else {
        setError(`No staff member found with email "${email}". Please select one of the demo roles below.`);
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication error.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = (role: StaffRole) => {
    const staffList = dataStore.getStaff();
    const matched = staffList.find(s => s.role === role);
    if (matched) {
      onLoginSuccess(matched);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center px-4 py-8">
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
            <h1 className="text-xl font-bold text-white">Administrator Portal</h1>
            <p className="text-xs text-slate-400 mt-1">LinkedIn Local Owerri Operations Team</p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 bg-red-900/40 border border-red-700/50 rounded-xl flex items-start space-x-2.5 text-red-200 text-xs">
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
                  placeholder="name@llowerri.org"
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
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:border-linkedin focus:ring-1 focus:ring-linkedin"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-linkedin hover:bg-linkedin-dark text-white font-bold rounded-xl text-sm shadow transition flex items-center justify-center space-x-2"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In as Administrator'}</span>
            </button>
          </form>

          {/* Demo Roles Quick Login Switcher */}
          <div className="mt-8 pt-6 border-t border-slate-700">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2.5 text-center">
              Quick Role Test Logins:
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('owner')}
                className="p-2.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 border border-slate-600 text-left transition text-xs"
              >
                <span className="font-bold text-amber-400 block">Owner</span>
                <span className="text-[10px] text-slate-400">Full Access</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('manager')}
                className="p-2.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 border border-slate-600 text-left transition text-xs"
              >
                <span className="font-bold text-blue-400 block">Manager</span>
                <span className="text-[10px] text-slate-400">Ops & Tasks</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('viewer')}
                className="p-2.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 border border-slate-600 text-left transition text-xs"
              >
                <span className="font-bold text-emerald-400 block">Viewer</span>
                <span className="text-[10px] text-slate-400">Read-Only</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
