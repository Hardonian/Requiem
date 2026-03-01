// ready-layer/src/app/api/mcp/tool/call/route.ts
// Force dynamic rendering: this route requires runtime auth secrets.
export const dynamic = 'force-dynamic';

import '@requiem/ai';
import { POST_callTool } from '@requiem/ai/mcp';

export const POST = POST_callTool;
