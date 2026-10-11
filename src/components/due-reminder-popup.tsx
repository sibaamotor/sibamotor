import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AlarmClock, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { listBoards, getBoard } from "@/lib/local-db";
import { addDaysIso, isOverdue, isoToday, isoToJalaaliStr } from "@/lib/jalali";
import { useLocalSession } from "@/lib/local-session";
import type { Card } from "@/lib/types";
import { Button } from "./ui/button";

const DISMISS_KEY = "sibamotor-due-dismiss";

type DueItem = {
  boardId: string;
  boardTitle: string;
  card: Card;
  kind: "overdue" | "today" | "soon";
};

function readDismissed(): Record<string, string> {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeDismissed(map: Record<string, string>) {
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function DueReminderPopup() {
  const { user } = useLocalSession();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setDismissed(readDismissed());
  }, []);

  const boardsQ = useQuery({
    queryKey: ["boards"],
    queryFn: () => listBoards(),
    enabled: Boolean(user),
    refetchInterval: 120_000,
  });

  const boardId = boardsQ.data?.[0]?.id;
  const boardQ = useQuery({
    queryKey: ["board", boardId, "due-reminder"],
    queryFn: () => getBoard({ data: { boardId: boardId! } }),
    enabled: Boolean(user && boardId),
    refetchInterval: 120_000,
  });

  const items = useMemo(() => {
    const board = boardQ.data;
    if (!board) return [] as DueItem[];
    const doneId = board.lists[board.lists.length - 1]?.id;
    const today = isoToday();
    const soon = addDaysIso(today, 3);
    const out: DueItem[] = [];
    for (const list of board.lists) {
      for (const card of list.cards) {
        if (card.archived || !card.dueDate) continue;
        if (card.listId === doneId) continue;
        const d = card.dueDate.slice(0, 10);
        let kind: DueItem["kind"] | null = null;
        if (isOverdue(card.dueDate, false)) kind = "overdue";
        else if (d === today) kind = "today";
        else if (d > today && d <= soon) kind = "soon";
        if (!kind) continue;
        const key = `${board.id}:${card.id}:${kind}`;
        if (dismissed[key] === today) continue;
        out.push({ boardId: board.id, boardTitle: board.title, card, kind });
      }
    }
    out.sort((a, b) => {
      const order = { overdue: 0, today: 1, soon: 2 };
      return order[a.kind] - order[b.kind] || (a.card.dueDate || "").localeCompare(b.card.dueDate || "");
    });
    return out.slice(0, 8);
  }, [boardQ.data, dismissed]);

  useEffect(() => {
    if (items.length > 0) setOpen(true);
  }, [items.length]);

  if (!user || !open || items.length === 0) return null;

  function dismissAll() {
    const today = isoToday();
    const next = { ...dismissed };
    for (const it of items) {
      next[`${it.boardId}:${it.card.id}:${it.kind}`] = today;
    }
    setDismissed(next);
    writeDismissed(next);
    setOpen(false);
  }

  const label: Record<DueItem["kind"], string> = {
    overdue: "عقب‌افتاده",
    today: "سررسید امروز",
    soon: "تا ۳ روز آینده",
  };

  return (
    <div className="fixed bottom-20 end-4 z-50 w-[min(100%-2rem,22rem)] rounded-2xl border border-border bg-bg-elevated p-4 shadow-[var(--shadow-flyout)] lg:bottom-6">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlarmClock className="size-5 text-warning" />
          <div>
            <p className="text-sm font-semibold">یادآور سررسید</p>
            <p className="text-[11px] text-muted">{items.length} مورد نیازمند توجه</p>
          </div>
        </div>
        <button type="button" className="text-subtle hover:text-fg" onClick={dismissAll} aria-label="بستن">
          <X className="size-4" />
        </button>
      </div>
      <ul className="k-scroll max-h-56 space-y-1 overflow-y-auto">
        {items.map((it) => (
          <li key={`${it.boardId}-${it.card.id}`}>
            <button
              type="button"
              className="flex w-full flex-col gap-0.5 rounded-lg px-2 py-2 text-start hover:bg-accent-soft"
              onClick={() => {
                setOpen(false);
                void navigate({
                  to: "/b/$boardId",
                  params: { boardId: it.boardId },
                  search: { card: it.card.id } as never,
                });
              }}
            >
              <span className="truncate text-[13px] font-medium">{it.card.title}</span>
              <span className="flex justify-between text-[11px] text-muted">
                <span
                  className={
                    it.kind === "overdue" ? "text-danger" : it.kind === "today" ? "text-warning" : ""
                  }
                >
                  {label[it.kind]}
                </span>
                <span className="tabular-nums">{isoToJalaaliStr(it.card.dueDate)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={dismissAll}>
        امروز دیگر نشان نده
      </Button>
    </div>
  );
}
