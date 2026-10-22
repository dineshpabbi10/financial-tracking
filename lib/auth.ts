import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { db } from "@/lib/db";

const scrypt = promisify(scryptCallback);

export const SESSION_COOKIE = "loonie_session";
const SESSION_DAYS = 30;
const PASSCODE_SETTING = "auth.passcode";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function hashPasscode(passcode: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(passcode, salt, 64)) as Buffer;
  return `scrypt.${salt.toString("base64url")}.${derived.toString("base64url")}`;
}

async function verifyPasscode(passcode: string, stored: string): Promise<boolean> {
  const [algorithm, saltPart, hashPart] = stored.split(".");
  if (algorithm !== "scrypt" || !saltPart || !hashPart) return false;
  const salt = Buffer.from(saltPart, "base64url");
  const expected = Buffer.from(hashPart, "base64url");
  const actual = (await scrypt(passcode, salt, expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function isSetupComplete(): Promise<boolean> {
  const setting = await db.setting.findUnique({ where: { key: PASSCODE_SETTING } });
  return Boolean(setting);
}

export async function setInitialPasscode(passcode: string): Promise<boolean> {
  if (passcode.length < 8) throw new Error("Passcode must be at least 8 characters.");
  if (passcode.length > 200) throw new Error("Passcode is too long.");
  const alreadySet = await isSetupComplete();
  if (alreadySet) return false;
  await db.setting.create({
    data: { key: PASSCODE_SETTING, value: await hashPasscode(passcode) },
  });
  return true;
}

export async function verifyLoginPasscode(passcode: string): Promise<boolean> {
  const setting = await db.setting.findUnique({ where: { key: PASSCODE_SETTING } });
  if (!setting) return false;
  return verifyPasscode(passcode, setting.value);
}

export async function changePasscode(
  current: string,
  next: string,
): Promise<boolean> {
  if (!(await verifyLoginPasscode(current))) return false;
  if (next.length < 8) throw new Error("New passcode must be at least 8 characters.");
  await db.setting.update({
    where: { key: PASSCODE_SETTING },
    data: { value: await hashPasscode(next) },
  });
  // Sign out every other device.
  await db.session.deleteMany({});
  return true;
}

export async function createSession(): Promise<void> {
  await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.session.create({ data: { tokenHash: hashToken(token), expiresAt } });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  store.delete(SESSION_COOKIE);
}

export async function getSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!session || session.expiresAt.getTime() < Date.now()) return null;
  return session;
}

/** For server components: bounce to login when there's no valid session. */
export async function requireSession() {
  const session = await getSession();
  if (!session) {
    const setupDone = await isSetupComplete();
    redirect(setupDone ? "/login" : "/setup");
  }
  return session;
}

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export function checkLoginRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= 8;
}

export function clearLoginRateLimit(key: string): void {
  loginAttempts.delete(key);
}
