import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Edit2,
  Archive,
  X,
  Sun,
  Sunset,
  Moon,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { Programme, ProgrammeDay, SessionSlot, SessionTask, StaffProfile } from '../../types';
import { dataStore } from '../../lib/data-store';
import { RolePermissions } from '../../lib/validation';

interface Props {
  currentStaff: StaffProfile;
}

export const ProgrammeSchedule: React.FC<Props> = ({ currentStaff }) => {
  const [programme, setProgramme] = useState<Programme | null>(null);
  const [days, setDays] = useState<ProgrammeDay[]>([]);
  const [selectedDayId, setSelectedDayId] = useState<string>('');
  const [daySlots, setDaySlots] = useState<Array<SessionSlot & { tasks: SessionTask[]; formatted_window: string }>>([]);

  // Add/Edit Task Modal
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<SessionTask | null>(null);
  const [taskTargetSlotId, setTaskTargetSlotId] = useState<string>('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskCategory, setTaskCategory] = useState('Media & Publicity');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskStatus, setTaskStatus] = useState<SessionTask['status']>('open');
  const [taskError, setTaskError] = useState<string | null>(null);

  // Archive modal
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [activeSuccessMsg, setActiveSuccessMsg] = useState<string | null>(null);

  const canManage = RolePermissions.canManageTasks(currentStaff.role);
  const isOwner = RolePermissions.canArchiveProgramme(currentStaff.role);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedDayId) {
      loadDaySlots(selectedDayId);
    }
  }, [selectedDayId]);

  const loadData = () => {
    const activeDays = dataStore.getProgrammeDays();
    setDays(activeDays);
    const prog = (dataStore as any).state?.programmes?.[0] || null;
    setProgramme(prog);

    if (activeDays.length > 0 && !selectedDayId) {
      setSelectedDayId(activeDays[0].id);
    }
  };

  const handleSetActiveDay = (dayNumber: number) => {
    const res = dataStore.setActiveProgrammeDay(dayNumber, currentStaff, true);
    if (res.success) {
      setActiveSuccessMsg(res.message);
      setTimeout(() => setActiveSuccessMsg(null), 4000);
      loadData();
      if (selectedDayId) loadDaySlots(selectedDayId);
    }
  };

  const loadDaySlots = (dayId: string) => {
    const slots = dataStore.getDaySessionSlots(dayId);
    setDaySlots(slots as any);
  };

  const handleOpenAddTask = (slotId: string) => {
    setEditingTask(null);
    setTaskTargetSlotId(slotId);
    setTaskTitle('');
    setTaskCategory('Media & Publicity');
    setTaskDescription('');
    setTaskStatus('open');
    setTaskError(null);
    setShowTaskModal(true);
  };

  const handleOpenEditTask = (task: SessionTask) => {
    setEditingTask(task);
    setTaskTargetSlotId(task.session_slot_id);
    setTaskTitle(task.title);
    setTaskCategory(task.category);
    setTaskDescription(task.description || '');
    setTaskStatus(task.status);
    setTaskError(null);
    setShowTaskModal(true);
  };

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    setTaskError(null);

    if (!taskTitle.trim()) {
      setTaskError('Task title is required.');
      return;
    }

    if (editingTask) {
      dataStore.updateTask(
        editingTask.id,
        {
          title: taskTitle.trim(),
          category: taskCategory,
          description: taskDescription.trim() || null,
          status: taskStatus,
        },
        currentStaff
      );
    } else {
      dataStore.addTask(
        {
          session_slot_id: taskTargetSlotId,
          title: taskTitle.trim(),
          category: taskCategory,
          description: taskDescription.trim() || null,
          status: taskStatus,
        },
        currentStaff
      );
    }

    setShowTaskModal(false);
    if (selectedDayId) loadDaySlots(selectedDayId);
  };

  const handleToggleOverride = (slotId: string, currentOverride: boolean | null) => {
    // Cycles: null (auto) -> true (force open) -> false (force closed) -> null (auto)
    let nextOverride: boolean | null = true;
    if (currentOverride === true) nextOverride = false;
    else if (currentOverride === false) nextOverride = null;

    dataStore.setSlotOverride(slotId, nextOverride, currentStaff);
    if (selectedDayId) loadDaySlots(selectedDayId);
  };

  const handleArchiveProgramme = () => {
    if (!programme) return;
    (dataStore as any).archiveProgramme?.(programme.id, currentStaff);
    setShowArchiveModal(false);
    loadData();
  };

  const selectedDay = days.find(d => d.id === selectedDayId);

  return (
    <div className="space-y-6">
      {/* Top Banner: Programme Config */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900">
              {programme?.title || '30-Day Volunteer Programme'}
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-emerald-100 text-emerald-800">
              {programme?.status || 'active'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 flex items-center space-x-3">
            <span>Duration: <strong>30 Days</strong></span>
            <span>•</span>
            <span>Timezone: <strong>Africa/Lagos (WAT, UTC+1)</strong></span>
            <span>•</span>
            <span>Started: {programme?.start_date}</span>
          </p>
        </div>

        {isOwner && programme?.status === 'active' && (
          <button
            onClick={() => setShowArchiveModal(true)}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
            title="Complete and archive programme without losing records"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Complete & Archive Programme</span>
          </button>
        )}
      </div>

      {/* Success Notification */}
      {activeSuccessMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center space-x-2.5 text-emerald-900 text-xs font-semibold shadow-xs animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{activeSuccessMsg}</span>
        </div>
      )}

      {/* 30-Day Selector Pills */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-2.5">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            Select Programme Day to Inspect & Manage:
          </label>
          <span className="text-[11px] text-slate-500 flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            <span>Currently Active: <strong>Day {programme?.active_day_number || 1}</strong></span>
          </span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {days.map(d => {
            const isSelected = d.id === selectedDayId;
            const isActiveForVolunteers = d.day_number === programme?.active_day_number;
            return (
              <button
                key={d.id}
                onClick={() => setSelectedDayId(d.id)}
                className={`relative flex-shrink-0 px-3.5 py-2 rounded-xl text-center border transition ${
                  isSelected
                    ? 'bg-linkedin text-white border-linkedin shadow-sm'
                    : isActiveForVolunteers
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {isActiveForVolunteers && (
                  <span
                    className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white"
                    title="Active for Volunteers"
                  />
                )}
                <div className="text-xs font-bold leading-tight">Day {d.day_number}</div>
                <div className={`text-[10px] ${isSelected ? 'text-blue-100' : isActiveForVolunteers ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                  {isActiveForVolunteers ? 'ACTIVE' : d.calendar_date.slice(5)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Day Overview & 3 Session Slot Cards */}
      {selectedDay && (
        <div className="space-y-4">
          {/* Active Day Status Card */}
          <div
            className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs ${
              selectedDay.day_number === programme?.active_day_number
                ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            <div className="flex items-center space-x-3">
              {selectedDay.day_number === programme?.active_day_number ? (
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              ) : (
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
              )}
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-sm">
                    {selectedDay.day_number === programme?.active_day_number
                      ? `Day ${selectedDay.day_number} is LIVE & ACTIVE for Volunteers`
                      : `Day ${selectedDay.day_number} is currently inactive for check-in`}
                  </span>
                  {selectedDay.day_number === programme?.active_day_number && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-600 text-white uppercase tracking-wider">
                      Live
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedDay.day_number === programme?.active_day_number
                    ? 'Volunteers accessing the check-in page are automatically directed to this day.'
                    : `Volunteers are currently directed to Day ${programme?.active_day_number || 1}. Activate this day to switch volunteer check-ins here.`}
                </p>
              </div>
            </div>

            {canManage && (
              <div className="flex-shrink-0">
                {selectedDay.day_number === programme?.active_day_number ? (
                  <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg border border-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Active for Volunteers</span>
                  </span>
                ) : (
                  <button
                    onClick={() => handleSetActiveDay(selectedDay.day_number)}
                    className="flex items-center space-x-1.5 px-3.5 py-2 bg-linkedin hover:bg-linkedin-dark text-white text-xs font-bold rounded-lg shadow-sm transition"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Set Day {selectedDay.day_number} Active for Volunteers</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-linkedin" />
              <span>
                Day {selectedDay.day_number} Sessions ({selectedDay.calendar_date})
              </span>
            </h2>
            <span className="text-xs text-slate-500 font-medium">{selectedDay.theme}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {daySlots.map(slot => {
              const sessionIcon =
                slot.session_code === 'morning' ? Sun :
                slot.session_code === 'afternoon' ? Sunset : Moon;
              const Icon = sessionIcon;

              return (
                <div
                  key={slot.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between"
                >
                  <div>
                    {/* Slot Header */}
                    <div className="flex items-start justify-between mb-3 pb-3 border-b border-slate-100">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-9 h-9 rounded-lg bg-blue-50 text-linkedin flex items-center justify-center">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">{slot.name}</h3>
                          <div className="text-[11px] text-slate-500 flex items-center space-x-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{slot.formatted_window}</span>
                          </div>
                        </div>
                      </div>

                      {/* Override Button (Managers/Owners) */}
                      {canManage && (
                        <button
                          onClick={() => handleToggleOverride(slot.id, slot.is_override_open)}
                          className={`text-[10px] font-bold px-2 py-1 rounded transition border ${
                            slot.is_override_open === true
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : slot.is_override_open === false
                              ? 'bg-rose-50 text-rose-700 border-rose-300'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                          title="Click to cycle: Auto (Window) -> Force Open -> Force Closed"
                        >
                          {slot.is_override_open === true
                            ? 'FORCE OPEN'
                            : slot.is_override_open === false
                            ? 'FORCE CLOSED'
                            : 'WINDOW (AUTO)'}
                        </button>
                      )}
                    </div>

                    {/* Task List */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        <span>Tasks ({slot.tasks.length})</span>
                        {canManage && (
                          <button
                            onClick={() => handleOpenAddTask(slot.id)}
                            className="text-linkedin hover:text-linkedin-dark flex items-center space-x-1 normal-case font-semibold"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add Task</span>
                          </button>
                        )}
                      </div>

                      {slot.tasks.length === 0 ? (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center text-xs text-slate-400">
                          No tasks assigned to this slot yet.
                        </div>
                      ) : (
                        slot.tasks.map(task => (
                          <div
                            key={task.id}
                            className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1 hover:border-slate-300 transition"
                          >
                            <div className="flex items-start justify-between">
                              <span className="font-semibold text-slate-800 leading-tight">
                                {task.title}
                              </span>
                              {canManage && (
                                <button
                                  onClick={() => handleOpenEditTask(task)}
                                  className="text-slate-400 hover:text-slate-600 p-0.5 ml-1"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            {task.description && (
                              <p className="text-[11px] text-slate-500 line-clamp-2">
                                {task.description}
                              </p>
                            )}
                            <div className="flex items-center justify-between pt-1">
                              <span className="text-[10px] font-medium text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                {task.category}
                              </span>
                              <span
                                className={`text-[10px] font-bold uppercase ${
                                  task.status === 'open'
                                    ? 'text-emerald-700'
                                    : task.status === 'closed'
                                    ? 'text-slate-500'
                                    : 'text-rose-600'
                                }`}
                              >
                                {task.status}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal: Add / Edit Task */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveTask}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-base text-slate-900">
                {editingTask ? 'Edit Session Task' : 'Add New Session Task'}
              </h3>
              <button
                type="button"
                onClick={() => setShowTaskModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {taskError && (
              <div className="mb-4 p-2.5 bg-red-50 text-red-700 rounded-lg text-xs font-medium">
                {taskError}
              </div>
            )}

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                  Task Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={e => setTaskTitle(e.target.value)}
                  placeholder="e.g. Social Media Blast & Morning Amplification"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-linkedin"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                  Category / Functional Area
                </label>
                <select
                  value={taskCategory}
                  onChange={e => setTaskCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-linkedin"
                >
                  <option value="Media & Publicity">Media & Publicity</option>
                  <option value="Registration">Registration & Check-In</option>
                  <option value="Logistics">Logistics & Venue</option>
                  <option value="Protocol">Protocol & Speakers</option>
                  <option value="Technical">Technical & Audio-Visual</option>
                  <option value="General">General Support</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                  Task Description / Instructions
                </label>
                <textarea
                  rows={3}
                  value={taskDescription}
                  onChange={e => setTaskDescription(e.target.value)}
                  placeholder="Describe what volunteers must execute to complete this task..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-linkedin"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                  Status
                </label>
                <select
                  value={taskStatus}
                  onChange={e => setTaskStatus(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-linkedin"
                >
                  <option value="open">Open for Submissions</option>
                  <option value="closed">Closed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="draft">Draft (Hidden)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100 mt-4">
              <button
                type="button"
                onClick={() => setShowTaskModal(false)}
                className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold text-white bg-linkedin hover:bg-linkedin-dark rounded-lg shadow transition"
              >
                Save Task
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Complete & Archive Programme */}
      {showArchiveModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn">
            <div className="flex items-center space-x-2 text-amber-600 mb-3">
              <Archive className="w-5 h-5" />
              <h3 className="font-bold text-base text-slate-900">Archive Programme?</h3>
            </div>
            <p className="text-xs text-slate-600 mb-3">
              Completing and archiving this programme will mark it as read-only.
              <strong> All volunteer submissions, audit logs, and attendance matrices are fully preserved.</strong>
            </p>
            <div className="flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowArchiveModal(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleArchiveProgramme}
                className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow transition"
              >
                Confirm Archive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
