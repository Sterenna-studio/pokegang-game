import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sync = await readFile(new URL('../analytics/apps-script/Sync.gs', import.meta.url), 'utf8');

assert.match(sync, /apps_script_version:\s*3/);
assert.match(sync, /const nestedDimensionCount = dimensions\.length \+ 1/);
assert.match(sync, /nestedDimensionCount === 10 && dimensions\.includes\('date'\)/);
assert.match(sync, /const compactDimensions = dimensions\.filter\(name => name !== 'date'\)/);
assert.match(sync, /row\.d\.date = date/);
assert.match(sync, /function pgDateRange_/);
assert.match(sync, /dimensionNames\.length \+ \(eventName \? 1 : 0\)/);

console.log('✓ GA4 nested dimension filter fallback');
