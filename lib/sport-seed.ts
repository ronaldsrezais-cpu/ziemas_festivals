import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { categories, sports } from "@/db/schema";

export const sportSeed = [
  { code: "discgolf", name: "Disku golfs", location: "Ērgļi", mode: "team" as const },
  { code: "biathlon", name: "Biatlons", location: "Ērgļi", mode: "individual" as const },
  { code: "snow-volleyball", name: "Sniega volejbols", location: "Ērgļi", mode: "team" as const },
  { code: "hockey-3x3", name: "Hokejs 3x3", location: "Ērgļi", mode: "team" as const },
  { code: "table-hockey", name: "Galda hokejs", location: "Ērgļi", mode: "team" as const },
  { code: "cross-country", name: "Distanču slēpošana", location: "Ērgļi", mode: "individual" as const },
  { code: "skating", name: "Slidošana", location: "Ērgļi", mode: "individual" as const },
  { code: "alpine", name: "Kalnu slēpošana", location: "Briežkalns", mode: "individual" as const },
  { code: "snowboard", name: "Snovbords", location: "Briežkalns", mode: "individual" as const },
  { code: "freestyle-ski", name: "Frīstaila slēpošana", location: "Briežkalns", mode: "individual" as const },
  { code: "freestyle-snowboard", name: "Frīstaila snovbords", location: "Briežkalns", mode: "individual" as const },
  { code: "sledding", name: "Ragaviņu sports", location: "Briežkalns", mode: "team" as const },
  { code: "winter-orienteering", name: "Ziemas orientēšanās", location: "Vestiena", mode: "individual" as const },
];

type CategoryDraft = { sportCode: string; code: string; name: string; discipline: string; gender: "F" | "M" | "X"; minBirthYear: number; maxBirthYear: number; teamMin?: number; teamMax?: number; schoolLimit?: number | null };

const individual = (sportCode: string, discipline: string, groups: Array<[string, number, number]>) =>
  groups.flatMap(([name, minBirthYear, maxBirthYear], groupIndex) => (["F", "M"] as const).map((gender) => ({ sportCode, code: `${groupIndex + 1}-${gender.toLowerCase()}`, name: `${name} — ${gender === "F" ? "meitenes / jaunietes" : "zēni / jaunieši"}`, discipline, gender, minBirthYear, maxBirthYear })));

const categoryDrafts: CategoryDraft[] = [
  { sportCode: "discgolf", code: "team", name: "Komandu ieskaite", discipline: "Disku golfs", gender: "X", minBirthYear: 2008, maxBirthYear: 2014, teamMin: 3, teamMax: 4, schoolLimit: 2 },
  { sportCode: "snow-volleyball", code: "group-1", name: "1. grupa", discipline: "Sniega volejbols", gender: "X", minBirthYear: 2007, maxBirthYear: 2010, teamMin: 3, teamMax: 5, schoolLimit: 1 },
  { sportCode: "snow-volleyball", code: "group-2", name: "2. grupa", discipline: "Sniega volejbols", gender: "X", minBirthYear: 2011, maxBirthYear: 2015, teamMin: 3, teamMax: 5, schoolLimit: 1 },
  { sportCode: "hockey-3x3", code: "elite", name: "Elite", discipline: "Hokejs 3x3", gender: "X", minBirthYear: 2010, maxBirthYear: 2013, teamMin: 3, teamMax: 4, schoolLimit: 1 },
  { sportCode: "hockey-3x3", code: "skills", name: "Meistarība", discipline: "Hokejs 3x3", gender: "X", minBirthYear: 2010, maxBirthYear: 2013, teamMin: 3, teamMax: 4, schoolLimit: 1 },
  { sportCode: "table-hockey", code: "group-1", name: "1. grupa", discipline: "Galda hokejs", gender: "X", minBirthYear: 2006, maxBirthYear: 2010, teamMin: 3, teamMax: 5 },
  { sportCode: "table-hockey", code: "group-2", name: "2. grupa", discipline: "Galda hokejs", gender: "X", minBirthYear: 2011, maxBirthYear: 2015, teamMin: 3, teamMax: 5 },
  { sportCode: "sledding", code: "group-1", name: "1. grupa", discipline: "Ragaviņu sports", gender: "X", minBirthYear: 2006, maxBirthYear: 2009, teamMin: 6, teamMax: 6, schoolLimit: 1 },
  { sportCode: "sledding", code: "group-2", name: "2. grupa", discipline: "Ragaviņu sports", gender: "X", minBirthYear: 2010, maxBirthYear: 2012, teamMin: 6, teamMax: 6, schoolLimit: 1 },
  { sportCode: "sledding", code: "group-3", name: "3. grupa", discipline: "Ragaviņu sports", gender: "X", minBirthYear: 2013, maxBirthYear: 2015, teamMin: 6, teamMax: 6, schoolLimit: 1 },
  ...individual("biathlon", "Sprints", [["1. grupa", 2006, 2009], ["2. grupa", 2010, 2011], ["3. grupa", 2012, 2013], ["4. grupa", 2014, 2015]]),
  ...individual("cross-country", "Īsā distance, brīvais stils", [["1. grupa", 2006, 2009], ["2. grupa", 2010, 2011], ["3. grupa", 2012, 2013], ["4. grupa", 2014, 2015]]),
  ...individual("skating", "3 apļu distance", [["1. grupa", 2006, 2009], ["2. grupa", 2010, 2011], ["3. grupa", 2012, 2013], ["4. grupa", 2014, 2015]]),
  ...individual("alpine", "Milzu slaloms", [["1. grupa", 2006, 2009], ["2. grupa", 2010, 2012], ["3. grupa", 2013, 2015]]),
  ...individual("snowboard", "Slaloms", [["1. grupa", 2006, 2009], ["2. grupa", 2010, 2012], ["3. grupa", 2013, 2018]]),
  ...individual("winter-orienteering", "Vidējā distance", [["1. grupa", 2006, 2009], ["2. grupa", 2010, 2011], ["3. grupa", 2012, 2013], ["4. grupa", 2014, 2016]]),
  { sportCode: "freestyle-ski", code: "1-f", name: "1. grupa — meitenes", discipline: "Slopestyle", gender: "F", minBirthYear: 2014, maxBirthYear: 2018 },
  { sportCode: "freestyle-ski", code: "2-f", name: "2. grupa — jaunietes", discipline: "Slopestyle", gender: "F", minBirthYear: 2006, maxBirthYear: 2013 },
  { sportCode: "freestyle-ski", code: "1-m", name: "1. grupa — zēni", discipline: "Slopestyle", gender: "M", minBirthYear: 2015, maxBirthYear: 2018 },
  { sportCode: "freestyle-ski", code: "2-m", name: "2. grupa — zēni", discipline: "Slopestyle", gender: "M", minBirthYear: 2010, maxBirthYear: 2014 },
  { sportCode: "freestyle-ski", code: "3-m", name: "3. grupa — jaunieši", discipline: "Slopestyle", gender: "M", minBirthYear: 2006, maxBirthYear: 2009 },
  { sportCode: "freestyle-snowboard", code: "1-f", name: "1. grupa — meitenes", discipline: "Slopestyle", gender: "F", minBirthYear: 2014, maxBirthYear: 2018 },
  { sportCode: "freestyle-snowboard", code: "2-f", name: "2. grupa — jaunietes", discipline: "Slopestyle", gender: "F", minBirthYear: 2006, maxBirthYear: 2013 },
  { sportCode: "freestyle-snowboard", code: "1-m", name: "1. grupa — zēni", discipline: "Slopestyle", gender: "M", minBirthYear: 2015, maxBirthYear: 2018 },
  { sportCode: "freestyle-snowboard", code: "2-m", name: "2. grupa — zēni", discipline: "Slopestyle", gender: "M", minBirthYear: 2010, maxBirthYear: 2014 },
  { sportCode: "freestyle-snowboard", code: "3-m", name: "3. grupa — jaunieši", discipline: "Slopestyle", gender: "M", minBirthYear: 2006, maxBirthYear: 2009 },
];

export async function ensureSportSeed() {
  const db = getDb();
  const existing = await db.select({ id: sports.id }).from(sports).limit(1);
  if (existing.length === 0) {
    await db.insert(sports).values(sportSeed.map((sport, index) => ({ ...sport, sortOrder: index + 1 }))).onConflictDoNothing();
  }
  return db.select().from(sports).where(eq(sports.active, true)).orderBy(asc(sports.sortOrder));
}

export async function getSportsWithCategories() {
  const db = getDb();
  const sportRows = await ensureSportSeed();
  const existing = await db.select({ id: categories.id }).from(categories).limit(1);
  if (existing.length === 0) {
    const ids = Object.fromEntries(sportRows.map((sport) => [sport.code, sport.id]));
    await db.insert(categories).values(categoryDrafts.map((draft, index) => ({
      sportId: ids[draft.sportCode], code: draft.code, name: draft.name, discipline: draft.discipline,
      gender: draft.gender, minBirthYear: draft.minBirthYear, maxBirthYear: draft.maxBirthYear,
      teamMin: draft.teamMin ?? 1, teamMax: draft.teamMax ?? 1, schoolLimit: draft.schoolLimit ?? null,
      sortOrder: index + 1,
    }))).onConflictDoNothing();
  }
  const categoryRows = await db.select().from(categories).where(eq(categories.active, true)).orderBy(asc(categories.sortOrder));
  return sportRows.map((sport) => ({ ...sport, categories: categoryRows.filter((category) => category.sportId === sport.id) }));
}
