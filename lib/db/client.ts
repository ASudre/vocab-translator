import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

declare global {
  var __dbClient: postgres.Sql | undefined;
}

// A module-scope singleton, reused across route handler invocations within
// the same serverless instance. `max: 1` because each instance handles one
// request at a time and Neon's pooler already pools across instances.
const client = globalThis.__dbClient ?? postgres(process.env.DATABASE_URL!, { max: 1 });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__dbClient = client;
}

export const db = drizzle(client, { schema });
