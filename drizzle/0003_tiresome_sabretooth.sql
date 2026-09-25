CREATE TABLE "safety_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"school_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"object_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"roster_revision" integer NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "roster_revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "safety_documents" ADD CONSTRAINT "safety_documents_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_safety_documents_school" ON "safety_documents" USING btree ("school_id");