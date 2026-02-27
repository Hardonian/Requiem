/**
 * Requiem UI Kit
 * 
 * A deterministic design system for operational interfaces.
 * Harvested from Reach and ReadyLayer, consolidated for reuse.
 * 
 * @package @requiem/ui
 * @version 0.1.0
 */

// Utilities
export * from './lib/utils'

// Primitive Components
export * from './components/primitives'

// Layout Components
export * from './components/layout'

// Data Components
export * from './components/data'

// Enterprise Components (gated - only import what you need)
// import * as Enterprise from '@requiem/ui/enterprise'

/**
 * OSS vs Enterprise Boundary
 * 
 * All exports in this file are OSS-safe and can be used in any context.
 * Enterprise-specific components (billing, tenant management, audit logs)
 * are available via the /enterprise subpath export and should only be
 * imported in enterprise-gated code paths.
 * 
 * Example:
 *   import { Button, Card } from '@requiem/ui'              // OK for OSS
 *   import { BillingMeter } from '@requiem/ui/enterprise'  // Enterprise only
 */
