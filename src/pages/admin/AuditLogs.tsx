import React, { useState, useEffect } from 'react';
import { FileText, Search } from 'lucide-react';
import { AuditLog, StaffProfile } from '../../types';
import { dataStore } from '../../lib/data-store';
import { formatLagosDateTime } from '../../lib/lagos-time';

interface Props {
  currentStaff: StaffProfile;
}

export const AuditLogs: React.FC<Props> = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  useEffect(() => {
    loadLogs();
  }, [search, actionFilter]);

  const loadLogs = () => {
    let list = dataStore.getAuditLogs(200);

    if (actionFilter) {
      list = list.filter(l => l.action === actionFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        l =>
          (l.staff_email && l.staff_email.toLowerCase().includes(q)) ||
          l.action.toLowerCase().includes(q) ||
          l.target_type.toLowerCase().includes(q) ||
          (l.target_id && l.target_id.toLowerCase().includes(q)) ||
          JSON.stringify(l.details).toLowerCase().includes(q)
      );
    }

    setLogs(list);
  };

  const actionBadgeColors: Record<string, string> = {
    RECORD_VOID: 'bg-rose-100 text-rose-800 border-rose-300',
    VOLUNTEER_DEACTIVATE: 'bg-amber-100 text-amber-800 border-amber-300',
    VOLUNTEER_ADD: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    VOLUNTEER_IMPORT: 'bg-blue-100 text-blue-800 border-blue-300',
    TASK_CREATE: 'bg-purple-100 text-purple-800 border-purple-300',
    TASK_EDIT: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    ROLE_CHANGE: 'bg-orange-100 text-orange-800 border-orange-300',
    CSV_EXPORT: 'bg-slate-100 text-slate-800 border-slate-300',
    PROGRAMME_CREATED: 'bg-teal-100 text-teal-800 border-teal-300',
    CALENDAR_GENERATED: 'bg-cyan-100 text-cyan-800 border-cyan-300',
    SESSION_OVERRIDE: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-2">
          <FileText className="w-5 h-5 text-linkedin" />
          <h1 className="text-xl font-bold text-slate-900">Administrative Audit Logs</h1>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          Immutable audit trail recording administrative actions, task updates, volunteer deactivations, voided records, role modifications, and CSV exports.
        </p>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Search Audit Entries
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter by staff email, action, target ID, details..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-linkedin"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Filter by Action Type
          </label>
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-linkedin"
          >
            <option value="">All Actions</option>
            <option value="RECORD_VOID">Record Voided</option>
            <option value="VOLUNTEER_ADD">Volunteer Added</option>
            <option value="VOLUNTEER_UPDATE">Volunteer Updated / Deactivated</option>
            <option value="VOLUNTEER_IMPORT">Volunteer CSV Import</option>
            <option value="TASK_CREATE">Task Created</option>
            <option value="TASK_EDIT">Task Edited</option>
            <option value="SESSION_OVERRIDE">Session Window Override</option>
            <option value="ROLE_CHANGE">Team Role Changed</option>
            <option value="CSV_EXPORT">CSV Export Triggered</option>
          </select>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Timestamp (WAT)</th>
                <th className="py-3 px-4">Staff User</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Target</th>
                <th className="py-3 px-4">Details & Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No audit log records match the search criteria.
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50 transition text-slate-700">
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-500">
                      {formatLagosDateTime(log.created_at)}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-semibold text-slate-900 block">
                        {log.staff_email || 'System'}
                      </span>
                      {log.ip_address && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          IP: {log.ip_address}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                          actionBadgeColors[log.action] || 'bg-slate-100 text-slate-800 border-slate-300'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-medium text-slate-800 block uppercase text-[11px]">
                        {log.target_type}
                      </span>
                      {log.target_id && (
                        <span className="text-[10px] font-mono text-slate-500">
                          {log.target_id}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 max-w-md">
                      <pre className="text-[11px] font-mono bg-slate-50 p-1.5 rounded border border-slate-200 text-slate-600 whitespace-pre-wrap break-all">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
