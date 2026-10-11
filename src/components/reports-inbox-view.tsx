import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Download, Forward, FileText, Plus } from "lucide-react";
import { useLocalSession } from "@/lib/local-session";
import { getWorkReport, listInboxReports, listSentReports, type WorkReport } from "@/lib/work-reports";
import { getAppFile } from "@/lib/files";
import { formatRelativeFa, isoToJalaaliLong } from "@/lib/jalali";
import { Button } from "./ui/button";
import { SendReportDialog } from "./send-report-dialog";
import { cn } from "@/lib/utils";

export function ReportsInboxView() {
  const { user } = useLocalSession();
  const me = user?.username ?? "";
  const [tab, setTab] = useState<"inbox" | "sent">("inbox");
  const [selected, setSelected] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [forward, setForward] = useState<WorkReport | null>(null);

  const inboxQ = useQuery({
    queryKey: ["work-reports", "inbox", me],
    queryFn: () => listInboxReports({ data: { username: me } }),
    enabled: Boolean(me),
  });
  const sentQ = useQuery({
    queryKey: ["work-reports", "sent", me],
    queryFn: () => listSentReports({ data: { username: me } }),
    enabled: Boolean(me),
  });
  const detailQ = useQuery({
    queryKey: ["work-reports", "one", selected],
    queryFn: () => getWorkReport({ data: { id: selected!, username: me } }),
    enabled: Boolean(selected && me),
  });

  const list = tab === "inbox" ? inboxQ.data ?? [] : sentQ.data ?? [];
  const detail = detailQ.data;

  async function downloadFile(fileId: string, name: string) {
    const res = await getAppFile({ data: { id: fileId } });
    if (!res.ok) return;
    const a = document.createElement("a");
    a.href = `data:${res.mime};base64,${res.dataBase64}`;
    a.download = name || res.filename;
    a.click();
  }

  return (
    <div className="k-scroll mx-auto flex max-w-4xl flex-col gap-4 overflow-y-auto px-4 py-5 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">گزارش‌های کاری</h1>
          <p className="mt-1 text-[13px] text-muted">دریافتی، ارسالی، ارجاع و پیوست فایل</p>
        </div>
        <Button size="sm" onClick={() => { setForward(null); setSendOpen(true); }}>
          <Plus className="size-4" />
          گزارش جدید
        </Button>
      </div>

      <div className="flex gap-1 rounded-full bg-surface-2 p-1 self-start">
        {(["inbox", "sent"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setTab(t); setSelected(null); }}
            className={cn(
              "rounded-full px-4 py-1.5 text-[12px] font-medium",
              tab === t ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
            )}
          >
            {t === "inbox" ? "دریافتی" : "ارسالی"}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ul className="space-y-2">
          {list.length === 0 && (
            <li className="rounded-xl border border-border k-glass px-4 py-8 text-center text-sm text-muted">
              گزارشی نیست.
            </li>
          )}
          {list.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setSelected(r.id)}
                className={cn(
                  "w-full rounded-xl border px-3 py-3 text-start transition",
                  selected === r.id ? "border-accent bg-accent-soft" : "border-border k-glass hover:border-border-strong",
                  tab === "inbox" && !r.readAt && "border-accent/40",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[13px] font-medium">
                    {tab === "inbox" ? `از ${r.fromUsername}` : `به ${r.toUsername}`}
                  </span>
                  <span className="text-[10px] text-subtle">{formatRelativeFa(r.createdAt)}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[12px] text-muted">
                  {r.body || r.filename || "—"}
                </p>
                {(r.cardTitle || r.boardTitle) && (
                  <p className="mt-1 text-[11px] text-subtle">
                    {r.boardTitle}
                    {r.cardTitle ? ` · ${r.cardTitle}` : ""}
                  </p>
                )}
              </button>
            </li>
          ))}
        </ul>

        <div className="rounded-2xl border border-border k-glass p-4 min-h-[200px]">
          {!detail ? (
            <p className="py-10 text-center text-sm text-muted">یک گزارش را انتخاب کنید</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">
                    {detail.fromUsername} → {detail.toUsername}
                  </p>
                  <p className="text-[11px] text-muted">
                    {isoToJalaaliLong(detail.createdAt.slice(0, 10))} · {detail.createdAt.slice(11, 16)}
                  </p>
                </div>
                {tab === "inbox" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setForward(detail);
                      setSendOpen(true);
                    }}
                  >
                    <Forward className="size-3.5" />
                    ارجاع
                  </Button>
                )}
              </div>
              {(detail.boardTitle || detail.cardTitle) && (
                <p className="text-[12px] text-muted">
                  {detail.boardTitle}
                  {detail.cardTitle ? ` / ${detail.cardTitle}` : ""}
                </p>
              )}
              {detail.body && (
                <div className="whitespace-pre-wrap rounded-lg bg-surface-2 px-3 py-2 text-[13px] leading-relaxed">
                  {detail.body}
                </div>
              )}
              {detail.fileId && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void downloadFile(detail.fileId!, detail.filename || "file")}
                >
                  <Download className="size-3.5" />
                  دانلود {detail.filename || "پیوست"}
                </Button>
              )}
              {detail.parentId && (
                <p className="text-[11px] text-subtle">این گزارش ارجاع‌شده است.</p>
              )}
            </div>
          )}
        </div>
      </div>

      <SendReportDialog
        open={sendOpen}
        onOpenChange={(v) => {
          setSendOpen(v);
          if (!v) setForward(null);
        }}
        forwardFrom={
          forward
            ? {
                parentId: forward.id,
                body: forward.body,
                boardId: forward.boardId,
                boardTitle: forward.boardTitle,
                cardId: forward.cardId,
                cardTitle: forward.cardTitle,
              }
            : undefined
        }
      />
    </div>
  );
}
