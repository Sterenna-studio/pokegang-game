#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const SCHEMA_PATH = new URL('../analytics/ga4-definitions.json', import.meta.url);
const allowedUnits = new Set([
  'STANDARD', 'CURRENCY', 'FEET', 'METERS', 'KILOMETERS', 'MILES',
  'MILLISECONDS', 'SECONDS', 'MINUTES', 'HOURS',
]);
const parameterRe = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;

function validate(schema) {
  const errors = [];
  const dimensions = new Set();
  const metrics = new Set();

  if (!schema || typeof schema !== 'object') errors.push('schema root must be an object');
  if (!/^\d+$/.test(String(schema?.propertyId ?? ''))) errors.push('propertyId must be numeric');
  if (!Array.isArray(schema?.customDimensions)) errors.push('customDimensions must be an array');
  if (!Array.isArray(schema?.customMetrics)) errors.push('customMetrics must be an array');

  for (const [kind, items, seen] of [
    ['dimension', schema?.customDimensions ?? [], dimensions],
    ['metric', schema?.customMetrics ?? [], metrics],
  ]) {
    for (const item of items) {
      if (!parameterRe.test(item?.parameterName ?? '')) errors.push(`${kind}: invalid parameterName ${JSON.stringify(item?.parameterName)}`);
      if (seen.has(item?.parameterName)) errors.push(`${kind}: duplicate parameterName ${item?.parameterName}`);
      seen.add(item?.parameterName);
      if (item?.scope !== 'EVENT') errors.push(`${kind} ${item?.parameterName}: scope must be EVENT`);
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

  const overlap = [...dimensions].filter(name => metrics.has(name));
  if (overlap.length) errors.push(`parameters cannot be both dimension and metric: ${overlap.join(', ')}`);

  if (errors.length) {
    errors.forEach(error => console.error(`[ga4-schema] ERROR: ${error}`));
    process.exitCode = 1;
    return;
  }
  console.log(`[ga4-schema] manifest valid: ${dimensions.size} dimensions, ${metrics.size} metrics`);
}

const schema = JSON.parse(await readFile(SCHEMA_PATH, 'utf8'));
validate(schema);
