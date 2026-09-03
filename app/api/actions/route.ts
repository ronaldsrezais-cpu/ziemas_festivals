import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
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
import { sendApprovalEmail } from "@/lib/email";
import { runtimeEnv } from "@/lib/runtime";
import {
  accessCodeHash,
  createAccessCode,
  createSession,
  destroySession,
  getSession,
  hashSecret,
  requiredLeaders,
  verifySecret,
} from "@/lib/security";
import { getSportsWithCategories } from "@/lib/sport-seed";

export const dynamic = "force-dynamic";

const schoolRegistrationSchema = z.object({
  name: z.string().trim().min(2).max(180),
  municipality: z.string().trim().min(2).max(120),
  teacherName: z.string().trim().min(3).max(120),
  teacherRole: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  phone: z.string().trim().min(6).max(40),
});

const participantSchema = z.object({
  id: z.number().int().positive().optional(),
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(100),
  birthYear: z.number().int().min(2000).max(2030),
  gender: z.enum(["F", "M"]),
  registrations: z
    .array(
      z.object({
        categoryId: z.number().int().positive(),
        teamName: z.string().trim().max(80).optional(),
      }),
    )
    .min(1)
    .refine(
      (items) =>
        new Set(items.map((item) => item.categoryId)).size === items.length,
      "Vienu kategoriju vienam dalībniekam drīkst izvēlēties tikai vienu reizi.",
    ),
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
  const [leaderRows, participantRows, entryRows, sportRows] = await Promise.all(
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
    ],
  );
  return {
    school,
    leaders: leaderRows,
    participants: participantRows,
    entries: entryRows,
    sports: sportRows,
    requiredLeaders: requiredLeaders(participantRows.length),
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
    outboxRows,
    settingRows,
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
    db
      .select()
      .from(emailOutbox)
      .orderBy(desc(emailOutbox.createdAt))
      .limit(20),
    db.select().from(settings),
  ]);
  return {
    schools: schoolRows.map((school) => ({
      ...school,
      participantCount: participantRows.filter(
        (person) => person.schoolId === school.id,
      ).length,
      leaderCount: leaderRows.filter((leader) => leader.schoolId === school.id)
        .length,
    })),
    sports: sportRows.map((sport) => ({
      ...sport,
      categories: categoryRows.filter(
        (category) => category.sportId === sport.id,
      ),
    })),
    judges: judgeRows,
    outbox: outboxRows,
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

async function validateRegistrations(
  input: z.infer<typeof participantSchema>,
  schoolId: number,
) {
  const db = getDb();
  const ids = input.registrations.map(
    (registration) => registration.categoryId,
  );
  const rows = await db
    .select({ category: categories, sportMode: sports.mode })
    .from(categories)
    .innerJoin(sports, eq(categories.sportId, sports.id))
    .where(and(inArray(categories.id, ids), eq(categories.active, true)));
  if (rows.length !== new Set(ids).size)
    throw new Error("Kāda no izvēlētajām disciplīnām nav pieejama.");
  const existingEntries = await db
    .select({
      participantId: entries.participantId,
      categoryId: entries.categoryId,
      teamName: entries.teamName,
    })
    .from(entries)
    .where(
      and(eq(entries.schoolId, schoolId), inArray(entries.categoryId, ids)),
    );
  const otherEntries = existingEntries.filter(
    (entry) => entry.participantId !== input.id,
  );
  for (const row of rows) {
    if (
      input.birthYear < row.category.minBirthYear ||
      input.birthYear > row.category.maxBirthYear
    )
      throw new Error(
        `${row.category.name}: dzimšanas gads neatbilst kategorijai.`,
      );
    if (row.category.gender !== "X" && row.category.gender !== input.gender)
      throw new Error(`${row.category.name}: dzimums neatbilst kategorijai.`);
    const registration = input.registrations.find(
      (item) => item.categoryId === row.category.id,
    );
    if (row.sportMode === "team" && !registration?.teamName)
      throw new Error(`${row.category.name}: jānorāda komandas nosaukums.`);
    const categoryEntries = otherEntries.filter(
      (entry) => entry.categoryId === row.category.id,
    );
    if (row.sportMode === "team" && registration?.teamName) {
      const teamSize = categoryEntries.filter(
        (entry) => entry.teamName === registration.teamName,
      ).length;
      if (teamSize >= row.category.teamMax)
        throw new Error(
          `${row.category.name}: komandā drīkst būt ne vairāk kā ${row.category.teamMax} dalībnieki.`,
        );
      if (row.category.schoolLimit) {
        const teams = new Set(
          categoryEntries.map((entry) => entry.teamName).filter(Boolean),
        );
        teams.add(registration.teamName);
        if (teams.size > row.category.schoolLimit)
          throw new Error(
            `${row.category.name}: skola drīkst pieteikt ne vairāk kā ${row.category.schoolLimit} komandas.`,
          );
      }
    }
    if (
      row.sportMode === "individual" &&
      row.category.schoolLimit &&
      categoryEntries.length >= row.category.schoolLimit
    )
      throw new Error(
        `${row.category.name}: skola drīkst pieteikt ne vairāk kā ${row.category.schoolLimit} dalībniekus.`,
      );
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
      const code = createAccessCode();
      const codeHash = await accessCodeHash(code);
      const [school] = await db
        .update(schools)
        .set({
          status: "approved",
          approvedAt: new Date().toISOString(),
          accessCodeHash: codeHash,
        })
        .where(eq(schools.id, schoolId))
        .returning();
      if (!school) throw new Error("Skola nav atrasta.");
      const email = await sendApprovalEmail({
        schoolId: school.id,
        recipient: school.email,
        schoolName: school.name,
        accessCode: code,
      });
      return Response.json({ ok: true, code, emailSent: email.sent });
    }

    if (
      action === "add-leader" ||
      action === "delete-leader" ||
      action === "save-participant" ||
      action === "delete-participant"
    ) {
      const session = await getSession("school");
      if (!session)
        return Response.json({ error: "Nav atļauts." }, { status: 401 });
      if (action === "add-leader") {
        const data = z
          .object({
            fullName: z.string().trim().min(3),
            role: z.string().trim().min(2),
            email: z.string().trim().email().optional().or(z.literal("")),
            phone: z.string().trim().optional(),
          })
          .parse(payload);
        const [leader] = await db
          .insert(leaders)
          .values({ schoolId: session.subjectId, ...data })
          .returning();
        return Response.json({ leader });
      }
      if (action === "delete-leader") {
        const leaderId = z.number().int().positive().parse(payload.leaderId);
        await db
          .delete(leaders)
          .where(
            and(
              eq(leaders.id, leaderId),
              eq(leaders.schoolId, session.subjectId),
            ),
          );
        return Response.json({ ok: true });
      }
      if (action === "delete-participant") {
        const participantId = z
          .number()
          .int()
          .positive()
          .parse(payload.participantId);
        await db
          .update(participants)
          .set({ active: false })
          .where(
            and(
              eq(participants.id, participantId),
              eq(participants.schoolId, session.subjectId),
            ),
          );
        await db
          .delete(entries)
          .where(
            and(
              eq(entries.participantId, participantId),
              eq(entries.schoolId, session.subjectId),
            ),
          );
        return Response.json({ ok: true });
      }
      const data = participantSchema.parse(payload);
      await validateRegistrations(data, session.subjectId);
      let participantId = data.id;
      if (participantId) {
        const [existing] = await db
          .select({ id: participants.id })
          .from(participants)
          .where(
            and(
              eq(participants.id, participantId),
              eq(participants.schoolId, session.subjectId),
            ),
          )
          .limit(1);
        if (!existing)
          return Response.json(
            { error: "Dalībnieks nav atrasts." },
            { status: 404 },
          );
        await db
          .update(participants)
          .set({
            firstName: data.firstName,
            lastName: data.lastName,
            birthYear: data.birthYear,
            gender: data.gender,
          })
          .where(eq(participants.id, participantId));
        await db
          .delete(entries)
          .where(eq(entries.participantId, participantId));
      } else {
        const [created] = await db
          .insert(participants)
          .values({
            schoolId: session.subjectId,
            firstName: data.firstName,
            lastName: data.lastName,
            birthYear: data.birthYear,
            gender: data.gender,
          })
          .returning();
        participantId = created.id;
      }
      await db.insert(entries).values(
        data.registrations.map((registration) => ({
          schoolId: session.subjectId,
          participantId: participantId!,
          categoryId: registration.categoryId,
          teamName: registration.teamName || null,
        })),
      );
      return Response.json({ ok: true, participantId });
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
              "participants_public",
            ]),
            value: z.string().max(80),
          })
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
