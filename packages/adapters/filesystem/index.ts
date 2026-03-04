import { BaseAdapter, createEvent } from '../base.js';

export class FilesystemAdapter extends BaseAdapter {
  name = 'filesystem';
  version = '1.0.0';

  normalize(input_payload: unknown) {
    const payload = this.redact(input_payload) as Record<string, unknown>;
    const artifact = this.pipeline.storeArtifact({ media_type: 'application/json', content: JSON.stringify(payload), redacted: true });
    const event = createEvent('filesystem.exec', String(payload.status ?? 'process.completed'), artifact.cas_ref, {
      command: payload.command,
      exit_code: payload.exit_code,
      proof_pack_ref: `cas:${artifact.cas_ref}`,
    });
    return { event, artifacts: [artifact] };
  }

  redact(payload: unknown): unknown {
    const value = (payload && typeof payload === 'object') ? { ...(payload as Record<string, unknown>) } : {};
    if ('stdout' in value) value.stdout = '[TRUNCATED]';
    return value;
  }
}
