import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { municipalityOptions } from "@/lib/municipalities";
import { getDb } from "@/db";
import {
  categories,
  emailOutbox,
  entries,
  judges,
  leaders,
  participants,
  results,
  schools,
  settings,
  sports,
  uploads,
} from "@/db/schema";
import { approveSchool, resendApprovalEmail } from "@/lib/email";
import { mutateSchoolRoster } from "@/lib/school-roster";
import { rosterReadiness } from "@/lib/roster-readiness";
import { runtimeEnv } from "@/lib/runtime";
import {
  accessCodeHash,
  createSession,
  destroySession,
  getSession,
  hashSecret,
  requiredLeaders,
  verifySecret,
} from "@/lib/security";
import { recoverSchoolAccessCode } from "@/lib/school-access-code";
import { getSportsWithCategories } from "@/lib/sport-seed";

export const dynamic = "force-dynamic";

const schoolRegistrationSchema = z.object({
  name: z.string().trim().min(2).max(180),
  municipality: z.enum(municipalityOptions, { errorMap: () => ({ message: "Izvēlieties novadu vai valstspilsētu no saraksta." }) }),
  teacherName: z.string().trim().min(3).max(120),
  teacherRole: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  phone: z.string().trim().min(6).max(40),
});


function message(error: unknown) {
  if (error instanceof z.ZodError)
    return error.issues[0]?.message ?? "Nepilnīgi dati";
  const databaseCode =
    typeof error === "object" && error && "code" in error
      ? String(error.code)
      : "";
  if (
    databaseCode === "23505" ||
    (error instanceof Error && /UNIQUE constraint failed/.test(error.message))
  )
    return "Šāda informācija sistēmā jau ir reģistrēta.";
  return error instanceof Error
    ? error.message
    : "Neizdevās apstrādāt pieprasījumu.";
}

async function publicView() {
  const db = getDb();
  const sportRows = await getSportsWithCategories();
  const [participantsSetting] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "participants_public"))
    .limit(1);
  const participantsPublic = participantsSetting?.value !== "false";
  const schoolRows = await db
    .select({
      id: schools.id,
      name: schools.name,
      municipality: schools.municipality,
    })
    .from(schools)
    .where(eq(schools.status, "approved"))
    .orderBy(asc(schools.name));
  const participantRows = await db
    .select({
      id: participants.id,
      firstName: participants.firstName,
      lastName: participants.lastName,
      birthYear: participants.birthYear,
      gender: participants.gender,
      schoolId: schools.id,
      schoolName: schools.name,
      municipality: schools.municipality,
    })
    .from(participants)
    .innerJoin(schools, eq(participants.schoolId, schools.id))
    .where(and(eq(participants.active, true), eq(schools.status, "approved")))
    .orderBy(asc(schools.name), asc(participants.lastName));
  const resultRows = await db
    .select({
      id: results.id,
      placement: results.placement,
      status: results.status,
      score: results.score,
      categoryId: categories.id,
      categoryName: categories.name,
      discipline: categories.discipline,
      gender: categories.gender,
      sportId: sports.id,
      sportName: sports.name,
      participantId: participants.id,
      participantName: participants.firstName,
      participantLastName: participants.lastName,
      schoolId: schools.id,
      schoolName: schools.name,
      municipality: schools.municipality,
      teamName: entries.teamName,
      sourceUploadId: results.sourceUploadId,
    })
    .from(results)
    .innerJoin(entries, eq(results.entryId, entries.id))
    .innerJoin(categories, eq(results.categoryId, categories.id))
    .innerJoin(sports, eq(categories.sportId, sports.id))
    .innerJoin(participants, eq(entries.participantId, participants.id))
    .innerJoin(schools, eq(entries.schoolId, schools.id))
    .where(eq(results.published, true))
    .orderBy(
      asc(sports.sortOrder),
      asc(categories.sortOrder),
      asc(results.placement),
    );
  const uploadIds = resultRows
    .map((row) => row.sourceUploadId)
    .filter((id): id is number => Boolean(id));
  const uploadRows = uploadIds.length
    ? await db
        .select({ id: uploads.id, fileName: uploads.fileName })
        .from(uploads)
        .where(inArray(uploads.id, uploadIds))
    : [];
  const judgeRows = await db
    .select({
      id: judges.id,
      fullName: judges.fullName,
      sportId: judges.sportId,
      sportName: sports.name,
    })
    .from(judges)
    .innerJoin(sports, eq(judges.sportId, sports.id))
    .where(eq(judges.active, true))
    .orderBy(asc(sports.sortOrder), asc(judges.fullName));
  return {
    sports: sportRows,
    schools: schoolRows,
    participants: participantsPublic ? participantRows : [],
    participantsPublic,
    participantCount: participantRows.length,
    results: resultRows,
    uploads: uploadRows,
    judges: judgeRows,
  };
}

async function schoolView(schoolId: number) {
  const db = getDb();
  const [school] = await db
    .select()
    .from(schools)
    .where(eq(schools.id, schoolId))
    .limit(1);
  if (!school) throw new Error("Skola nav atrasta.");
  const [leaderRows, participantRows, entryRows, sportRows, editingRows] = await Promise.all(
    [
      db
        .select()
        .from(leaders)
        .where(eq(leaders.schoolId, schoolId))
        .orderBy(asc(leaders.id)),
      db
        .select()
        .from(participants)
        .where(
          and(
            eq(participants.schoolId, schoolId),
            eq(participants.active, true),
          ),
        )
        .orderBy(asc(participants.lastName)),
      db
        .select()
        .from(entries)
        .where(eq(entries.schoolId, schoolId))
        .orderBy(asc(entries.id)),
      getSportsWithCategories(),
      db.select().from(settings).where(eq(settings.key, "roster_editing_open")),
    ],
  );
  return {
    school: { ...school, accessCodeHash: undefined },
    leaders: leaderRows,
    participants: participantRows,
    entries: entryRows,
    sports: sportRows,
    requiredLeaders: requiredLeaders(participantRows.length),
    rosterEditable: editingRows[0]?.value !== "false" && school.status === "approved",
    readiness: rosterReadiness(participantRows.length, leaderRows.length, school.rosterSubmittedAt,
      participantRows.filter(person => !entryRows.some(entry => entry.participantId === person.id)).length),
  };
}

async function adminView() {
  const db = getDb();
  await getSportsWithCategories();
  const [
    schoolRows,
    leaderRows,
    participantRows,
    sportRows,
    categoryRows,
    judgeRows,
    settingRows,
    codeMessages,
    entryRows,
  ] = await Promise.all([
    db.select().from(schools).orderBy(desc(schools.createdAt)),
    db.select().from(leaders),
    db.select().from(participants).where(eq(participants.active, true)),
    db.select().from(sports).orderBy(asc(sports.sortOrder)),
    db
      .select()
      .from(categories)
      .orderBy(asc(categories.sportId), asc(categories.sortOrder)),
    db
      .select({
        id: judges.id,
        fullName: judges.fullName,
        sportId: judges.sportId,
        sportName: sports.name,
        active: judges.active,
      })
      .from(judges)
      .innerJoin(sports, eq(judges.sportId, sports.id))
      .orderBy(asc(sports.name), asc(judges.fullName)),
    db.select().from(settings),
    db.selectDistinctOn([emailOutbox.schoolId], {
      id: emailOutbox.id,
      schoolId: emailOutbox.schoolId,
      body: emailOutbox.body,
      recipient: emailOutbox.recipient,
      status: emailOutbox.status,
      error: emailOutbox.error,
      createdAt: emailOutbox.createdAt,
      sentAt: emailOutbox.sentAt,
      lastAttemptAt: emailOutbox.lastAttemptAt,
      attemptCount: emailOutbox.attemptCount,
    }).from(emailOutbox).orderBy(emailOutbox.schoolId, desc(emailOutbox.id)),
    db.select({ participantId: entries.participantId }).from(entries),
  ]);
  const codeBodies = new Map(codeMessages.map((message) => [message.schoolId, message.body]));
  const schoolById = new Map(schoolRows.map((school) => [school.id, school]));
  const registeredIds = new Set(entryRows.map(entry => entry.participantId));
  const adminSchools = await Promise.all(schoolRows.map(async (school) => {
    const { accessCodeHash: currentHash, ...details } = school;
    return {
      ...details,
      accessCode: school.status === "approved" && runtimeEnv().AUTH_SECRET
        ? await recoverSchoolAccessCode(codeBodies.get(school.id), currentHash, accessCodeHash)
        : null,
      participantCount: participantRows.filter(
        (person) => person.schoolId === school.id,
      ).length,
      leaderCount: leaderRows.filter((leader) => leader.schoolId === school.id)
        .length,
      readiness: rosterReadiness(
        participantRows.filter(person => person.schoolId === school.id).length,
        leaderRows.filter(leader => leader.schoolId === school.id).length,
        school.rosterSubmittedAt,
        participantRows.filter(person => person.schoolId === school.id && !registeredIds.has(person.id)).length,
      ),
    };
  }));
  return {
    schools: adminSchools,
    leaders: leaderRows.map((leader) => {
      const school = schoolById.get(leader.schoolId);
      return {
        id: leader.id,
        fullName: leader.fullName,
        role: leader.role,
        email: leader.email,
        phone: leader.phone,
        schoolId: leader.schoolId,
        schoolName: school?.name ?? "",
        municipality: school?.municipality ?? "",
        schoolStatus: school?.status ?? "",
      };
    }).sort((a, b) => a.schoolName.localeCompare(b.schoolName, "lv") || a.fullName.localeCompare(b.fullName, "lv")),
    sports: sportRows.map((sport) => ({
      ...sport,
      categories: categoryRows.filter(
        (category) => category.sportId === sport.id,
      ),
    })),
    judges: judgeRows,
    outbox: codeMessages.map(mail => ({
      id: mail.id, schoolId: mail.schoolId, recipient: mail.recipient, status: mail.status,
      error: mail.error, createdAt: mail.createdAt, sentAt: mail.sentAt,
      lastAttemptAt: mail.lastAttemptAt, attemptCount: mail.attemptCount,
      schoolName: schoolById.get(mail.schoolId ?? -1)?.name ?? "Skola vairs nav pieejama",
      canRetry: adminSchools.some(school => school.id === mail.schoolId && school.status === "approved" && Boolean(school.accessCode)),
    })).sort((a, b) => b.id - a.id),
    emailConfigured: Boolean(runtimeEnv().RESEND_API_KEY && runtimeEnv().EMAIL_FROM),
    settings: Object.fromEntries(
      settingRows.map((row) => [row.key, row.value]),
    ),
  };
}

async function adminAccreditationView() {
  const db = getDb();
  const [participantRows, leaderRows, judgeRows] = await Promise.all([
    db
      .select({
        id: participants.id,
        firstName: participants.firstName,
        lastName: participants.lastName,
        schoolName: schools.name,
      })
      .from(participants)
      .innerJoin(schools, eq(participants.schoolId, schools.id))
      .where(and(eq(participants.active, true), eq(schools.status, "approved")))
      .orderBy(asc(schools.name), asc(participants.lastName)),
    db
      .select({
        id: leaders.id,
        fullName: leaders.fullName,
        role: leaders.role,
        schoolName: schools.name,
      })
      .from(leaders)
      .innerJoin(schools, eq(leaders.schoolId, schools.id))
      .where(eq(schools.status, "approved"))
      .orderBy(asc(schools.name), asc(leaders.fullName)),
    db
      .select({
        id: judges.id,
        fullName: judges.fullName,
        sportName: sports.name,
      })
      .from(judges)
      .innerJoin(sports, eq(judges.sportId, sports.id))
      .where(eq(judges.active, true))
      .orderBy(asc(sports.sortOrder), asc(judges.fullName)),
  ]);
  return {
    participants: participantRows,
    leaders: leaderRows,
    judges: judgeRows,
  };
}

async function judgeView(judgeId: number) {
  const db = getDb();
  const [judge] = await db
    .select({
      id: judges.id,
      fullName: judges.fullName,
      sportId: judges.sportId,
      sportName: sports.name,
    })
    .from(judges)
    .innerJoin(sports, eq(judges.sportId, sports.id))
    .where(and(eq(judges.id, judgeId), eq(judges.active, true)))
    .limit(1);
  if (!judge) throw new Error("Tiesnesis nav atrasts.");
  const categoryRows = await db
    .select()
    .from(categories)
    .where(
      and(eq(categories.sportId, judge.sportId), eq(categories.active, true)),
    )
    .orderBy(asc(categories.sortOrder));
  const categoryIds = categoryRows.map((category) => category.id);
  const entryRows = categoryIds.length
    ? await db
        .select({
          entryId: entries.id,
          categoryId: entries.categoryId,
          teamName: entries.teamName,
          participantId: participants.id,
          firstName: participants.firstName,
          lastName: participants.lastName,
          birthYear: participants.birthYear,
          gender: participants.gender,
          schoolId: schools.id,
          schoolName: schools.name,
          municipality: schools.municipality,
        })
        .from(entries)
        .innerJoin(participants, eq(entries.participantId, participants.id))
        .innerJoin(schools, eq(entries.schoolId, schools.id))
        .where(inArray(entries.categoryId, categoryIds))
        .orderBy(
          asc(entries.categoryId),
          asc(schools.name),
          asc(participants.lastName),
        )
    : [];
  const resultRows = categoryIds.length
    ? await db
        .select()
        .from(results)
        .where(inArray(results.categoryId, categoryIds))
    : [];
  const uploadRows = await db
    .select()
    .from(uploads)
    .where(eq(uploads.sportId, judge.sportId))
    .orderBy(desc(uploads.createdAt));
  return {
    judge,
    categories: categoryRows,
    entries: entryRows,
    results: resultRows,
    uploads: uploadRows,
  };
}

export async function GET(request: Request) {
  try {
    const view = new URL(request.url).searchParams.get("view") ?? "public";
    if (view === "public") return Response.json(await publicView());
    if (view === "school") {
      const session = await getSession("school");
      if (!session)
        return Response.json(
          { error: "Nepieciešama piekļuve skolas sadaļai." },
          { status: 401 },
        );
      return Response.json(await schoolView(session.subjectId));
    }
    if (view === "admin") {
      const session = await getSession("admin");
      if (!session)
        return Response.json(
          { error: "Nepieciešama administratora piekļuve." },
          { status: 401 },
        );
      return Response.json(await adminView());
    }
    if (view === "admin-accreditations") {
      const session = await getSession("admin");
      if (!session)
        return Response.json(
          { error: "Nepieciešama administratora piekļuve." },
          { status: 401 },
        );
      return Response.json(await adminAccreditationView());
    }
    if (view === "judge") {
      const session = await getSession("judge");
      if (!session)
        return Response.json(
          { error: "Nepieciešama tiesneša piekļuve." },
          { status: 401 },
        );
      return Response.json(await judgeView(session.subjectId));
    }
    if (view === "judge-login") {
      const db = getDb();
      const rows = await db
        .select({
          id: judges.id,
          fullName: judges.fullName,
          sportName: sports.name,
        })
        .from(judges)
        .innerJoin(sports, eq(judges.sportId, sports.id))
        .where(eq(judges.active, true))
        .orderBy(asc(sports.name), asc(judges.fullName));
      return Response.json({ judges: rows });
    }
    return Response.json({ error: "Nezināms skats." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const action = String(payload.action ?? "");
    const db = getDb();

    if (action === "register-school") {
      const [openSetting] = await db
        .select()
        .from(settings)
        .where(eq(settings.key, "registration_open"))
        .limit(1);
      if (openSetting?.value === "false")
        return Response.json(
          { error: "Skolu reģistrācija pašlaik ir slēgta." },
          { status: 403 },
        );
      const data = schoolRegistrationSchema.parse(payload);
      const [school] = await db
        .insert(schools)
        .values({ ...data, email: data.email.toLowerCase() })
        .returning();
      return Response.json(
        {
          school,
          message:
            "Pieteikums saņemts. Pēc apstiprināšanas uz norādīto e-pastu tiks nosūtīts piekļuves kods.",
        },
        { status: 201 },
      );
    }

    if (action === "login-school") {
      const codeHash = await accessCodeHash(
        z.string().min(4).parse(payload.code),
      );
      const [school] = await db
        .select({ id: schools.id })
        .from(schools)
        .where(
          and(
            eq(schools.accessCodeHash, codeHash),
            eq(schools.status, "approved"),
          ),
        )
        .limit(1);
      if (!school)
        return Response.json(
          { error: "Piekļuves kods nav derīgs." },
          { status: 401 },
        );
      await createSession("school", school.id);
      return Response.json({ ok: true });
    }

    if (action === "login-admin") {
      const password = z.string().min(6).parse(payload.password);
      const expected = runtimeEnv().ADMIN_PASSWORD;
      if (!expected || password !== expected)
        return Response.json({ error: "Nepareiza parole." }, { status: 401 });
      await createSession("admin", 0);
      return Response.json({ ok: true });
    }

    if (action === "login-judge") {
      const judgeId = z.number().int().positive().parse(payload.judgeId);
      const password = z.string().min(4).parse(payload.password);
      const [judge] = await db
        .select()
        .from(judges)
        .where(and(eq(judges.id, judgeId), eq(judges.active, true)))
        .limit(1);
      if (!judge || !(await verifySecret(password, judge.passwordHash)))
        return Response.json({ error: "Nepareiza parole." }, { status: 401 });
      await createSession("judge", judge.id);
      return Response.json({ ok: true });
    }

    if (action === "logout") {
      await destroySession();
      return Response.json({ ok: true });
    }

    if (action === "approve-school" || action === "reject-school") {
      const session = await getSession("admin");
      if (!session)
        return Response.json({ error: "Nav atļauts." }, { status: 401 });
      const schoolId = z.number().int().positive().parse(payload.schoolId);
      if (action === "reject-school") {
        await db
          .update(schools)
          .set({ status: "rejected", accessCodeHash: null })
          .where(eq(schools.id, schoolId));
        return Response.json({ ok: true });
      }
      return Response.json(await approveSchool(schoolId));
    }

    if (action === "resend-approval") {
      const session = await getSession("admin");
      if (!session) return Response.json({ error: "Nav atļauts." }, { status: 401 });
      return Response.json(await resendApprovalEmail(z.number().int().positive().parse(payload.schoolId)));
    }

    if (["add-leader", "delete-leader", "save-participant", "delete-participant", "submit-roster"].includes(action)) {
      const session = await getSession("school");
      if (!session) return Response.json({ error: "Nav atļauts." }, { status: 401 });
      return Response.json(await mutateSchoolRoster(session.subjectId, action, payload));
    }

    if (
      action === "add-category" ||
      action === "update-category" ||
      action === "add-judge" ||
      action === "save-setting"
    ) {
      const session = await getSession("admin");
      if (!session)
        return Response.json({ error: "Nav atļauts." }, { status: 401 });
      if (action === "add-judge") {
        const data = z
          .object({
            sportId: z.number().int().positive(),
            fullName: z.string().trim().min(3),
            password: z.string().min(6),
          })
          .parse(payload);
        const [judge] = await db
          .insert(judges)
          .values({
            sportId: data.sportId,
            fullName: data.fullName,
            passwordHash: await hashSecret(data.password),
          })
          .returning({ id: judges.id, fullName: judges.fullName });
        return Response.json({ judge });
      }
      if (action === "save-setting") {
        const data = z
          .object({
            key: z.enum([
              "festival_year",
              "registration_open",
              "roster_editing_open",
              "participants_public",
            ]),
            value: z.string().max(80),
          })
          .refine(data => data.key === "festival_year" || ["true", "false"].includes(data.value),
            "Slēdža vērtībai jābūt true vai false.")
          .parse(payload);
        await db
          .insert(settings)
          .values(data)
          .onConflictDoUpdate({
            target: settings.key,
            set: { value: data.value, updatedAt: new Date().toISOString() },
          });
        return Response.json({ ok: true });
      }
      const data = z
        .object({
          id: z.number().int().positive().optional(),
          sportId: z.number().int().positive(),
          code: z.string().trim().min(2),
          name: z.string().trim().min(2),
          discipline: z.string().trim().min(2),
          gender: z.enum(["F", "M", "X"]),
          minBirthYear: z.number().int(),
          maxBirthYear: z.number().int(),
          teamMin: z.number().int().min(1),
          teamMax: z.number().int().min(1),
          schoolLimit: z.number().int().positive().nullable().optional(),
          active: z.boolean().optional(),
        })
        .refine(
          (value) => value.minBirthYear <= value.maxBirthYear,
          "Dzimšanas gadu intervāls nav pareizs.",
        )
        .refine(
          (value) => value.teamMin <= value.teamMax,
          "Komandas dalībnieku intervāls nav pareizs.",
        )
        .parse(payload);
      if (action === "update-category" && data.id) {
        const { id, ...changes } = data;
        await db.update(categories).set(changes).where(eq(categories.id, id));
      } else {
        const sortOrder =
          (
            await db
              .select({ id: categories.id })
              .from(categories)
              .where(eq(categories.sportId, data.sportId))
          ).length + 1;
        await db.insert(categories).values({ ...data, sortOrder });
      }
      return Response.json({ ok: true });
    }

    if (action === "save-result" || action === "publish-sport") {
      const session = await getSession("judge");
      if (!session)
        return Response.json({ error: "Nav atļauts." }, { status: 401 });
      const [judge] = await db
        .select()
        .from(judges)
        .where(eq(judges.id, session.subjectId))
        .limit(1);
      if (!judge)
        return Response.json(
          { error: "Tiesnesis nav atrasts." },
          { status: 404 },
        );
      if (action === "publish-sport") {
        const judgeCategories = await db
          .select({ id: categories.id })
          .from(categories)
          .where(eq(categories.sportId, judge.sportId));
        const ids = judgeCategories.map((category) => category.id);
        if (ids.length)
          await db
            .update(results)
            .set({ published: true, updatedAt: new Date().toISOString() })
            .where(inArray(results.categoryId, ids));
        await db
          .update(uploads)
          .set({ status: "published" })
          .where(eq(uploads.sportId, judge.sportId));
        return Response.json({ ok: true });
      }
      const data = z
        .object({
          categoryId: z.number().int().positive(),
          entryId: z.number().int().positive(),
          placement: z.number().int().positive().nullable().optional(),
          status: z.enum(["ranked", "dns", "dnf", "dsq"]),
          score: z.string().trim().max(80).optional(),
          sourceUploadId: z.number().int().positive().nullable().optional(),
        })
        .parse(payload);
      const [entry] = await db
        .select({ id: entries.id })
        .from(entries)
        .innerJoin(categories, eq(entries.categoryId, categories.id))
        .where(
          and(
            eq(entries.id, data.entryId),
            eq(entries.categoryId, data.categoryId),
            eq(categories.sportId, judge.sportId),
          ),
        )
        .limit(1);
      if (!entry)
        return Response.json(
          { error: "Dalībnieks nav pieejams šim sporta veidam." },
          { status: 403 },
        );
      await db
        .insert(results)
        .values({
          ...data,
          placement: data.status === "ranked" ? (data.placement ?? null) : null,
          sourceUploadId: data.sourceUploadId ?? null,
          judgeId: judge.id,
          published: false,
          updatedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: [results.entryId, results.categoryId],
          set: {
            placement:
              data.status === "ranked" ? (data.placement ?? null) : null,
            status: data.status,
            score: data.score,
            sourceUploadId: data.sourceUploadId ?? null,
            judgeId: judge.id,
            published: false,
            updatedAt: new Date().toISOString(),
          },
        });
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Nezināma darbība." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 400 });
  }
}
