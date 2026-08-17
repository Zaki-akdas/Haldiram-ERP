import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Load local environment (Vercel injects env vars natively, so files are only
// needed for local development). .env.local takes precedence over .env.
config({ path: ['.env.local', '.env'] });

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.local / .env from the project root, ' +
      'or export DATABASE_URL before running drizzle-kit.'
  );
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
