import { describe, it, expect } from 'vitest';
import { handleAdminAction } from '../api/admin-action';
import { supabaseServer } from '../api/utils/supabase-server';

describe('Admin Action Slot Override API', () => {
  it('updates session_slot override in Supabase via handleAdminAction', async () => {
    if (!supabaseServer) return;

    // Get active morning slot
    const { data: slot } = await supabaseServer
      .from('session_slots')
      .select('id, name, is_override_open')
      .eq('session_code', 'morning')
      .limit(1)
      .single();

    expect(slot).toBeDefined();

    let statusCode = 200;
    let responseData: any = null;

    const req = {
      method: 'POST',
      body: {
        action: 'set_slot_override',
        payload: {
          slot_id: slot.id,
          override: true,
        },
      },
    };

    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        responseData = data;
      },
    };

    await handleAdminAction(req, res);
    expect(statusCode).toBe(200);
    expect(responseData?.success).toBe(true);
    expect(responseData?.data?.is_override_open).toBe(true);

    // Reset back to null
    await handleAdminAction(
      {
        method: 'POST',
        body: {
          action: 'set_slot_override',
          payload: {
            slot_id: slot.id,
            override: null,
          },
        },
      },
      res
    );
  }, 15000);
});
