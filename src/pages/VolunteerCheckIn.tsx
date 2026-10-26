import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  ShieldCheck,
  Send,
  RefreshCw,
  Info,
  UserCheck,
  ArrowRight,
  Lock,
} from 'lucide-react';
import { PublicScheduleData, SubmissionResult } from '../types';
import { fetchPublicSchedule, submitVolunteerTask } from '../lib/api-client';
import { normalizeVolunteerId, isValidVolunteerIdFormat } from '../lib/validation';
import { formatLagosDateTime, formatSessionWindowRange } from '../lib/lagos-time';

interface Props {
  onNavigateToAdmin: () => void;
}

export const VolunteerCheckIn: React.FC<Props> = ({ onNavigateToAdmin }) => {
  const [scheduleData, setScheduleData] = useState<PublicScheduleData | null>(null);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [volunteerId, setVolunteerId] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [pin, setPin] = useState('');
  const [showPinInput, setShowPinInput] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Live Lagos clock
  const [currentLagosTime, setCurrentLagosTime] = useState<string>('');

  useEffect(() => {
    loadSchedule();
    const interval = setInterval(() => {
      setCurrentLagosTime(formatLagosDateTime(new Date()));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  async function loadSchedule(dayNumber?: number) {
    setLoadingSchedule(true);
    try {
      const data = await fetchPublicSchedule(dayNumber);
      setScheduleData(data);

      // Auto-select first open slot, or first slot
      const openSlot = data.slots.find(s => s.is_open) || data.slots[0];
      if (openSlot) {
        setSelectedSlotId(openSlot.id);
      }
    } catch (err) {
      console.error('Failed to load schedule:', err);
    } finally {
      setLoadingSchedule(false);
    }
  }

  const currentSlot = scheduleData?.slots.find(s => s.id === selectedSlotId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmissionResult(null);

    const normalized = normalizeVolunteerId(volunteerId);

    if (!normalized) {
      setFormError('Please enter your assigned Volunteer ID.');
      return;
    }

    if (!isValidVolunteerIdFormat(normalized)) {
      setFormError(`Invalid Volunteer ID format: "${normalized}". Expected format like LLO-VOL-001.`);
      return;
    }

    if (!selectedSlotId) {
      setFormError('Please select a programme session.');
      return;
    }

    if (currentSlot && !currentSlot.is_open) {
      setFormError(`The ${currentSlot.name} is currently closed for check-in.`);
      return;
    }

    // Prevent accidental repeated submission
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const result = await submitVolunteerTask({
        volunteer_id: normalized,
        session_slot_id: selectedSlotId,
        pin: pin || undefined,
      });

      setSubmissionResult(result);
    } catch (err: any) {
      setSubmissionResult({
        success: false,
        message: 'A network error occurred. Please check your internet connection and try again.',
        error_code: 'SERVER_ERROR',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForAnother = () => {
    setSubmissionResult(null);
    setFormError(null);
  };

  const handleVolunteerIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Automatically capitalize for user convenience
    setVolunteerId(e.target.value.toUpperCase());
    if (formError) setFormError(null);
    if (submissionResult) setSubmissionResult(null);
  };

  const selectDemoId = (id: string) => {
    setVolunteerId(id);
    if (formError) setFormError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Top Banner */}
      <header className="bg-linkedin-navy text-white shadow-md border-b-4 border-linkedin">
        <div className="max-w-xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-linkedin flex items-center justify-center font-bold text-white text-lg tracking-wider shadow">
              LLO
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">LinkedIn Local Owerri</h1>
              <p className="text-xs text-slate-300">Volunteer Engagement Tracking System</p>
            </div>
          </div>
          <button
            onClick={onNavigateToAdmin}
            className="text-xs text-slate-300 hover:text-white flex items-center space-x-1 py-1.5 px-2.5 rounded border border-slate-700 hover:border-slate-500 transition"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-linkedin-light" />
            <span>Staff Login</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-xl w-full mx-auto px-4 py-6 flex-1">
        {/* Programme Status Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
            <Calendar className="w-4 h-4 text-linkedin" />
            <span className="font-semibold text-slate-900">
              {scheduleData ? `Day ${scheduleData.current_day.day_number} of ${scheduleData.programme.duration_days}` : '30-Day Programme'}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 uppercase tracking-wide">
              Active Day
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-xs text-slate-600">
              {scheduleData?.current_day.calendar_date}
            </span>
          </div>
          <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-mono">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{currentLagosTime || 'Loading time (WAT)...'}</span>
          </div>
        </div>

        {/* Loading State */}
        {loadingSchedule && !scheduleData && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
            <RefreshCw className="w-8 h-8 text-linkedin animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-600">Loading today's programme schedule...</p>
          </div>
        )}

        {/* Success Feedback Card */}
        {submissionResult && submissionResult.success && submissionResult.submission && (
          <div className="bg-white rounded-2xl shadow-md border-2 border-emerald-500 p-6 mb-6 animate-fadeIn">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-200">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="text-center mb-6">
              <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full uppercase tracking-wider mb-2">
                Reported Participation Verified
              </span>
              <h2 className="text-xl font-bold text-slate-900">Check-in Confirmed!</h2>
              <p className="text-sm text-slate-600 mt-1">
                Thank you for contributing to LinkedIn Local Owerri.
              </p>
            </div>

            {/* Resolved Volunteer & Submission Details */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3 text-sm">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-slate-500">Volunteer Name:</span>
                <span className="font-bold text-slate-900 flex items-center space-x-1.5">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  <span>{submissionResult.submission.volunteer_name}</span>
                </span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-slate-500">Assigned ID:</span>
                <span className="font-mono font-semibold text-slate-800">
                  {submissionResult.submission.volunteer_id}
                </span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-slate-500">Programme Session:</span>
                <span className="font-medium text-slate-800">
                  {submissionResult.submission.session_name}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <span>Timestamp:</span>
                <span className="font-mono">{submissionResult.submission.submitted_at_lagos}</span>
              </div>
            </div>

            <button
              onClick={handleResetForAnother}
              className="mt-6 w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl transition text-sm flex items-center justify-center space-x-2"
            >
              <span>Check in another session or volunteer</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Check-In Form (Shown when not showing success) */}
        {(!submissionResult || !submissionResult.success) && scheduleData && (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6">
            <div className="mb-5 pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Volunteer Session Check-In</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                No login required. Enter your assigned ID to check in.
              </p>
            </div>

            {/* Error Banners */}
            {formError && (
              <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-2.5 text-red-800 text-xs">
                <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <span className="font-medium">{formError}</span>
              </div>
            )}

            {submissionResult && !submissionResult.success && (
              <div
                className={`mb-5 p-4 rounded-xl border flex items-start space-x-3 text-xs ${
                  submissionResult.error_code === 'DUPLICATE_SUBMISSION'
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : submissionResult.error_code === 'SESSION_CLOSED'
                    ? 'bg-slate-100 border-slate-300 text-slate-800'
                    : submissionResult.error_code === 'INVALID_VOLUNTEER_ID'
                    ? 'bg-rose-50 border-rose-300 text-rose-900'
                    : 'bg-red-50 border-red-300 text-red-900'
                }`}
              >
                <AlertTriangle
                  className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                    submissionResult.error_code === 'DUPLICATE_SUBMISSION'
                      ? 'text-amber-600'
                      : 'text-red-600'
                  }`}
                />
                <div>
                  <p className="font-bold mb-1">
                    {submissionResult.error_code === 'DUPLICATE_SUBMISSION'
                      ? 'Already Checked In'
                      : submissionResult.error_code === 'SESSION_CLOSED'
                      ? 'Session Window Closed'
                      : submissionResult.error_code === 'INVALID_VOLUNTEER_ID'
                      ? 'Volunteer ID Not Found'
                      : submissionResult.error_code === 'INACTIVE_VOLUNTEER'
                      ? 'Volunteer Account Inactive'
                      : 'Check-in Error'}
                  </p>
                  <p className="leading-relaxed">{submissionResult.message}</p>
                </div>
              </div>
            )}

            {/* Field 1: Assigned Volunteer ID */}
            <div className="mb-5">
              <label htmlFor="volunteer_id" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                1. Assigned Volunteer ID <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="volunteer_id"
                  name="volunteer_id"
                  type="text"
                  value={volunteerId}
                  onChange={handleVolunteerIdChange}
                  placeholder="e.g. LLO-VOL-001"
                  autoComplete="off"
                  spellCheck="false"
                  disabled={isSubmitting}
                  className="w-full px-3.5 py-3 text-base sm:text-sm font-mono uppercase bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-linkedin focus:ring-2 focus:ring-linkedin/20 transition"
                  required
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>Standard format: <code className="text-linkedin font-mono">LLO-VOL-###</code></span>
              </div>

              {/* Quick Volunteer ID selector pills for easy testing */}
              <div className="mt-2.5 pt-2 border-t border-slate-100">
                <span className="text-[11px] text-slate-500 block mb-1.5">Quick Demo IDs:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'LLO-VOL-001', name: 'Chinedu' },
                    { id: 'LLO-VOL-002', name: 'Amina' },
                    { id: 'LLO-VOL-003', name: 'Ngozi' },
                    { id: 'LLO-VOL-007', name: 'Blessing (Inactive)' },
                  ].map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectDemoId(item.id)}
                      className={`text-[11px] px-2 py-1 rounded-md border font-mono transition ${
                        volunteerId === item.id
                          ? 'bg-linkedin text-white border-linkedin'
                          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {item.id} ({item.name})
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Field 2: Programme Session Selection */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                2. Programme Session <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                {scheduleData.slots.map(slot => {
                  const isSelected = selectedSlotId === slot.id;
                  const isSlotOpen = slot.is_open;
                  const windowRange = formatSessionWindowRange(
                    slot.scheduled_time,
                    slot.window_open_offset_minutes,
                    slot.window_close_offset_minutes
                  );

                  return (
                    <label
                      key={slot.id}
                      className={`block p-3 rounded-xl border cursor-pointer transition ${
                        isSelected
                          ? 'border-linkedin bg-blue-50/60 ring-2 ring-linkedin/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <input
                            type="radio"
                            name="session_slot"
                            value={slot.id}
                            checked={isSelected}
                            onChange={() => setSelectedSlotId(slot.id)}
                            className="w-4 h-4 text-linkedin border-slate-300 focus:ring-linkedin"
                          />
                          <div>
                            <div className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                              <span>{slot.name}</span>
                            </div>
                            <div className="text-xs text-slate-500 flex items-center space-x-1 mt-0.5">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>{windowRange}</span>
                            </div>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div>
                          {isSlotOpen ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-full flex items-center space-x-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              <span>OPEN</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[11px] font-medium rounded-full">
                              CLOSED
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Optional PIN toggle (Architectural readiness for PIN auth) */}
            <div className="mb-6">
              <button
                type="button"
                onClick={() => setShowPinInput(!showPinInput)}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center space-x-1"
              >
                <Lock className="w-3 h-3 text-slate-400" />
                <span>{showPinInput ? 'Hide PIN field' : 'Have a private security PIN? (Optional)'}</span>
              </button>
              {showPinInput && (
                <div className="mt-2">
                  <input
                    type="password"
                    maxLength={6}
                    value={pin}
                    onChange={e => setPin(e.target.value)}
                    placeholder="Enter 4-6 digit PIN if issued"
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-linkedin"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    ID-only check-in is standard. PIN verification is active only if assigned by coordinator.
                  </span>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !selectedSlotId || (currentSlot && !currentSlot.is_open)}
              className={`w-full py-3.5 px-4 rounded-xl text-white font-bold text-sm shadow-md transition flex items-center justify-center space-x-2 ${
                isSubmitting || (currentSlot && !currentSlot.is_open)
                  ? 'bg-slate-400 cursor-not-allowed opacity-80'
                  : 'bg-linkedin hover:bg-linkedin-dark active:scale-[0.99]'
              }`}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying & Recording...</span>
                </>
              ) : currentSlot && !currentSlot.is_open ? (
                <span>Session Currently Closed</span>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Check In Now</span>
                </>
              )}
            </button>

            {/* Notice */}
            <div className="mt-4 flex items-start space-x-2 text-[11px] text-slate-500">
              <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
              <span>
                Submissions are timestamped on the server in Africa/Lagos time. You may only check in once per session.
              </span>
            </div>
          </form>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-100 border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <div className="max-w-xl mx-auto px-4">
          <p className="font-semibold text-slate-700">LinkedIn Local Owerri</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Connecting professionals, transforming communities. Volunteer Tracking v1.0.
          </p>
        </div>
      </footer>
    </div>
  );
};
