export interface RuntimeManifest {
  git_sha: string;
  build_time: string;
  environment: string;
  prompt_version: string;
  core_version: string;
}

export function getRuntimeManifest(): RuntimeManifest {
  return {
    git_sha: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? 'unknown',
    build_time: process.env.BUILD_TIME ?? new Date().toISOString(),
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
    prompt_version: process.env.REQUIEM_PROMPT_VERSION ?? 'prompts/system.lock.md',
    core_version: process.env.REQUIEM_CORE_VERSION ?? 'contracts/determinism.contract.json',
  };
}
