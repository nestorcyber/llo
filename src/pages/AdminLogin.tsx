import React, { useState } from 'react';
import { Lock, Mail, ArrowLeft, AlertCircle, ArrowRight } from 'lucide-react';
import { StaffProfile } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { dataStore } from '../lib/data-store';
import niforixLogo from '../assets/niforix-logo.png';
import lloLogo from '../assets/llo-logo.png';

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
        setError('Invalid email or password.');
        setLoading(false);
        return;
      }

      if (!matched.is_active) {
        setError('This staff account has been deactivated. Please contact an owner.');
        setLoading(false);
        return;
      }

      // Verify assigned password
      const expectedPassword =
        STAFF_PASSWORDS[normalizedEmail] ||
        (matched.role === 'owner' ? 'adminllo' : `${matched.role}llo`);

      if (password !== expectedPassword) {
        setError('Invalid email or password.');
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200/80">
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img
              src={lloLogo}
              alt="LinkedIn Local Owerri"
              className="h-7 sm:h-8 object-contain"
            />
          </div>

          <button
            onClick={onBackToVolunteerPage}
            className="text-xs font-semibold text-slate-600 hover:text-blue-600 flex items-center space-x-1.5 py-1.5 px-3 rounded-lg border border-slate-200 hover:border-slate-300 bg-white transition shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Volunteer Check-In</span>
          </button>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="max-w-md w-full mx-auto px-4 py-8 flex-1 flex flex-col justify-center">
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-9 shadow-sm">
          {/* Header */}
          <div className="text-center mb-6">
            <img
              src={lloLogo}
              alt="LinkedIn Local Owerri"
              className="h-10 sm:h-11 object-contain mx-auto mb-3"
            />
            <h2 className="font-heading text-2xl font-extrabold text-slate-900 tracking-tight">
              Staff Sign In
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Sign in with your team credentials to access the management portal.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-2.5 text-red-800 text-xs animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-800 uppercase tracking-wider mb-1.5">
                Staff Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@llo.com"
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition shadow-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition shadow-sm"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-heading font-semibold rounded-xl text-sm shadow-sm shadow-blue-600/20 transition flex items-center justify-center space-x-2"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In to Portal'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-slate-500">
        <div className="max-w-xl mx-auto px-4 flex items-center justify-center space-x-2 text-slate-600 text-xs font-medium">
          <span>Powered by</span>
          <img
            src={niforixLogo}
            alt="Niforix"
            className="h-5 sm:h-6 object-contain inline-block"
          />
        </div>
      </footer>
    </div>
  );
};
