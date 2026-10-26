import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  Upload,
  Download,
  Search,
  Eye,
  AlertTriangle,
  X,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { StaffProfile, Volunteer } from '../../types';
import { dataStore } from '../../lib/data-store';
import { generateNextVolunteerId, normalizeVolunteerId, isValidVolunteerIdFormat, RolePermissions } from '../../lib/validation';
import {
  generateVolunteersCsv,
  parseVolunteersCsv,
  triggerCsvDownload,
  generateVolunteerTemplateCsv,
} from '../../lib/csv';
import { VolunteerDetailModal } from './VolunteerDetailModal';

interface Props {
  currentStaff: StaffProfile;
}

export const Volunteers: React.FC<Props> = ({ currentStaff }) => {
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedVolunteer, setSelectedVolunteer] = useState<Volunteer | null>(null);

  // Add Volunteer Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Import CSV Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importStatus, setImportStatus] = useState<{ message: string; isError?: boolean } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Status Toggle Modal (Confirmation)
  const [toggleTarget, setToggleTarget] = useState<Volunteer | null>(null);

  const canManage = RolePermissions.canManageVolunteers(currentStaff.role);

  useEffect(() => {
    loadVolunteers();
    const unsubscribe = dataStore.subscribe(() => {
      loadVolunteers();
    });
    return () => unsubscribe();
  }, [search, statusFilter]);

  const loadVolunteers = () => {
    const list = dataStore.getVolunteers(search, statusFilter);
    setVolunteers(list);
  };

  const handleOpenAddModal = () => {
    const existingIds = dataStore.getVolunteers().map(v => v.volunteer_id);
    const nextId = generateNextVolunteerId(existingIds);
    setNewId(nextId);
    setNewName('');
    setNewEmail('');
    setNewPhone('');
    setNewNotes('');
    setAddError(null);
    setShowAddModal(true);
  };

  const handleSaveVolunteer = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    const normalized = normalizeVolunteerId(newId);
    if (!isValidVolunteerIdFormat(normalized)) {
      setAddError(`Invalid ID format: "${normalized}". Expected format like LLO-VOL-001`);
      return;
    }

    if (!newName.trim()) {
      setAddError('Full name is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await dataStore.addVolunteer(
        {
          volunteer_id: normalized,
          full_name: newName.trim(),
          email: newEmail.trim() || null,
          phone: newPhone.trim() || null,
          is_active: true,
          notes: newNotes.trim() || null,
        },
        currentStaff
      );

      if (res.success) {
        setShowAddModal(false);
        loadVolunteers();
      } else {
        setAddError(res.message);
      }
    } catch (err: any) {
      setAddError(err?.message || 'Failed to save volunteer to database.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportCsv = () => {
    dataStore.addAuditLog(currentStaff, 'CSV_EXPORT', 'volunteer', null, {
      count: volunteers.length,
    });
    const content = generateVolunteersCsv(volunteers);
    triggerCsvDownload(content, `llo-volunteers-${Date.now()}.csv`);
  };

  const handleDownloadTemplate = () => {
    const templateContent = generateVolunteerTemplateCsv();
    triggerCsvDownload(templateContent, 'llo_volunteer_import_template.csv');
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = evt => {
      const text = evt.target?.result as string;
      setCsvText(text);
    };
    reader.readAsText(file);
  };

  const handleProcessCsvImport = async () => {
    if (!csvText.trim()) {
      setImportStatus({ message: 'Please select or paste CSV text first.', isError: true });
      return;
    }

    const parseResult = parseVolunteersCsv(csvText);

    if (parseResult.totalRows === 0) {
      setImportStatus({ message: 'No valid data rows found in CSV.', isError: true });
      return;
    }

    const validRowsToImport = parseResult.rows
      .filter(r => r.isValid)
      .map(r => ({
        volunteer_id: r.volunteer_id,
        full_name: r.full_name,
        email: r.email,
        phone: r.phone,
        is_active: true,
        notes: r.notes,
      }));

    setIsImporting(true);
    try {
      const result = await dataStore.importVolunteers(validRowsToImport, currentStaff);
      setImportStatus({
        message: `${result.message} (${parseResult.errorCount} malformed rows excluded).`,
        isError: !result.success,
      });

      if (result.success) {
        loadVolunteers();
        setTimeout(() => {
          setShowImportModal(false);
          setImportStatus(null);
          setCsvText('');
        }, 1500);
      }
    } catch (err: any) {
      setImportStatus({ message: err?.message || 'Import failed.', isError: true });
    } finally {
      setIsImporting(false);
    }
  };

  const handleConfirmToggleActive = async () => {
    if (!toggleTarget) return;
    const newStatus = !toggleTarget.is_active;

    await dataStore.updateVolunteer(toggleTarget.id, { is_active: newStatus }, currentStaff);
    setToggleTarget(null);
    loadVolunteers();
  };

  return (
    <div className="space-y-6">
      {/* Title & Action Buttons */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-xl sm:text-2xl font-bold text-slate-900">Volunteer Directory & IDs</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage assigned volunteer credentials, track rosters, and inspect 30-day activity matrices
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <>
              <button
                onClick={handleOpenAddModal}
                className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add Volunteer</span>
              </button>

              <button
                onClick={() => {
                  setCsvText('');
                  setImportStatus(null);
                  setShowImportModal(true);
                }}
                className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 hover:border-slate-300 transition shadow-sm"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import CSV</span>
              </button>
            </>
          )}

          <button
            onClick={handleDownloadTemplate}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 hover:border-slate-300 transition shadow-sm"
            title="Download blank CSV template with sample volunteer IDs and format"
          >
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            <span>Download Template</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 hover:border-slate-300 transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Directory</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Search */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Search Volunteers
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter by name, ID (e.g. LLO-VOL-001), or email..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-linkedin"
            />
          </div>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Account Status
          </label>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-linkedin"
          >
            <option value="">All Statuses</option>
            <option value="active">Active IDs Only</option>
            <option value="inactive">Inactive IDs Only</option>
          </select>
        </div>
      </div>

      {/* Volunteer Directory Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Volunteer ID</th>
                <th className="py-3 px-4">Full Name</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4 text-center">Check-Ins</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {volunteers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No volunteers found matching current criteria.
                  </td>
                </tr>
              ) : (
                volunteers.map(vol => (
                  <tr
                    key={vol.id}
                    className={`hover:bg-slate-50 transition ${
                      !vol.is_active ? 'bg-slate-50/50 text-slate-400' : 'text-slate-700'
                    }`}
                  >
                    {/* Volunteer ID */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-mono font-bold text-linkedin bg-blue-50 px-2 py-0.5 rounded">
                        {vol.volunteer_id}
                      </span>
                    </td>

                    {/* Name */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-bold text-slate-900 block">{vol.full_name}</span>
                      {vol.notes && (
                        <span className="text-[10px] text-slate-500 truncate max-w-xs block">
                          {vol.notes}
                        </span>
                      )}
                    </td>

                    {/* Contact */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="block text-slate-700">{vol.email || '–'}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{vol.phone || '–'}</span>
                    </td>

                    {/* Check-ins count */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                        {vol.submission_count || 0}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {vol.is_active ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          ACTIVE
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                          INACTIVE
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                      {/* View Matrix */}
                      <button
                        onClick={() => setSelectedVolunteer(vol)}
                        className="px-2.5 py-1 text-xs text-linkedin hover:text-linkedin-dark hover:bg-blue-50 rounded transition font-medium"
                        title="View 30-day participation matrix"
                      >
                        <Eye className="w-3.5 h-3.5 inline mr-1" />
                        <span>Matrix</span>
                      </button>

                      {/* Toggle Active/Inactive */}
                      {canManage && (
                        <button
                          onClick={() => setToggleTarget(vol)}
                          className={`px-2 py-1 text-[11px] rounded font-medium transition ${
                            vol.is_active
                              ? 'text-rose-600 hover:bg-rose-50'
                              : 'text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          {vol.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add Volunteer */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveVolunteer}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-base text-slate-900">Add New Volunteer</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {addError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-xs font-medium">
                {addError}
              </div>
            )}

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                  Assigned Volunteer ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newId}
                  onChange={e => setNewId(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono uppercase focus:bg-white focus:border-linkedin"
                  placeholder="LLO-VOL-001"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Auto-sequenced format: LLO-VOL-###
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-linkedin"
                  placeholder="e.g. Chinedu Okeke"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-linkedin"
                    placeholder="email@example.com"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={e => setNewPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-linkedin"
                    placeholder="+23480..."
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                  Notes / Role Brief
                </label>
                <textarea
                  rows={2}
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                  placeholder="e.g. Volunteer notes, preferred session..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-linkedin"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100 mt-4">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-bold text-white bg-linkedin hover:bg-linkedin-dark disabled:opacity-50 rounded-lg shadow transition flex items-center space-x-1.5"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving to Database...</span>
                  </>
                ) : (
                  <span>Save Volunteer Record</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Import CSV */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2">
                <Upload className="w-5 h-5 text-linkedin" />
                <h3 className="font-bold text-base text-slate-900">Import Volunteers via CSV</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {importStatus && (
              <div
                className={`mb-4 p-3 rounded-lg text-xs font-medium ${
                  importStatus.isError
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}
              >
                {importStatus.message}
              </div>
            )}

            <div className="space-y-3.5 text-xs text-slate-600">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <span className="font-bold text-slate-900 block text-xs">Need the CSV import format?</span>
                  <span className="text-[11px] text-slate-600">Download our pre-formatted template with sample volunteer IDs and names.</span>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-linkedin hover:bg-linkedin-dark text-white font-bold text-xs rounded-lg shadow-xs transition flex-shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Template</span>
                </button>
              </div>

              <p>
                Upload a CSV file containing volunteer rosters. Supported headers:
                <code className="text-linkedin font-mono ml-1">volunteer_id, full_name, email, phone, notes</code>
              </p>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                  Upload .csv File
                </label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvFileUpload}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                  Or Paste CSV Data
                </label>
                <textarea
                  rows={5}
                  value={csvText}
                  onChange={e => setCsvText(e.target.value)}
                  placeholder="volunteer_id,full_name,email,phone&#10;LLO-VOL-010,Ibrahim Musa,ibrahim@example.com,+23480..."
                  className="w-full font-mono text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-linkedin"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100 mt-4">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProcessCsvImport}
                disabled={isImporting}
                className="px-4 py-2 text-xs font-bold text-white bg-linkedin hover:bg-linkedin-dark disabled:opacity-50 rounded-lg shadow transition flex items-center space-x-1.5"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Importing to Database...</span>
                  </>
                ) : (
                  <span>Validate & Import</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Status Toggle Confirmation */}
      {toggleTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn">
            <div className="flex items-center space-x-2 text-amber-600 mb-3">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-base text-slate-900">
                {toggleTarget.is_active ? 'Deactivate Volunteer?' : 'Re-activate Volunteer?'}
              </h3>
            </div>

            <p className="text-xs text-slate-600 mb-3">
              Are you sure you want to {toggleTarget.is_active ? 'deactivate' : 'activate'}{' '}
              <strong className="text-slate-900">{toggleTarget.full_name}</strong> (
              <code className="font-mono">{toggleTarget.volunteer_id}</code>)?
            </p>

            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-[11px] text-amber-800 mb-4">
              <strong>Notice:</strong> Deactivating an ID prevents new check-ins, but does
              <strong> not delete</strong> any existing historical check-ins or records.
            </div>

            <div className="flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setToggleTarget(null)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmToggleActive}
                className={`px-4 py-1.5 text-xs font-bold text-white rounded-lg shadow transition ${
                  toggleTarget.is_active
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {toggleTarget.is_active ? 'Confirm Deactivate' : 'Confirm Activate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal with 30-Day Matrix */}
      {selectedVolunteer && (
        <VolunteerDetailModal
          volunteer={selectedVolunteer}
          onClose={() => setSelectedVolunteer(null)}
        />
      )}
    </div>
  );
};
