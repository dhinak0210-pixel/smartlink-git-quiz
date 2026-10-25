/**
 * scripts/add-contestant.js
 * CLI tool for administrators to enroll a contestant.
 * Pre-provisions Supabase Auth credentials and creates the contestant in the students table.
 *
 * Usage:
 *   node scripts/add-contestant.js <name> <email> <registerNo> [password] [joinCode]
 * Example:
 *   node scripts/add-contestant.js "Rahul Sharma" "2100030001@klu.ac.in" "2100030001"
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
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
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

function generateJoinCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return code;
}

const args = process.argv.slice(2);
if (args.length < 3) {
  console.log(`
Usage:
  node scripts/add-contestant.js <name> <email> <registerNo> [password] [joinCode]

Example:
  node scripts/add-contestant.js "Rahul Sharma" "2100030001@klu.ac.in" "2100030001"
  `);
  process.exit(1);
}

const name = args[0].trim();
const email = args[1].trim().toLowerCase();
const registerNo = args[2].trim().toUpperCase();
const password = args[3] || `Klu@${registerNo.slice(-4) || '2026'}!`;
const joinCode = (args[4] || generateJoinCode()).toUpperCase();

async function addContestant() {
  console.log(`\n========================================`);
  console.log(`👤 Enrolling Contestant: ${name}`);
  console.log(`========================================`);

  try {
    // 1. Check duplicate in students table
    const { data: existing } = await supabase
      .from('students')
      .select('id, email, register_no')
      .or(`email.eq.${email},register_no.eq.${registerNo}`)
      .maybeSingle();

    if (existing) {
      console.error(`❌ Conflict: Student with email ${email} or register no ${registerNo} already exists.`);
      process.exit(1);
    }

    // 2. Pre-provision in auth.users
    const { data: usersData } = await supabase.auth.admin.listUsers();
    let authUser = usersData?.users.find((u) => u.email?.toLowerCase() === email);

    if (!authUser) {
      console.log(`Creating user in auth.users...`);
      const { data: newAuth, error: authErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, register_no: registerNo, role: 'student' },
      });
      if (authErr) throw authErr;
      authUser = newAuth.user;
    } else {
      console.log(`Updating existing auth user password...`);
      const { data: updAuth, error: authErr } = await supabase.auth.admin.updateUserById(
        authUser.id,
        {
          password,
          email_confirm: true,
          user_metadata: { name, register_no: registerNo, role: 'student' },
        }
      );
      if (authErr) throw authErr;
      authUser = updAuth.user;
    }

    // 3. Hash join code
    const codeHash = await bcrypt.hash(joinCode, 10);

    // 4. Insert into students table
    const { data: student, error: insertErr } = await supabase
      .from('students')
      .insert({
        name,
        email,
        register_no: registerNo,
        college_id: registerNo,
        join_code: joinCode,
        join_code_hash: codeHash,
        auth_user_id: authUser.id,
        status: 'account_created',
        is_active: true,
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    console.log(`\n🎉 Contestant successfully enrolled!`);
    console.log(`----------------------------------------`);
    console.log(`Name:        ${name}`);
    console.log(`Email:       ${email}`);
    console.log(`Register No: ${registerNo}`);
    console.log(`Password:    ${password}`);
    console.log(`Join Code:   ${joinCode}`);
    console.log(`Status:      account_created (Can log in immediately)`);
    console.log(`Login URL:   http://localhost:3000/login`);
    console.log(`Test URL:    http://localhost:3000/test-login`);
    console.log(`----------------------------------------\n`);
  } catch (err) {
    console.error('❌ Failed to enroll contestant:', err);
    process.exit(1);
  }
}

addContestant();
