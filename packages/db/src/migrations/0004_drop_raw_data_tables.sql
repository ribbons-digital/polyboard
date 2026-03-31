-- Migration: 0004_drop_raw_data_tables
-- Purpose: Remove tables storing large raw data to reduce memory/DB size
-- Created: 2025-04-01 as part of hybrid architecture refactor

-- Drop large raw data tables that cause memory exhaustion
DROP TABLE IF EXISTS wallet_positions_open CASCADE;
DROP TABLE IF EXISTS wallet_positions_closed CASCADE;
DROP TABLE IF EXISTS wallet_trades CASCADE;
DROP TABLE IF EXISTS market_holders CASCADE;
DROP TABLE IF EXISTS wallet_event_stats CASCADE;

-- Clean up old snapshot data (keep last 24 hours)
DELETE FROM market_snapshots 
WHERE captured_at < NOW() - INTERVAL '24 hours';

-- Add index for efficient future cleanup
CREATE INDEX IF NOT EXISTS idx_market_snapshots_captured_at 
ON market_snapshots(captured_at);
