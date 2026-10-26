import { describe, it, expect } from 'vitest';
import {
  normalizeVolunteerId,
  isValidVolunteerIdFormat,
  sanitizeCsvCell,
  generateNextVolunteerId,
} from '../src/lib/validation';
import { parseVolunteersCsv, generateAttendanceCsv, generateVolunteersCsv } from '../src/lib/csv';
import { TaskSubmission, Volunteer } from '../src/types';

describe('Volunteer ID Normalization and Validation', () => {
  it('normalizes volunteer IDs by trimming, uppercasing, and removing zero-width chars', () => {
    expect(normalizeVolunteerId(' llo-vol-001 ')).toBe('LLO-VOL-001');
    expect(normalizeVolunteerId('llo-vol-42')).toBe('LLO-VOL-42');
    expect(normalizeVolunteerId('  llo-vol-999  ')).toBe('LLO-VOL-999');
    expect(normalizeVolunteerId('\u200Bllo-vol-005\u200B')).toBe('LLO-VOL-005');
  });

  it('validates correct volunteer ID formats', () => {
    expect(isValidVolunteerIdFormat('LLO-VOL-001')).toBe(true);
    expect(isValidVolunteerIdFormat('LLO-VOL-042')).toBe(true);
    expect(isValidVolunteerIdFormat('LLO-VOL-1000')).toBe(true);
    expect(isValidVolunteerIdFormat('LLO-CORE-01')).toBe(true);
  });

  it('rejects invalid or malformed volunteer IDs', () => {
    expect(isValidVolunteerIdFormat('')).toBe(false);
    expect(isValidVolunteerIdFormat('VOL-001')).toBe(false);
    expect(isValidVolunteerIdFormat('HELLO')).toBe(false);
    expect(isValidVolunteerIdFormat('LLO-')).toBe(false);
    expect(isValidVolunteerIdFormat('LLO-VOL-AB')).toBe(false);
    expect(isValidVolunteerIdFormat('12345')).toBe(false);
  });

  it('generates next sequential volunteer ID correctly', () => {
    const existing = ['LLO-VOL-001', 'LLO-VOL-002', 'LLO-VOL-006'];
    expect(generateNextVolunteerId(existing)).toBe('LLO-VOL-007');

    const emptyList: string[] = [];
    expect(generateNextVolunteerId(emptyList)).toBe('LLO-VOL-001');

    const listWithGaps = ['LLO-VOL-010', 'LLO-VOL-003'];
    expect(generateNextVolunteerId(listWithGaps)).toBe('LLO-VOL-011');
  });
});

describe('CSV Formula Injection Protection (CWE-1236)', () => {
  it('sanitizes formula trigger characters by prefixing with an apostrophe', () => {
    // Dangerous prefixes: =, +, -, @, \t, \r, %
    expect(sanitizeCsvCell('=SUM(A1:A10)')).toBe(`"'=SUM(A1:A10)"`);
    expect(sanitizeCsvCell('+1234567890')).toBe(`"'+1234567890"`);
    expect(sanitizeCsvCell('-cmd|/C calc!A0')).toBe(`"'-cmd|/C calc!A0"`);
    expect(sanitizeCsvCell('@HYPERLINK("http://evil.com")')).toBe(`"'@HYPERLINK(""http://evil.com"")"`);
    expect(sanitizeCsvCell('\tmalicious')).toBe(`"'\tmalicious"`);
    expect(sanitizeCsvCell('%DDE("cmd";"/C calc")')).toBe(`"'%DDE(""cmd"";""/C calc"")"`);
  });

  it('preserves and properly quotes normal safe text', () => {
    expect(sanitizeCsvCell('Chinedu Okeke')).toBe('"Chinedu Okeke"');
    expect(sanitizeCsvCell('LLO-VOL-001')).toBe('"LLO-VOL-001"');
    expect(sanitizeCsvCell('Logistics & Venue')).toBe('"Logistics & Venue"');
  });

  it('handles null and undefined values safely', () => {
    expect(sanitizeCsvCell(null)).toBe('""');
    expect(sanitizeCsvCell(undefined)).toBe('""');
  });

  it('escapes internal double quotes properly per RFC 4180', () => {
    expect(sanitizeCsvCell('Said "Hello"')).toBe('"Said ""Hello"""');
  });
});

describe('Volunteer CSV Import Parsing', () => {
  it('parses valid volunteer CSV with headers', () => {
    const csvData = `volunteer_id,full_name,email,phone
LLO-VOL-010,Ifeanyi Duru,ifeanyi@example.com,+2348011112222
LLO-VOL-011,Nkechi Nwankwo,nkechi@example.com,+2348022223333`;

    const result = parseVolunteersCsv(csvData);
    expect(result.totalRows).toBe(2);
    expect(result.validCount).toBe(2);
    expect(result.errorCount).toBe(0);
    expect(result.rows[0].volunteer_id).toBe('LLO-VOL-010');
    expect(result.rows[0].full_name).toBe('Ifeanyi Duru');
    expect(result.rows[1].volunteer_id).toBe('LLO-VOL-011');
  });

  it('detects duplicate IDs inside the CSV and flags them', () => {
    const csvWithDupes = `volunteer_id,full_name,email,phone
LLO-VOL-010,Person A,a@example.com,
LLO-VOL-010,Person B,b@example.com,`;

    const result = parseVolunteersCsv(csvWithDupes);
    expect(result.totalRows).toBe(2);
    expect(result.validCount).toBe(1);
    expect(result.errorCount).toBe(1);
    expect(result.duplicateIds).toContain('LLO-VOL-010');
    expect(result.rows[1].errors[0]).toContain('Duplicate ID within this CSV file');
  });

  it('flags malformed rows and missing fields', () => {
    const csvWithErrors = `volunteer_id,full_name,email,phone
,Missing ID,test@example.com,
INVALID_ID,Valid Name,test2@example.com,
LLO-VOL-012,,no_name@example.com,`;

    const result = parseVolunteersCsv(csvWithErrors);
    expect(result.totalRows).toBe(3);
    expect(result.validCount).toBe(0);
    expect(result.errorCount).toBe(3);
    expect(result.rows[0].errors).toContain('Volunteer ID is required');
    expect(result.rows[1].errors[0]).toContain('Invalid ID format');
    expect(result.rows[2].errors).toContain('Full name is required');
  });
});

describe('CSV Generation with Sanitization', () => {
  it('generates safe attendance CSV escaping formula injection', () => {
    const submissions: TaskSubmission[] = [
      {
        id: 'sub-1',
        programme_id: 'p-1',
        programme_day_id: 'd-1',
        session_slot_id: 's-1',
        volunteer_id: 'v-1',
        status: 'voided',
        submitted_at: '2026-10-26T10:00:00Z',
        submitted_ip: '127.0.0.1',
        user_agent: 'Test',
        voided_at: '2026-10-26T11:00:00Z',
        voided_by: 'staff-1',
        void_reason: '+12345 Dangerous Reason',
        volunteer: {
          volunteer_id: 'LLO-VOL-001',
          full_name: '=cmd|/C calc!A0', // malicious name
        },
        slot: {
          session_code: 'morning',
          name: 'Morning Session',
          scheduled_time: '10:00:00',
        },
        day: {
          day_number: 1,
          calendar_date: '2026-10-26',
        },
      },
    ];

    const csvOutput = generateAttendanceCsv(submissions);
    // Malicious name starting with '=' must be prefixed with single quote
    expect(csvOutput).toContain(`"'=cmd|/C calc!A0"`);
    // Malicious reason starting with '+' must be prefixed with single quote
    expect(csvOutput).toContain(`"'+12345 Dangerous Reason"`);
  });
});
