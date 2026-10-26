import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  UserCheck,
  ArrowRight,
  Check,
} from 'lucide-react';
import { PublicScheduleData, SubmissionResult, SessionSlot } from '../types';
import { fetchPublicSchedule, submitVolunteerTask } from '../lib/api-client';
import { normalizeVolunteerId, isValidVolunteerIdFormat } from '../lib/validation';
import { formatLagosDateTime, formatSessionWindowRange } from '../lib/lagos-time';
import niforixLogo from '../assets/niforix-logo.png';
import lloLogo from '../assets/llo-logo.png';

interface Props {
  onNavigateToAdmin?: () => void;
}

export const VolunteerCheckIn: React.FC<Props> = () => {
  const [scheduleData, setScheduleData] = useState<PublicScheduleData | null>(null);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [volunteerId, setVolunteerId] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');

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

    // Only open sessions can be selected
    if (slot.is_open) {
      setSelectedSlotId(slot.id);
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
  };

  const handleVolunteerIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolunteerId(e.target.value.toUpperCase());
    if (formError) setFormError(null);
    if (submissionResult) setSubmissionResult(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-20">
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img
              src={lloLogo}
              alt="LinkedIn Local Owerri"
              className="h-8 sm:h-9 object-contain"
            />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-xl w-full mx-auto px-4 py-8 flex-1 flex flex-col justify-center">
        {/* Loading Spinner */}
        {loadingSchedule && !scheduleData && (
          <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center shadow-sm">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-600">Loading programme schedule...</p>
          </div>
        )}

        {/* State 1: Success Feedback Card */}
        {submissionResult && submissionResult.success && submissionResult.submission && (
          <div className="bg-white rounded-3xl border border-slate-200 p-7 sm:p-9 shadow-sm animate-fadeIn">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-200">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div className="text-center mb-6">
              <h2 className="font-heading text-2xl font-extrabold text-slate-900">
                Attendance Confirmed
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Your session check-in has been successfully recorded.
              </p>
            </div>

            {/* Resolved Volunteer & Submission Details */}
            <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200/80 space-y-3 text-sm mb-6">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
                <span className="text-slate-500 text-xs font-medium">Volunteer</span>
                <span className="font-bold text-slate-900 flex items-center space-x-1.5">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  <span>{submissionResult.submission.volunteer_name}</span>
                </span>
              </div>
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
                <span className="text-slate-500 text-xs font-medium">Assigned ID</span>
                <span className="font-mono font-bold text-blue-600">
                  {submissionResult.submission.volunteer_id}
                </span>
              </div>
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
                <span className="text-slate-500 text-xs font-medium">Session</span>
                <span className="font-semibold text-slate-800">
                  {submissionResult.submission.session_name}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <span>Recorded Time (WAT)</span>
                <span className="font-mono">{submissionResult.submission.submitted_at_lagos}</span>
              </div>
            </div>

            <button
              onClick={handleResetForAnother}
              className="w-full py-4 px-6 rounded-xl text-white font-heading font-semibold text-sm bg-blue-600 hover:bg-blue-700 active:scale-[0.99] transition flex items-center justify-center space-x-2 shadow-sm"
            >
              <span>Check In Another Volunteer</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* State 2: Clean Check-In Form (matching modern design) */}
        {(!submissionResult || !submissionResult.success) && scheduleData && (
          <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-9 shadow-sm">
            {/* Header section */}
            <div className="mb-6">
              <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Volunteer Check-In
              </h2>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                Confirm your daily programme attendance by providing your volunteer ID.
              </p>
            </div>

            {/* Error Banners */}
            {formError && (
              <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-2.5 text-red-800 text-xs animate-fadeIn">
                <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <span className="font-medium">{formError}</span>
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

            {/* Field 1: Volunteer ID */}
            <div className="mb-6">
              <label htmlFor="volunteer_id" className="block text-sm font-semibold text-slate-900 mb-2">
                Volunteer ID
              </label>
              <input
                id="volunteer_id"
                name="volunteer_id"
                type="text"
                value={volunteerId}
                onChange={handleVolunteerIdChange}
                placeholder="Enter Your volunteer ID"
                autoComplete="off"
                spellCheck="false"
                disabled={isSubmitting}
                className="w-full px-4 py-3.5 text-base rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition shadow-sm font-mono uppercase"
                required
              />
            </div>

            {/* Field 2: Select Session (Cards matching reference design) */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2.5">
                <label className="block text-sm font-semibold text-slate-900">
                  Select Session
                </label>
                <span className="text-xs text-slate-400 font-mono">
                  {currentLagosTime}
                </span>
              </div>

              <div className="space-y-2.5">
                {scheduleData.slots.map(slot => {
                  const isSelected = selectedSlotId === slot.id && slot.is_open;
                  const isSlotOpen = slot.is_open;
                  const windowStatus = slot.window_status;
                  const windowRange = formatSessionWindowRange(
                    slot.scheduled_time,
                    slot.window_open_offset_minutes,
                    slot.window_close_offset_minutes
                  );

                  return (
                    <div
                      key={slot.id}
                      onClick={() => handleSlotClick(slot)}
                      className={`relative p-4 rounded-xl border transition cursor-pointer select-none ${
                        isSelected
                          ? 'border-2 border-blue-600 bg-blue-50/20 shadow-sm'
                          : isSlotOpen
                          ? 'border border-slate-300 hover:border-slate-400 bg-white'
                          : 'border border-slate-200 bg-slate-50/60 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Clock
                            className={`w-4 h-4 flex-shrink-0 ${
                              isSelected ? 'text-blue-600' : 'text-slate-400'
                            }`}
                          />
                          <div>
                            <div
                              className={`text-sm font-semibold leading-snug ${
                                isSelected ? 'text-slate-900' : 'text-slate-700'
                              }`}
                            >
                              {slot.name}
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              {windowRange}
                            </div>
                          </div>
                        </div>

                        {/* Right Selection Indicator */}
                        <div>
                          {isSelected ? (
                            <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-sm">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          ) : isSlotOpen ? (
                            <span className="text-xs font-semibold text-emerald-600 flex items-center space-x-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              <span>Open</span>
                            </span>
                          ) : windowStatus === 'closed' ? (
                            <span className="text-xs font-medium text-slate-400">Closed</span>
                          ) : (
                            <span className="text-xs font-medium text-slate-400">Upcoming</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Session Status Row */}
            <div className="pt-4 pb-6 border-t border-slate-100 flex items-center justify-between text-sm">
              <span className="text-slate-500">Selected Session</span>
              <span
                className={`font-bold ${
                  selectedSlot?.is_open ? 'text-blue-600' : 'text-slate-400'
                }`}
              >
                {selectedSlot?.is_open ? selectedSlot.name : 'None (Closed)'}
              </span>
            </div>

            {/* Submit Button (Matching reference design) */}
            <button
              type="submit"
              disabled={isSubmitting || !selectedSlot || !selectedSlot.is_open || !volunteerId.trim()}
              className={`w-full py-4 px-6 rounded-xl text-white font-heading font-semibold text-base shadow-sm transition flex items-center justify-center space-x-2 ${
                isSubmitting || !selectedSlot || !selectedSlot.is_open || !volunteerId.trim()
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.99] shadow-blue-600/20'
              }`}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Recording Check-In...</span>
                </>
              ) : (
                <>
                  <span>Check In Now</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-slate-500">
        <div className="max-w-xl mx-auto px-4 flex items-center justify-center space-x-2 text-slate-600 text-xs font-medium">
          <span>Powered by</span>
          <img
            src={niforixLogo}
            alt="Niforix"
            className="h-5 sm:h-6 object-contain inline-block"
          />
        </div>
      </footer>
    </div>
  );
};
