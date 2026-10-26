import React, { useState, useEffect } from 'react';
import {
  Search,
  Download,
  X,
  FileSpreadsheet,
  ShieldAlert,
} from 'lucide-react';
import { StaffProfile, TaskSubmission } from '../../types';
import { dataStore } from '../../lib/data-store';
import { formatLagosDateTime } from '../../lib/lagos-time';
import { generateAttendanceCsv, triggerCsvDownload } from '../../lib/csv';
import { RolePermissions } from '../../lib/validation';

interface Props {
  currentStaff: StaffProfile;
}

export const Attendance: React.FC<Props> = ({ currentStaff }) => {
  const [submissions, setSubmissions] = useState<TaskSubmission[]>([]);
  const [search, setSearch] = useState('');
  const [dayFilter, setDayFilter] = useState<string>('all');
  const [sessionFilter, setSessionFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Voiding modal state
  const [voidTarget, setVoidTarget] = useState<TaskSubmission | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidError, setVoidError] = useState<string | null>(null);

  const canVoid = RolePermissions.canVoidSubmissions(currentStaff.role);

  useEffect(() => {
    loadAttendance();
  }, [dayFilter, sessionFilter, statusFilter, search]);

  const loadAttendance = () => {
    const list = dataStore.getAttendance({
      day_number: dayFilter === 'all' ? undefined : Number(dayFilter),
      session_code: sessionFilter === 'all' ? undefined : sessionFilter,
      status: statusFilter === 'all' ? undefined : statusFilter,
      search: search.trim() || undefined,
    });
    setSubmissions(list);
  };

  const handleExportCsv = (filteredOnly: boolean) => {
    const recordsToExport = filteredOnly
      ? submissions
      : dataStore.getAttendance();

    // Log export audit
    dataStore.addAuditLog(currentStaff, 'CSV_EXPORT', 'submission', null, {
      filtered: filteredOnly,
      records_exported: recordsToExport.length,
      day_filter: dayFilter,
      session_filter: sessionFilter,
    });

    const csvContent = generateAttendanceCsv(recordsToExport);
    const filename = `llo-attendance-${filteredOnly ? 'filtered-' : 'all-'}${Date.now()}.csv`;
    triggerCsvDownload(csvContent, filename);
  };

  const handleConfirmVoid = () => {
    if (!voidTarget) return;
    if (!voidReason.trim()) {
      setVoidError('A reason must be provided to void this participation record.');
      return;
    }

    const res = dataStore.voidSubmission(voidTarget.id, voidReason.trim(), currentStaff);
    if (res.success) {
      setVoidTarget(null);
      setVoidReason('');
      setVoidError(null);
      loadAttendance();
    } else {
      setVoidError(res.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Toolbar */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Attendance & Submissions</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Search, filter, inspect and export reported volunteer tasks (WAT timezone)
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleExportCsv(true)}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
            title="Export records matching current search and filters"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Filtered ({submissions.length})</span>
          </button>

          <button
            onClick={() => handleExportCsv(false)}
            className="flex items-center space-x-1.5 px-3 py-2 bg-linkedin hover:bg-linkedin-dark text-white text-xs font-semibold rounded-lg shadow-sm transition"
            title="Export all database records to CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export All Records</span>
          </button>
        </div>
      </div>

      {/* Search and Filters Card */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Search Input */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Search Volunteer / Task
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Name, ID (e.g. LLO-VOL-001)..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-linkedin"
            />
          </div>
        </div>

        {/* Day Filter */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Programme Day
          </label>
          <select
            value={dayFilter}
            onChange={e => setDayFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-linkedin"
          >
            <option value="all">All Days (1 - 30)</option>
            {Array.from({ length: 30 }, (_, i) => i + 1).map(d => (
              <option key={d} value={d}>Day {d}</option>
            ))}
          </select>
        </div>

        {/* Session Filter */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Session Slot
          </label>
          <select
            value={sessionFilter}
            onChange={e => setSessionFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-linkedin"
          >
            <option value="all">All Sessions</option>
            <option value="morning">Morning (10:00 AM)</option>
            <option value="afternoon">Afternoon (3:00 PM)</option>
            <option value="evening">Evening (8:00 PM)</option>
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-linkedin"
          >
            <option value="all">All Statuses</option>
            <option value="reported">Reported (Active)</option>
            <option value="voided">Voided</option>
          </select>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Day & Date</th>
                <th className="py-3 px-4">Session</th>
                <th className="py-3 px-4">Volunteer</th>
                <th className="py-3 px-4">Task Completed</th>
                <th className="py-3 px-4">Timestamp (WAT)</th>
                <th className="py-3 px-4">Status</th>
                {canVoid && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {submissions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No participation submissions match the selected filters.
                  </td>
                </tr>
              ) : (
                submissions.map(sub => {
                  const isVoided = sub.status === 'voided';
                  return (
                    <tr
                      key={sub.id}
                      className={`hover:bg-slate-50/80 transition ${
                        isVoided ? 'bg-rose-50/30 text-slate-400' : 'text-slate-700'
                      }`}
                    >
                      {/* Day & Date */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-bold text-slate-900 block">
                          Day {sub.day?.day_number || '–'}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {sub.day?.calendar_date}
                        </span>
                      </td>

                      {/* Session */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-medium text-slate-800 block">
                          {sub.slot?.name || 'Session'}
                        </span>
                      </td>

                      {/* Volunteer */}
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block">
                          {sub.volunteer?.full_name || 'Volunteer'}
                        </span>
                        <span className="font-mono text-[11px] text-linkedin font-semibold">
                          {sub.volunteer?.volunteer_id}
                        </span>
                        <span className="text-[10px] text-slate-500 ml-1">
                          ({sub.volunteer?.track})
                        </span>
                      </td>

                      {/* Task */}
                      <td className="py-3 px-4 max-w-xs">
                        <span className="font-medium text-slate-800 block">
                          {sub.task?.title}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {sub.task?.category}
                        </span>
                      </td>

                      {/* Timestamp in Lagos time */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-600">
                        {formatLagosDateTime(sub.submitted_at)}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isVoided ? (
                          <span
                            className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 cursor-help"
                            title={`Voided: ${sub.void_reason || 'No reason specified'}`}
                          >
                            VOIDED
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            REPORTED
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      {canVoid && (
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {!isVoided ? (
                            <button
                              onClick={() => {
                                setVoidTarget(sub);
                                setVoidReason('');
                                setVoidError(null);
                              }}
                              className="text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2 py-1 rounded transition"
                              title="Void incorrect submission"
                            >
                              Void Record
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              Voided
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Void Submission */}
      {voidTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2 text-rose-600">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="font-bold text-base text-slate-900">Void Participation Record</h3>
              </div>
              <button
                onClick={() => setVoidTarget(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs text-slate-600">
              <p>
                You are about to void the submission for{' '}
                <strong className="text-slate-900">{voidTarget.volunteer?.full_name}</strong> (
                <code>{voidTarget.volunteer?.volunteer_id}</code>).
              </p>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="block font-semibold text-slate-700">{voidTarget.task?.title}</span>
                <span className="text-slate-500">{voidTarget.slot?.name}</span>
              </div>
              <p className="text-[11px] text-slate-500">
                This will mark the record as voided and preserve an immutable audit trail.
                The record will not be deleted from the database.
              </p>

              {voidError && (
                <div className="p-2.5 bg-red-50 text-red-700 rounded-lg text-xs font-medium">
                  {voidError}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                  Reason for Voiding <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={voidReason}
                  onChange={e => setVoidReason(e.target.value)}
                  placeholder="e.g. Volunteer reported incorrect task by mistake, duplicate entry, coordinator review..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:border-linkedin"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setVoidTarget(null)}
                className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmVoid}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow transition"
              >
                Confirm Void Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
