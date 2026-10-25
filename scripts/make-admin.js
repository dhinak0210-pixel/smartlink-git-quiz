/**
 * scripts/make-admin.js
 * Creates or resets an Admin user with 'owner' (super_admin) privileges in Supabase.
 * Usage: node scripts/make-admin.js [email] [password] [displayName]
 */

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

const args = process.argv.slice(2);
const email = (args[0] || process.env.ADMIN_USER_EMAIL || 'admin@klu.ac.in').toLowerCase().trim();
const password = args[1] || process.env.ADMIN_USER_PASSWORD || 'Admin@2026Quiz!';
const displayName = args[2] || 'Platform Administrator';

async function makeAdmin() {
  console.log(`\n========================================`);
  console.log(`🔑 Provisioning Admin: ${email}`);
  console.log(`========================================`);

  try {
    const { data: usersData, error: listErr } = await supabase.auth.admin.listUsers();
    if (listErr) throw listErr;

    let authUser = usersData.users.find(
      (u) => u.email?.toLowerCase() === email
    );

    if (!authUser) {
      console.log(`Creating user in auth.users...`);
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: displayName,
          name: displayName,
          role: 'owner',
        },
      });
      if (createErr) throw createErr;
      authUser = newUser.user;
      console.log(`✅ Auth user created with ID: ${authUser.id}`);
    } else {
      console.log(`Existing auth user found (${authUser.id}). Updating password and confirming...`);
      const { data: updated, error: updateErr } = await supabase.auth.admin.updateUserById(
        authUser.id,
        {
          password,
          email_confirm: true,
          user_metadata: {
            display_name: displayName,
            name: displayName,
            role: 'owner',
          },
        }
      );
      if (updateErr) throw updateErr;
      authUser = updated.user;
      console.log(`✅ Auth user updated.`);
    }

    // Upsert into admin_users table
    const { data: existingAdmin } = await supabase
      .from('admin_users')
      .select('id, role')
      .eq('auth_user_id', authUser.id)
      .maybeSingle();

    if (!existingAdmin) {
      const { error: insErr } = await supabase.from('admin_users').insert({
        auth_user_id: authUser.id,
        role: 'owner',
        display_name: displayName,
        active: true,
      });
      if (insErr) throw insErr;
      console.log(`✅ Inserted into admin_users as 'owner'`);
    } else {
      const { error: updErr } = await supabase
        .from('admin_users')
        .update({
          role: 'owner',
          display_name: displayName,
          active: true,
        })
        .eq('auth_user_id', authUser.id);
      if (updErr) throw updErr;
      console.log(`✅ Updated admin_users record to 'owner'`);
    }

    console.log(`\n🎉 Admin user successfully configured!`);
    console.log(`----------------------------------------`);
    console.log(`Email:    ${email}`);
    console.log(`Password: ${password}`);
    console.log(`Role:     owner (super_admin)`);
    console.log(`Login at: http://localhost:3000/login (or http://localhost:3000/admin/login)`);
    console.log(`----------------------------------------\n`);
  } catch (err) {
    console.error('❌ Failed to provision admin:', err);
    process.exit(1);
  }
}

makeAdmin();
