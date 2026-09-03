import { sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, serial, text, uniqueIndex } from "drizzle-orm/pg-core";

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const schools = pgTable(
  "schools",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    municipality: text("municipality").notNull(),
    teacherName: text("teacher_name").notNull(),
    teacherRole: text("teacher_role").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
    accessCodeHash: text("access_code_hash"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    approvedAt: text("approved_at"),
  },
  (table) => [
    uniqueIndex("idx_schools_name_municipality").on(table.name, table.municipality),
    index("idx_schools_status").on(table.status),
    index("idx_schools_municipality").on(table.municipality),
  ],
);

export const leaders = pgTable(
  "leaders",
  {
    id: serial("id").primaryKey(),
    schoolId: integer("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    role: text("role").notNull().default("Komandas vadītājs"),
    email: text("email"),
    phone: text("phone"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_leaders_school_id").on(table.schoolId)],
);

export const participants = pgTable(
  "participants",
  {
    id: serial("id").primaryKey(),
    schoolId: integer("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    birthYear: integer("birth_year").notNull(),
    gender: text("gender", { enum: ["F", "M"] }).notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_participants_school_id").on(table.schoolId),
    index("idx_participants_birth_year_gender").on(table.birthYear, table.gender),
  ],
);

export const sports = pgTable(
  "sports",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    location: text("location").notNull(),
    mode: text("mode", { enum: ["individual", "team"] }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
  },
  (table) => [uniqueIndex("idx_sports_code").on(table.code)],
);

export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    sportId: integer("sport_id").notNull().references(() => sports.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    discipline: text("discipline").notNull(),
    gender: text("gender", { enum: ["F", "M", "X"] }).notNull(),
    minBirthYear: integer("min_birth_year").notNull(),
    maxBirthYear: integer("max_birth_year").notNull(),
    teamMin: integer("team_min").notNull().default(1),
    teamMax: integer("team_max").notNull().default(1),
    schoolLimit: integer("school_limit"),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
  },
  (table) => [
    uniqueIndex("idx_categories_sport_code").on(table.sportId, table.code),
    index("idx_categories_sport_id").on(table.sportId),
  ],
);

export const entries = pgTable(
  "entries",
  {
    id: serial("id").primaryKey(),
    schoolId: integer("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
    categoryId: integer("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
    participantId: integer("participant_id").notNull().references(() => participants.id, { onDelete: "cascade" }),
    teamName: text("team_name"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_entries_participant_category").on(table.participantId, table.categoryId),
    index("idx_entries_school_id").on(table.schoolId),
    index("idx_entries_category_id").on(table.categoryId),
  ],
);

export const judges = pgTable(
  "judges",
  {
    id: serial("id").primaryKey(),
    sportId: integer("sport_id").notNull().references(() => sports.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    passwordHash: text("password_hash").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_judges_sport_id").on(table.sportId)],
);

export const uploads = pgTable(
  "uploads",
  {
    id: serial("id").primaryKey(),
    sportId: integer("sport_id").notNull().references(() => sports.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    objectKey: text("object_key").notNull(),
    mimeType: text("mime_type").notNull(),
    status: text("status", { enum: ["uploaded", "reviewed", "published"] }).notNull().default("uploaded"),
    createdByJudgeId: integer("created_by_judge_id").references(() => judges.id, { onDelete: "set null" }),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_uploads_sport_id").on(table.sportId)],
);

export const results = pgTable(
  "results",
  {
    id: serial("id").primaryKey(),
    categoryId: integer("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
    entryId: integer("entry_id").notNull().references(() => entries.id, { onDelete: "cascade" }),
    placement: integer("placement"),
    status: text("status", { enum: ["ranked", "dns", "dnf", "dsq"] }).notNull().default("ranked"),
    score: text("score"),
    sourceUploadId: integer("source_upload_id").references(() => uploads.id, { onDelete: "set null" }),
    judgeId: integer("judge_id").references(() => judges.id, { onDelete: "set null" }),
    published: boolean("published").notNull().default(false),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_results_entry_category").on(table.entryId, table.categoryId),
    index("idx_results_category_place").on(table.categoryId, table.placement),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    role: text("role", { enum: ["admin", "school", "judge"] }).notNull(),
    subjectId: integer("subject_id").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_sessions_expires_at").on(table.expiresAt)],
);

export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: serial("id").primaryKey(),
    schoolId: integer("school_id").references(() => schools.id, { onDelete: "cascade" }),
    recipient: text("recipient").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    status: text("status", { enum: ["queued", "sent", "failed"] }).notNull().default("queued"),
    error: text("error"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    sentAt: text("sent_at"),
  },
  (table) => [index("idx_email_outbox_status").on(table.status)],
);
