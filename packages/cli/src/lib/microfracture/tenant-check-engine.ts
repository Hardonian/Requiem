/**
 * Tenant Check Engine — Verify tenant isolation and boundary integrity
 *
 * INVARIANT: All checks are deterministic
 * INVARIANT: No cross-tenant data leakage
 * INVARIANT: Validates data consistency without modifying
 */

export interface TenantCheckRecord {
  id: string;
  tenantId: string;
  tableName: string;
  linkedTenantId?: string;
}

export interface TenantCheckResult {
  tenantId: string;
  checks: {
    total: number;
    passed: number;
    failed: number;
  };
  violations: Array<{
    type: 'missing_tenant_id' | 'cross_tenant_link' | 'null_tenant_id';
    table: string;
    recordId: string;
    details: string;
  }>;
  summary: {
    recordsChecked: number;
    tablesChecked: string[];
    isolationScore: number; // 0-100
  };
  passed: boolean;
  resultHash: string;
  checkedAt: string; // Display only
}

/**
 * Perform tenant isolation check
 */
export function checkTenantIsolation(
  tenantId: string,
  records: TenantCheckRecord[],
  options: { tables?: string[] } = {}
): TenantCheckResult {
  const violations: TenantCheckResult['violations'] = [];
  const tablesChecked = new Set<string>();
  let recordsChecked = 0;

  // Filter records for specified tables or all
  const filteredRecords = options.tables
    ? records.filter(r => options.tables!.includes(r.tableName))
    : records;

  for (const record of filteredRecords) {
    recordsChecked++;
    tablesChecked.add(record.tableName);

    // Check for null tenant_id
    if (!record.tenantId) {
      violations.push({
        type: 'null_tenant_id',
        table: record.tableName,
        recordId: record.id,
        details: `Record ${record.id} in ${record.tableName} has null tenant_id`,
      });
      continue;
    }

    // Check for cross-tenant links
    if (record.linkedTenantId && record.linkedTenantId !== record.tenantId) {
      violations.push({
        type: 'cross_tenant_link',
        table: record.tableName,
        recordId: record.id,
        details: `Record ${record.id} links to different tenant ${record.linkedTenantId}`,
      });
    }
  }

  // Calculate isolation score
  const isolationScore = recordsChecked > 0
    ? Math.round(((recordsChecked - violations.length) / recordsChecked) * 100)
    : 100;

  const passed = violations.length === 0;

  const result: TenantCheckResult = {
    tenantId,
    checks: {
      total: recordsChecked,
      passed: recordsChecked - violations.length,
      failed: violations.length,
    },
    violations,
    summary: {
      recordsChecked,
      tablesChecked: Array.from(tablesChecked).sort(),
      isolationScore,
    },
    passed,
    resultHash: '', // Set below
    checkedAt: new Date().toISOString(),
  };

  result.resultHash = computeCheckHash(result);

  return result;
}

/**
 * Compute deterministic check hash
 */
function computeCheckHash(result: Omit<TenantCheckResult, 'resultHash' | 'checkedAt'>): string {
  const stableObj = {
    tenantId: result.tenantId,
    total: result.checks.total,
    failed: result.checks.failed,
    isolationScore: result.summary.isolationScore,
    passed: result.passed,
  };

  const json = JSON.stringify(stableObj, Object.keys(stableObj).sort());

  // Simple hash
  let hash = 0;
  for (let i = 0; i < json.length; i++) {
    const char = json.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

/**
 * Format check result as table
 */
export function formatTenantCheckAsTable(result: TenantCheckResult): string {
  const lines: string[] = [
    '┌────────────────────────────────────────────────────────────┐',
    '│ TENANT ISOLATION CHECK                                     │',
    '├────────────────────────────────────────────────────────────┤',
    `│  Tenant:  ${result.tenantId.substring(0, 46).padEnd(46)}│`,
    '├────────────────────────────────────────────────────────────┤',
    `│  Status:  ${(result.passed ? '✅ PASSED' : '❌ FAILED').padEnd(46)}│`,
    `│  Score:   ${(result.summary.isolationScore + '%').padEnd(46)}│`,
    '├────────────────────────────────────────────────────────────┤',
    `│  Records: ${result.checks.total.toString().padStart(5)} checked                      │`,
    `│  Passed:  ${result.checks.passed.toString().padStart(5)}                            │`,
    `│  Failed:  ${result.checks.failed.toString().padStart(5)}                            │`,
  ];

  if (result.summary.tablesChecked.length > 0) {
    lines.push('├────────────────────────────────────────────────────────────┤');
    lines.push('│  TABLES CHECKED                                            │');
    for (const table of result.summary.tablesChecked.slice(0, 5)) {
      lines.push(`│  • ${table.substring(0, 54).padEnd(54)}│`);
    }
    if (result.summary.tablesChecked.length > 5) {
      lines.push(`│  ... and ${result.summary.tablesChecked.length - 5} more`.padEnd(61) + '│');
    }
  }

  if (result.violations.length > 0) {
    lines.push('├────────────────────────────────────────────────────────────┤');
    lines.push('│  VIOLATIONS                                                │');
    for (const v of result.violations.slice(0, 5)) {
      const icon = v.type === 'cross_tenant_link' ? '🔴' : '🟡';
      lines.push(`│  ${icon} ${v.type.substring(0, 20).padEnd(20)} ${v.table.substring(0, 18).padEnd(18)}│`);
    }
    if (result.violations.length > 5) {
      lines.push(`│  ... and ${result.violations.length - 5} more violations`.padEnd(61) + '│');
    }
  }

  lines.push('├────────────────────────────────────────────────────────────┤');
  lines.push(`│  Hash: ${result.resultHash.substring(0, 16)}...`.padEnd(61) + '│');
  lines.push('└────────────────────────────────────────────────────────────┘');

  return lines.join('\n');
}

/**
 * Format check result as JSON
 */
export function formatTenantCheckAsJson(result: TenantCheckResult): Record<string, unknown> {
  return {
    tenantId: result.tenantId,
    passed: result.passed,
    isolationScore: result.summary.isolationScore,
    checks: result.checks,
    tables: result.summary.tablesChecked,
    violations: result.violations.map(v => ({
      type: v.type,
      table: v.table,
      record: v.recordId.substring(0, 16) + '...',
    })),
    resultHash: result.resultHash,
  };
}
