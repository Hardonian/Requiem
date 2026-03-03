export interface ProblemJson {
  type: string;
  title: string;
  status: number;
  detail: string;
  trace_id?: string;
}

export function problem(status: number, title: string, detail: string, traceId?: string): Response {
  const payload: ProblemJson = {
    type: `https://httpstatuses.com/${status}`,
    title,
    status,
    detail,
    trace_id: traceId,
  };
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/problem+json' },
  });
}
