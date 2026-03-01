// ready-layer/src/app/api/mcp/health/route.ts
// Force dynamic rendering: this route registers built-in tools + skills at runtime.
export const dynamic = 'force-dynamic';

// Initialization: registers built-in tools + skills
import '@requiem/ai';
import { GET_health } from '@requiem/ai/mcp';

export const GET = GET_health;
