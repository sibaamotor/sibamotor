import { createServerFn } from "@tanstack/react-start";
import { getSql } from "./db";
import { nid } from "./utils";

export type ChatMessage = {
  id: string;
  fromUsername: string;
  fromDisplayName: string;
  toUsername: string;
  toDisplayName: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  replyToId: string | null;
  replyBody: string | null;
  replyFromName: string | null;
};

type MsgRow = {
  id: string;
  from_username: string;
  from_display_name: string | null;
  to_username: string;
  to_display_name: string | null;
  body: string;
  created_at: string;
  read_at: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  reply_to_id: string | null;
  reply_body: string | null;
  reply_from_name: string | null;
};

function mapRow(r: MsgRow): ChatMessage {
  return {
    id: r.id,
    fromUsername: r.from_username,
    fromDisplayName: r.from_display_name || r.from_username,
    toUsername: r.to_username,
    toDisplayName: r.to_display_name || r.to_username,
    body: r.deleted_at ? "" : r.body,
    createdAt: r.created_at,
    readAt: r.read_at,
    editedAt: r.edited_at,
    deletedAt: r.deleted_at,
    replyToId: r.reply_to_id,
    replyBody: r.reply_body,
    replyFromName: r.reply_from_name,
  };
}

const SELECT = `
  select
    m.id,
    m.from_username,
    fu.display_name as from_display_name,
    m.to_username,
    tu.display_name as to_display_name,
    m.body,
    m.created_at,
    m.read_at,
    m.edited_at,
    m.deleted_at,
    m.reply_to_id,
    r.body as reply_body,
    ru.display_name as reply_from_name
  from app_messages m
  left join login_users fu on fu.username = m.from_username
  left join login_users tu on tu.username = m.to_username
  left join app_messages r on r.id = m.reply_to_id
  left join login_users ru on ru.username = r.from_username
`;

export const listMyMessages = createServerFn({ method: "GET" })
  .validator((data: { username: string }) => data)
  .handler(async ({ data }): Promise<ChatMessage[]> => {
    const u = data.username.trim().toLowerCase();
    if (!u) return [];
    const sql = await getSql();
    const rows = await sql.query<MsgRow>(
      `${SELECT} where m.from_username = $1 or m.to_username = $1 order by m.created_at asc`,
      [u],
    );
    return rows.map(mapRow);
  });

export const unreadCount = createServerFn({ method: "GET" })
  .validator((data: { username: string }) => data)
  .handler(async ({ data }): Promise<number> => {
    const u = data.username.trim().toLowerCase();
    if (!u) return 0;
    const sql = await getSql();
    const rows = await sql<{ n: number }>`
      select count(*)::int as n from app_messages
      where to_username = ${u} and read_at is null
    `;
    return rows[0]?.n ?? 0;
  });

export const listUnread = createServerFn({ method: "GET" })
  .validator((data: { username: string }) => data)
  .handler(async ({ data }): Promise<ChatMessage[]> => {
    const u = data.username.trim().toLowerCase();
    if (!u) return [];
    const sql = await getSql();
    const rows = await sql.query<MsgRow>(
      `${SELECT} where m.to_username = $1 and m.read_at is null order by m.created_at desc`,
      [u],
    );
    return rows.map(mapRow);
  });

export const sendMessage = createServerFn({ method: "POST" })
  .validator((data: { from: string; to: string; body: string; replyToId?: string | null }) => data)
  .handler(async ({ data }): Promise<{ ok: true; id: string } | { ok: false; error: string }> => {
    const from = data.from.trim().toLowerCase();
    const to = data.to.trim().toLowerCase();
    const body = data.body.trim();
    if (!from || !to) return { ok: false, error: "فرستنده یا گیرنده نامعتبر است." };
    if (from === to) return { ok: false, error: "نمی‌توانید به خودتان پیام بدهید." };
    if (!body) return { ok: false, error: "متن پیام خالی است." };
    if (body.length > 8_000_000) return { ok: false, error: "پیام یا فایل خیلی بزرگ است." };
    const sql = await getSql();
    const users = await sql<{ username: string }>`
      select username from login_users where username in (${from}, ${to})
    `;
    if (users.length < 2) return { ok: false, error: "کاربر گیرنده پیدا نشد." };
    const id = nid();
    const now = new Date().toISOString();
    const replyTo = data.replyToId?.trim() || null;
    await sql`
      insert into app_messages (id, from_username, to_username, body, created_at, read_at, reply_to_id)
      values (${id}, ${from}, ${to}, ${body}, ${now}, null, ${replyTo})
    `;
    return { ok: true, id };
  });

/** Either side of a conversation can edit a message THEY sent (not the other party's). */
export const editMessage = createServerFn({ method: "POST" })
  .validator((data: { username: string; id: string; body: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const u = data.username.trim().toLowerCase();
    const body = data.body.trim();
    if (!body) return { ok: false, error: "متن پیام خالی است." };
    if (body.length > 8_000_000) return { ok: false, error: "پیام یا فایل خیلی بزرگ است." };
    const sql = await getSql();
    const now = new Date().toISOString();
    const rows = await sql<{ id: string }>`
      update app_messages
      set body = ${body}, edited_at = ${now}
      where id = ${data.id} and from_username = ${u} and deleted_at is null
      returning id
    `;
    if (rows.length === 0) return { ok: false, error: "امکان ویرایش این پیام برای شما وجود ندارد." };
    return { ok: true as const };
  });

/** Either side of a conversation can delete a message THEY sent (soft delete). */
export const deleteMessage = createServerFn({ method: "POST" })
  .validator((data: { username: string; id: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const u = data.username.trim().toLowerCase();
    const sql = await getSql();
    const now = new Date().toISOString();
    const rows = await sql<{ id: string }>`
      update app_messages
      set deleted_at = ${now}
      where id = ${data.id} and from_username = ${u} and deleted_at is null
      returning id
    `;
    if (rows.length === 0) return { ok: false, error: "امکان حذف این پیام برای شما وجود ندارد." };
    return { ok: true as const };
  });

export const markConversationRead = createServerFn({ method: "POST" })
  .validator((data: { username: string; other: string }) => data)
  .handler(async ({ data }) => {
    const u = data.username.trim().toLowerCase();
    const other = data.other.trim().toLowerCase();
    if (!u || !other) return { ok: true as const };
    const sql = await getSql();
    const now = new Date().toISOString();
    await sql`
      update app_messages
      set read_at = ${now}
      where to_username = ${u} and from_username = ${other} and read_at is null
    `;
    return { ok: true as const };
  });

export const markMessageRead = createServerFn({ method: "POST" })
  .validator((data: { username: string; id: string }) => data)
  .handler(async ({ data }) => {
    const u = data.username.trim().toLowerCase();
    const sql = await getSql();
    const now = new Date().toISOString();
    await sql`
      update app_messages
      set read_at = ${now}
      where id = ${data.id} and to_username = ${u} and read_at is null
    `;
    return { ok: true as const };
  });
