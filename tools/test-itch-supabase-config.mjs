import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const modulePath = path.join(root, 'modules', 'nitro', 'nitro-supabase.js');
const source = fs.readFileSync(modulePath, 'utf8');

// Guardrails: the itch runtime may embed only browser-safe Supabase material.
assert.match(source, /https:\/\/ojklmobvafovftqvevzh\.supabase\.co/);
assert.match(source, /sb_publishable_[A-Za-z0-9_-]+/);
assert.doesNotMatch(source, /sb_secret_[A-Za-z0-9_-]+/i);

// Reject any embedded JWT whose payload is a service-role token.
const jwtCandidates = source.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || [];
for (const jwt of jwtCandidates) {
  const payload = jwt.split('.')[1];
  const padded = payload.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - payload.length % 4) % 4);
  const decoded = Buffer.from(padded, 'base64').toString('utf8');
  assert.doesNotMatch(decoded, /"role"\s*:\s*"service_role"/i);
}

// Simulate the hostname used by an itch HTML iframe. This branch must resolve
// without any network request to Nitro and must target the dedicated PokéGang project.
globalThis.location = { hostname: 'html-classic.itch.zone' };
const mod = await import(`${pathToFileURL(modulePath).href}?test=${Date.now()}`);
const cfg = await mod.getNitroSupabaseConfig();

assert.equal(cfg?.url, 'https://ojklmobvafovftqvevzh.supabase.co');
assert.match(cfg?.anonKey || '', /^sb_publishable_/);
assert.doesNotMatch(cfg?.anonKey || '', /service_role|sb_secret_/i);

console.log('✓ itch uses the dedicated PokéGang Supabase project with a publishable key only');
