export type PluginScope = 'config' | 'cli' | 'api' | 'workflow';

export type PluginPermission =
  | 'workflow:run'
  | 'workflow:enqueue'
  | 'cli:command'
  | 'api:route.read'
  | 'api:route.write'
  | 'artifact:read'
  | 'artifact:write';

export interface PluginCapability {
  id: string;
  description: string;
  scope: PluginScope;
  deterministic: boolean;
}

export interface PluginManifest {
  name: string;
  version: string;
  interfaceVersion: '1.0';
  enabledByDefault?: boolean;
  minCoreVersion?: string;
  capabilities: PluginCapability[];
  permissions: PluginPermission[];
  tenancy: {
    requiresTenantContext: boolean;
    allowsCrossTenantAccess: false;
  };
  security: {
    requiresPolicyEvaluation: true;
    requiresTraceHeaders: true;
    networkAccess: 'none' | 'restricted';
  };
}

export interface PluginExecutionContext {
  tenantId: string;
  actorId: string;
  traceId: string;
  requestId: string;
}

export interface SafePlugin {
  readonly manifest: PluginManifest;
  discoverCapabilities(): PluginCapability[];
}
