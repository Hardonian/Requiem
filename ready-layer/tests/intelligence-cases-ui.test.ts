import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

describe('intelligence cases page badge rendering', () => {
  it('renders pointer type badges with stable class tokens', async () => {
    vi.doMock('@/lib/intelligence-store', () => ({
      getCases: () => [
        {
          case_id: '123e4567-e89b-12d3-a456-426614174000',
          tenant_id: 'tenant-snapshot',
          summary: 'Fix build regression',
          failing_command: 'pnpm build',
          tests_passed: true,
          build_passed: true,
          cost_units: 42,
          pointers: ['run:run-1', 'artifact://bundle/run-1', 'evidence:test-log'],
          created_at: '2026-01-01T00:00:00.000Z',
          case_version: 'v1',
        },
      ],
    }));

    const mod = await import('../src/app/intelligence/cases/page');
    const element = await mod.default({ searchParams: Promise.resolve({ tenant: 'tenant-snapshot' }) });
    const html = renderToStaticMarkup(element);

    expect(html).toContain('bg-blue-100 text-blue-800');
    expect(html).toContain('bg-emerald-100 text-emerald-800');
    expect(html).toContain('bg-amber-100 text-amber-800');
    expect(html).toContain('>run<');
    expect(html).toContain('>artifact<');
    expect(html).toContain('>evidence<');
    expect(html).toMatchSnapshot();
  });
});
