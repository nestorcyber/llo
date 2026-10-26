import { sanitizeCsvCell, normalizeVolunteerId, isValidVolunteerIdFormat } from './validation';
import { TaskSubmission, Volunteer } from '../types';
import { formatLagosDateTime } from './lagos-time';

export interface ParsedVolunteerRow {
  volunteer_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  track: string;
  notes: string | null;
  isValid: boolean;
  errors: string[];
}

export interface CsvParseResult {
  rows: ParsedVolunteerRow[];
  totalRows: number;
  validCount: number;
  errorCount: number;
  duplicateIds: string[];
}

/**
 * Parses raw CSV text for volunteer records.
 * Supports headers: volunteer_id (or id), full_name (or name), email, phone, track, notes
 */
export function parseVolunteersCsv(csvContent: string): CsvParseResult {
  const lines = csvContent.split(/\r\n|\n|\r/).filter(line => line.trim().length > 0);
  if (lines.length === 0) {
    return { rows: [], totalRows: 0, validCount: 0, errorCount: 0, duplicateIds: [] };
  }

  // Parse header
  const headerLine = lines[0];
  const headers = parseCsvLine(headerLine).map(h => h.trim().toLowerCase().replace(/[\s_-]+/g, ''));

  const idIdx = headers.findIndex(h => h === 'volunteerid' || h === 'id');
  const nameIdx = headers.findIndex(h => h === 'fullname' || h === 'name');
  const emailIdx = headers.findIndex(h => h === 'email' || h === 'emailaddress');
  const phoneIdx = headers.findIndex(h => h === 'phone' || h === 'phonenumber' || h === 'mobile');
  const trackIdx = headers.findIndex(h => h === 'track' || h === 'department' || h === 'role');
  const notesIdx = headers.findIndex(h => h === 'notes' || h === 'note' || h === 'comments');

  const seenIds = new Set<string>();
  const duplicateIds = new Set<string>();
  const parsedRows: ParsedVolunteerRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    const values = parseCsvLine(rawLine);
    const errors: string[] = [];

    const rawId = idIdx !== -1 && values[idIdx] ? values[idIdx].trim() : '';
    const rawName = nameIdx !== -1 && values[nameIdx] ? values[nameIdx].trim() : '';
    const rawEmail = emailIdx !== -1 && values[emailIdx] ? values[emailIdx].trim() : null;
    const rawPhone = phoneIdx !== -1 && values[phoneIdx] ? values[phoneIdx].trim() : null;
    const rawTrack = trackIdx !== -1 && values[trackIdx] ? values[trackIdx].trim() : 'General';
    const rawNotes = notesIdx !== -1 && values[notesIdx] ? values[notesIdx].trim() : null;

    const normalizedId = normalizeVolunteerId(rawId);

    if (!normalizedId) {
      errors.push('Volunteer ID is required');
    } else if (!isValidVolunteerIdFormat(normalizedId)) {
      errors.push(`Invalid ID format: "${normalizedId}". Expected format like LLO-VOL-001`);
    } else if (seenIds.has(normalizedId)) {
      errors.push(`Duplicate ID within this CSV file: "${normalizedId}"`);
      duplicateIds.add(normalizedId);
    } else {
      seenIds.add(normalizedId);
    }

    if (!rawName) {
      errors.push('Full name is required');
    }

    parsedRows.push({
      volunteer_id: normalizedId,
      full_name: rawName,
      email: rawEmail || null,
      phone: rawPhone || null,
      track: rawTrack || 'General',
      notes: rawNotes || null,
      isValid: errors.length === 0,
      errors,
    });
  }

  const validCount = parsedRows.filter(r => r.isValid).length;
  const errorCount = parsedRows.length - validCount;

  return {
    rows: parsedRows,
    totalRows: parsedRows.length,
    validCount,
    errorCount,
    duplicateIds: Array.from(duplicateIds),
  };
}

/**
 * Parses a single CSV line respecting RFC 4180 quotes
 */
export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

/**
 * Builds CSV string for Attendance Submissions with Formula Injection Protection
 */
export function generateAttendanceCsv(submissions: TaskSubmission[]): string {
  const headers = [
    'Submission ID',
    'Programme Day',
    'Calendar Date',
    'Session',
    'Volunteer ID',
    'Volunteer Name',
    'Volunteer Track',
    'Task Completed',
    'Task Category',
    'Submission Time (WAT)',
    'Status',
    'Void Reason',
  ];

  const headerRow = headers.map(h => sanitizeCsvCell(h)).join(',');

  const rows = submissions.map(sub => {
    return [
      sanitizeCsvCell(sub.id),
      sanitizeCsvCell(sub.day ? `Day ${sub.day.day_number}` : ''),
      sanitizeCsvCell(sub.day?.calendar_date || ''),
      sanitizeCsvCell(sub.slot?.name || ''),
      sanitizeCsvCell(sub.volunteer?.volunteer_id || ''),
      sanitizeCsvCell(sub.volunteer?.full_name || ''),
      sanitizeCsvCell(sub.volunteer?.track || ''),
      sanitizeCsvCell(sub.task?.title || ''),
      sanitizeCsvCell(sub.task?.category || ''),
      sanitizeCsvCell(formatLagosDateTime(sub.submitted_at)),
      sanitizeCsvCell(sub.status.toUpperCase()),
      sanitizeCsvCell(sub.void_reason || ''),
    ].join(',');
  });

  return [headerRow, ...rows].join('\r\n');
}

/**
 * Builds CSV string for Volunteer Directory with Formula Injection Protection
 */
export function generateVolunteersCsv(volunteers: Volunteer[]): string {
  const headers = [
    'Volunteer ID',
    'Full Name',
    'Track',
    'Email',
    'Phone',
    'Status',
    'Notes',
    'Created At (WAT)',
  ];

  const headerRow = headers.map(h => sanitizeCsvCell(h)).join(',');

  const rows = volunteers.map(vol => {
    return [
      sanitizeCsvCell(vol.volunteer_id),
      sanitizeCsvCell(vol.full_name),
      sanitizeCsvCell(vol.track),
      sanitizeCsvCell(vol.email || ''),
      sanitizeCsvCell(vol.phone || ''),
      sanitizeCsvCell(vol.is_active ? 'Active' : 'Inactive'),
      sanitizeCsvCell(vol.notes || ''),
      sanitizeCsvCell(formatLagosDateTime(vol.created_at)),
    ].join(',');
  });

  return [headerRow, ...rows].join('\r\n');
}

/**
 * Browser helper to trigger CSV file download
 */
export function triggerCsvDownload(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
