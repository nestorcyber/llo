import React, { useState, useEffect } from 'react';
import {
  Users,
  CheckCircle2,
  Sun,
  Sunset,
  Moon,
  TrendingUp,
  Activity,
  Award,
  Filter,
  RefreshCw,
  Radio,
  Lock,
  Unlock,
  RotateCcw,
} from 'lucide-react';
import { DashboardMetrics, ProgrammeDay, Volunteer, StaffProfile, SessionSlot } from '../../types';
import { dataStore } from '../../lib/data-store';
import { RolePermissions } from '../../lib/validation';

interface DashboardProps {
  onNavigateToVolunteers?: () => void;
  currentStaff?: StaffProfile;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigateToVolunteers, currentStaff }) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [selectedDayNumber, setSelectedDayNumber] = useState<number | 'all'>('all');
  const [programmeDays, setProgrammeDays] = useState<ProgrammeDay[]>([]);
  const [volunteersList, setVolunteersList] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [updatingSlotId, setUpdatingSlotId] = useState<string | null>(null);
  const [isActivatingDay, setIsActivatingDay] = useState(false);

  useEffect(() => {
    // Proactively sync live database on dashboard mount
    dataStore.syncWithLiveDatabase().then(() => {
      loadData();
    });
  }, []);

  useEffect(() => {
    loadData();
    const unsubscribe = dataStore.subscribe(() => {
      loadData();
    });
    return () => unsubscribe();
  }, [selectedDayNumber]);

  const loadData = () => {
    setLoading(true);
    try {
      const days = dataStore.getProgrammeDays();
      setProgrammeDays(days);

      const filterArgs = selectedDayNumber === 'all' ? undefined : { day_number: selectedDayNumber };
      const res = dataStore.getDashboardMetrics(filterArgs);
      setMetrics(res);
      setVolunteersList(dataStore.getVolunteers());
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  const canManage = currentStaff ? RolePermissions.canManageTasks(currentStaff.role) : true;

  const activeProg = (dataStore as any).state?.programmes?.[0] || null;
  const activeDayNumber = activeProg?.active_day_number || 1;
  const activeDay = programmeDays.find(d => d.day_number === activeDayNumber) || programmeDays[0];
  const activeDaySlots: Array<SessionSlot & { checkins_count?: number; is_open: boolean; window_status: string; formatted_window?: string }> =
    activeDay ? (dataStore.getDaySessionSlots(activeDay.id) as any) : [];

  const handleSetActiveDay = async (dayNum: number) => {
    setIsActivatingDay(true);
    try {
      const res = await dataStore.setActiveProgrammeDay(dayNum, currentStaff, false);
      if (res.success) {
        setActionMsg(`Day ${dayNum} (${activeDay?.calendar_date || ''}) is now active on the frontend!`);
        setTimeout(() => setActionMsg(null), 4000);
        loadData();
      }
    } finally {
      setIsActivatingDay(false);
    }
  };

  const handleToggleSlotOverride = async (slotId: string, makeOpen: boolean) => {
    setUpdatingSlotId(slotId);
    try {
      const res = await dataStore.setSlotOverride(slotId, makeOpen, currentStaff as any);
      if (res.success) {
        setActionMsg(makeOpen ? 'Session window is now OPEN on the frontend!' : 'Session window is now CLOSED.');
        setTimeout(() => setActionMsg(null), 4000);
        loadData();
      }
    } finally {
      setUpdatingSlotId(null);
    }
  };

  const handleResetSlotAuto = async (slotId: string) => {
    setUpdatingSlotId(slotId);
    try {
      const res = await dataStore.setSlotOverride(slotId, null, currentStaff as any);
      if (res.success) {
        setActionMsg('Session window reset to automatic schedule.');
        setTimeout(() => setActionMsg(null), 4000);
        loadData();
      }
    } finally {
      setUpdatingSlotId(null);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await dataStore.clearLocalCacheAndResync();
      loadData();
    } finally {
      setIsSyncing(false);
    }
  };

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="w-8 h-8 text-linkedin animate-spin" />
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="space-y-6">
      {/* Page Title & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="font-heading text-xl sm:text-2xl font-bold text-slate-900">Operations Dashboard</h1>
            <div className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center space-x-1 border ${
              dataStore.isLiveConnected()
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${dataStore.isLiveConnected() ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span>{dataStore.isLiveConnected() ? 'Supabase Live' : 'Local Fallback'}</span>
            </div>
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition"
              title="Refresh dashboard metrics and volunteer roster from Supabase"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time analytics, volunteer roster, and participation metrics for LinkedIn Local Owerri
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-600">Filter Day:</span>
          <select
            value={selectedDayNumber}
            onChange={e => setSelectedDayNumber(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">Entire 30-Day Programme</option>
            {programmeDays.map(day => (
              <option key={day.id} value={day.day_number}>
                Day {day.day_number} ({day.calendar_date})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Action Success Notification */}
      {actionMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center space-x-2.5 text-emerald-900 text-xs font-semibold shadow-xs animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{actionMsg}</span>
        </div>
      )}

      {/* Live Day & Session Controls Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <Radio className="w-4 h-4 text-blue-600 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Live Programme Day & Session Controls
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-600 text-white uppercase tracking-wider">
                  Live Control
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Directly control which day and sessions are active on the volunteer check-in frontend
              </p>
            </div>
          </div>

          {/* Quick Active Day Selector */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-600 whitespace-nowrap">Active Day on Frontend:</span>
            <select
              value={activeDayNumber}
              disabled={isActivatingDay || !canManage}
              onChange={e => handleSetActiveDay(Number(e.target.value))}
              className="text-xs font-bold bg-blue-50/80 text-blue-900 border border-blue-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 cursor-pointer"
            >
              {programmeDays.map(day => (
                <option key={day.id} value={day.day_number}>
                  Day {day.day_number} ({day.calendar_date}) {day.day_number === activeDayNumber ? '• ACTIVE' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 3 Sessions for the Active Day */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {activeDaySlots.map(slot => {
            const sessionIcon =
              slot.session_code === 'morning' ? Sun :
              slot.session_code === 'afternoon' ? Sunset : Moon;
            const Icon = sessionIcon;
            const isUpdating = updatingSlotId === slot.id;

            return (
              <div
                key={slot.id}
                className={`p-4 rounded-xl border transition flex flex-col justify-between space-y-3 ${
                  slot.is_open
                    ? 'bg-emerald-50/30 border-emerald-200/90 shadow-xs'
                    : 'bg-slate-50/70 border-slate-200/80'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        slot.is_open ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">{slot.name}</div>
                        <div className="text-[10px] text-slate-500">{slot.formatted_window}</div>
                      </div>
                    </div>

                    <div>
                      {slot.is_override_open === true ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          FORCE OPEN
                        </span>
                      ) : slot.is_override_open === false ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                          FORCE CLOSED
                        </span>
                      ) : slot.is_open ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 flex items-center space-x-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>OPEN</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 text-slate-600">
                          CLOSED
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-2.5 text-[11px] text-slate-600 flex items-center justify-between">
                    <span>Recorded check-ins:</span>
                    <span className="font-mono font-bold text-slate-900">{slot.checkins_count || 0}</span>
                  </div>
                </div>

                {canManage && (
                  <div className="pt-2 border-t border-slate-200/60 flex items-center gap-1.5">
                    {slot.is_open ? (
                      <button
                        onClick={() => handleToggleSlotOverride(slot.id, false)}
                        disabled={isUpdating}
                        className="flex-1 py-1.5 px-2.5 rounded-lg text-[11px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition flex items-center justify-center space-x-1 disabled:opacity-50"
                      >
                        {isUpdating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Lock className="w-3 h-3" />}
                        <span>Close Session</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleSlotOverride(slot.id, true)}
                        disabled={isUpdating}
                        className="flex-1 py-1.5 px-2.5 rounded-lg text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition flex items-center justify-center space-x-1 disabled:opacity-50"
                      >
                        {isUpdating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Unlock className="w-3 h-3" />}
                        <span>Open for Check-In</span>
                      </button>
                    )}

                    {slot.is_override_open !== null && slot.is_override_open !== undefined && (
                      <button
                        onClick={() => handleResetSlotAuto(slot.id)}
                        disabled={isUpdating}
                        title="Reset to automatic schedule"
                        className="p-1.5 rounded-lg text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-300 transition"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Key Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Registered Volunteers */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Volunteers
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="font-heading text-2xl font-black text-slate-900">{metrics.total_volunteers}</div>
          <div className="text-xs text-slate-500 mt-1 flex items-center space-x-1">
            <span className="font-semibold text-emerald-600">{metrics.active_volunteers_count} active</span>
            <span>•</span>
            <span>{metrics.total_volunteers - metrics.active_volunteers_count} inactive</span>
          </div>
        </div>

        {/* Card 2: Unique Active Volunteers Today */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Unique Volunteers (Today)
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="font-heading text-2xl font-black text-slate-900">{metrics.unique_volunteers_today}</div>
          <div className="text-xs text-slate-500 mt-1">
            Distinct individuals who reported participation today
          </div>
        </div>

        {/* Card 3: Total Check-Ins */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Check-Ins
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="font-heading text-2xl font-black text-slate-900">{metrics.total_submissions}</div>
          <div className="text-xs text-slate-500 mt-1">
            Total recorded session check-ins across programme
          </div>
        </div>

        {/* Card 4: Attendance Rate */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Attendance Rate
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="font-heading text-2xl font-black text-slate-900">{metrics.attendance_rate_percentage}%</div>
          <div className="text-xs text-slate-500 mt-1">
            Based on active volunteer session opportunities
          </div>
        </div>
      </div>

      {/* Registered Volunteers Roster (Live from Database) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-blue-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Registered Volunteers Roster</h2>
              <p className="text-xs text-slate-500">
                Live database volunteers ({volunteersList.length} verified in database)
              </p>
            </div>
          </div>
          {onNavigateToVolunteers && (
            <button
              onClick={onNavigateToVolunteers}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center space-x-1"
            >
              <span>Manage Full Directory &rarr;</span>
            </button>
          )}
        </div>

        {volunteersList.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400">
            No volunteers found in database.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {volunteersList.map(vol => (
              <div
                key={vol.id}
                className="p-3 bg-slate-50/80 hover:bg-blue-50/40 rounded-xl border border-slate-200/70 transition flex items-center justify-between space-x-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-[11px] font-bold text-blue-700 bg-blue-100/60 px-1.5 py-0.5 rounded">
                      {vol.volunteer_id}
                    </span>
                    <span className="font-bold text-xs text-slate-900 truncate">
                      {vol.full_name}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 truncate mt-0.5">
                    {vol.email || vol.phone || vol.notes || 'General Volunteer'}
                  </div>
                </div>
                <div>
                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                      vol.is_active
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {vol.is_active ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Session Breakdown Section */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900 mb-1">Session Participation Breakdown</h2>
        <p className="text-xs text-slate-500 mb-4">
          Check-ins distributed across the 3 scheduled Nigeria time slots (WAT)
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Morning Slot */}
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Sun className="w-5 h-5 text-amber-500" />
                <span className="text-sm font-bold text-slate-800">Morning Session</span>
              </div>
              <span className="text-xs font-mono font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                10:00 AM
              </span>
            </div>
            <div className="text-2xl font-bold text-slate-900 mb-1">
              {metrics.session_counts.morning}
            </div>
            <p className="text-xs text-slate-500">
              Window: 10:00 AM – 12:00 PM WAT
            </p>
          </div>

          {/* Afternoon Slot */}
          <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Sunset className="w-5 h-5 text-blue-500" />
                <span className="text-sm font-bold text-slate-800">Afternoon Session</span>
              </div>
              <span className="text-xs font-mono font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                3:00 PM
              </span>
            </div>
            <div className="text-2xl font-bold text-slate-900 mb-1">
              {metrics.session_counts.afternoon}
            </div>
            <p className="text-xs text-slate-500">
              Window: 03:00 PM – 05:00 PM WAT
            </p>
          </div>

          {/* Evening Slot */}
          <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/40">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Moon className="w-5 h-5 text-indigo-500" />
                <span className="text-sm font-bold text-slate-800">Evening Session</span>
              </div>
              <span className="text-xs font-mono font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">
                7:00 PM
              </span>
            </div>
            <div className="text-2xl font-bold text-slate-900 mb-1">
              {metrics.session_counts.evening}
            </div>
            <p className="text-xs text-slate-500">
              Window: 07:00 PM – 09:00 PM WAT
            </p>
          </div>
        </div>
      </div>

      {/* Daily Engagement Trends (Day 1..30) */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">30-Day Daily Engagement Trends</h2>
            <p className="text-xs text-slate-500">
              Distinguishing unique volunteers (bars) from total check-ins (trend)
            </p>
          </div>
          <span className="text-xs text-slate-500 flex items-center space-x-3">
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded bg-linkedin inline-block"></span>
              <span>Unique Volunteers</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded bg-slate-300 inline-block"></span>
              <span>Total Check-Ins</span>
            </span>
          </span>
        </div>

        {/* Visual Mini Chart Grid */}
        <div className="grid grid-cols-6 sm:grid-cols-10 lg:grid-cols-15 gap-1.5 pt-4">
          {metrics.daily_trends.map(d => {
            const hasActivity = d.total_submissions > 0;
            return (
              <div
                key={d.day_number}
                className={`p-2 rounded-lg border text-center transition ${
                  hasActivity
                    ? 'bg-blue-50/80 border-blue-200 text-blue-900'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
                title={`Day ${d.day_number} (${d.calendar_date}): ${d.unique_volunteers} unique volunteers, ${d.total_submissions} total check-ins`}
              >
                <div className="text-[10px] font-bold text-slate-500">D{d.day_number}</div>
                <div className="text-xs font-extrabold mt-0.5">
                  {d.unique_volunteers}
                </div>
                <div className="text-[9px] text-slate-400">
                  {d.total_submissions} check-ins
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Volunteer Leaderboard & Consistency */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Active Volunteers Leaderboard */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Award className="w-5 h-5 text-amber-500" />
              <div>
                <h2 className="text-sm font-bold text-slate-900">Top Active Volunteers</h2>
                <p className="text-xs text-slate-500">Volunteers with the highest recorded session check-ins</p>
              </div>
            </div>
          </div>
          <div className="space-y-3 mt-4">
            {metrics.top_active_volunteers.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No check-ins recorded yet.</p>
            ) : (
              metrics.top_active_volunteers.map((vol, idx) => {
                const maxCount = metrics.top_active_volunteers[0]?.checkins_count || 1;
                const percentage = Math.round((vol.checkins_count / Math.max(1, maxCount)) * 100);

                return (
                  <div key={vol.volunteer_id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            idx === 0
                              ? 'bg-amber-100 text-amber-800'
                              : idx === 1
                              ? 'bg-slate-200 text-slate-800'
                              : idx === 2
                              ? 'bg-amber-700/20 text-amber-900'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <div>
                          <span className="font-bold text-xs text-slate-900">{vol.full_name}</span>
                          <span className="font-mono text-[11px] text-linkedin font-semibold ml-2">
                            {vol.volunteer_id}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs font-bold text-slate-900 font-mono">
                          {vol.checkins_count}
                        </span>
                        <span className="text-[11px] text-slate-500">check-ins</span>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200/70 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-linkedin h-full rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Volunteer Consistency Breakdown */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center space-x-2 mb-3">
            <Activity className="w-4 h-4 text-linkedin" />
            <h2 className="text-sm font-bold text-slate-900">30-Day Consistency</h2>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Volunteer active day distribution over 30 days
          </p>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-emerald-700">High Consistency (≥70% days)</span>
                <span>{metrics.volunteer_consistency.high} volunteers</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full"
                  style={{ width: `${(metrics.volunteer_consistency.high / Math.max(1, metrics.total_volunteers)) * 100}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-blue-700">Moderate Consistency (30-69%)</span>
                <span>{metrics.volunteer_consistency.medium} volunteers</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-linkedin h-full rounded-full"
                  style={{ width: `${(metrics.volunteer_consistency.medium / Math.max(1, metrics.total_volunteers)) * 100}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-slate-600">Low Consistency (&lt;30%)</span>
                <span>{metrics.volunteer_consistency.low} volunteers</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-slate-300 h-full rounded-full"
                  style={{ width: `${(metrics.volunteer_consistency.low / Math.max(1, metrics.total_volunteers)) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
