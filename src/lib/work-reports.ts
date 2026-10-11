import { createServerFn } from "@tanstack/react-start";
import { getSql } from "./db";
import { loadWorkspaceForReports, pushCardActivity } from "./work-reports-helpers";
import { nid } from "./utils";

export type WorkReport = {
  id: string;
  fromUsername: string;
  toUsername: string;
  boardId: string | null;
  boardTitle: string | null;
  cardId: string | null;
  cardTitle: string | null;
  body: string;
  fileId: string | null;
  filename: string | null;
  parentId: string | null;
  createdAt: string;
  readAt: string | null;
};

function mapRow(r: {
  id: string;
  from_username: string;
  to_username: string;
  board_id: string | null;
  board_title: string | null;
  card_id: string | null;
  card_title: string | null;
  body: string;
  file_id: string | null;
  filename: string | null;
  parent_id: string | null;
  created_at: string;
  read_at: string | null;
}): WorkReport {
  return {
    id: r.id,
    fromUsername: r.from_username,
    toUsername: r.to_username,
    boardId: r.board_id,
    boardTitle: r.board_title,
    cardId: r.card_id,
    cardTitle: r.card_title,
    body: r.body,
    fileId: r.file_id,
    filename: r.filename,
    parentId: r.parent_id,
    createdAt: r.created_at,
    readAt: r.read_at,
  };
}

export const sendWorkReport = createServerFn({ method: "POST" })
  .validator(
    (data: {
      fromUsername: string;
      toUsername: string;
      boardId?: string;
      boardTitle?: string;
      cardId?: string;
      cardTitle?: string;
      body: string;
      fileId?: string;
      filename?: string;
      parentId?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const from = data.fromUsername.trim().toLowerCase();
    const to = data.toUsername.trim().toLowerCase();
    if (!from || !to) throw new Error("فرستنده و گیرنده الزامی است.");
    if (!data.body.trim() && !data.fileId) throw new Error("متن یا فایل گزارش لازم است.");
    const sql = await getSql();
    const id = nid();
    const now = new Date().toISOString();
    await sql`
      insert into app_work_reports (
        id, from_username, to_username, board_id, board_title, card_id, card_title,
        body, file_id, filename, parent_id, created_at, read_at
      ) values (
        ${id}, ${from}, ${to},
        ${data.boardId ?? null}, ${data.boardTitle ?? null},
        ${data.cardId ?? null}, ${data.cardTitle ?? null},
        ${data.body.trim()},
        ${data.fileId ?? null}, ${data.filename ?? null},
        ${data.parentId ?? null}, ${now}, null
      )
    `;
    // card activity log
    if (data.cardId) {
      await pushCardActivity(
        data.cardId,
        from,
        `گزارش ارسال شد به ${to}${data.parentId ? " (ارجاع)" : ""}`,
      );
    }
    // notification
    try {
      await sql`
        insert into app_notifications (id, username, kind, title, body, href, read_at, created_at)
        values (
          ${nid()},
          ${to},
          'work_report',
          ${data.parentId ? "ارجاع گزارش کاری" : "گزارش کاری جدید"},
          ${(data.body || data.filename || "گزارش").slice(0, 120)},
          ${"/reports-inbox"},
          null,
          ${now}
        )
      `;
    } catch {
      /* notifications table may lag */
    }
    return { ok: true as const, id };
  });

export const listInboxReports = createServerFn({ method: "GET" })
  .validator((data: { username: string }) => data)
  .handler(async ({ data }): Promise<WorkReport[]> => {
    const u = data.username.trim().toLowerCase();
    if (!u) return [];
    const sql = await getSql();
    const rows = await sql<Parameters<typeof mapRow>[0]>`
      select * from app_work_reports
      where to_username = ${u}
      order by created_at desc
      limit 100
    `;
    return rows.map(mapRow);
  });

export const listSentReports = createServerFn({ method: "GET" })
  .validator((data: { username: string }) => data)
  .handler(async ({ data }): Promise<WorkReport[]> => {
    const u = data.username.trim().toLowerCase();
    if (!u) return [];
    const sql = await getSql();
    const rows = await sql<Parameters<typeof mapRow>[0]>`
      select * from app_work_reports
      where from_username = ${u}
      order by created_at desc
      limit 100
    `;
    return rows.map(mapRow);
  });

export const getWorkReport = createServerFn({ method: "GET" })
  .validator((data: { id: string; username: string }) => data)
  .handler(async ({ data }): Promise<WorkReport | null> => {
    const sql = await getSql();
    const rows = await sql<Parameters<typeof mapRow>[0]>`
      select * from app_work_reports where id = ${data.id}
    `;
    const r = rows[0];
    if (!r) return null;
    const u = data.username.trim().toLowerCase();
    if (r.to_username !== u && r.from_username !== u) return null;
    if (r.to_username === u && !r.read_at) {
      const now = new Date().toISOString();
      await sql`update app_work_reports set read_at = ${now} where id = ${data.id}`;
      r.read_at = now;
    }
    return mapRow(r);
  });

export const unreadWorkReportCount = createServerFn({ method: "GET" })
  .validator((data: { username: string }) => data)
  .handler(async ({ data }): Promise<number> => {
    const u = data.username.trim().toLowerCase();
    if (!u) return 0;
    const sql = await getSql();
    const rows = await sql<{ n: number }>`
      select count(*)::int as n from app_work_reports
      where to_username = ${u} and read_at is null
    `;
    return rows[0]?.n ?? 0;
  });
