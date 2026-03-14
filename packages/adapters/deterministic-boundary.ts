import { createHash } from 'node:crypto';

export type AdapterMode = 'record' | 'replay';

export interface AdapterInvocationRecord {
  adapter: string;
  inputHash: string;
  outputHash: string;
  input: unknown;
  output: unknown;
}

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export class DeterministicAdapterBoundary {
  private readonly records: AdapterInvocationRecord[];
  private cursor = 0;

  constructor(private readonly mode: AdapterMode, existingRecords: AdapterInvocationRecord[] = []) {
    this.records = existingRecords.map((record) => ({ ...record }));
  }

  invoke<TInput, TOutput>(adapter: string, input: TInput, executor: () => TOutput): TOutput {
    const inputHash = digest({ adapter, input });

    if (this.mode === 'replay') {
      const record = this.records[this.cursor++];
      if (!record) {
        throw new Error(`Missing replay record for adapter '${adapter}'`);
      }
      if (record.adapter !== adapter || record.inputHash !== inputHash) {
        throw new Error(`Replay mismatch for adapter '${adapter}'`);
      }
      return record.output as TOutput;
    }

    const output = executor();
    const outputHash = digest({ adapter, output });
    this.records.push({ adapter, inputHash, outputHash, input, output });
    return output;
  }

  exportRecords(): AdapterInvocationRecord[] {
    return this.records.map((record) => ({ ...record }));
  }

  getProofDigest(): string {
    return digest(this.records);
  }
}
