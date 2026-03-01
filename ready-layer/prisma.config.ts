import { defineConfig } from '@prisma/config';

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
  },
  // Use directUrl for migrations to avoid connection pooler issues
  // The pooler (port 6543) is for app runtime, direct connection (port 5432) for migrations
  migrate: {
    adapter: async () => {
      // Validate that DATABASE_URL and DIRECT_DATABASE_URL are different in production
      if (process.env.NODE_ENV === 'production') {
        const dbUrl = process.env.DATABASE_URL;
        const directUrl = process.env.DIRECT_DATABASE_URL;
        
        if (!dbUrl || !directUrl) {
          throw new Error(
            '[FATAL] Both DATABASE_URL and DIRECT_DATABASE_URL must be set in production. ' +
            'DATABASE_URL (pooler) is for runtime, DIRECT_DATABASE_URL (direct) is for migrations.'
          );
        }
        
        if (dbUrl === directUrl) {
          throw new Error(
            '[FATAL] DATABASE_URL and DIRECT_DATABASE_URL must be different in production. ' +
            'Use the Supabase session pooler (port 6543) for DATABASE_URL and ' +
            'direct connection (port 5432) for DIRECT_DATABASE_URL.'
          );
        }
      }
      return null;
    },
  },
});
