ALTER TABLE "email_outbox" ADD COLUMN "html" text;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD COLUMN "sender" text;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD COLUMN "reply_to" text;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD COLUMN "provider_id" text;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD COLUMN "delivery_status" text;