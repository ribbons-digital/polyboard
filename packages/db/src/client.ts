import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { parseDatabaseEnv } from './env'

export function createDb(env: Record<string, string | undefined> = process.env) {
  const parsed = parseDatabaseEnv(env)
  const client = postgres(parsed.databaseUrl, {
    prepare: false,
    max: 5,
  })

  return drizzle(client)
}
