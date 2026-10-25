/**
 * scripts/seed-admins.js
 * Creates or updates the Owner and Co-Organizer admin accounts in auth.users and admin_users.
 * Uses the Supabase Admin API with pre-confirmed email (no emails sent).
 */

// Node 20 WebSocket polyfill for Supabase Realtime client if invoked
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

const ADMIN_ACCOUNTS = [
  {
    email: process.env.ADMIN_OWNER_EMAIL || 'dhina7250@gmail.com',
    password: process.env.ADMIN_OWNER_PASSWORD || 'Dhina4213@',
    role: 'owner',
    displayName: 'Dhina (Lead Organizer)',
  },
  {
    email: process.env.ADMIN_CO_ORGANIZER_EMAIL || 'co_organizer@klu.ac.in',
    password: process.env.ADMIN_CO_ORGANIZER_PASSWORD || 'CoOrg2026!Quiz',
    role: 'co_organizer',
    displayName: 'Co-Organizer',
  },
];

async function seedAdmins() {
  console.log('🚀 Seeding Admin accounts into Supabase Auth & admin_users...');

  for (const account of ADMIN_ACCOUNTS) {
    try {
      console.log(`\nProcessing admin: ${account.email} (${account.role})`);

      // Check if user exists in auth.users
      const { data: usersData, error: listErr } = await supabase.auth.admin.listUsers();
      if (listErr) throw listErr;

      let authUser = usersData.users.find(
        (u) => u.email?.toLowerCase() === account.email.toLowerCase()
      );

      if (!authUser) {
        console.log(`Creating auth user: ${account.email}...`);
        const { data: created, error: createErr } = await supabase.auth.admin.createUser({
          email: account.email,
          password: account.password,
          email_confirm: true,
          user_metadata: { name: account.displayName, role: 'admin' },
          app_metadata: { role: 'admin' },
        });

        if (createErr) throw createErr;
        authUser = created.user;
        console.log(`✅ Created auth.users record: ${authUser.id}`);
      } else {
        console.log(`Updating existing auth user: ${authUser.id}...`);
        await supabase.auth.admin.updateUserById(authUser.id, {
          password: account.password,
          email_confirm: true,
          user_metadata: { name: account.displayName, role: 'admin' },
          app_metadata: { role: 'admin' },
        });
        console.log(`✅ Updated auth user password and metadata`);
      }

      // Upsert into admin_users table
      const { error: upsertErr } = await supabase.from('admin_users').upsert(
        {
          auth_user_id: authUser.id,
          display_name: account.displayName,
          role: account.role,
          active: true,
        },
        { onConflict: 'auth_user_id' }
      );

      if (upsertErr) throw upsertErr;
      console.log(`✅ Upserted admin_users table row for ${account.email} (${account.role})`);
    } catch (err) {
      console.error(`❌ Failed to seed ${account.email}:`, err.message);
    }
  }

  console.log('\n🎉 Admin seeding complete!');
}

seedAdmins();
