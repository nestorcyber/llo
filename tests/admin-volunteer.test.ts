import { describe, it, expect, afterAll } from 'vitest';
import { handleAdminAction } from '../api/admin-action';
import { supabaseServer } from '../api/utils/supabase-server';

const TEST_VOLUNTEER_ID = 'LLO-VOL-TESTADMIN';

describe('Admin Action Volunteer API', () => {
  afterAll(async () => {
    if (supabaseServer) {
      await supabaseServer.from('volunteers').delete().eq('volunteer_id', TEST_VOLUNTEER_ID);
    }
  });

  it('successfully creates a volunteer in the live database via admin-action', async () => {
    let responseStatus = 200;
    let responseJson: any = null;

    const req = {
      method: 'POST',
      body: {
        action: 'add_volunteer',
        payload: {
          volunteer_id: TEST_VOLUNTEER_ID,
          full_name: 'Admin Added Volunteer',
          email: 'admin.added@example.com',
          phone: '+2348099999999',
          track: 'Logistics',
          is_active: true,
          notes: 'Created via admin action test',
        },
      },
    };

    const res = {
      status(code: number) {
        responseStatus = code;
        return this;
      },
      json(data: any) {
        responseJson = data;
      },
    };

    await handleAdminAction(req, res);

    expect(responseStatus).toBe(200);
    expect(responseJson).toBeDefined();
    expect(responseJson.success).toBe(true);
    expect(responseJson.data.volunteer_id).toBe(TEST_VOLUNTEER_ID);

    // Verify it actually exists in Supabase
    if (supabaseServer) {
      const { data, error } = await supabaseServer
        .from('volunteers')
        .select('id, volunteer_id, full_name, email, phone, track, is_active, notes')
        .eq('volunteer_id', TEST_VOLUNTEER_ID)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.full_name).toBe('Admin Added Volunteer');
    }
  }, 15000);

  it('rejects duplicate volunteer ID with clear error', async () => {
    let responseStatus = 200;
    let responseJson: any = null;

    const req = {
      method: 'POST',
      body: {
        action: 'add_volunteer',
        payload: {
          volunteer_id: TEST_VOLUNTEER_ID,
          full_name: 'Duplicate Volunteer',
          is_active: true,
        },
      },
    };

    const res = {
      status(code: number) {
        responseStatus = code;
        return this;
      },
      json(data: any) {
        responseJson = data;
      },
    };

    await handleAdminAction(req, res);

    expect(responseStatus).toBe(400);
    expect(responseJson.success).toBe(false);
    expect(responseJson.message).toContain('already exists');
  }, 15000);
});
