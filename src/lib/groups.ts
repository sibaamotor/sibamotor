import { createServerFn } from "@tanstack/react-start";
import { getSql } from "./db";
import { nid } from "./utils";

export type ChatGroup = {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  members: string[];
};

export type GroupMessage = {
  id: string;
  groupId: string;
  fromUsername: string;
  fromDisplayName: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  replyToId: string | null;
  replyBody: string | null;
  replyFromName: string | null;
};

export type GroupRead = { username: string; lastReadAt: string };

export const createGroup = createServerFn({ method: "POST" })
  .validator((data: { by: string; name: string; members: string[] }) => data)
  .handler(async ({ data }): Promise<{ ok: true; id: string } | { ok: false; error: string }> => {
    const by = data.by.trim().toLowerCase();
    const name = data.name.trim();
    if (!name) return { ok: false, error: "نام گروه الزامی است." };
    if (!by) return { ok: false, error: "کاربر نامعتبر است." };
    const members = Array.from(
      new Set([by, ...data.members.map((m) => m.trim().toLowerCase()).filter(Boolean)]),
    );
    if (members.length < 2) return { ok: false, error: "حداقل یک عضو دیگر برای گروه انتخاب کنید." };
    const sql = await getSql();
    const id = nid();
    const now = new Date().toISOString();
    await sql`insert into app_groups (id, name, created_by, created_at) values (${id}, ${name}, ${by}, ${now})`;
    for (const m of members) {
      await sql`
        insert into app_group_members (group_id, username, joined_at)
        values (${id}, ${m}, ${now})
        on conflict (group_id, username) do nothing
      `;
    }
    return { ok: true as const, id };
  });

export const addGroupMember = createServerFn({ method: "POST" })
  .validator((data: { by: string; groupId: string; username: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const by = data.by.trim().toLowerCase();
    const target = data.username.trim().toLowerCase();
    if (!target) return { ok: false, error: "کاربر نامعتبر است." };
    const sql = await getSql();
    const member = await sql<{ username: string }>`
      select username from app_group_members where group_id = ${data.groupId} and username = ${by}
    `;
    if (member.length === 0) return { ok: false, error: "شما عضو این گروه نیستید." };
    const now = new Date().toISOString();
    await sql`
      insert into app_group_members (group_id, username, joined_at)
      values (${data.groupId}, ${target}, ${now})
      on conflict (group_id, username) do nothing
    `;
    return { ok: true as const };
  });

export const listMyGroups = createServerFn({ method: "GET" })
  .validator((data: { username: string }) => data)
  .handler(async ({ data }): Promise<ChatGroup[]> => {
    const u = data.username.trim().toLowerCase();
    if (!u) return [];
    const sql = await getSql();
    const rows = await sql<{ id: string; name: string; created_by: string; created_at: string }>`
      select g.id, g.name, g.created_by, g.created_at
      from app_groups g
      where exists (select 1 from app_group_members gm where gm.group_id = g.id and gm.username = ${u})
      order by g.created_at desc
    `;
    const groups: ChatGroup[] = [];
    for (const r of rows) {
      const mem = await sql<{ username: string }>`
        select username from app_group_members where group_id = ${r.id} order by username
      `;
      groups.push({
        id: r.id,
        name: r.name,
        createdBy: r.created_by,
        createdAt: r.created_at,
        members: mem.map((m) => m.username),
      });
    }
    return groups;
  });

type GroupMsgRow = {
  id: string;
  group_id: string;
  from_username: string;
  from_display_name: string | null;
  body: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  reply_to_id: string | null;
  reply_body: string | null;
  reply_from_name: string | null;
};

function mapGroupRow(r: GroupMsgRow): GroupMessage {
  return {
    id: r.id,
    groupId: r.group_id,
    fromUsername: r.from_username,
    fromDisplayName: r.from_display_name || r.from_username,
    body: r.deleted_at ? "" : r.body,
    createdAt: r.created_at,
    editedAt: r.edited_at,
    deletedAt: r.deleted_at,
    replyToId: r.reply_to_id,
    replyBody: r.reply_body,
    replyFromName: r.reply_from_name,
  };
}

const GROUP_SELECT = `
  select
    m.id, m.group_id, m.from_username, fu.display_name as from_display_name,
    m.body, m.created_at, m.edited_at, m.deleted_at, m.reply_to_id,
    r.body as reply_body, ru.display_name as reply_from_name
  from app_group_messages m
  left join login_users fu on fu.username = m.from_username
  left join app_group_messages r on r.id = m.reply_to_id
  left join login_users ru on ru.username = r.from_username
`;

export const listGroupMessages = createServerFn({ method: "GET" })
  .validator((data: { groupId: string; username: string }) => data)
  .handler(async ({ data }): Promise<GroupMessage[]> => {
    const sql = await getSql();
    const u = data.username.trim().toLowerCase();
    const member = await sql<{ username: string }>`
      select username from app_group_members where group_id = ${data.groupId} and username = ${u}
    `;
    if (member.length === 0) return [];
    const rows = await sql.query<GroupMsgRow>(
      `${GROUP_SELECT} where m.group_id = $1 order by m.created_at asc`,
      [data.groupId],
    );
    return rows.map(mapGroupRow);
  });

export const sendGroupMessage = createServerFn({ method: "POST" })
  .validator((data: { from: string; groupId: string; body: string; replyToId?: string | null }) => data)
  .handler(async ({ data }): Promise<{ ok: true; id: string } | { ok: false; error: string }> => {
    const from = data.from.trim().toLowerCase();
    const body = data.body.trim();
    if (!body) return { ok: false, error: "متن پیام خالی است." };
    if (body.length > 4000) return { ok: false, error: "پیام خیلی طولانی است." };
    const sql = await getSql();
    const member = await sql<{ username: string }>`
      select username from app_group_members where group_id = ${data.groupId} and username = ${from}
    `;
    if (member.length === 0) return { ok: false, error: "شما عضو این گروه نیستید." };
    const id = nid();
    const now = new Date().toISOString();
    const replyTo = data.replyToId?.trim() || null;
    await sql`
      insert into app_group_messages (id, group_id, from_username, body, created_at, reply_to_id)
      values (${id}, ${data.groupId}, ${from}, ${body}, ${now}, ${replyTo})
    `;
    return { ok: true as const, id };
  });

export const editGroupMessage = createServerFn({ method: "POST" })
  .validator((data: { username: string; id: string; body: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const u = data.username.trim().toLowerCase();
    const body = data.body.trim();
    if (!body) return { ok: false, error: "متن پیام خالی است." };
    if (body.length > 4000) return { ok: false, error: "پیام خیلی طولانی است." };
    const sql = await getSql();
    const now = new Date().toISOString();
    const rows = await sql<{ id: string }>`
      update app_group_messages
      set body = ${body}, edited_at = ${now}
      where id = ${data.id} and from_username = ${u} and deleted_at is null
      returning id
    `;
    if (rows.length === 0) return { ok: false, error: "امکان ویرایش این پیام برای شما وجود ندارد." };
    return { ok: true as const };
  });

export const deleteGroupMessage = createServerFn({ method: "POST" })
  .validator((data: { username: string; id: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const u = data.username.trim().toLowerCase();
    const sql = await getSql();
    const now = new Date().toISOString();
    const rows = await sql<{ id: string }>`
      update app_group_messages
      set deleted_at = ${now}
      where id = ${data.id} and from_username = ${u} and deleted_at is null
      returning id
    `;
    if (rows.length === 0) return { ok: false, error: "امکان حذف این پیام برای شما وجود ندارد." };
    return { ok: true as const };
  });

export const markGroupRead = createServerFn({ method: "POST" })
  .validator((data: { username: string; groupId: string }) => data)
  .handler(async ({ data }) => {
    const u = data.username.trim().toLowerCase();
    if (!u) return { ok: true as const };
    const sql = await getSql();
    const now = new Date().toISOString();
    await sql`
      insert into app_group_reads (group_id, username, last_read_at)
      values (${data.groupId}, ${u}, ${now})
      on conflict (group_id, username) do update set last_read_at = excluded.last_read_at
    `;
    return { ok: true as const };
  });

export const listGroupReads = createServerFn({ method: "GET" })
  .validator((data: { groupId: string }) => data)
  .handler(async ({ data }): Promise<GroupRead[]> => {
    const sql = await getSql();
    const rows = await sql<{ username: string; last_read_at: string }>`
      select username, last_read_at from app_group_reads where group_id = ${data.groupId}
    `;
    return rows.map((r) => ({ username: r.username, lastReadAt: r.last_read_at }));
  });

export const groupUnreadCounts = createServerFn({ method: "GET" })
  .validator((data: { username: string }) => data)
  .handler(async ({ data }): Promise<Record<string, number>> => {
    const u = data.username.trim().toLowerCase();
    if (!u) return {};
    const sql = await getSql();
    const rows = await sql<{ group_id: string; n: number }>`
      select gm2.group_id, count(*)::int as n
      from app_group_messages gm2
      join app_group_members mem on mem.group_id = gm2.group_id and mem.username = ${u}
      left join app_group_reads r on r.group_id = gm2.group_id and r.username = ${u}
      where gm2.from_username <> ${u}
        and gm2.deleted_at is null
        and (r.last_read_at is null or gm2.created_at > r.last_read_at)
      group by gm2.group_id
    `;
    const out: Record<string, number> = {};
    for (const row of rows) out[row.group_id] = row.n;
    return out;
  });

/** Remove a member from a group. Any current member can remove others; cannot remove the last member. */
export const removeGroupMember = createServerFn({ method: "POST" })
  .validator((data: { by: string; groupId: string; username: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const by = data.by.trim().toLowerCase();
    const target = data.username.trim().toLowerCase();
    if (!target) return { ok: false, error: "کاربر نامعتبر است." };
    const sql = await getSql();
    const member = await sql<{ username: string }>`
      select username from app_group_members where group_id = ${data.groupId} and username = ${by}
    `;
    if (member.length === 0) return { ok: false, error: "شما عضو این گروه نیستید." };
    const count = await sql<{ n: number }>`
      select count(*)::int as n from app_group_members where group_id = ${data.groupId}
    `;
    if ((count[0]?.n ?? 0) <= 1) {
      return { ok: false, error: "نمی‌توان آخرین عضو گروه را حذف کرد." };
    }
    await sql`
      delete from app_group_members where group_id = ${data.groupId} and username = ${target}
    `;
    await sql`
      delete from app_group_reads where group_id = ${data.groupId} and username = ${target}
    `;
    return { ok: true as const };
  });

/** Soft-clear all messages in a group (marks them deleted). Any member can do this. */
export const clearGroupMessages = createServerFn({ method: "POST" })
  .validator((data: { by: string; groupId: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const by = data.by.trim().toLowerCase();
    if (!by) return { ok: false, error: "کاربر نامعتبر است." };
    const sql = await getSql();
    const member = await sql<{ username: string }>`
      select username from app_group_members where group_id = ${data.groupId} and username = ${by}
    `;
    if (member.length === 0) return { ok: false, error: "شما عضو این گروه نیستید." };
    const now = new Date().toISOString();
    await sql`
      update app_group_messages
      set deleted_at = ${now}
      where group_id = ${data.groupId} and deleted_at is null
    `;
    return { ok: true as const };
  });
