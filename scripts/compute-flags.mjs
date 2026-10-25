// scripts/compute-flags.mjs
// Run AFTER the quiz ends, BEFORE admin review.
// Computes all statistical flags and inserts them into the flags table.
// Usage: node scripts/compute-flags.mjs

import { computeFlags } from './compute-flags.ts';

computeFlags()
  .then(() => {
    console.log('✓ Flag computation finished successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Flag computation failed:', err);
    process.exit(1);
  });
