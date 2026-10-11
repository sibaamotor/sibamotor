import { createServerFn } from "@tanstack/react-start";
import { getSql } from "./db";
import { nid } from "./utils";

export type AppNotification = {
  id: string;
  username: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export const pushNotification = createServerFn({ method: "POST" })
  .validator(
    (data: {
      username: string;
      kind: string;
      title: string;
      body?: string;
      href?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const username = data.username.trim().toLowerCase();
    if (!username) return { ok: false as const };
    const sql = await getSql();
    const id = nid();
    const now = new Date().toISOString();
    await sql`
      insert into app_notifications (id, username, kind, title, body, href, read_at, created_at)
      values (
        ${id},
        ${username},
        ${data.kind},
        ${data.title},
        ${data.body ?? ""},
        ${data.href ?? null},
        null,
        ${now}
      )
    `;
    return { ok: true as const, id };
  });

export const listNotifications = createServerFn({ method: "GET" })
  .validator((data: { username: string }) => data)
  .handler(async ({ data }): Promise<AppNotification[]> => {
    const u = data.username.trim().toLowerCase();
    if (!u) return [];
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      username: string;
      kind: string;
      title: string;
      body: string;
      href: string | null;
      read_at: string | null;
      created_at: string;
    }>`
      select id, username, kind, title, body, href, read_at, created_at
      from app_notifications
      where username = ${u}
      order by created_at desc
      limit 50
    `;
    return rows.map((r) => ({
      id: r.id,
      username: r.username,
      kind: r.kind,
      title: r.title,
      body: r.body,
      href: r.href,
      readAt: r.read_at,
      createdAt: r.created_at,
    }));
  });

export const unreadNotificationCount = createServerFn({ method: "GET" })
  .validator((data: { username: string }) => data)
  .handler(async ({ data }): Promise<number> => {
    const u = data.username.trim().toLowerCase();
    if (!u) return 0;
    const sql = await getSql();
    const rows = await sql<{ n: number }>`
      select count(*)::int as n from app_notifications
      where username = ${u} and read_at is null
    `;
    return rows[0]?.n ?? 0;
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .validator((data: { username: string; ids?: string[] }) => data)
  .handler(async ({ data }) => {
    const u = data.username.trim().toLowerCase();
    if (!u) return { ok: true as const };
    const sql = await getSql();
    const now = new Date().toISOString();
    if (data.ids?.length) {
      for (const id of data.ids) {
        await sql`
          update app_notifications set read_at = ${now}
          where id = ${id} and username = ${u} and read_at is null
        `;
      }
    } else {
      await sql`
        update app_notifications set read_at = ${now}
        where username = ${u} and read_at is null
      `;
    }
    return { ok: true as const };
  });
