import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { sessions } from "@/db/schema";
import { runtimeEnv } from "@/lib/runtime";

export type SessionRole = "admin" | "school" | "judge";

const encoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join(
    "",
  );
}

function randomHex(length = 16) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export async function sha256(value: string) {
  return bytesToHex(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", encoder.encode(value)),
    ),
  );
}

export async function hashSecret(value: string) {
  const salt = randomHex(16);
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(value),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: encoder.encode(salt),
      iterations: 120_000,
    },
    key,
    256,
  );
  return `${salt}:${bytesToHex(new Uint8Array(derived))}`;
}

export async function verifySecret(value: string, encoded: string) {
  const [salt, expected] = encoded.split(":");
  if (!salt || !expected) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(value),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: encoder.encode(salt),
      iterations: 120_000,
    },
    key,
    256,
  );
  const actual = bytesToHex(new Uint8Array(derived));
  if (actual.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < actual.length; index += 1)
    mismatch |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  return mismatch === 0;
}

export async function accessCodeHash(code: string) {
  const secret = runtimeEnv().AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET nav konfigurēts.");
  return sha256(`${code.trim().toUpperCase()}:${secret}`);
}

export function createAccessCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join(
    "",
  );
}

export async function createSession(role: SessionRole, subjectId: number) {
  const id = `${role}_${crypto.randomUUID()}_${randomHex(8)}`;
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 12);
  await getDb()
    .insert(sessions)
    .values({ id, role, subjectId, expiresAt: expires.toISOString() });
  const jar = await cookies();
  jar.set("zf_session", id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function getSession(requiredRole?: SessionRole) {
  const jar = await cookies();
  const id = jar.get("zf_session")?.value;
  if (!id) return null;
  const [session] = await getDb()
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.id, id),
        gt(sessions.expiresAt, new Date().toISOString()),
      ),
    )
    .limit(1);
  if (!session || (requiredRole && session.role !== requiredRole)) return null;
  return session;
}

export async function destroySession() {
  const jar = await cookies();
  const id = jar.get("zf_session")?.value;
  if (id) await getDb().delete(sessions).where(eq(sessions.id, id));
  jar.delete("zf_session");
}

export { requiredLeaders } from "./roster-readiness";
