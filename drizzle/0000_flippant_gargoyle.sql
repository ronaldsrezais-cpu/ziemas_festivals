CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"sport_id" integer NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"discipline" text NOT NULL,
	"gender" text NOT NULL,
	"min_birth_year" integer NOT NULL,
	"max_birth_year" integer NOT NULL,
	"team_min" integer DEFAULT 1 NOT NULL,
	"team_max" integer DEFAULT 1 NOT NULL,
	"school_limit" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_outbox" (
	"id" serial PRIMARY KEY NOT NULL,
	"school_id" integer,
	"recipient" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"error" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"sent_at" text
);
--> statement-breakpoint
CREATE TABLE "entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"school_id" integer NOT NULL,
	"category_id" integer NOT NULL,
	"participant_id" integer NOT NULL,
	"team_name" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "judges" (
	"id" serial PRIMARY KEY NOT NULL,
	"sport_id" integer NOT NULL,
	"full_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leaders" (
	"id" serial PRIMARY KEY NOT NULL,
	"school_id" integer NOT NULL,
	"full_name" text NOT NULL,
	"role" text DEFAULT 'Komandas vadītājs' NOT NULL,
	"email" text,
	"phone" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"school_id" integer NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"birth_year" integer NOT NULL,
	"gender" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "results" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"entry_id" integer NOT NULL,
	"placement" integer,
	"status" text DEFAULT 'ranked' NOT NULL,
	"score" text,
	"source_upload_id" integer,
	"judge_id" integer,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"municipality" text NOT NULL,
	"teacher_name" text NOT NULL,
	"teacher_role" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"access_code_hash" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"approved_at" text
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"subject_id" integer NOT NULL,
	"expires_at" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sports" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"location" text NOT NULL,
	"mode" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploads" (
	"id" serial PRIMARY KEY NOT NULL,
	"sport_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"object_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"status" text DEFAULT 'uploaded' NOT NULL,
	"created_by_judge_id" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_sport_id_sports_id_fk" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judges" ADD CONSTRAINT "judges_sport_id_sports_id_fk" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaders" ADD CONSTRAINT "leaders_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "results" ADD CONSTRAINT "results_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "results" ADD CONSTRAINT "results_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "results" ADD CONSTRAINT "results_source_upload_id_uploads_id_fk" FOREIGN KEY ("source_upload_id") REFERENCES "public"."uploads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "results" ADD CONSTRAINT "results_judge_id_judges_id_fk" FOREIGN KEY ("judge_id") REFERENCES "public"."judges"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_sport_id_sports_id_fk" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_created_by_judge_id_judges_id_fk" FOREIGN KEY ("created_by_judge_id") REFERENCES "public"."judges"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_categories_sport_code" ON "categories" USING btree ("sport_id","code");--> statement-breakpoint
CREATE INDEX "idx_categories_sport_id" ON "categories" USING btree ("sport_id");--> statement-breakpoint
CREATE INDEX "idx_email_outbox_status" ON "email_outbox" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_entries_participant_category" ON "entries" USING btree ("participant_id","category_id");--> statement-breakpoint
CREATE INDEX "idx_entries_school_id" ON "entries" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "idx_entries_category_id" ON "entries" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_judges_sport_id" ON "judges" USING btree ("sport_id");--> statement-breakpoint
CREATE INDEX "idx_leaders_school_id" ON "leaders" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "idx_participants_school_id" ON "participants" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "idx_participants_birth_year_gender" ON "participants" USING btree ("birth_year","gender");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_results_entry_category" ON "results" USING btree ("entry_id","category_id");--> statement-breakpoint
CREATE INDEX "idx_results_category_place" ON "results" USING btree ("category_id","placement");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_schools_name_municipality" ON "schools" USING btree ("name","municipality");--> statement-breakpoint
CREATE INDEX "idx_schools_status" ON "schools" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_schools_municipality" ON "schools" USING btree ("municipality");--> statement-breakpoint
CREATE INDEX "idx_sessions_expires_at" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sports_code" ON "sports" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_uploads_sport_id" ON "uploads" USING btree ("sport_id");