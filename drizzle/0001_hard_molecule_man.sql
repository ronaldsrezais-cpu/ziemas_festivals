ALTER TABLE "email_outbox" ADD COLUMN "last_attempt_at" text;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD COLUMN "attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "roster_submitted_at" text;
--> statement-breakpoint
INSERT INTO "settings" ("key", "value") VALUES ('roster_editing_open', 'true') ON CONFLICT ("key") DO NOTHING;
