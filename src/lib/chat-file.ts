/** Encode/decode file attachments in chat (legacy base64 or file-id reference). */

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
const PREFIX = "__FILE__:";
const ID_PREFIX = "__FILEID__:";

export type ChatFilePayload = {
  name: string;
  mime: string;
  size: number;
  data: string;
};

export type ChatFileRef = {
  fileId: string;
  name: string;
  mime: string;
  size: number;
};

export function isFileBody(body: string): boolean {
  return body.startsWith(PREFIX) || body.startsWith(ID_PREFIX);
}

export function isFileRefBody(body: string): boolean {
  return body.startsWith(ID_PREFIX);
}

export function encodeFileBody(file: ChatFilePayload): string {
  return PREFIX + JSON.stringify(file);
}

export function encodeFileRef(ref: ChatFileRef): string {
  return ID_PREFIX + JSON.stringify(ref);
}

export function decodeFileBody(body: string): ChatFilePayload | null {
  if (!body.startsWith(PREFIX)) return null;
  try {
    const parsed = JSON.parse(body.slice(PREFIX.length)) as ChatFilePayload;
    if (!parsed?.name || !parsed?.data || typeof parsed.size !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function decodeFileRef(body: string): ChatFileRef | null {
  if (!body.startsWith(ID_PREFIX)) return null;
  try {
    const parsed = JSON.parse(body.slice(ID_PREFIX.length)) as ChatFileRef;
    if (!parsed?.fileId || !parsed?.name) return null;
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
