#!/usr/bin/env node
/**
 * Diagnostic script to check data freshness status
 * Run with: pnpm exec tsx scripts/check-freshness.ts
 */
import { createDb, dataFreshness, jobRuns } from '@polyboard/db'
import { desc } from 'drizzle-orm'

const freshnessStaleAfterMs: Record<string, number> = {
  'gamma:markets': 600_000,
  'data:wallets': 1_800_000,
  'scores:markets': 600_000,
  'ws:markets': 300_000,
}

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`
  return `${Math.round(ms / 3_600_000)}h`
}

async function main() {
  const db = createDb()
  const now = new Date()

  console.log('\n📊 Polyboard Data Freshness Status')
  console.log('===================================\n')
  console.log(`Checked at: ${now.toISOString()}`)
  console.log()

  const rows = await db.select().from(dataFreshness)

  if (rows.length === 0) {
    console.log('⚠️  No freshness rows found in database!')
    console.log('   The worker may not have started or completed bootstrap.')
    process.exit(1)
  }

  let hasIssues = false

  for (const row of rows) {
    const sourceKey = row.sourceKey
    const status = row.status
    const asOf = row.asOf
    const threshold = freshnessStaleAfterMs[sourceKey]

    let ageMs: number | null = null
    let isStale = false
    let icon = '✅'

    if (asOf) {
      ageMs = now.getTime() - new Date(asOf).getTime()
      if (threshold && ageMs > threshold) {
        isStale = true
        hasIssues = true
        icon = '⚠️'
      }
    } else {
      hasIssues = true
      icon = '❌'
    }

    if (status === 'degraded' || status === 'fallback') {
      hasIssues = true
      icon = status === 'degraded' ? '⚠️' : '⏸️'
    }

    console.log(`${icon} ${sourceKey}`)
    console.log(`   Status: ${status}`)
    if (asOf) {
      console.log(`   Last Update: ${new Date(asOf).toISOString()}`)
      if (ageMs !== null) {
        console.log(`   Age: ${formatDuration(ageMs)}${isStale ? ' ← STALE!' : ''}`)
      }
    } else {
      console.log(`   Last Update: NEVER`)
    }
    if (threshold) {
      console.log(`   Threshold: ${formatDuration(threshold)}`)
    }
    console.log()
  }

  // Check recent job runs
  console.log('\n📋 Recent Job Runs')
  console.log('===================\n')
  
  const recentJobs = await db
    .select()
    .from(jobRuns)
    .orderBy(desc(jobRuns.startedAt))
    .limit(10)

  if (recentJobs.length === 0) {
    console.log('No job runs recorded yet.')
  } else {
    for (const job of recentJobs) {
      const icon = job.status === 'completed' ? '✅' : job.status === 'failed' ? '❌' : '⏳'
      console.log(`${icon} ${job.jobName}`)
      console.log(`   Status: ${job.status}`)
      console.log(`   Started: ${new Date(job.startedAt).toISOString()}`)
      if (job.endedAt) {
        const duration = new Date(job.endedAt).getTime() - new Date(job.startedAt).getTime()
        console.log(`   Duration: ${formatDuration(duration)}`)
      }
      console.log()
    }
  }

  if (hasIssues) {
    console.log('⚠️  ISSUES DETECTED')
    console.log('   Some data sources are stale or unavailable.')
    console.log('   Check worker logs for errors:')
    console.log('   - Look for "[scheduler] starting discovery/backfill/scoreRefresh"')
    console.log('   - Look for "[scheduler] X failed" error messages')
    process.exit(1)
  } else {
    console.log('✅ All data sources are fresh and live!')
    process.exit(0)
  }
}

main().catch((error) => {
  console.error('Failed to check freshness:', error)
  process.exit(1)
})
