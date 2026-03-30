import { existsSync } from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'drizzle-kit'
import { config } from 'dotenv'

let currentDir = process.cwd()

while (true) {
  const candidate = path.join(currentDir, '.env')

  if (existsSync(candidate)) {
    config({ path: candidate })
    break
  }

  const parentDir = path.dirname(currentDir)

  if (parentDir === currentDir) {
    break
  }

  currentDir = parentDir
}

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://polyboard:polyboard@localhost:5432/polyboard',
  },
})
