// ready-layer/src/app/api/mcp/tools/route.ts
// Force dynamic rendering: this route requires runtime auth secrets.
export const dynamic = 'force-dynamic';

import '@requiem/ai';
import { GET_tools } from '@requiem/ai/mcp';

export const GET = GET_tools;
