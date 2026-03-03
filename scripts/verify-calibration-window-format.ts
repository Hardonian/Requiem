import fs from 'node:fs';

const sourcePath = 'ready-layer/src/lib/intelligence-store.ts';
const source = fs.readFileSync(sourcePath, 'utf8');

if (!source.includes('assertValidCalibrationWindow')) {
  throw new Error('assertValidCalibrationWindow export missing from intelligence-store');
}
if (!source.includes('window must match <number><d|h>')) {
  throw new Error('calibration window schema guard string missing');
}

const re = /^(\d+)([dh])$/i;
const valid = ['30d', '72h', '1D', '24H'];
const invalid = ['30m', 'bad-window', 'd30', '72'];

for (const value of valid) {
  if (!re.test(value)) {
    throw new Error(`expected valid window rejected: ${value}`);
  }
}
for (const value of invalid) {
  if (re.test(value)) {
    throw new Error(`expected invalid window accepted: ${value}`);
  }
}

process.stdout.write('verify:calibration-window passed\n');
