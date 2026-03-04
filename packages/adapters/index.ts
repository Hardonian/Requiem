import { FilesystemAdapter } from './filesystem/index.js';
import { GitHubAdapter } from './github/index.js';
import { OtelAdapter } from './otel/index.js';
import { SentryAdapter } from './sentry/index.js';
import { StripeAdapter } from './stripe/index.js';
import { ToolcallAdapter } from './toolcall/index.js';
import { CasStore, KernelEventPipeline } from './sdk/index.js';

export function createDefaultAdapters() {
  const pipeline = new KernelEventPipeline(new CasStore());
  return {
    github: new GitHubAdapter(pipeline),
    sentry: new SentryAdapter(pipeline),
    stripe: new StripeAdapter(pipeline),
    otel: new OtelAdapter(pipeline),
    toolcall: new ToolcallAdapter(pipeline),
    filesystem: new FilesystemAdapter(pipeline),
  };
}
