/** Encode/decode file attachments stored inside chat message body. */

export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const PREFIX = "__FILE__:";

export type ChatFilePayload = {
  name: string;
  mime: string;
  size: number;
  data: string; // base64 without data: prefix
};

export function isFileBody(body: string): boolean {
  return body.startsWith(PREFIX);
}

export function encodeFileBody(file: ChatFilePayload): string {
  return PREFIX + JSON.stringify(file);
}

export function decodeFileBody(body: string): ChatFilePayload | null {
  if (!isFileBody(body)) return null;
  try {
    const parsed = JSON.parse(body.slice(PREFIX.length)) as ChatFilePayload;
    if (!parsed?.name || !parsed?.data || typeof parsed.size !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Read a browser File as base64 (no data: prefix). Rejects over size limit. */
export function readFileAsBase64(file: File): Promise<ChatFilePayload> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_FILE_BYTES) {
      reject(new Error(`حجم فایل بیشتر از ${formatFileSize(MAX_FILE_BYTES)} است.`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      const data = comma >= 0 ? result.slice(comma + 1) : result;
      resolve({
        name: file.name,
        mime: file.type || "application/octet-stream",
        size: file.size,
        data,
      });
    };
    reader.onerror = () => reject(new Error("خواندن فایل ناموفق بود."));
    reader.readAsDataURL(file);
  });
}
