#!/usr/bin/env node

import { createSign } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const ADMIN_BASE = 'https://analyticsadmin.googleapis.com/v1beta';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const EDIT_SCOPE = 'https://www.googleapis.com/auth/analytics.edit';
const SCHEMA_PATH = new URL('../analytics/ga4-definitions.json', import.meta.url);

const args = new Set(process.argv.slice(2));
const mode = args.has('--apply') ? 'apply' : args.has('--check') ? 'check' : 'validate';

function fail(message) {
  console.error(`\n[ga4-schema] ${message}`);
  process.exitCode = 1;
}

function base64url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function validateSchema(schema) {
  const allowedUnits = new Set([
    'STANDARD', 'CURRENCY', 'FEET', 'METERS', 'KILOMETERS', 'MILES',
    'MILLISECONDS', 'SECONDS', 'MINUTES', 'HOURS',
  ]);
  const parameterRe = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
  const seenDimensions = new Set();
  const seenMetrics = new Set();
  const errors = [];

  if (!schema || typeof schema !== 'object') errors.push('schema root must be an object');
  if (!/^\d+$/.test(String(schema?.propertyId ?? ''))) errors.push('propertyId must be a numeric GA4 property id');
  if (!Array.isArray(schema?.customDimensions)) errors.push('customDimensions must be an array');
  if (!Array.isArray(schema?.customMetrics)) errors.push('customMetrics must be an array');

  for (const [kind, items, seen] of [
    ['dimension', schema?.customDimensions ?? [], seenDimensions],
    ['metric', schema?.customMetrics ?? [], seenMetrics],
  ]) {
    for (const item of items) {
      if (!parameterRe.test(item?.parameterName ?? '')) errors.push(`${kind}: invalid parameterName ${JSON.stringify(item?.parameterName)}`);
      if (seen.has(item?.parameterName)) errors.push(`${kind}: duplicate parameterName ${item?.parameterName}`);
      seen.add(item?.parameterName);
      if (item?.scope !== 'EVENT') errors.push(`${kind} ${item?.parameterName}: only EVENT scope is supported by this manifest`);
      if (typeof item?.displayName !== 'string' || item.displayName.length < 1 || item.displayName.length > 82) {
        errors.push(`${kind} ${item?.parameterName}: displayName must contain 1..82 characters`);
      }
      if (typeof item?.description === 'string' && item.description.length > 150) {
        errors.push(`${kind} ${item?.parameterName}: description exceeds 150 characters`);
      }
      if (kind === 'metric' && !allowedUnits.has(item?.measurementUnit)) {
        errors.push(`metric ${item?.parameterName}: unsupported measurementUnit ${item?.measurementUnit}`);
      }
    }
  }

  const overlap = [...seenDimensions].filter(name => seenMetrics.has(name));
  if (overlap.length) errors.push(`parameter names cannot be both dimension and metric: ${overlap.join(', ')}`);

  if (errors.length) {
    for (const error of errors) console.error(`[ga4-schema] ERROR: ${error}`);
    throw new Error(`manifest validation failed with ${errors.length} error(s)`);
  }

  console.log(`[ga4-schema] manifest valid: ${seenDimensions.size} dimensions, ${seenMetrics.size} metrics`);
}

async function loadSchema() {
  const text = await readFile(SCHEMA_PATH, 'utf8');
  const schema = JSON.parse(text);
  validateSchema(schema);
  return schema;
}

function decodeServiceAccount() {
  const b64 = process.env.GA4_ADMIN_SERVICE_ACCOUNT_JSON_B64;
  if (!b64) throw new Error('GA4_ADMIN_SERVICE_ACCOUNT_JSON_B64 is missing');
  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  } catch (error) {
    throw new Error(`cannot decode GA4_ADMIN_SERVICE_ACCOUNT_JSON_B64: ${error.message}`);
  }
  if (!parsed.client_email || !parsed.private_key) throw new Error('service-account JSON must contain client_email and private_key');
  return parsed;
}

async function getAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: EDIT_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${payload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(serviceAccount.private_key)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: `${unsigned}.${signature}`,
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await response.json();
  if (!response.ok || !json.access_token) {
    throw new Error(`Google OAuth token request failed (${response.status}): ${JSON.stringify(json)}`);
  }
  return json.access_token;
}

async function gaRequest(token, path, options = {}) {
  const response = await fetch(`${ADMIN_BASE}/${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`GA Admin API ${options.method ?? 'GET'} ${path} failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

async function listAll(token, propertyId, resource, fieldName) {
  const rows = [];
  let pageToken = '';
  do {
    const params = new URLSearchParams({ pageSize: '200' });
    if (pageToken) params.set('pageToken', pageToken);
    const body = await gaRequest(token, `properties/${propertyId}/${resource}?${params}`);
    rows.push(...(body[fieldName] ?? []));
    pageToken = body.nextPageToken ?? '';
  } while (pageToken);
  return rows;
}

function desiredDiff(existing, desired, kind) {
  const changes = [];
  if (existing.scope !== desired.scope) {
    throw new Error(`${kind} ${desired.parameterName}: GA4 scope is ${existing.scope}, manifest wants ${desired.scope}; scope is immutable`);
  }
  if (kind === 'metric' && existing.measurementUnit !== desired.measurementUnit) {
    throw new Error(`${kind} ${desired.parameterName}: GA4 unit is ${existing.measurementUnit}, manifest wants ${desired.measurementUnit}; review manually before changing units`);
  }
  if (existing.displayName !== desired.displayName) changes.push('displayName');
  if ((existing.description ?? '') !== (desired.description ?? '')) changes.push('description');
  return changes;
}

async function syncCollection({ token, propertyId, desired, existing, kind, resource }) {
  const byParameter = new Map(existing.map(item => [item.parameterName, item]));
  const drift = [];

  for (const item of desired) {
    const found = byParameter.get(item.parameterName);
    if (!found) {
      drift.push({ type: 'missing', item });
      console.log(`[ga4-schema] MISSING ${kind}: ${item.parameterName}`);
      if (mode === 'apply') {
        await gaRequest(token, `properties/${propertyId}/${resource}`, {
          method: 'POST',
          body: JSON.stringify(item),
        });
        console.log(`[ga4-schema] CREATED ${kind}: ${item.parameterName}`);
      }
      continue;
    }

    const changes = desiredDiff(found, item, kind);
    if (!changes.length) {
      console.log(`[ga4-schema] OK ${kind}: ${item.parameterName}`);
      continue;
    }

    drift.push({ type: 'update', item, changes });
    console.log(`[ga4-schema] DRIFT ${kind}: ${item.parameterName} (${changes.join(', ')})`);
    if (mode === 'apply') {
      const body = Object.fromEntries(changes.map(field => [field, item[field] ?? '']));
      const updateMask = changes.join(',');
      await gaRequest(token, `${found.name}?updateMask=${encodeURIComponent(updateMask)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      console.log(`[ga4-schema] UPDATED ${kind}: ${item.parameterName}`);
    }
  }

  // Intentionally never archive definitions that exist in GA4 but not in the manifest.
  // Archiving consumes historical reporting capacity and is a destructive admin choice.
  const unmanaged = existing.filter(item => !desired.some(d => d.parameterName === item.parameterName));
  for (const item of unmanaged) console.log(`[ga4-schema] UNMANAGED ${kind}: ${item.parameterName} (left untouched)`);

  return drift;
}

async function main() {
  const schema = await loadSchema();
  if (mode === 'validate') return;

  const propertyId = process.env.GA4_PROPERTY_ID || schema.propertyId;
  if (String(propertyId) !== String(schema.propertyId)) {
    throw new Error(`GA4_PROPERTY_ID (${propertyId}) does not match manifest propertyId (${schema.propertyId})`);
  }

  const serviceAccount = decodeServiceAccount();
  const token = await getAccessToken(serviceAccount);
  const dimensions = await listAll(token, propertyId, 'customDimensions', 'customDimensions');
  const metrics = await listAll(token, propertyId, 'customMetrics', 'customMetrics');

  console.log(`[ga4-schema] connected to property ${propertyId}: ${dimensions.length} existing dimensions, ${metrics.length} existing metrics`);

  const dimensionDrift = await syncCollection({
    token,
    propertyId,
    desired: schema.customDimensions,
    existing: dimensions,
    kind: 'dimension',
    resource: 'customDimensions',
  });
  const metricDrift = await syncCollection({
    token,
    propertyId,
    desired: schema.customMetrics,
    existing: metrics,
    kind: 'metric',
    resource: 'customMetrics',
  });

  const driftCount = dimensionDrift.length + metricDrift.length;
  if (mode === 'check' && driftCount) {
    fail(`${driftCount} managed GA4 definition(s) differ from the manifest`);
  } else if (mode === 'apply') {
    console.log(`[ga4-schema] apply complete (${driftCount} change(s) requested)`);
  } else {
    console.log('[ga4-schema] GA4 custom definitions are in sync');
  }
}

main().catch(error => {
  fail(error?.stack || String(error));
});
