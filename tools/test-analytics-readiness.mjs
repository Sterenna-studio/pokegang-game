import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const analytics = await readFile(new URL('../modules/systems/analytics.js', import.meta.url), 'utf8');
const sync = await readFile(new URL('../analytics/apps-script/Sync.gs', import.meta.url), 'utf8');
const definitions = JSON.parse(await readFile(new URL('../analytics/ga4-definitions.json', import.meta.url), 'utf8'));

const dimensionNames = new Set(definitions.customDimensions.map(item => item.parameterName));

for (const name of ['runtime_context', 'reason', 'previous_zone']) {
  assert.ok(dimensionNames.has(name), `GA4 manifest must register ${name}`);
}

assert.match(analytics, /runtime_context:\s*_runtimeContext/);
assert.match(analytics, /trackEvent\('play_started'/);
assert.match(analytics, /trackEvent\('runtime_error'/);
assert.match(analytics, /return 'lab';/);
assert.match(analytics, /return 'localhost';/);

// Slot and runtime context must be requested for every generic gameplay event,
// otherwise Supabase silently falls back to slot=-1 / unknown context.
assert.match(sync, /'customEvent:runtime_context',[\s\S]*'customEvent:slot'/);
assert.match(sync, /slot:\s*pgInt_\(row\.d\['customEvent:slot'\], -1\)/);
assert.match(sync, /runtime_context:\s*pgText_\(row\.d\['customEvent:runtime_context'\]\)/);

for (const eventName of [
  'play_started',
  'runtime_error',
  'onboarding_briefing_started',
  'onboarding_briefing_completed',
  'onboarding_briefing_skipped',
  'starter_choice_shown',
  'starter_choice_completed',
  'first_wild_capture',
  'ambush_started',
  'ambush_resolved',
  'identity_completed',
  'guide_recruited',
  'guide_team_set',
  'guide_zone_assigned',
  'guide_combat_enabled',
]) {
  assert.ok(sync.includes(`'${eventName}'`), `Supabase sync must include ${eventName}`);
}

assert.match(sync, /customEvent:reason/);
assert.match(sync, /customEvent:previous_zone/);

console.log('✓ analytics readiness coverage');
