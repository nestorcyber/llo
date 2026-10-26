import { describe, it, expect, beforeEach } from 'vitest';
import { RolePermissions } from '../src/lib/validation';
import { dataStore } from '../src/lib/data-store';
import { StaffProfile } from '../src/types';

describe('Administrator Roles & Permission Enforcement', () => {
  beforeEach(() => {
    dataStore.resetToDefault();
  });

  it('enforces Owner permissions: full administration access', () => {
    expect(RolePermissions.canManageTeam('owner')).toBe(true);
    expect(RolePermissions.canArchiveProgramme('owner')).toBe(true);
    expect(RolePermissions.canManageVolunteers('owner')).toBe(true);
    expect(RolePermissions.canManageTasks('owner')).toBe(true);
    expect(RolePermissions.canVoidSubmissions('owner')).toBe(true);
    expect(RolePermissions.canExport('owner')).toBe(true);
  });

  it('enforces Manager permissions: operations access, restricted team admin', () => {
    expect(RolePermissions.canManageTeam('manager')).toBe(false);
    expect(RolePermissions.canArchiveProgramme('manager')).toBe(false);
    expect(RolePermissions.canManageVolunteers('manager')).toBe(true);
    expect(RolePermissions.canManageTasks('manager')).toBe(true);
    expect(RolePermissions.canVoidSubmissions('manager')).toBe(true);
    expect(RolePermissions.canExport('manager')).toBe(true);
  });

  it('enforces Viewer permissions: read-only access', () => {
    expect(RolePermissions.canManageTeam('viewer')).toBe(false);
    expect(RolePermissions.canArchiveProgramme('viewer')).toBe(false);
    expect(RolePermissions.canManageVolunteers('viewer')).toBe(false);
    expect(RolePermissions.canManageTasks('viewer')).toBe(false);
    expect(RolePermissions.canVoidSubmissions('viewer')).toBe(false);
    expect(RolePermissions.canExport('viewer')).toBe(true); // viewers can export reports
  });

  it('protects the last remaining Owner account from accidental removal or demotion', () => {
    const staffList = dataStore.getStaff();
    const owner = staffList.find(s => s.role === 'owner')!;
    expect(owner).toBeDefined();

    // Ensure there is only 1 owner currently
    const allOwners = staffList.filter(s => s.role === 'owner' && s.is_active);
    expect(allOwners.length).toBe(1);

    // Attempting to demote the sole active owner to manager must fail
    const result = dataStore.updateStaffRole(owner.id, 'manager', owner);
    expect(result.success).toBe(false);
    expect(result.message).toContain('last remaining active Owner');

    // Add a second owner
    const secondOwner = dataStore.addStaff(
      {
        email: 'second_owner@llowerri.org',
        full_name: 'Second Owner',
        role: 'owner',
        is_active: true,
      },
      owner
    ).staff!;

    expect(secondOwner).toBeDefined();

    // Now demoting one of the two owners is permitted
    const demoteRes = dataStore.updateStaffRole(secondOwner.id, 'manager', owner);
    expect(demoteRes.success).toBe(true);
  });

  it('provisions default administrator accounts with updated email formats', () => {
    const staffList = dataStore.getStaff();
    const admin = staffList.find(s => s.email === 'admin@llo.com');
    const manager = staffList.find(s => s.email === 'manager@llo.com');
    const viewer = staffList.find(s => s.email === 'viewer@llo.com');

    expect(admin).toBeDefined();
    expect(admin?.role).toBe('owner');
    expect(manager).toBeDefined();
    expect(manager?.role).toBe('manager');
    expect(viewer).toBeDefined();
    expect(viewer?.role).toBe('viewer');
  });
});
