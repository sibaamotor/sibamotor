import { useMemo, useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download } from "lucide-react";
import type { Board, Card } from "@/lib/types";
import { addDaysIso, isOverdue, isoToday, isoToJalaaliStr } from "@/lib/jalali";
import { personName } from "@/lib/names";
import { PRIORITY_LABEL } from "@/lib/constants";
import { cn, downloadText } from "@/lib/utils";
import { Button } from "./ui/button";

export function DashboardView({
  board,
  onOpenCard,
}: {
  board: Board;
  onOpenCard?: (id: string) => void;
}) {
  const cards: Card[] = board.lists.flatMap((l) => l.cards);
  const doneId = board.lists[board.lists.length - 1]?.id;
  const [personId, setPersonId] = useState<string>("all");
  const [labelId, setLabelId] = useState<string>("all");

  const filtered = useMemo(() => {
    return cards.filter((c) => {
      if (personId !== "all" && c.memberIds.indexOf(personId) < 0 && c.followerId !== personId) return false;
      if (labelId !== "all" && !c.labelIds.includes(labelId)) return false;
      return true;
    });
  }, [cards, personId, labelId]);

  const kpi = useMemo(() => {
    const total = filtered.length;
    const active = filtered.filter((c) => !c.archived);
    const done = active.filter((c) => c.listId === doneId).length;
    const doing = board.lists.length >= 2 ? active.filter((c) => c.listId === board.lists[1]!.id).length : 0;
    const overdue = active.filter((c) => isOverdue(c.dueDate, c.listId === doneId)).length;
    const today = isoToday();
    const week = addDaysIso(today, 7);
    const dueSoon = active.filter((c) => {
      if (!c.dueDate || c.listId === doneId) return false;
      const d = c.dueDate.slice(0, 10);
      return d >= today && d <= week;
    }).length;
    const avg = active.length
      ? Math.round(active.reduce((s, c) => s + (c.progress ?? 0), 0) / active.length)
      : 0;
    const unassigned = active.filter((c) => c.memberIds.length === 0 && c.listId !== doneId).length;
    const highPri = active.filter((c) => c.priority === "high" && c.listId !== doneId).length;
    const archived = filtered.filter((c) => c.archived).length;
    let checkTotal = 0;
    let checkDone = 0;
    for (const c of active) {
      for (const ch of c.checklists) {
        checkTotal += ch.items.length;
        checkDone += ch.items.filter((i) => i.done).length;
      }
    }
    const completionRate = active.length ? Math.round((done / active.length) * 100) : 0;
    return {
      total: active.length,
      done,
      doing,
      overdue,
      dueSoon,
      avg,
      unassigned,
      highPri,
      archived,
      checkTotal,
      checkDone,
      completionRate,
    };
  }, [board, filtered, doneId]);

  const catRows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of filtered) {
      if (c.labelIds.length === 0) counts.set("_", (counts.get("_") ?? 0) + 1);
      for (const id of c.labelIds) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([id, value]) => {
        const lab = board.labels.find((l) => l.id === id);
        return { name: lab?.name ?? "بدون برچسب", value, fill: lab?.color ?? "var(--k-subtle)" };
      })
      .sort((a, b) => b.value - a.value);
  }, [board.labels, filtered]);

  const priRows = useMemo(
    () =>
      (["high", "med", "low"] as const).map((p) => ({
        name: PRIORITY_LABEL[p],
        value: filtered.filter((c) => c.priority === p).length,
      })),
    [filtered],
  );

  const listRows = useMemo(
    () =>
      board.lists.map((l) => ({
        name: l.title,
        value: filtered.filter((c) => c.listId === l.id && !c.archived).length,
      })),
    [board.lists, filtered],
  );

  const dueSoonCards = useMemo(() => {
    const today = isoToday();
    const week = addDaysIso(today, 7);
    return filtered
      .filter((c) => {
        if (c.archived || !c.dueDate || c.listId === doneId) return false;
        const d = c.dueDate.slice(0, 10);
        return d >= today && d <= week;
      })
      .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
  }, [filtered, doneId]);

  const execRows = useMemo(() => personStats(filtered, board, doneId, "exec"), [board, filtered, doneId]);
  const followRows = useMemo(() => personStats(filtered, board, doneId, "follow"), [board, filtered, doneId]);
  const overdueCards = useMemo(
    () =>
      filtered
        .filter((c) => isOverdue(c.dueDate, c.listId === doneId))
        .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || "")),
    [filtered, doneId],
  );

  const noDue = useMemo(
    () => filtered.filter((c) => !c.dueDate && c.listId !== doneId),
    [filtered, doneId],
  );

  function exportCsv() {
    const header = ["عنوان", "ستون", "اولویت", "پیشرفت", "مهلت", "مسئول اجرا", "پیگیری"];
    const lines = [header.join(",")];
    for (const c of filtered) {
      const list = board.lists.find((l) => l.id === c.listId)?.title ?? "";
      const members = c.memberIds
        .map((id) => board.people.find((p) => p.id === id))
        .filter(Boolean)
        .map((p) => personName(p!))
        .join(" | ");
      const follower = board.people.find((p) => p.id === c.followerId);
      const row = [
        csv(c.title),
        csv(list),
        csv(PRIORITY_LABEL[c.priority]),
        String(c.progress ?? 0),
        csv(isoToJalaaliStr(c.dueDate) || ""),
        csv(members),
        csv(follower ? personName(follower) : ""),
      ];
      lines.push(row.join(","));
    }
    downloadText(`sibamotor-report-${new Date().toISOString().slice(0, 10)}.csv`, lines.join("\n"), "text/csv;charset=utf-8");
  }

  if (cards.length === 0) {
    return (
      <div className="grid h-[50vh] place-items-center px-6 text-center">
        <div>
          <h1 className="text-lg font-semibold">داشبورد گزارش</h1>
          <p className="mt-1 text-sm text-muted">هنوز کاری ثبت نشده.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-4 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">داشبورد گزارش</h1>
          <p className="text-[13px] text-muted">{board.title}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={exportCsv}>
          <Download className="size-4" />
          خروجی CSV
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 text-[12px] text-muted">
          مسئول
          <select
            className="max-w-[10rem] bg-transparent text-[12px] text-fg outline-none"
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
          >
            <option value="all">همه</option>
            {board.people.map((p) => (
              <option key={p.id} value={p.id}>
                {personName(p)}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 text-[12px] text-muted">
          برچسب
          <select
            className="max-w-[10rem] bg-transparent text-[12px] text-fg outline-none"
            value={labelId}
            onChange={(e) => setLabelId(e.target.value)}
          >
            <option value="all">همه</option>
            {board.labels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        {(personId !== "all" || labelId !== "all") && (
          <button type="button" className="text-[12px] text-muted hover:text-fg" onClick={() => { setPersonId("all"); setLabelId("all"); }}>
            پاک کردن فیلتر
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <Kpi label="کل کارها" value={kpi.total} />
        <Kpi label="نرخ تکمیل" value={kpi.completionRate} suffix="٪" tone="success" />
        <Kpi label="در حال اجرا" value={kpi.doing} />
        <Kpi label="تکمیل‌شده" value={kpi.done} tone="success" />
        <Kpi label="عقب‌افتاده" value={kpi.overdue} tone="danger" />
        <Kpi label="سررسید ۷ روز" value={kpi.dueSoon} />
        <Kpi label="اولویت بالا" value={kpi.highPri} tone="danger" />
        <Kpi label="میانگین پیشرفت" value={kpi.avg} suffix="٪" />
        <Kpi label="بدون مسئول" value={kpi.unassigned} />
        <Kpi label="بایگانی‌شده" value={kpi.archived} />
        <Kpi
          label="چک‌لیست"
          value={kpi.checkDone}
          suffix={kpi.checkTotal ? `/${kpi.checkTotal}` : ""}
        />
        <Kpi label="بدون مهلت" value={noDue.length} />
      </div>

      <section className="rounded-2xl border border-border k-glass p-4">
        <h2 className="mb-3 text-sm font-semibold">توزیع ستون‌ها</h2>
        <Bars rows={listRows.map((r) => ({ ...r, color: "var(--k-accent)" }))} />
      </section>

      {dueSoonCards.length > 0 && (
        <section className="rounded-2xl border border-border k-glass p-4">
          <h2 className="mb-3 text-sm font-semibold">سررسید تا ۷ روز آینده</h2>
          <ul className="space-y-1">
            {dueSoonCards.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onOpenCard?.(c.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-start hover:bg-accent-soft"
                >
                  <span className="min-w-0 flex-1 truncate text-sm">{c.title}</span>
                  <span className="shrink-0 text-[12px] tabular-nums text-muted">
                    {isoToJalaaliStr(c.dueDate)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {overdueCards.length > 0 && (
        <section className="rounded-2xl border border-border k-glass p-4">
          <h2 className="mb-3 text-sm font-semibold text-danger">کارهای عقب‌افتاده</h2>
          <ul className="space-y-1">
            {overdueCards.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onOpenCard?.(c.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-start hover:bg-accent-soft"
                >
                  <span className="min-w-0 flex-1 truncate text-sm">{c.title}</span>
                  <span className="shrink-0 text-[12px] tabular-nums text-danger">
                    {isoToJalaaliStr(c.dueDate)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {noDue.length > 0 && (
        <section className="rounded-2xl border border-border k-glass p-4">
          <h2 className="mb-3 text-sm font-semibold">کارهای بدون مهلت</h2>
          <ul className="space-y-1">
            {noDue.slice(0, 8).map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onOpenCard?.(c.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-start hover:bg-accent-soft"
                >
                  <span className="min-w-0 flex-1 truncate text-sm">{c.title}</span>
                  <span className="shrink-0 text-[12px] tabular-nums text-subtle">{c.progress}٪</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-border k-glass p-4">
        <h2 className="mb-3 text-sm font-semibold">کارها بر اساس برچسب</h2>
        <div className="h-56" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={catRows} layout="vertical" margin={{ left: 8, right: 16 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={128} tick={{ fontSize: 11, fill: "var(--k-muted)" }} />
              <Tooltip
                contentStyle={{
                  background: "var(--k-bg-elevated)",
                  border: "1px solid var(--k-border)",
                  borderRadius: 8,
                  color: "var(--k-fg)",
                }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                {catRows.map((e) => (
                  <Cell key={e.name} fill={e.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-2xl border border-border k-glass p-4">
        <h2 className="mb-3 text-sm font-semibold">توزیع اولویت</h2>
        <Bars rows={priRows.map((r) => ({ ...r, color: "var(--k-accent)" }))} />
      </section>

      <Perf title="عملکرد مسئولین اجرا" rows={execRows} />
      <Perf title="عملکرد مسئولین پیگیری" rows={followRows} />

      <section className="rounded-2xl border border-border k-glass p-4">
        <h2 className="mb-3 text-sm font-semibold">فهرست کارها</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="border-b border-border text-[12px] text-subtle">
              <tr>
                <th className="px-2 py-2 text-start font-medium">عنوان</th>
                <th className="px-2 py-2 text-start font-medium">ستون</th>
                <th className="px-2 py-2 text-start font-medium">اولویت</th>
                <th className="px-2 py-2 text-start font-medium">پیشرفت</th>
                <th className="px-2 py-2 text-start font-medium">مهلت</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const list = board.lists.find((l) => l.id === c.listId);
                const overdue = isOverdue(c.dueDate, c.listId === doneId);
                return (
                  <tr key={c.id} className="border-b border-border/60 last:border-0">
                    <td className="px-2 py-2">
                      <button type="button" className="text-start hover:underline" onClick={() => onOpenCard?.(c.id)}>
                        {c.title}
                      </button>
                    </td>
                    <td className="px-2 py-2 text-muted">{list?.title}</td>
                    <td className="px-2 py-2">{PRIORITY_LABEL[c.priority]}</td>
                    <td className="px-2 py-2 tabular-nums">{c.progress}٪</td>
                    <td className={cn("px-2 py-2 tabular-nums", overdue && "text-danger")}>
                      {isoToJalaaliStr(c.dueDate) || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function csv(s: string) {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function Kpi({
  label,
  value,
  tone,
  suffix,
}: {
  label: string;
  value: number;
  tone?: "success" | "danger";
  suffix?: string;
}) {
  return (
    <div className="rounded-2xl border border-border k-glass px-4 py-4 text-center">
      <div
        className={cn(
          "text-2xl font-semibold tabular-nums",
          tone === "success" && "text-success",
          tone === "danger" && "text-danger",
        )}
      >
        {value}
        {suffix ? <span className="text-base font-medium text-muted">{suffix}</span> : null}
      </div>
      <div className="mt-1 text-[12px] text-muted">{label}</div>
    </div>
  );
}

function Bars({ rows }: { rows: { name: string; value: number; color: string }[] }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.name} className="flex items-center gap-3">
          <div className="w-24 shrink-0 text-end text-[12px] text-muted">{r.name}</div>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max((r.value / max) * 100, r.value ? 4 : 0)}%`, background: r.color }}
            />
          </div>
          <div className="w-8 tabular-nums text-[12px]">{r.value}</div>
        </div>
      ))}
    </div>
  );
}

function Perf({
  title,
  rows,
}: {
  title: string;
  rows: { name: string; total: number; completed: number; overdue: number }[];
}) {
  const max = Math.max(...rows.map((r) => r.total), 1);
  return (
    <section className="rounded-2xl border border-border k-glass p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mb-3 text-[12px] text-subtle">طول میله = حجم کار · بخش رنگی = نسبت تکمیل</p>
      {rows.length === 0 ? (
        <p className="text-[13px] text-muted">داده‌ای نیست</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.name} className="flex items-center gap-3">
              <div className="w-36 shrink-0 truncate text-end text-[12px] text-muted">{r.name}</div>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div className="relative h-full" style={{ width: `${Math.max((r.total / max) * 100, 6)}%` }}>
                  <div className="absolute inset-0 bg-border-strong" />
                  <div
                    className="absolute inset-y-0 end-0 bg-success"
                    style={{ width: `${r.total ? (r.completed / r.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div className={cn("w-16 text-[12px] tabular-nums", r.overdue ? "text-danger" : "text-fg")}>
                {r.completed}/{r.total}
                {r.overdue ? ` · ${r.overdue}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function personStats(cards: Card[], board: Board, doneId: string | undefined, role: "exec" | "follow") {
  const map = new Map<string, { total: number; completed: number; overdue: number }>();
  for (const c of cards) {
    const ids = role === "exec" ? c.memberIds : c.followerId ? [c.followerId] : [];
    for (const id of ids) {
      const s = map.get(id) ?? { total: 0, completed: 0, overdue: 0 };
      s.total += 1;
      if (c.listId === doneId) s.completed += 1;
      if (isOverdue(c.dueDate, c.listId === doneId)) s.overdue += 1;
      map.set(id, s);
    }
  }
  return [...map.entries()]
    .map(([id, s]) => {
      const p = board.people.find((x) => x.id === id);
      return { name: p ? personName(p) : "نامشخص", ...s };
    })
    .sort((a, b) => b.total - a.total);
}
