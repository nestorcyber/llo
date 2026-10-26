import React, { useState, useEffect } from 'react';
import { Shield, UserPlus, X, AlertTriangle } from 'lucide-react';
import { StaffProfile, StaffRole } from '../../types';
import { dataStore } from '../../lib/data-store';

interface Props {
  currentStaff: StaffProfile;
}

export const TeamManagement: React.FC<Props> = ({ currentStaff }) => {
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<StaffRole>('manager');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = () => {
    setStaffList(dataStore.getStaff());
  };

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newEmail.trim() || !newName.trim()) {
      setError('Name and Email are required.');
      return;
    }

    if (staffList.some(s => s.email.toLowerCase() === newEmail.trim().toLowerCase())) {
      setError(`A staff member with email "${newEmail}" already exists.`);
      return;
    }

    dataStore.addStaff(
      {
        email: newEmail.trim().toLowerCase(),
        full_name: newName.trim(),
        role: newRole,
        is_active: true,
      },
      currentStaff
    );

    setShowAddModal(false);
    setNewName('');
    setNewEmail('');
    setNewRole('manager');
    loadStaff();
  };

  const handleRoleChange = (targetStaff: StaffProfile, role: StaffRole) => {
    setError(null);
    const res = dataStore.updateStaffRole(targetStaff.id, role, currentStaff);
    if (!res.success) {
      setError(res.message);
    } else {
      loadStaff();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-linkedin" />
            <h1 className="text-xl font-bold text-slate-900">Team & Role Administration</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage administrative access levels. Role changes and invitations are restricted to Owners.
          </p>
        </div>

        <button
          onClick={() => {
            setError(null);
            setShowAddModal(true);
          }}
          className="flex items-center space-x-1.5 px-3.5 py-2 bg-linkedin hover:bg-linkedin-dark text-white text-xs font-semibold rounded-lg shadow-sm transition"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Invite / Provision Team Member</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-2.5 text-red-800 text-xs font-medium">
          <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Role Definitions Reference Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl text-xs">
          <span className="font-bold text-amber-900 block mb-1">Owner (Super Admin)</span>
          <p className="text-amber-800">
            Full system control: team member provisioning, role assignment, programme archiving, task management, record voiding, and exports.
          </p>
        </div>

        <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl text-xs">
          <span className="font-bold text-blue-900 block mb-1">Manager (Operations)</span>
          <p className="text-blue-800">
            Operational control: add and import volunteers, create and open tasks, set session overrides, void incorrect submissions, and export CSVs.
          </p>
        </div>

        <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl text-xs">
          <span className="font-bold text-emerald-900 block mb-1">Viewer (Auditor / Read-Only)</span>
          <p className="text-emerald-800">
            Observability: inspect real-time operational dashboards, view attendance tables, search volunteers, and download CSV reports.
          </p>
        </div>
      </div>

      {/* Staff Members Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Staff Member</th>
              <th className="py-3 px-4">Email</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Account Status</th>
              <th className="py-3 px-4 text-right">Role Assignment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {staffList.map(member => {
              const isCurrentUser = member.id === currentStaff.id;
              return (
                <tr key={member.id} className="hover:bg-slate-50 transition text-slate-700">
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="font-bold text-slate-900 block">{member.full_name}</span>
                    {isCurrentUser && (
                      <span className="text-[10px] text-linkedin font-semibold">(You)</span>
                    )}
                  </td>

                  <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-600">
                    {member.email}
                  </td>

                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        member.role === 'owner'
                          ? 'bg-amber-100 text-amber-800'
                          : member.role === 'manager'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {member.role}
                    </span>
                  </td>

                  <td className="py-3 px-4 whitespace-nowrap">
                    {member.is_active ? (
                      <span className="text-emerald-600 font-medium">Active</span>
                    ) : (
                      <span className="text-rose-600 font-medium">Inactive</span>
                    )}
                  </td>

                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <select
                      value={member.role}
                      onChange={e => handleRoleChange(member, e.target.value as StaffRole)}
                      className="px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:border-linkedin"
                    >
                      <option value="owner">Owner</option>
                      <option value="manager">Manager</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal: Provision Team Member */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleAddStaff}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-base text-slate-900">Provision Team Member</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Somtochukwu Obi"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-linkedin"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="name@llowerri.org"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-linkedin"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                  Role Assignment
                </label>
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value as StaffRole)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-linkedin"
                >
                  <option value="manager">Manager (Volunteer, Task, & Attendance Ops)</option>
                  <option value="viewer">Viewer (Read-Only & CSV Export)</option>
                  <option value="owner">Owner (Full Admin Access)</option>
                </select>
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
                className="px-4 py-2 text-xs font-bold text-white bg-linkedin hover:bg-linkedin-dark rounded-lg shadow transition"
              >
                Create Staff Member
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
