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
} from 'lucide-react';
import { DashboardMetrics, ProgrammeDay } from '../../types';
import { dataStore } from '../../lib/data-store';

export const Dashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [selectedDayNumber, setSelectedDayNumber] = useState<number | 'all'>('all');
  const [programmeDays, setProgrammeDays] = useState<ProgrammeDay[]>([]);
  const [loading, setLoading] = useState(true);

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
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setLoading(false);
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
          <h1 className="font-heading text-xl sm:text-2xl font-bold text-slate-900">Operations Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time analytics and participation metrics for LinkedIn Local Owerri
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

          <button
            onClick={loadData}
            title="Refresh analytics"
            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded-xl border border-slate-200 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
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
