// Login accounts (username/password for "ورود").
//
// This used to store accounts in the browser's localStorage, so a user the
// admin created on one PC did not exist on any other PC. Every export below
// now runs on the SERVER against the `login_users` table in Postgres (see
// migrations/0002_workspace.sql), so every device shares the same accounts.
import { createServerFn } from "@tanstack/react-start";
import { getSql } from "./db";

export type LocalUser = {
  username: string;
  displayName: string;
  role: string;
};

/** The one built-in system-admin account; can create/reset other users. */
export const ADMIN_USERNAME = "h.mojarad";

type UserRow = { username: string; password: string; display_name: string; role: string };

export const verifyLocalUser = createServerFn({ method: "POST" })
  .validator((data: { username: string; password: string }) => data)
  .handler(async ({ data }): Promise<LocalUser | null> => {
    const sql = await getSql();
    const u = data.username.trim().toLowerCase();
    const rows = await sql<UserRow>`select username, password, display_name, role from login_users where username = ${u}`;
    const found = rows[0];
    if (!found || found.password !== data.password) return null;
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
    if (!data.password || data.password.length < 4) {
      return { ok: false, error: "رمز عبور باید حداقل ۴ کاراکتر باشد." };
    }
    const sql = await getSql();
    await sql`
      insert into login_users (username, password, display_name, role)
      values (${username}, ${data.password}, ${data.displayName.trim() || username}, ${data.role.trim()})
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
    if (!found || found.password !== data.currentPassword) {
      return { ok: false, error: "رمز فعلی نادرست است." };
    }
    await sql`
      update login_users set password = ${data.newPassword} where username = ${username}
    `;
    return { ok: true as const };
  });
