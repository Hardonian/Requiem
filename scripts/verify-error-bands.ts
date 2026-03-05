import assert from 'node:assert/strict';
import { generateErrorBands } from '../packages/cli/src/lib/learning-suite.js';
import learningStore from '../ready-layer/src/lib/learning-store.ts';
const { buildErrorBands } = learningStore;

const resA = generateErrorBands('verify-tenant', 'model-v', 80, 123);
const resB = generateErrorBands('verify-tenant', 'model-v', 80, 123);
assert.equal(JSON.stringify(resA.bands.bands), JSON.stringify(resB.bands.bands), 'CLI error bands must be deterministic for same seed');

const route = buildErrorBands('verify-tenant', 'model-v', 80);
assert(route.visual_svg_cas.startsWith('cas:'), 'route error band svg ref missing');
assert(route.visual_html_cas.startsWith('cas:'), 'route error band html ref missing');

console.log('verify-error-bands:ok');
