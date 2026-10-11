import { createServerFn } from "@tanstack/react-start";
import { getSql } from "./db";
import { nid } from "./utils";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export type StoredFileMeta = {
  id: string;
  filename: string;
  mime: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: string;
};

/** Store file in app_files table (separate from message body). */
export const uploadAppFile = createServerFn({ method: "POST" })
  .validator(
    (data: {
      filename: string;
      mime: string;
      sizeBytes: number;
      dataBase64: string;
      uploadedBy: string;
    }) => data,
  )
  .handler(async ({ data }): Promise<{ ok: true; id: string } | { ok: false; error: string }> => {
    if (data.sizeBytes > MAX_FILE_BYTES) {
      return { ok: false, error: "حجم فایل بیشتر از ۵ مگابایت است." };
    }
    if (!data.dataBase64 || data.dataBase64.length > MAX_FILE_BYTES * 2) {
      return { ok: false, error: "داده فایل نامعتبر است." };
    }
    const sql = await getSql();
    const id = nid();
    const now = new Date().toISOString();
    await sql`
      insert into app_files (id, filename, mime, size_bytes, data, uploaded_by, created_at)
      values (
        ${id},
        ${data.filename.slice(0, 200)},
        ${data.mime.slice(0, 120)},
        ${data.sizeBytes},
        ${data.dataBase64},
        ${data.uploadedBy.trim().toLowerCase()},
        ${now}
      )
    `;
    return { ok: true as const, id };
  });

export const getAppFile = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => data)
  .handler(
    async ({
      data,
    }): Promise<
      | { ok: true; filename: string; mime: string; sizeBytes: number; dataBase64: string }
      | { ok: false; error: string }
    > => {
      const sql = await getSql();
      const rows = await sql<{
        filename: string;
        mime: string;
        size_bytes: number;
        data: string;
      }>`
        select filename, mime, size_bytes, data from app_files where id = ${data.id}
      `;
      const r = rows[0];
      if (!r) return { ok: false, error: "فایل پیدا نشد." };
      return {
        ok: true as const,
        filename: r.filename,
        mime: r.mime,
        sizeBytes: r.size_bytes,
        dataBase64: r.data,
      };
    },
  );
