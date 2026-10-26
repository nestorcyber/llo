import React, { useMemo } from 'react';
import { X, Calendar } from 'lucide-react';
import { Volunteer } from '../../types';
import { dataStore } from '../../lib/data-store';

interface Props {
  volunteer: Volunteer;
  onClose: () => void;
}

export const VolunteerDetailModal: React.FC<Props> = ({ volunteer, onClose }) => {
  // Compute 30-day participation matrix
  const matrix = useMemo(() => {
    return dataStore.getVolunteerParticipationMatrix(volunteer.id);
  }, [volunteer.id]);

  const totalAttended = useMemo(() => {
    return matrix.reduce((acc, curr) => acc + curr.total_attended, 0);
  }, [matrix]);

  const activeDaysCount = useMemo(() => {
    return matrix.filter(m => m.total_attended > 0).length;
  }, [matrix]);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 my-8 animate-fadeIn max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-linkedin-navy text-white flex items-center justify-center font-bold text-lg">
              {volunteer.full_name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-slate-900">{volunteer.full_name}</h2>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    volunteer.is_active
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {volunteer.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex items-center space-x-3 text-xs text-slate-500 mt-0.5">
                <span className="font-mono font-bold text-linkedin">{volunteer.volunteer_id}</span>
                <span>•</span>
                <span className="font-medium text-slate-700">Track: {volunteer.track}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto py-4 space-y-6 flex-1 pr-1">
          {/* Volunteer Summary Stats & Contact Details */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] font-bold text-slate-500 uppercase block">Total Completed</span>
              <span className="text-xl font-black text-slate-900">{totalAttended} Tasks</span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] font-bold text-slate-500 uppercase block">Active Days</span>
              <span className="text-xl font-black text-linkedin">{activeDaysCount} of 30</span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] font-bold text-slate-500 uppercase block">Email Address</span>
              <span className="text-xs font-medium text-slate-800 truncate block">
                {volunteer.email || 'None'}
              </span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] font-bold text-slate-500 uppercase block">Phone</span>
              <span className="text-xs font-medium text-slate-800 truncate block">
                {volunteer.phone || 'None'}
              </span>
            </div>
          </div>

          {/* 30-Day Participation Matrix */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
                  <Calendar className="w-4 h-4 text-linkedin" />
                  <span>30-Day Participation Matrix</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Inspect Morning (M: 10 AM), Afternoon (A: 3 PM), and Evening (E: 8 PM) session activity
                </p>
              </div>

              {/* Legend */}
              <div className="flex items-center space-x-3 text-[11px] text-slate-500">
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block"></span>
                  <span>Attended</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded bg-slate-200 inline-block"></span>
                  <span>Missed</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded bg-rose-400 inline-block"></span>
                  <span>Voided</span>
                </span>
              </div>
            </div>

            {/* Matrix Grid: 30 Days */}
            <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-10 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
              {matrix.map(day => (
                <div
                  key={day.day_number}
                  className="bg-white p-2 rounded-lg border border-slate-200 shadow-xs flex flex-col items-center"
                >
                  <span className="text-[10px] font-bold text-slate-600 mb-1">
                    Day {day.day_number}
                  </span>
                  <div className="grid grid-cols-3 gap-1 w-full text-center">
                    {/* Morning */}
                    <div
                      className={`h-6 rounded text-[10px] font-bold flex items-center justify-center transition ${
                        day.morning === 'reported' || day.morning === 'verified'
                          ? 'bg-emerald-500 text-white shadow-xs'
                          : day.morning === 'voided'
                          ? 'bg-rose-400 text-white'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                      title={`Day ${day.day_number} Morning: ${day.morning}`}
                    >
                      M
                    </div>

                    {/* Afternoon */}
                    <div
                      className={`h-6 rounded text-[10px] font-bold flex items-center justify-center transition ${
                        day.afternoon === 'reported' || day.afternoon === 'verified'
                          ? 'bg-emerald-500 text-white shadow-xs'
                          : day.afternoon === 'voided'
                          ? 'bg-rose-400 text-white'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                      title={`Day ${day.day_number} Afternoon: ${day.afternoon}`}
                    >
                      A
                    </div>

                    {/* Evening */}
                    <div
                      className={`h-6 rounded text-[10px] font-bold flex items-center justify-center transition ${
                        day.evening === 'reported' || day.evening === 'verified'
                          ? 'bg-emerald-500 text-white shadow-xs'
                          : day.evening === 'voided'
                          ? 'bg-rose-400 text-white'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                      title={`Day ${day.day_number} Evening: ${day.evening}`}
                    >
                      E
                    </div>
                  </div>
                  <span className="text-[9px] text-slate-400 mt-1">
                    {day.calendar_date.slice(5)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Volunteer Notes */}
          {volunteer.notes && (
            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 text-xs text-blue-900">
              <span className="font-bold">Coordinator Notes: </span>
              <span>{volunteer.notes}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-4 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};
