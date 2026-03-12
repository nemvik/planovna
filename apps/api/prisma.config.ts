import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const buildSafeDatabaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=app';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: buildSafeDatabaseUrl,
  },
});
