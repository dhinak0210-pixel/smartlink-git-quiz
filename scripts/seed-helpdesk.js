/**
 * scripts/seed-helpdesk.js
 * Creates or updates a limited Help-Desk account for event-day volunteers.
 * Uses role: "help_desk" which has restricted privileges (unlock students, view status).
 */

// Node 20 WebSocket polyfill
if (typeof global.WebSocket === 'undefined') {
  global.WebSocket = class MockWebSocket {
    constructor() {}
    addEventListener() {}
    removeEventListener() {}
    send() {}
    close() {}
  };
}

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment from .env.local
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const HELPDESK_ACCOUNT = {
  email: process.env.HELPDESK_EMAIL || 'helpdesk@klu.ac.in',
  password: process.env.HELPDESK_PASSWORD || 'HelpDesk2026!Volunteer',
  role: 'help_desk',
  displayName: 'Volunteer Help Desk',
};

async function seedHelpdesk() {
  console.log('🚀 Seeding Help-Desk volunteer account...');

  try {
    const { data: usersData, error: listErr } = await supabase.auth.admin.listUsers();
    if (listErr) throw listErr;

    let authUser = usersData.users.find(
      (u) => u.email?.toLowerCase() === HELPDESK_ACCOUNT.email.toLowerCase()
    );

    if (!authUser) {
      console.log(`Creating auth user: ${HELPDESK_ACCOUNT.email}...`);
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email: HELPDESK_ACCOUNT.email,
        password: HELPDESK_ACCOUNT.password,
        email_confirm: true,
        user_metadata: { name: HELPDESK_ACCOUNT.displayName, role: 'admin' },
        app_metadata: { role: 'admin' },
      });

      if (createErr) throw createErr;
      authUser = created.user;
      console.log(`✅ Created auth.users record: ${authUser.id}`);
    } else {
      console.log(`Updating existing auth user: ${authUser.id}...`);
      await supabase.auth.admin.updateUserById(authUser.id, {
        password: HELPDESK_ACCOUNT.password,
        email_confirm: true,
        user_metadata: { name: HELPDESK_ACCOUNT.displayName, role: 'admin' },
        app_metadata: { role: 'admin' },
      });
      console.log(`✅ Updated password and metadata`);
    }

    const { error: upsertErr } = await supabase.from('admin_users').upsert(
      {
        auth_user_id: authUser.id,
        display_name: HELPDESK_ACCOUNT.displayName,
        role: HELPDESK_ACCOUNT.role,
        active: true,
      },
      { onConflict: 'auth_user_id' }
    );

    if (upsertErr) throw upsertErr;
    console.log(`✅ Upserted admin_users table row for ${HELPDESK_ACCOUNT.email} with role: ${HELPDESK_ACCOUNT.role}`);
    console.log('\n🎉 Help-Desk volunteer account seeding complete!');
  } catch (err) {
    console.error(`❌ Failed to seed help-desk:`, err.message);
  }
}

seedHelpdesk();
