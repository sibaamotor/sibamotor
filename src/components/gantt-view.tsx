import { useMemo } from "react";
import type { Board, Card } from "@/lib/types";
import { asIsoDate, isOverdue, isoToJalaali, isoToday, JMONTHS } from "@/lib/jalali";
import { personById, personName } from "@/lib/names";

function toDate(iso: string): Date {
  const day = asIsoDate(iso);
  if (!day) return new Date(NaN);
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}
function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function GanttView({ board, onOpenCard }: { board: Board; onOpenCard?: (id: string) => void }) {
  const rows = useMemo(() => {
    const cards: Card[] = board.lists.flatMap((l) => l.cards.map((c) => ({ ...c, listId: l.id })));
    const dated = cards.filter((c) => asIsoDate(c.startDate) || asIsoDate(c.dueDate));
    return dated.sort((a, b) =>
      (asIsoDate(a.startDate) || asIsoDate(a.dueDate) || "").localeCompare(
        asIsoDate(b.startDate) || asIsoDate(b.dueDate) || "",
      ),
    );
  }, [board]);

  const doneId = board.lists[board.lists.length - 1]?.id;

  const range = useMemo(() => {
    if (rows.length === 0) return null;
    const dates: string[] = [];
    for (const c of rows) {
      const s = asIsoDate(c.startDate);
      const d = asIsoDate(c.dueDate);
      if (s) dates.push(s);
      if (d) dates.push(d);
    }
    dates.push(isoToday());
    if (dates.length === 0) return null;
    const min = dates.reduce((a, b) => (a < b ? a : b));
    const max = dates.reduce((a, b) => (a > b ? a : b));
    const start = toDate(min);
    start.setDate(start.getDate() - 2);
    const end = toDate(max);
    end.setDate(end.getDate() + 3);
    const days = Math.min(Math.max(Math.round((end.getTime() - start.getTime()) / 86400000), 1), 400);
    if (!Number.isFinite(days)) return null;
    return { start, days };
  }, [rows]);

  if (!range || rows.length === 0) {
    return (
      <div className="grid h-[50vh] place-items-center px-6 text-center">
        <div className="max-w-sm space-y-1">
          <h1 className="text-lg font-semibold text-fg">گانت چارت</h1>
          <p className="text-sm text-muted">کاری با تاریخ شروع یا مهلت ثبت نشده. از جزئیات کارت تاریخ شمسی بگذارید.</p>
        </div>
      </div>
    );
  }

  const px = 22;
  const labelW = 240;
  const today = toDate(isoToday());
  const todayOff = Math.round((today.getTime() - range.start.getTime()) / 86400000);
  const chartW = range.days * px;

  const months: { x: number; label: string }[] = [];
  const ticks: { x: number; label: string }[] = [];
  let lastLabelX = -999;
  for (let i = 0; i <= range.days; i++) {
    const d = new Date(range.start);
    d.setDate(d.getDate() + i);
    const j = isoToJalaali(fmt(d));
    if (!j) continue;
    const isMonthStart = j[2] === 1;
    if (isMonthStart || i === 0) {
      if (!(i - lastLabelX < 4 && !isMonthStart)) {
        months.push({ x: i, label: `${JMONTHS[j[1] - 1]} ${j[0]}` });
        lastLabelX = i;
      }
    }
    if (j[2] === 1 || j[2] === 8 || j[2] === 15 || j[2] === 22) {
      ticks.push({ x: i, label: String(j[2]) });
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="px-4 py-3">
        <h1 className="text-lg font-semibold">گانت چارت</h1>
        <p className="text-[13px] text-muted">
          {rows.length} کار زمان‌بندی‌شده · خط رنگی امروز است · نوار قرمز یعنی عقب‌افتاده
        </p>
      </div>
      <div className="k-scroll min-h-0 flex-1 overflow-auto px-4 pb-8" dir="ltr">
        <div className="relative" style={{ minWidth: labelW + chartW + 24 }}>
          <div className="sticky top-0 z-10 flex h-12 items-end border-b border-border k-glass">
            <div className="sticky left-0 z-20 h-12 shrink-0 k-glass" style={{ width: labelW }} />
            <div className="relative h-12" style={{ width: chartW }}>
              {months.map((m) => (
                <div
                  key={`${m.label}-${m.x}`}
                  className="absolute top-1 whitespace-nowrap text-[11px] font-medium text-muted"
                  style={{ left: m.x * px }}
                >
                  {m.label}
                </div>
              ))}
              {ticks.map((t) => (
                <div
                  key={`t-${t.x}`}
                  className="absolute bottom-0.5 text-[10px] tabular-nums text-subtle"
                  style={{ left: t.x * px }}
                >
                  {t.label}
                </div>
              ))}
            </div>
          </div>

          {todayOff >= 0 && todayOff <= range.days && (
            <>
              <div
                className="pointer-events-none absolute top-12 bottom-0 z-[1] w-px bg-accent"
                style={{ left: labelW + todayOff * px }}
              />
              <div
                className="pointer-events-none absolute top-1 z-[3] rounded-sm bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-fg"
                style={{ left: labelW + todayOff * px + 4 }}
              >
                امروز
              </div>
            </>
          )}

          {rows.map((c) => {
            const sIso = asIsoDate(c.startDate) || asIsoDate(c.dueDate) || asIsoDate(c.createdAt) || isoToday();
            const eIso = asIsoDate(c.dueDate) || asIsoDate(c.startDate) || sIso;
            const s = toDate(sIso);
            const e = toDate(eIso);
            const x1 = Math.round((s.getTime() - range.start.getTime()) / 86400000);
            const x2 = Math.max(Math.round((e.getTime() - range.start.getTime()) / 86400000), x1);
            const done = c.listId === doneId;
            const overdue = isOverdue(c.dueDate, done);
            const label = board.labels.find((l) => c.labelIds.includes(l.id));
            const priColor =
              c.priority === "high" ? "#e11d48" : c.priority === "low" ? "#16a34a" : "#2563eb";
            const color = overdue ? "#e11d48" : done ? "#94a3b8" : label?.color || priColor;
            const owner = personById(board.people, c.memberIds[0] ?? c.followerId);
            const width = Math.max((x2 - x1 + 1) * px - 4, 12);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onOpenCard?.(c.id)}
                className="flex h-10 w-full items-center border-b border-border/60 text-start hover:bg-accent-soft/40"
              >
                <div
                  className="sticky left-0 z-[2] truncate bg-bg/90 px-2 text-right text-[12px] text-fg backdrop-blur-sm"
                  style={{ width: labelW }}
                  dir="rtl"
                >
                  <div className="truncate font-medium">{c.title}</div>
                  {owner && <div className="truncate text-[10px] text-subtle">{personName(owner)}</div>}
                </div>
                <div className="relative h-10" style={{ width: chartW }}>
                  <div
                    className="absolute top-2 h-6 overflow-hidden rounded-md px-1.5 text-[10px] leading-6 text-white shadow-sm ring-1 ring-black/5"
                    title={c.title}
                    style={{
                      left: x1 * px,
                      width,
                      background: color,
                      opacity: done ? 0.45 : 0.92,
                    }}
                  >
                    {width > 48 ? c.title : ""}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
