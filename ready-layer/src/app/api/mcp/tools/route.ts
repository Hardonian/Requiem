export async function GET(req: Request): Promise<Response> {
  await import('@requiem/ai');
  const { GET_tools } = await import('@requiem/ai/mcp');
  return GET_tools(req);
}
