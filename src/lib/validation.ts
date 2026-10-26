import { StaffRole } from '../types';

/**
 * Normalizes volunteer IDs:
 * - Trims whitespace
 * - Converts to uppercase
 * - Strips zero-width characters
 */
export function normalizeVolunteerId(id: string | null | undefined): string {
  if (!id) return '';
  return id
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // remove zero-width spaces
    .trim()
    .toUpperCase();
}

/**
 * Validates volunteer ID format.
 * Standard format: LLO-VOL-### (e.g. LLO-VOL-001, LLO-VOL-999)
 * Also permits flexible LLO- prefix with alphanumeric identifier: LLO-[A-Z0-9-]+
 */
export function isValidVolunteerIdFormat(id: string): boolean {
  const normalized = normalizeVolunteerId(id);
  // Standard format: LLO-VOL- followed by 3 or more digits (e.g. LLO-VOL-001)
  const standardPattern = /^LLO-VOL-\d{3,}$/;
  // Extended format: LLO- followed by track code and digits (e.g. LLO-CORE-01, LLO-MED-002)
  const extendedPattern = /^LLO-[A-Z]{2,6}-\d{2,5}$/;
  return standardPattern.test(normalized) || extendedPattern.test(normalized);
}

/**
 * Sanitizes a CSV cell against spreadsheet formula injection (CWE-1236).
 * Prepends a single quote (') if the field starts with '=', '+', '-', '@', '\t', '\r', or '%'.
 * RFC 4180 escaping: double quotes are escaped as '""', and fields containing commas,
 * newlines, or quotes are enclosed in double quotes.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }

  let str = String(value);

  // Check for dangerous formula trigger characters at start
  const dangerousPrefixes = ['=', '+', '-', '@', '\t', '\r', '%'];
  const firstChar = str.charAt(0);
  if (dangerousPrefixes.includes(firstChar)) {
    // Prefix with single quote to force spreadsheet programs to treat as literal text
    str = `'${str}`;
  }

  // Escape double quotes by doubling them
  const escaped = str.replace(/"/g, '""');

  // Enclose in quotes
  return `"${escaped}"`;
}

/**
 * Generates next sequential volunteer ID given existing volunteer IDs.
 * Finds highest number among LLO-VOL-### and increments.
 */
export function generateNextVolunteerId(existingIds: string[]): string {
  let maxNum = 0;
  const regex = /^LLO-VOL-(\d+)$/;

  for (const id of existingIds) {
    const match = normalizeVolunteerId(id).match(regex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }

  const nextNum = maxNum + 1;
  const padded = String(nextNum).padStart(3, '0');
  return `LLO-VOL-${padded}`;
}

/**
 * Role Permission Verification Matrix
 */
export const RolePermissions = {
  canManageVolunteers(role: StaffRole): boolean {
    return role === 'owner' || role === 'manager';
  },

  canManageTasks(role: StaffRole): boolean {
    return role === 'owner' || role === 'manager';
  },

  canVoidSubmissions(role: StaffRole): boolean {
    return role === 'owner' || role === 'manager';
  },

  canManageTeam(role: StaffRole): boolean {
    return role === 'owner';
  },

  canArchiveProgramme(role: StaffRole): boolean {
    return role === 'owner';
  },

  canExport(role: StaffRole): boolean {
    return role === 'owner' || role === 'manager' || role === 'viewer';
  },

  canChangeRole(currentStaffRole: StaffRole, _targetCurrentRole: StaffRole, _newTargetRole: StaffRole): { allowed: boolean; reason?: string } {
    if (currentStaffRole !== 'owner') {
      return { allowed: false, reason: 'Only owners can modify team roles.' };
    }
    // An owner can manage roles, but cannot demote themselves if they're the last owner (enforced at DB level and UI)
    return { allowed: true };
  }
};
