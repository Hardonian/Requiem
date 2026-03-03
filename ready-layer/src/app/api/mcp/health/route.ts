export async function GET(req: Request): Promise<Response> {
  await import('@requiem/ai');
  const { GET_health } = await import('@requiem/ai/mcp');
  return GET_health(req);
}
