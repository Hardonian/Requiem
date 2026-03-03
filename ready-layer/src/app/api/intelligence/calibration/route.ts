import { NextResponse } from 'next/server';
import { loadCalibrationReport } from '@/lib/calibration-report';

export const dynamic = 'force-dynamic';

function traceId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function GET(): Promise<NextResponse> {
  const t = traceId();
  try {
    const data = loadCalibrationReport();
    return NextResponse.json({ ok: true, data, trace_id: t }, { status: 200 });
  } catch (error) {
    return NextResponse.json({
      type: 'about:blank',
      title: 'Calibration data unavailable',
      status: 500,
      detail: error instanceof Error ? error.message : 'unknown_error',
      trace_id: t,
    }, { status: 500, headers: { 'content-type': 'application/problem+json' } });
  }
}
