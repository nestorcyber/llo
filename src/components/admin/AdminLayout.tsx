import React from 'react';
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  CalendarDays,
  Shield,
  FileText,
  LogOut,
  ExternalLink,
  Clock,
} from 'lucide-react';
import { StaffProfile, StaffRole } from '../../types';
import niforixLogo from '../../assets/niforix-logo.png';

export type AdminTab =
  | 'dashboard'
  | 'attendance'
  | 'volunteers'
  | 'schedule'
  | 'team'
  | 'audit';

interface Props {
  currentStaff: StaffProfile;
  currentTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  onLogout: () => void;
  onGoToPublicPage: () => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<Props> = ({
  currentStaff,
  currentTab,
  onTabChange,
  onLogout,
  onGoToPublicPage,
  children,
}) => {
  const isOwner = currentStaff.role === 'owner';

  const roleBadgeColor: Record<StaffRole, string> = {
    owner: 'bg-amber-100 text-amber-800 border-amber-300',
    manager: 'bg-blue-100 text-blue-800 border-blue-300',
    viewer: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  };

  const navItems: Array<{ id: AdminTab; label: string; icon: React.FC<{ className?: string }>; ownerOnly?: boolean }> = [
    { id: 'dashboard', label: 'Dashboard & Analytics', icon: LayoutDashboard },
    { id: 'attendance', label: 'Attendance & Reports', icon: CheckSquare },
    { id: 'volunteers', label: 'Volunteer Directory', icon: Users },
    { id: 'schedule', label: 'Programme & Tasks', icon: CalendarDays },
    { id: 'team', label: 'Team & Roles', icon: Shield, ownerOnly: true },
    { id: 'audit', label: 'Audit Logs', icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand Logo & Title */}
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-linkedin flex items-center justify-center font-bold text-white text-base shadow">
                LLO
              </div>
              <div>
                <span className="font-bold text-slate-900 text-base leading-none block">
                  LinkedIn Local Owerri
                </span>
                <span className="text-[11px] font-medium text-slate-500">
                  Operations & Volunteer Management
                </span>
              </div>
            </div>

            {/* Timezone & Staff User Info */}
            <div className="flex items-center space-x-4">
              {/* Lagos Timezone Pill */}
              <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 font-mono">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>WAT (UTC+1)</span>
              </div>

              {/* Public Check-in Shortcut */}
              <button
                onClick={onGoToPublicPage}
                className="hidden sm:flex items-center space-x-1 px-3 py-1.5 text-xs text-slate-600 hover:text-linkedin hover:bg-slate-50 border border-slate-200 rounded-lg transition"
              >
                <span>Volunteer Check-In</span>
                <ExternalLink className="w-3 h-3" />
              </button>

              {/* User Identity & Role Badge */}
              <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
                <div className="text-right">
                  <div className="text-xs font-bold text-slate-900 leading-none">
                    {currentStaff.full_name}
                  </div>
                  <div className="text-[10px] text-slate-400">{currentStaff.email}</div>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                    roleBadgeColor[currentStaff.role]
                  }`}
                >
                  {currentStaff.role}
                </span>
              </div>

              {/* Logout */}
              <button
                onClick={onLogout}
                title="Sign out"
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <nav className="flex space-x-1 overflow-x-auto py-2 -mb-px border-t border-slate-100">
            {navItems.map(item => {
              if (item.ownerOnly && !isOwner) return null;
              const Icon = item.icon;
              const isActive = currentTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition whitespace-nowrap ${
                    isActive
                      ? 'bg-linkedin text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Admin Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-auto text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-slate-600">
            LinkedIn Local Owerri &bull; Operations & Volunteer Management
          </p>
          <div className="flex items-center space-x-2 text-slate-600 font-medium">
            <span>Powered by</span>
            <img
              src={niforixLogo}
              alt="Niforix"
              className="h-5 object-contain inline-block"
            />
          </div>
        </div>
      </footer>
    </div>
  );
};
