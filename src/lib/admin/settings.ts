/**
 * Event settings management.
 * Settings are versioned and frozen after the bank freeze.
 * Every change is audited.
 */
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { auditLog } from "./audit";

export const DEFAULT_SETTINGS = {
  seconds_per_question: 20,
  gap_seconds: 5,
  total_questions: 15,
  scoring: {
    base_correct: 1000,
    time_bonus_max: 500,
    time_window_ms: 20000,
  },
  penalties: {
    tab_switch_2nd: -200,
  },
  lockout_attempts: 5,
  lockout_minutes: 10,
  sudden_death_seconds: 30,
  appeals_window_minutes: 10,
};

export async function getSettings(eventId: string) {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("event_settings")
    .select("*")
    .eq("event_id", eventId)
    .maybeSingle();

  if (!data) {
    return { values: DEFAULT_SETTINGS, frozen: false, version: 0 };
  }

  return {
    values: data.values || DEFAULT_SETTINGS,
    frozen: !!data.frozen_at,
    frozenAt: data.frozen_at,
    bankHash: data.bank_hash,
    version: data.version || 1,
  };
}

export async function updateSettings(
  eventId: string,
  newValues: Record<string, unknown>,
  adminUser: { id: string; displayName: string },
  ip?: string,
) {
  const admin = createSupabaseAdmin();
  const current = await getSettings(eventId);

  if (current.frozen) {
    throw new Error("Settings are frozen. Cannot edit after bank freeze.");
  }

  const merged = { ...current.values, ...newValues };
  const newVersion = current.version + 1;

  const { data: existing } = await admin
    .from("event_settings")
    .select("id")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existing) {
    await admin
      .from("event_settings")
      .update({
        values: merged,
        version: newVersion,
        updated_by: adminUser.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await admin.from("event_settings").insert({
      event_id: eventId,
      values: merged,
      version: newVersion,
      updated_by: adminUser.id,
    });
  }

  await auditLog({
    eventId,
    actorId: adminUser.id,
    actorName: adminUser.displayName,
    action: "update_settings",
    targetType: "settings",
    targetId: eventId,
    before: current.values as Record<string, unknown>,
    after: merged,
    ip,
  });

  return { values: merged, version: newVersion };
}

export async function freezeSettings(
  eventId: string,
  bankHash: string,
  adminUser: { id: string; displayName: string },
) {
  const admin = createSupabaseAdmin();
  const current = await getSettings(eventId);

  const { data: existing } = await admin
    .from("event_settings")
    .select("id")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existing) {
    await admin
      .from("event_settings")
      .update({
        frozen_at: new Date().toISOString(),
        bank_hash: bankHash,
      })
      .eq("id", existing.id);
  } else {
    await admin.from("event_settings").insert({
      event_id: eventId,
      values: current.values,
      version: 1,
      frozen_at: new Date().toISOString(),
      bank_hash: bankHash,
      updated_by: adminUser.id,
    });
  }

  await auditLog({
    eventId,
    actorId: adminUser.id,
    actorName: adminUser.displayName,
    action: "freeze_settings",
    targetType: "settings",
    targetId: eventId,
    after: { bank_hash: bankHash },
  });
}
