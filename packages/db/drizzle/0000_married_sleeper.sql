CREATE TABLE "app_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"min_market_volume" integer DEFAULT 50000 NOT NULL,
	"score_weights" jsonb DEFAULT '{"marketStructure":0.4,"smartMoney":0.4,"timing":0.2}'::jsonb NOT NULL,
	"tracked_categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_freshness" (
	"source_key" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"completeness" text DEFAULT 'backfilled' NOT NULL,
	"as_of" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"category" text,
	"end_date" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "job_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"job_name" text NOT NULL,
	"status" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "market_holders" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "market_holders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"market_id" text NOT NULL,
	"token_id" text NOT NULL,
	"wallet_address" text NOT NULL,
	"size" numeric(18, 4) NOT NULL,
	"current_value" numeric(18, 2),
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_scores" (
	"market_id" text PRIMARY KEY NOT NULL,
	"market_structure_score" numeric(10, 4) NOT NULL,
	"smart_money_score" numeric(10, 4) NOT NULL,
	"timing_score" numeric(10, 4) NOT NULL,
	"edge_score" numeric(10, 4) NOT NULL,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"calculated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_snapshots" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "market_snapshots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"market_id" text NOT NULL,
	"token_id" text NOT NULL,
	"last_price" numeric(12, 6),
	"spread_bps" numeric(12, 2),
	"best_bid" numeric(12, 6),
	"best_ask" numeric(12, 6),
	"captured_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_tags" (
	"market_id" text NOT NULL,
	"tag_slug" text NOT NULL,
	"label" text NOT NULL,
	CONSTRAINT "market_tags_market_id_tag_slug_pk" PRIMARY KEY("market_id","tag_slug")
);
--> statement-breakpoint
CREATE TABLE "markets" (
	"id" text PRIMARY KEY NOT NULL,
	"condition_id" text NOT NULL,
	"event_id" text,
	"question" text NOT NULL,
	"slug" text NOT NULL,
	"active" boolean NOT NULL,
	"closed" boolean NOT NULL,
	"volume" numeric(18, 2) NOT NULL,
	"liquidity" numeric(18, 2),
	"end_date" timestamp with time zone,
	"category" varchar(120),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "markets_condition_id_unique" UNIQUE("condition_id")
);
--> statement-breakpoint
CREATE TABLE "tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"market_id" text NOT NULL,
	"outcome" text NOT NULL,
	"outcome_index" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_event_stats" (
	"wallet_address" text NOT NULL,
	"event_slug" text NOT NULL,
	"trade_count" integer NOT NULL,
	"realized_pnl" numeric(18, 2) NOT NULL,
	"total_volume" numeric(18, 2) NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "wallet_event_stats_wallet_address_event_slug_pk" PRIMARY KEY("wallet_address","event_slug")
);
--> statement-breakpoint
CREATE TABLE "wallet_positions_closed" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "wallet_positions_closed_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"wallet_address" text NOT NULL,
	"market_id" text NOT NULL,
	"token_id" text NOT NULL,
	"outcome" text NOT NULL,
	"total_bought" numeric(18, 2) NOT NULL,
	"average_price" numeric(12, 6) NOT NULL,
	"realized_pnl" numeric(18, 2) NOT NULL,
	"closed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_positions_open" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "wallet_positions_open_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"wallet_address" text NOT NULL,
	"market_id" text NOT NULL,
	"token_id" text NOT NULL,
	"outcome" text NOT NULL,
	"size" numeric(18, 4) NOT NULL,
	"average_price" numeric(12, 6) NOT NULL,
	"current_value" numeric(18, 2) NOT NULL,
	"realized_pnl" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total_pnl" numeric(18, 2) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_scores" (
	"wallet_address" text PRIMARY KEY NOT NULL,
	"realized_pnl" numeric(18, 2) DEFAULT '0' NOT NULL,
	"unrealized_pnl" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total_pnl" numeric(18, 2) DEFAULT '0' NOT NULL,
	"win_rate" numeric(8, 4) DEFAULT '0' NOT NULL,
	"average_position_size" numeric(18, 2) DEFAULT '0' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"completeness" text DEFAULT 'provisional' NOT NULL,
	"calculated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_trades" (
	"transaction_hash" text PRIMARY KEY NOT NULL,
	"wallet_address" text NOT NULL,
	"market_id" text NOT NULL,
	"token_id" text NOT NULL,
	"side" text NOT NULL,
	"price" numeric(12, 6) NOT NULL,
	"size" numeric(18, 4) NOT NULL,
	"traded_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_watchlists" (
	"address" text PRIMARY KEY NOT NULL,
	"note" text,
	"is_excluded" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"address" text PRIMARY KEY NOT NULL,
	"display_name" text,
	"pseudonym" text,
	"verified" boolean DEFAULT false NOT NULL,
	"profile_image" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "market_holders" ADD CONSTRAINT "market_holders_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_holders" ADD CONSTRAINT "market_holders_token_id_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_holders" ADD CONSTRAINT "market_holders_wallet_address_wallets_address_fk" FOREIGN KEY ("wallet_address") REFERENCES "public"."wallets"("address") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_scores" ADD CONSTRAINT "market_scores_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_snapshots" ADD CONSTRAINT "market_snapshots_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_snapshots" ADD CONSTRAINT "market_snapshots_token_id_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_tags" ADD CONSTRAINT "market_tags_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "markets" ADD CONSTRAINT "markets_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_event_stats" ADD CONSTRAINT "wallet_event_stats_wallet_address_wallets_address_fk" FOREIGN KEY ("wallet_address") REFERENCES "public"."wallets"("address") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_positions_closed" ADD CONSTRAINT "wallet_positions_closed_wallet_address_wallets_address_fk" FOREIGN KEY ("wallet_address") REFERENCES "public"."wallets"("address") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_positions_closed" ADD CONSTRAINT "wallet_positions_closed_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_positions_closed" ADD CONSTRAINT "wallet_positions_closed_token_id_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_positions_open" ADD CONSTRAINT "wallet_positions_open_wallet_address_wallets_address_fk" FOREIGN KEY ("wallet_address") REFERENCES "public"."wallets"("address") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_positions_open" ADD CONSTRAINT "wallet_positions_open_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_positions_open" ADD CONSTRAINT "wallet_positions_open_token_id_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_scores" ADD CONSTRAINT "wallet_scores_wallet_address_wallets_address_fk" FOREIGN KEY ("wallet_address") REFERENCES "public"."wallets"("address") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_trades" ADD CONSTRAINT "wallet_trades_wallet_address_wallets_address_fk" FOREIGN KEY ("wallet_address") REFERENCES "public"."wallets"("address") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_trades" ADD CONSTRAINT "wallet_trades_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_trades" ADD CONSTRAINT "wallet_trades_token_id_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_watchlists" ADD CONSTRAINT "wallet_watchlists_address_wallets_address_fk" FOREIGN KEY ("address") REFERENCES "public"."wallets"("address") ON DELETE cascade ON UPDATE no action;