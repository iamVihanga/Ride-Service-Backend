import { drizzle } from 'drizzle-orm/node-postgres';

import env from '@/env';

import * as schema from '@/db/schema';

const db = drizzle({
  connection: {
    connectionString: env.DATABASE_URL,
    ssl: false
  },
  schema
});

export default db;
