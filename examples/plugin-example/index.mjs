import fs from 'node:fs';
import path from 'node:path';

const manifestPath = path.join(process.cwd(), 'examples', 'plugin-example', 'plugin.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

function validateManifest(m) {
  const required = ['name', 'version', 'interfaceVersion', 'capabilities', 'permissions', 'tenancy', 'security'];
  for (const key of required) {
    if (!(key in m)) throw new Error(`missing_manifest_field:${key}`);
  }
  if (m.tenancy.allowsCrossTenantAccess !== false) {
    throw new Error('plugin_must_not_allow_cross_tenant_access');
  }
  if (m.security.requiresPolicyEvaluation !== true) {
    throw new Error('plugin_must_require_policy_eval');
  }
}

validateManifest(manifest);

console.log(JSON.stringify({
  ok: true,
  plugin: manifest.name,
  capabilities: manifest.capabilities.map((c) => c.id),
  deterministicOnly: manifest.capabilities.every((c) => c.deterministic === true),
}, null, 2));
