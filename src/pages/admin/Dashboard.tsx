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
  BarChart3,
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Volunteer Operations Dashboard</h1>
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
            className="text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:border-linkedin focus:ring-1 focus:ring-linkedin"
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
            className="p-1.5 text-slate-500 hover:text-linkedin hover:bg-slate-100 rounded-lg transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Top Key Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Registered Volunteers */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Volunteers
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-linkedin flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{metrics.total_volunteers}</div>
          <div className="text-xs text-slate-500 mt-1 flex items-center space-x-1">
            <span className="font-semibold text-emerald-600">{metrics.active_volunteers_count} active</span>
            <span>•</span>
            <span>{metrics.total_volunteers - metrics.active_volunteers_count} inactive</span>
          </div>
        </div>

        {/* Card 2: Unique Active Volunteers Today */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Unique Volunteers (Today)
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{metrics.unique_volunteers_today}</div>
          <div className="text-xs text-slate-500 mt-1">
            Distinct individuals who reported participation today
          </div>
        </div>

        {/* Card 3: Total Task Submissions */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Task Submissions
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{metrics.total_submissions}</div>
          <div className="text-xs text-slate-500 mt-1">
            Total reported tasks completed across sessions
          </div>
        </div>

        {/* Card 4: Task Completion Rate */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Completion Rate
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{metrics.completion_rate_percentage}%</div>
          <div className="text-xs text-slate-500 mt-1">
            Based on active volunteer-task opportunities
          </div>
        </div>
      </div>

      {/* Session Breakdown Section */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900 mb-1">Session Participation Breakdown</h2>
        <p className="text-xs text-slate-500 mb-4">
          Submissions distributed across the 3 scheduled Nigeria time slots (WAT)
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
              Window: 09:30 AM – 12:00 PM WAT
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
              Window: 02:30 PM – 05:00 PM WAT
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
                8:00 PM
              </span>
            </div>
            <div className="text-2xl font-bold text-slate-900 mb-1">
              {metrics.session_counts.evening}
            </div>
            <p className="text-xs text-slate-500">
              Window: 07:30 PM – 10:00 PM WAT
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
              Distinguishing unique volunteers (bars) from total task submissions (trend)
            </p>
          </div>
          <span className="text-xs text-slate-500 flex items-center space-x-3">
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded bg-linkedin inline-block"></span>
              <span>Unique Volunteers</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded bg-slate-300 inline-block"></span>
              <span>Total Submissions</span>
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
                title={`Day ${d.day_number} (${d.calendar_date}): ${d.unique_volunteers} unique volunteers, ${d.total_submissions} total submissions`}
              >
                <div className="text-[10px] font-bold text-slate-500">D{d.day_number}</div>
                <div className="text-xs font-extrabold mt-0.5">
                  {d.unique_volunteers}
                </div>
                <div className="text-[9px] text-slate-400">
                  {d.total_submissions} subs
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Task Performance & Volunteer Consistency */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Most Completed Tasks */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center space-x-2 mb-3">
            <Award className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">Most Completed Tasks</h2>
          </div>
          <div className="space-y-2.5">
            {metrics.most_completed_tasks.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No task completions recorded yet.</p>
            ) : (
              metrics.most_completed_tasks.map((task, idx) => (
                <div key={task.task_id} className="flex items-center justify-between text-xs p-2 bg-slate-50 rounded-lg">
                  <div className="truncate pr-2">
                    <span className="font-bold text-slate-400 mr-1.5">#{idx + 1}</span>
                    <span className="font-semibold text-slate-800">{task.title}</span>
                    <span className="block text-[10px] text-slate-500">{task.category} • {task.session_name}</span>
                  </div>
                  <span className="font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                    {task.count}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Least Completed Tasks */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center space-x-2 mb-3">
            <BarChart3 className="w-4 h-4 text-amber-600" />
            <h2 className="text-sm font-bold text-slate-900">Least Completed Tasks</h2>
          </div>
          <div className="space-y-2.5">
            {metrics.least_completed_tasks.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No tasks recorded yet.</p>
            ) : (
              metrics.least_completed_tasks.map((task, idx) => (
                <div key={task.task_id} className="flex items-center justify-between text-xs p-2 bg-slate-50 rounded-lg">
                  <div className="truncate pr-2">
                    <span className="font-bold text-slate-400 mr-1.5">#{idx + 1}</span>
                    <span className="font-semibold text-slate-800">{task.title}</span>
                    <span className="block text-[10px] text-slate-500">{task.category} • {task.session_name}</span>
                  </div>
                  <span className="font-mono font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded">
                    {task.count}
                  </span>
                </div>
              ))
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
