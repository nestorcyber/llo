import { PublicScheduleData, SubmissionPayload, SubmissionResult } from '../types';
import { dataStore } from './data-store';

/**
 * API client for the public check-in interface.
 * Attempts server endpoint /api/submissions and /api/public-schedule.
 * If running purely in client/offline mode, gracefully executes through local dataStore.
 */

export async function fetchPublicSchedule(dayNumber?: number): Promise<PublicScheduleData> {
  try {
    const url = dayNumber ? `/api/public-schedule?day=${dayNumber}` : '/api/public-schedule';
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Falling back to local data store for public schedule:', err);
  }

  // Fallback to data store
  return dataStore.getPublicSchedule(dayNumber);
}

export async function submitVolunteerTask(payload: SubmissionPayload): Promise<SubmissionResult> {
  try {
    const res = await fetch('/api/submissions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data: SubmissionResult = await res.json();
    return data;
  } catch (err) {
    console.warn('Network error reaching /api/submissions, falling back to local business engine:', err);
    // If the network fails or endpoint is not reachable, we fall back to dataStore
    return dataStore.submitTask(payload);
  }
}
