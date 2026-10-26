import React, { useState, useEffect } from 'react';
import { StaffProfile } from './types';
import { VolunteerCheckIn } from './pages/VolunteerCheckIn';
import { AdminLogin } from './pages/AdminLogin';
import { AdminLayout, AdminTab } from './components/admin/AdminLayout';
import { Dashboard } from './pages/admin/Dashboard';
import { Attendance } from './pages/admin/Attendance';
import { Volunteers } from './pages/admin/Volunteers';
import { ProgrammeSchedule } from './pages/admin/ProgrammeSchedule';
import { TeamManagement } from './pages/admin/TeamManagement';
import { AuditLogs } from './pages/admin/AuditLogs';
import { supabase, isSupabaseConfigured } from './lib/supabase';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'public' | 'admin-login' | 'admin-portal'>('public');
  const [currentStaff, setCurrentStaff] = useState<StaffProfile | null>(null);
  const [currentAdminTab, setCurrentAdminTab] = useState<AdminTab>('dashboard');

  useEffect(() => {
    // Check saved staff in localStorage
    const saved = localStorage.getItem('llo_admin_session');
    if (saved) {
      try {
        const staff = JSON.parse(saved);
        if (staff) {
          if (staff.email === 'admin@llo.com' || staff.email === 'owner@llowerri.org') {
            staff.email = 'admin@llo.com';
            staff.full_name = 'Admin LLO';
          } else if (staff.email === 'manager@llo.com' || staff.email === 'manager@llowerri.org') {
            staff.email = 'manager@llo.com';
            staff.full_name = 'Manager LLO';
          } else if (staff.email === 'viewer@llo.com' || staff.email === 'viewer@llowerri.org') {
            staff.email = 'viewer@llo.com';
            staff.full_name = 'Viewer LLO';
          }
          localStorage.setItem('llo_admin_session', JSON.stringify(staff));
        }
        setCurrentStaff(staff);
      } catch (err) {
        console.warn('Failed to parse saved session', err);
      }
    }

    // Check URL path on mount
    const path = window.location.pathname;
    if (path.startsWith('/admin')) {
      const savedStaff = localStorage.getItem('llo_admin_session');
      if (savedStaff) {
        setCurrentView('admin-portal');
      } else {
        setCurrentView('admin-login');
      }
    }
  }, []);

  const handleLoginSuccess = (staff: StaffProfile) => {
    setCurrentStaff(staff);
    localStorage.setItem('llo_admin_session', JSON.stringify(staff));
    setCurrentView('admin-portal');
    window.history.pushState({}, '', '/admin');
  };

  const handleLogout = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    setCurrentStaff(null);
    localStorage.removeItem('llo_admin_session');
    setCurrentView('admin-login');
    window.history.pushState({}, '', '/admin/login');
  };

  const handleGoToPublic = () => {
    setCurrentView('public');
    window.history.pushState({}, '', '/');
  };

  const handleGoToAdmin = () => {
    if (currentStaff) {
      setCurrentView('admin-portal');
      window.history.pushState({}, '', '/admin');
    } else {
      setCurrentView('admin-login');
      window.history.pushState({}, '', '/admin/login');
    }
  };

  if (currentView === 'public') {
    return <VolunteerCheckIn onNavigateToAdmin={handleGoToAdmin} />;
  }

  if (currentView === 'admin-login') {
    return (
      <AdminLogin
        onLoginSuccess={handleLoginSuccess}
        onBackToVolunteerPage={handleGoToPublic}
      />
    );
  }

  if (currentView === 'admin-portal' && currentStaff) {
    return (
      <AdminLayout
        currentStaff={currentStaff}
        currentTab={currentAdminTab}
        onTabChange={setCurrentAdminTab}
        onLogout={handleLogout}
        onGoToPublicPage={handleGoToPublic}
      >
        {currentAdminTab === 'dashboard' && (
          <Dashboard onNavigateToVolunteers={() => setCurrentAdminTab('volunteers')} />
        )}
        {currentAdminTab === 'attendance' && <Attendance currentStaff={currentStaff} />}
        {currentAdminTab === 'volunteers' && <Volunteers currentStaff={currentStaff} />}
        {currentAdminTab === 'schedule' && <ProgrammeSchedule currentStaff={currentStaff} />}
        {currentAdminTab === 'team' && <TeamManagement currentStaff={currentStaff} />}
        {currentAdminTab === 'audit' && <AuditLogs currentStaff={currentStaff} />}
      </AdminLayout>
    );
  }

  return <VolunteerCheckIn onNavigateToAdmin={handleGoToAdmin} />;
};
export default App;
