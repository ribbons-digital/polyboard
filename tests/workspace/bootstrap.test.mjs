import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'

const requiredFiles = [
  'package.json',
  'pnpm-workspace.yaml',
  'tsconfig.base.json',
  '.gitignore',
  '.env.example',
  'docker-compose.yml',
]

test('workspace bootstrap files exist', () => {
  for (const file of requiredFiles) {
    assert.equal(existsSync(file), true, `Missing required file: ${file}`)
  }
})
