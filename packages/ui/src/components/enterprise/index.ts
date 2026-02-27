/**
 * Enterprise Components
 * 
 * WARNING: These components are for Enterprise use only.
 * Importing these in OSS code paths will fail the boundary check.
 * 
 * Components in this module:
 * - TenantSwitcher: Multi-tenant workspace selector
 * - RoleBadge: User role display with permissions
 * - AuditLogViewer: Security audit trail display
 * - BillingMeter: Usage and quota visualization
 * 
 * OSS Build Guarantee: The verify:boundaries script ensures these
 * components are not imported in OSS-only code paths.
 * 
 * @enterprise-only
 */

// Placeholder for enterprise components
// These would be harvested from Reach/ReadyLayer enterprise features
// but are kept minimal here to maintain OSS boundaries

export const ENTERPRISE_MARKER = 'enterprise-ui-components'

// Stub implementations - actual components would be developed here
// based on specific enterprise requirements

export interface TenantInfo {
  id: string
  name: string
  slug: string
}

export interface EnterpriseProps {
  tenantId: string
  userRole: 'admin' | 'member' | 'viewer'
}
