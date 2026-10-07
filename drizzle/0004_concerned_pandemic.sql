CREATE TABLE "start_protocols" (
	"id" serial PRIMARY KEY NOT NULL,
	"sport_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"object_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"created_by_judge_id" integer,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"published_at" text
);
--> statement-breakpoint
ALTER TABLE "email_outbox" ADD COLUMN "kind" text DEFAULT 'approval' NOT NULL;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD COLUMN "start_protocol_id" integer;--> statement-breakpoint
ALTER TABLE "start_protocols" ADD CONSTRAINT "start_protocols_sport_id_sports_id_fk" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "start_protocols" ADD CONSTRAINT "start_protocols_created_by_judge_id_judges_id_fk" FOREIGN KEY ("created_by_judge_id") REFERENCES "public"."judges"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_start_protocol_object" ON "start_protocols" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "idx_start_protocol_sport" ON "start_protocols" USING btree ("sport_id");--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_start_protocol_id_start_protocols_id_fk" FOREIGN KEY ("start_protocol_id") REFERENCES "public"."start_protocols"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_protocol_school_email" ON "email_outbox" USING btree ("start_protocol_id","school_id");