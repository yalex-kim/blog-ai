#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Admin Password Hash Generator
 *
 * Usage:
 *   node scripts/generate-admin-hash.js <username> <password>
 *
 * Example:
 *   node scripts/generate-admin-hash.js admin mySecurePassword123
 */

const bcrypt = require('bcryptjs');

const username = process.argv[2];
const password = process.argv[3];

if (!username || !password) {
  console.error('Usage: node scripts/generate-admin-hash.js <username> <password>');
  process.exit(1);
}

bcrypt.hash(password, 10, (err, hash) => {
  if (err) {
    console.error('Error generating hash:', err);
    return;
  }

  console.log('\n=== Admin Password Hash Generator ===\n');
  console.log('Username:', username);
  console.log('Bcrypt Hash (rounds=10):\n');
  console.log(hash);
  console.log('\n');
  console.log('SQL to create a new admin:');
  console.log(
    `INSERT INTO admins (username, password_hash, role, full_name) VALUES ('${username}', '${hash}', 'super_admin', 'System Administrator');`
  );
  console.log('\nSQL to update an existing admin\'s password:');
  console.log(`UPDATE admins SET password_hash = '${hash}' WHERE username = '${username}';`);
  console.log('\n');

  // Verify it works
  bcrypt.compare(password, hash, (err, result) => {
    console.log('Verification test:', result ? '✅ SUCCESS' : '❌ FAILED');
  });
});
