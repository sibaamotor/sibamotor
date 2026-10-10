// Login accounts (username/password for "ورود").
//
// Passwords are stored with scrypt (Node crypto). Legacy plain-text passwords
// still verify once and are upgraded to a hash on successful login.
import { createServerFn } from "@tanstack/react-start";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getSql } from "./db";

export type LocalUser = {
  username: string;
  displayName: string;
  role: string;
};

/** The one built-in system-admin account; can create/reset other users. */
export const ADMIN_USERNAME = "h.mojarad";

type UserRow = { username: string; password: string; display_name: string; role: string };

const HASH_PREFIX = "scrypt$";

function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(plain, salt, 32).toString("hex");
  return `${HASH_PREFIX}${salt}$${hash}`;
}

function verifyPassword(plain: string, stored: string): boolean {
  if (!stored.startsWith(HASH_PREFIX)) {
    // Legacy plain-text (migration path)
    return stored === plain;
  }
  const parts = stored.split("$");
  // scrypt$salt$hash
  if (parts.length !== 3) return false;
  const salt = parts[1]!;
  const expected = parts[2]!;
  const actual = scryptSync(plain, salt, 32).toString("hex");
  try {
    return timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

function isHashed(stored: string): boolean {
  return stored.startsWith(HASH_PREFIX);
}

export const verifyLocalUser = createServerFn({ method: "POST" })
  .validator((data: { username: string; password: string }) => data)
  .handler(async ({ data }): Promise<LocalUser | null> => {
    const sql = await getSql();
    const u = data.username.trim().toLowerCase();
    const rows = await sql<UserRow>`select username, password, display_name, role from login_users where username = ${u}`;
    const found = rows[0];
    if (!found || !verifyPassword(data.password, found.password)) return null;

    // Upgrade legacy plain password to scrypt hash after successful login
    if (!isHashed(found.password)) {
      const hashed = hashPassword(data.password);
      await sql`update login_users set password = ${hashed} where username = ${u}`;
    }

    return { username: found.username, displayName: found.display_name, role: found.role };
  });

/** Admin-only: list every login account (without passwords). */
export const listLocalUsers = createServerFn({ method: "GET" }).handler(async (): Promise<LocalUser[]> => {
  const sql = await getSql();
  const rows = await sql<Omit<UserRow, "password">>`select username, display_name, role from login_users order by username`;
  return rows.map((r) => ({ username: r.username, displayName: r.display_name, role: r.role }));
});

/**
 * Admin-only: create a brand-new login, or reset an existing one's
 * password/name/role if the username already exists.
 */
export const upsertLocalUser = createServerFn({ method: "POST" })
  .validator((data: { username: string; password: string; displayName: string; role: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const username = data.username.trim().toLowerCase();
    if (!username) return { ok: false, error: "نام کاربری الزامی است." };
    if (!/^[a-z0-9._-]+$/.test(username)) {
      return { ok: false, error: "نام کاربری فقط می‌تواند شامل حروف انگلیسی، عدد، نقطه و خط تیره باشد." };
    }
    if (!data.password || data.password.length < 6) {
      return { ok: false, error: "رمز عبور باید حداقل ۶ کاراکتر باشد." };
    }
    const hashed = hashPassword(data.password);
    const sql = await getSql();
    await sql`
      insert into login_users (username, password, display_name, role)
      values (${username}, ${hashed}, ${data.displayName.trim() || username}, ${data.role.trim()})
      on conflict (username) do update set
        password = excluded.password,
        display_name = excluded.display_name,
        role = excluded.role
    `;
    return { ok: true };
  });

/** Admin-only: remove a login. The built-in admin account cannot be removed. */
export const deleteLocalUser = createServerFn({ method: "POST" })
  .validator((data: { username: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const username = data.username.trim().toLowerCase();
    if (username === ADMIN_USERNAME) {
      return { ok: false, error: "حساب مدیر سیستم قابل حذف نیست." };
    }
    const sql = await getSql();
    await sql`delete from login_users where username = ${username}`;
    return { ok: true };
  });

/** Any logged-in user can change their own password (must know current one). */
export const changeOwnPassword = createServerFn({ method: "POST" })
  .validator((data: { username: string; currentPassword: string; newPassword: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const username = data.username.trim().toLowerCase();
    if (!username) return { ok: false, error: "کاربر نامعتبر است." };
    if (!data.newPassword || data.newPassword.length < 6) {
      return { ok: false, error: "رمز جدید باید حداقل ۶ کاراکتر باشد." };
    }
    if (data.newPassword === data.currentPassword) {
      return { ok: false, error: "رمز جدید نباید با رمز فعلی یکی باشد." };
    }
    const sql = await getSql();
    const rows = await sql<{ password: string }>`
      select password from login_users where username = ${username}
    `;
    const found = rows[0];
    if (!found || !verifyPassword(data.currentPassword, found.password)) {
      return { ok: false, error: "رمز فعلی نادرست است." };
    }
    const hashed = hashPassword(data.newPassword);
    await sql`
      update login_users set password = ${hashed} where username = ${username}
    `;
    return { ok: true as const };
  });
