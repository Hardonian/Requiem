export async function POST(req: Request): Promise<Response> {
  await import('@requiem/ai');
  const { POST_callTool } = await import('@requiem/ai/mcp');
  return POST_callTool(req);
}
