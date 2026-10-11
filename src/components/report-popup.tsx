import { useQuery } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { FileText, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatRelativeFa } from "@/lib/jalali";
import { useLocalSession } from "@/lib/local-session";
import { playReceiveSound } from "@/lib/message-sounds";
import { listInboxReports, type WorkReport } from "@/lib/work-reports";
import { Button } from "./ui/button";

const SEEN_KEY = "sibamotor-seen-reports";

function readSeen(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function writeSeen(ids: Set<string>) {
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

export function ReportPopup() {
  const { user } = useLocalSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [current, setCurrent] = useState<WorkReport | null>(null);

  useEffect(() => {
    setSeen(readSeen());
  }, []);

  const q = useQuery({
    queryKey: ["work-reports", "inbox", user?.username, "popup"],
    queryFn: () => listInboxReports({ data: { username: user!.username } }),
    enabled: Boolean(user),
    refetchInterval: 10000,
  });

  const fresh = useMemo(
    () => (q.data ?? []).filter((r) => !r.readAt && !seen.has(r.id)),
    [q.data, seen],
  );

  useEffect(() => {
    if (pathname.startsWith("/reports-inbox")) return;
    if (!current && fresh[0]) {
      setCurrent(fresh[0]!);
      playReceiveSound();
    }
  }, [fresh, current, pathname]);

  function dismiss(id: string) {
    const next = new Set(seen);
    next.add(id);
    setSeen(next);
    writeSeen(next);
    const rest = fresh.filter((r) => r.id !== id);
    setCurrent(rest[0] ?? null);
  }

  if (!current || !user) return null;

  return (
    <div className="fixed bottom-20 start-4 z-40 w-[min(92vw,340px)] animate-in fade-in slide-in-from-bottom-4 lg:bottom-6">
      <div className="rounded-2xl border border-border bg-bg-elevated p-4 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.35)]">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
            <FileText className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-accent">گزارش کاری جدید</p>
                <p className="mt-0.5 truncate text-[13px] font-semibold">
                  از {current.fromUsername}
                </p>
              </div>
              <button
                type="button"
                className="rounded-md p-1 text-subtle hover:bg-accent-soft hover:text-fg"
                aria-label="بستن"
                onClick={() => dismiss(current.id)}
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="mt-1 line-clamp-2 text-[12px] text-muted">
              {current.body || current.filename || "گزارش بدون متن"}
            </p>
            {(current.boardTitle || current.cardTitle) && (
              <p className="mt-1 truncate text-[11px] text-subtle">
                {[current.boardTitle, current.cardTitle].filter(Boolean).join(" · ")}
              </p>
            )}
            <p className="mt-1 text-[10px] text-subtle">{formatRelativeFa(current.createdAt)}</p>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                onClick={() => {
                  dismiss(current.id);
                  void navigate({ to: "/reports-inbox" });
                }}
              >
                مشاهده
              </Button>
              <Button size="sm" variant="secondary" onClick={() => dismiss(current.id)}>
                بعداً
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
