ALTER TABLE "wallet_trades" DROP CONSTRAINT "wallet_trades_pkey";--> statement-breakpoint
ALTER TABLE "wallet_trades" ADD COLUMN "id" bigint GENERATED ALWAYS AS IDENTITY (sequence name "wallet_trades_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1) NOT NULL;--> statement-breakpoint
ALTER TABLE "wallet_trades" ADD CONSTRAINT "wallet_trades_pkey" PRIMARY KEY ("id");
