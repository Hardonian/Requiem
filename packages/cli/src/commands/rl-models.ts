/**
 * rl models command - List providers, show throttles, show defaults
 */

import { ProviderConfigRepository, ProviderConfig } from '../db/operator-console.js';

interface ModelsListResult {
  providers: Array<{
    id: string;
    name: string;
    type: string;
    enabled: boolean;
    default_model: string;
    throttle_rpm: number;
    throttle_tpm: number;
    cost_per_1k_input: number;
    cost_per_1k_output: number;
    priority: number;
    api_key_set: boolean;
  }>;
}

interface ProviderDetailResult {
  provider: ProviderConfig & { api_key_set: boolean };
}

export async function runModels(
  subcommand: string,
  args: string[],
  options: { json: boolean }
): Promise<number> {
  const repo = new ProviderConfigRepository();

  switch (subcommand) {
    case 'list':
      return runList(repo, options);
    case 'show':
      return runShow(repo, args[0], options);
    case 'defaults':
      return runDefaults(repo, options);
    case 'enable':
      return runEnable(repo, args[0], true, options);
    case 'disable':
      return runEnable(repo, args[0], false, options);
    default:
      console.error(`Unknown models subcommand: ${subcommand}`);
      console.error('Usage: rl models list|show|defaults|enable|disable');
      return 1;
  }
}

async function runList(repo: ProviderConfigRepository, options: { json: boolean }): Promise<number> {
  const providers = repo.list();

  const result: ModelsListResult = {
    providers: providers.map(p => ({
      id: p.id,
      name: p.name,
      type: p.provider_type,
      enabled: p.enabled,
      default_model: p.default_model,
      throttle_rpm: p.throttle_rpm,
      throttle_tpm: p.throttle_tpm,
      cost_per_1k_input: p.cost_per_1k_input,
      cost_per_1k_output: p.cost_per_1k_output,
      priority: p.priority,
      api_key_set: p.api_key_env_var ? !!process.env[p.api_key_env_var] : false,
    })),
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printList(result);
  }

  return 0;
}

async function runShow(
  repo: ProviderConfigRepository,
  providerId: string,
  options: { json: boolean }
): Promise<number> {
  if (!providerId) {
    console.error('Usage: rl models show <provider>');
    return 1;
  }

  const provider = repo.findById(providerId);
  if (!provider) {
    console.error(`Provider not found: ${providerId}`);
    return 1;
  }

  const result: ProviderDetailResult = {
    provider: {
      ...provider,
      api_key_set: provider.api_key_env_var ? !!process.env[provider.api_key_env_var] : false,
    },
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printProvider(result.provider);
  }

  return 0;
}

async function runDefaults(repo: ProviderConfigRepository, options: { json: boolean }): Promise<number> {
  const providers = repo.list(true); // enabled only
  const defaultProvider = providers[0]; // lowest priority

  if (!defaultProvider) {
    console.error('No enabled providers found');
    return 1;
  }

  const result = {
    provider: defaultProvider.id,
    model: defaultProvider.default_model,
    throttle: {
      rpm: defaultProvider.throttle_rpm,
      tpm: defaultProvider.throttle_tpm,
    },
    costs: {
      per_1k_input: defaultProvider.cost_per_1k_input,
      per_1k_output: defaultProvider.cost_per_1k_output,
    },
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('');
    console.log('┌────────────────────────────────────────────────────────────┐');
    console.log('│ Default Provider Settings                                  │');
    console.log('├────────────────────────────────────────────────────────────┤');
    console.log(`│  Provider:    ${result.provider.padEnd(44)}│`);
    console.log(`│  Model:       ${result.model.padEnd(44)}│`);
    console.log('├────────────────────────────────────────────────────────────┤');
    console.log('│ THROTTLES                                                  │');
    console.log(`│  Requests/min:  ${String(result.throttle.rpm).padEnd(42)}│`);
    console.log(`│  Tokens/min:    ${String(result.throttle.tpm).padEnd(42)}│`);
    console.log('├────────────────────────────────────────────────────────────┤');
    console.log('│ COSTS                                                      │');
    console.log(`│  Input /1K:   $${String(result.costs.per_1k_input).padEnd(43)}│`);
    console.log(`│  Output /1K:  $${String(result.costs.per_1k_output).padEnd(43)}│`);
    console.log('└────────────────────────────────────────────────────────────┘');
    console.log('');
  }

  return 0;
}

async function runEnable(
  repo: ProviderConfigRepository,
  providerId: string,
  enabled: boolean,
  options: { json: boolean }
): Promise<number> {
  if (!providerId) {
    console.error(`Usage: rl models ${enabled ? 'enable' : 'disable'} <provider>`);
    return 1;
  }

  const updated = repo.update(providerId, { enabled });
  if (!updated) {
    console.error(`Provider not found: ${providerId}`);
    return 1;
  }

  if (options.json) {
    console.log(JSON.stringify({ provider: updated.id, enabled: updated.enabled }, null, 2));
  } else {
    console.log(`${updated.name} ${enabled ? 'enabled' : 'disabled'}`);
  }

  return 0;
}

function printList(result: ModelsListResult): void {
  console.log('');
  console.log('┌────────────────────────────────────────────────────────────┐');
  console.log('│ Available Providers                                        │');
  console.log('├────────────────────────────────────────────────────────────┤');
  console.log('│  Status  Provider        Type      Model                  │');
  console.log('├────────────────────────────────────────────────────────────┤');

  for (const p of result.providers) {
    const status = p.enabled ? (p.api_key_set ? '●' : '○') : ' ';
    const name = p.name.padEnd(12).substring(0, 12);
    const type = p.type.padEnd(8).substring(0, 8);
    const model = p.default_model.padEnd(25).substring(0, 25);
    console.log(`│   ${status}    ${name} ${type} ${model} │`);
  }

  console.log('├────────────────────────────────────────────────────────────┤');
  console.log('│  ● = enabled with key   ○ = enabled, key missing          │');
  console.log('│  ( ) = disabled                                          │');
  console.log('└────────────────────────────────────────────────────────────┘');
  console.log('');
  console.log('Run "rl models show <provider>" for details');
  console.log('');
}

function printProvider(provider: ProviderConfig & { api_key_set: boolean }): void {
  console.log('');
  console.log('┌────────────────────────────────────────────────────────────┐');
  console.log(`│ ${provider.name.padEnd(56)}│`);
  console.log('├────────────────────────────────────────────────────────────┤');
  console.log(`│  ID:          ${provider.id.padEnd(44)}│`);
  console.log(`│  Type:        ${provider.provider_type.padEnd(44)}│`);
  console.log(`│  Status:      ${(provider.enabled ? 'enabled' : 'disabled').padEnd(44)}│`);
  console.log(`│  API Key:     ${(provider.api_key_set ? 'set' : 'not set').padEnd(44)}│`);
  console.log('├────────────────────────────────────────────────────────────┤');
  console.log('│ MODELS                                                     │');
  console.log(`│  Default:     ${provider.default_model.padEnd(44)}│`);
  for (const model of provider.available_models) {
    const marker = model === provider.default_model ? '→' : ' ';
    console.log(`│  ${marker} ${model.padEnd(53)}│`);
  }
  console.log('├────────────────────────────────────────────────────────────┤');
  console.log('│ THROTTLES                                                  │');
  console.log(`│  Requests/min:  ${String(provider.throttle_rpm).padEnd(42)}│`);
  console.log(`│  Tokens/min:    ${String(provider.throttle_tpm).padEnd(42)}│`);
  console.log('├────────────────────────────────────────────────────────────┤');
  console.log('│ COSTS                                                      │');
  console.log(`│  Input /1K:   $${String(provider.cost_per_1k_input).padEnd(43)}│`);
  console.log(`│  Output /1K:  $${String(provider.cost_per_1k_output).padEnd(43)}│`);

  if (provider.base_url) {
    console.log('├────────────────────────────────────────────────────────────┤');
    console.log('│ ENDPOINT                                                   │');
    console.log(`│  ${provider.base_url.padEnd(54)}│`);
  }

  console.log('└────────────────────────────────────────────────────────────┘');
  console.log('');
}

export default runModels;
