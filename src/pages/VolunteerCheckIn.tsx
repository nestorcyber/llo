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
  Hourglass,
} from 'lucide-react';
import { PublicScheduleData, SubmissionResult, SessionSlot } from '../types';
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

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sessionFeedback, setSessionFeedback] = useState<{ message: string; type: 'closed' | 'upcoming' | 'info' } | null>(null);

  // Live Lagos clock
  const [currentLagosTime, setCurrentLagosTime] = useState<string>('');

  useEffect(() => {
    loadSchedule();
    const interval = setInterval(() => {
      setCurrentLagosTime(formatLagosDateTime(new Date()));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  async function loadSchedule() {
    setLoadingSchedule(true);
    try {
      const data = await fetchPublicSchedule();
      setScheduleData(data);

      // Auto-select the currently active/open slot if available
      if (data.active_slot) {
        setSelectedSlotId(data.active_slot.id);
      } else {
        setSelectedSlotId('');
      }
    } catch (err) {
      console.error('Failed to load schedule:', err);
    } finally {
      setLoadingSchedule(false);
    }
  }

  // Handle clicking a session radio option
  const handleSlotClick = (slot: SessionSlot) => {
    setFormError(null);

    const windowRange = formatSessionWindowRange(
      slot.scheduled_time,
      slot.window_open_offset_minutes,
      slot.window_close_offset_minutes
    );

    if (slot.is_open) {
      setSelectedSlotId(slot.id);
      setSessionFeedback(null);
    } else if (slot.window_status === 'closed') {
      setSessionFeedback({
        type: 'closed',
        message: `${slot.name} is Closed. Check-in for this session has already ended (Window: ${windowRange}).`,
      });
    } else if (slot.window_status === 'upcoming') {
      setSessionFeedback({
        type: 'upcoming',
        message: `${slot.name} is Upcoming. Check-in will open during its scheduled window (${windowRange}).`,
      });
    } else {
      setSessionFeedback({
        type: 'closed',
        message: `${slot.name} is currently Closed.`,
      });
    }
  };

  const selectedSlot = scheduleData?.slots.find(s => s.id === selectedSlotId);

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

    if (!selectedSlotId || !selectedSlot) {
      setFormError('Please select an active programme session.');
      return;
    }

    if (!selectedSlot.is_open) {
      setFormError(`${selectedSlot.name} is currently closed for check-in.`);
      return;
    }

    // Prevent accidental repeated submission
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const result = await submitVolunteerTask({
        volunteer_id: normalized,
        session_slot_id: selectedSlot.id,
      });

      setSubmissionResult(result);
      if (result.success) {
        setSessionFeedback(null);
      }
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
    setVolunteerId('');
    setSubmissionResult(null);
    setFormError(null);
    setSessionFeedback(null);
  };

  const handleVolunteerIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolunteerId(e.target.value.toUpperCase());
    if (formError) setFormError(null);
    if (submissionResult) setSubmissionResult(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans">
      {/* Top Banner */}
      <header className="bg-linkedin-navy text-white shadow-md border-b-4 border-linkedin">
        <div className="max-w-xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-linkedin flex items-center justify-center font-heading font-extrabold text-white text-lg tracking-wider shadow">
              LLO
            </div>
            <div>
              <h1 className="font-heading text-lg font-bold leading-tight">LinkedIn Local Owerri</h1>
              <p className="text-xs text-slate-300">Volunteer Engagement Tracking</p>
            </div>
          </div>
          <button
            onClick={onNavigateToAdmin}
            className="text-xs text-slate-300 hover:text-white flex items-center space-x-1.5 py-1.5 px-3 rounded-lg border border-slate-700 hover:border-slate-500 transition"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-linkedin-light" />
            <span>Staff Login</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-xl w-full mx-auto px-4 py-6 flex-1">
        {/* Programme Status Bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
            <Calendar className="w-4 h-4 text-linkedin" />
            <span className="font-semibold text-slate-900">
              {scheduleData ? `Day ${scheduleData.current_day.day_number} of ${scheduleData.programme.duration_days}` : '30-Day Programme'}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-linkedin-dark uppercase tracking-wide">
              {scheduleData?.current_day.calendar_date || 'Active Day'}
            </span>
          </div>
          <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-mono">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{currentLagosTime || 'Loading time (WAT)...'}</span>
          </div>
        </div>

        {/* Loading Spinner */}
        {loadingSchedule && !scheduleData && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 text-center">
            <RefreshCw className="w-8 h-8 text-linkedin animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-600">Loading today's programme schedule...</p>
          </div>
        )}

        {/* State 1: Success Feedback Card */}
        {submissionResult && submissionResult.success && submissionResult.submission && (
          <div className="bg-white rounded-2xl shadow-md border-2 border-emerald-500 p-6 sm:p-7 mb-6 animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-200 shadow-inner">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="text-center mb-6">
              <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full uppercase tracking-wider mb-2">
                Check-In Confirmed
              </span>
              <h2 className="font-heading text-2xl font-bold text-slate-900">You're Checked In!</h2>
              <p className="text-sm text-slate-600 mt-1">
                Your participation has been successfully recorded.
              </p>
            </div>

            {/* Resolved Volunteer & Submission Details */}
            <div className="bg-slate-50 rounded-xl p-4 sm:p-5 border border-slate-200 space-y-3 text-sm">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
                <span className="text-slate-500 text-xs uppercase font-medium">Volunteer Name:</span>
                <span className="font-bold text-slate-900 flex items-center space-x-1.5">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  <span>{submissionResult.submission.volunteer_name}</span>
                </span>
              </div>
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
                <span className="text-slate-500 text-xs uppercase font-medium">Assigned ID:</span>
                <span className="font-mono font-bold text-linkedin">
                  {submissionResult.submission.volunteer_id}
                </span>
              </div>
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
                <span className="text-slate-500 text-xs uppercase font-medium">Session:</span>
                <span className="font-semibold text-slate-800">
                  {submissionResult.submission.session_name}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <span>Recorded Time (WAT):</span>
                <span className="font-mono">{submissionResult.submission.submitted_at_lagos}</span>
              </div>
            </div>

            <button
              onClick={handleResetForAnother}
              className="mt-6 w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl transition text-sm flex items-center justify-center space-x-2"
            >
              <span>Check in another volunteer</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* State 2: Check-In Form (Always rendered when schedule is available) */}
        {(!submissionResult || !submissionResult.success) && scheduleData && (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-7">
            <div className="mb-5 pb-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="font-heading text-lg sm:text-xl font-bold text-slate-900">
                  Volunteer Session Check-In
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select your session and enter your assigned Volunteer ID.
                </p>
              </div>
              <button
                type="button"
                onClick={loadSchedule}
                title="Refresh Schedule"
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Error Banners */}
            {formError && (
              <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-2.5 text-red-800 text-xs animate-fadeIn">
                <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <span className="font-medium">{formError}</span>
              </div>
            )}

            {/* Click Feedback on Closed or Upcoming Session */}
            {sessionFeedback && (
              <div
                className={`mb-5 p-3.5 rounded-xl border flex items-start space-x-2.5 text-xs animate-fadeIn ${
                  sessionFeedback.type === 'closed'
                    ? 'bg-slate-100 border-slate-300 text-slate-800'
                    : 'bg-amber-50 border-amber-300 text-amber-900'
                }`}
              >
                {sessionFeedback.type === 'closed' ? (
                  <Lock className="w-4 h-4 text-slate-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <Hourglass className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <span className="font-bold mr-1">
                    {sessionFeedback.type === 'closed' ? 'Session Closed:' : 'Session Upcoming:'}
                  </span>
                  <span>{sessionFeedback.message}</span>
                </div>
              </div>
            )}

            {/* Submission Server Error Message */}
            {submissionResult && !submissionResult.success && (
              <div
                className={`mb-5 p-4 rounded-xl border flex items-start space-x-3 text-xs animate-fadeIn ${
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
            <div className="mb-6">
              <label htmlFor="volunteer_id" className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
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
                  className="w-full px-4 py-3.5 text-base sm:text-lg font-mono uppercase bg-slate-50 border-2 border-slate-300 rounded-xl focus:bg-white focus:border-linkedin focus:ring-4 focus:ring-linkedin/10 transition placeholder:text-slate-400 placeholder:normal-case placeholder:font-sans placeholder:text-sm"
                  required
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                Official format: <code className="text-linkedin font-mono font-semibold">LLO-VOL-###</code>
              </p>
            </div>

            {/* Field 2: Programme Session Selection Radio Buttons */}
            <div className="mb-6">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5">
                2. Select Programme Session <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2.5">
                {scheduleData.slots.map(slot => {
                  const isSelected = selectedSlotId === slot.id && slot.is_open;
                  const isSlotOpen = slot.is_open;
                  const windowStatus = slot.window_status; // 'open' | 'closed' | 'upcoming'
                  const windowRange = formatSessionWindowRange(
                    slot.scheduled_time,
                    slot.window_open_offset_minutes,
                    slot.window_close_offset_minutes
                  );

                  return (
                    <div
                      key={slot.id}
                      onClick={() => handleSlotClick(slot)}
                      className={`relative p-3.5 sm:p-4 rounded-xl border-2 transition cursor-pointer select-none ${
                        isSelected
                          ? 'border-linkedin bg-blue-50/60 ring-2 ring-linkedin/20 shadow-sm'
                          : isSlotOpen
                          ? 'border-emerald-300 hover:border-emerald-500 bg-emerald-50/30'
                          : windowStatus === 'closed'
                          ? 'border-slate-200 bg-slate-50/70 hover:bg-slate-100/60'
                          : 'border-slate-200 bg-slate-50/40 hover:bg-slate-100/60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3.5">
                          {/* Radio Button Visual */}
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition flex-shrink-0 ${
                              isSelected
                                ? 'border-linkedin bg-linkedin'
                                : isSlotOpen
                                ? 'border-emerald-500 bg-white'
                                : 'border-slate-300 bg-slate-100'
                            }`}
                          >
                            {isSelected ? (
                              <div className="w-2 h-2 rounded-full bg-white" />
                            ) : null}
                          </div>

                          <div>
                            <div className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                              <span>{slot.name}</span>
                            </div>
                            <div className="text-xs text-slate-500 flex items-center space-x-1.5 mt-0.5">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span>{windowRange}</span>
                            </div>
                          </div>
                        </div>

                        {/* Status Badge: Open Now | Closed | Upcoming */}
                        <div>
                          {isSlotOpen ? (
                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[11px] font-extrabold rounded-full flex items-center space-x-1.5 border border-emerald-300 shadow-sm">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                              </span>
                              <span>OPEN NOW</span>
                            </span>
                          ) : windowStatus === 'closed' ? (
                            <span className="px-2.5 py-1 bg-slate-200 text-slate-600 text-[11px] font-semibold rounded-full border border-slate-300">
                              Closed
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-[11px] font-semibold rounded-full border border-amber-200 flex items-center space-x-1">
                              <Hourglass className="w-3 h-3 text-amber-600" />
                              <span>Upcoming</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Informative Next Session Banner if currently outside active windows */}
              {!scheduleData.active_slot && scheduleData.next_session && (
                <div className="mt-3.5 p-3 rounded-xl bg-blue-50/80 border border-blue-200 text-xs text-slate-700 flex items-start space-x-2">
                  <Info className="w-4 h-4 text-linkedin flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-900">Next Available Session: </span>
                    <span>{scheduleData.next_session.name} ({scheduleData.next_session.window_range})</span>
                    <span className="block text-[11px] text-slate-500 mt-0.5">
                      Opens: <strong className="text-linkedin">{scheduleData.next_session.opens_at_label}</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !selectedSlot || !selectedSlot.is_open || !volunteerId.trim()}
              className={`w-full py-4 px-4 rounded-xl text-white font-heading font-bold text-sm sm:text-base shadow-md transition flex items-center justify-center space-x-2 ${
                isSubmitting || !selectedSlot || !selectedSlot.is_open || !volunteerId.trim()
                  ? 'bg-slate-300 cursor-not-allowed text-slate-500 shadow-none'
                  : 'bg-linkedin hover:bg-linkedin-dark active:scale-[0.99] shadow-linkedin/20'
              }`}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Recording Check-In...</span>
                </>
              ) : !selectedSlot || !selectedSlot.is_open ? (
                <span>
                  {!scheduleData.active_slot
                    ? 'Check-In Currently Inactive'
                    : 'Select Open Session to Check In'}
                </span>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Check In to {selectedSlot.name}</span>
                </>
              )}
            </button>

            {/* Notice */}
            <div className="mt-4 flex items-start space-x-2 text-[11px] text-slate-500">
              <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
              <span>
                All check-ins are verified and timestamped in Africa/Lagos time (WAT). Each volunteer can check in once per session.
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
            Connecting professionals, transforming communities. Volunteer Engagement Tracking System.
          </p>
        </div>
      </footer>
    </div>
  );
};
