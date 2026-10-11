import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { ArrowDownAZ, Download, MoreHorizontal, Plus, Tag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import type { Board, Card, Label, Priority } from "@/lib/types";
import { downloadJson, mid } from "@/lib/utils";
import { addDaysIso, isoToday, isOverdue } from "@/lib/jalali";
import { personName } from "@/lib/names";
import { LABEL_PALETTE, PRIORITY_LABEL } from "@/lib/constants";
import { useBoardCtx } from "@/lib/board-context";
import { usePermissions } from "@/lib/permissions-context";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown";
import { Input } from "../ui/input";
import { Label as FieldLabel } from "../ui/label";
import { listDndId, ListColumn } from "./list-column";
import { TaskCard } from "./task-card";
import { cn } from "@/lib/utils";

type Props = {
  board: Board;
  query: string;
  onOpenCard: (card: Card) => void;
  onAddCard: (listId: string, title: string, templateId?: string) => void;
  onRenameList: (id: string, title: string) => void;
  onDeleteList: (id: string) => void;
  onAddList: (title: string) => void;
  onMoveCard: (id: string, listId: string, position: number) => void;
  onMoveList: (id: string, position: number) => void;
  onCreateLabel: (name: string, color: string) => void;
  onDeleteLabel: (id: string) => void;
};

type Filters = {
  overdue: boolean;
  dueSoon: boolean;
  priority: Priority | "all";
  labelId: string | "all";
  personId: string | "all";
};

const EMPTY_FILTERS: Filters = {
  overdue: false,
  dueSoon: false,
  priority: "all",
  labelId: "all",
  personId: "all",
};

function isDueSoon(due: string | null | undefined, done: boolean): boolean {
  if (!due || done) return false;
  const today = isoToday();
  const week = addDaysIso(today, 7);
  const d = due.slice(0, 10);
  return d >= today && d <= week;
}

export function Kanban({
  board,
  query,
  onOpenCard,
  onAddCard,
  onRenameList,
  onDeleteList,
  onAddList,
  onMoveCard,
  onMoveList,
  onCreateLabel,
  onDeleteLabel,
}: Props) {
  const ctx = useBoardCtx();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const [lists, setLists] = useState(board.lists);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [addingList, setAddingList] = useState(false);
  const [listTitle, setListTitle] = useState("");
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [boardTitle, setBoardTitle] = useState(board.title);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const q = query.trim();
  const doneId = lists[lists.length - 1]?.id;
  const filterActive =
    filters.overdue || filters.dueSoon || filters.priority !== "all" || filters.labelId !== "all" || filters.personId !== "all";

  const stats = useMemo(() => {
    const cards = lists.flatMap((l) => l.cards);
    return {
      total: cards.length,
      queue: lists[0]?.cards.length ?? 0,
      doing: lists[1]?.cards.length ?? 0,
      done: lists[lists.length - 1]?.cards.length ?? 0,
      overdue: cards.filter((c) => isOverdue(c.dueDate, c.listId === doneId)).length,
      dueSoon: cards.filter((c) => isDueSoon(c.dueDate, c.listId === doneId)).length,
    };
  }, [lists, doneId]);

  const visible = useMemo(() => {
    const needle = q.toLowerCase();
    return lists.map((l) => ({
      ...l,
      cards: l.cards.filter((c) => {
        if (needle) {
          const people = c.memberIds
            .map((id) => board.people.find((p) => p.id === id))
            .filter(Boolean)
            .map((p) => personName(p!))
            .join(" ");
          const labels = c.labelIds
            .map((id) => board.labels.find((x) => x.id === id)?.name ?? "")
            .join(" ");
          const hay = `${c.title} ${c.notes} ${people} ${labels}`.toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        if (filters.overdue && !isOverdue(c.dueDate, l.id === doneId)) return false;
        if (filters.dueSoon && !isDueSoon(c.dueDate, l.id === doneId)) return false;
        if (filters.priority !== "all" && c.priority !== filters.priority) return false;
        if (filters.labelId !== "all" && !c.labelIds.includes(filters.labelId)) return false;
        if (filters.personId !== "all" && c.memberIds.indexOf(filters.personId) < 0 && c.followerId !== filters.personId)
          return false;
        return true;
      }),
    }));
  }, [lists, q, filters, board.people, board.labels, doneId]);

  useEffect(() => {
    setLists(board.lists);
    setBoardTitle(board.title);
  }, [board]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );
  const dndDisabled = !can("move_card") && !can("move_list");

  const allCards = useMemo(() => lists.flatMap((l) => l.cards), [lists]);
  const doneSet = useMemo(() => {
    const s = new Set<string>();
    for (const c of allCards) {
      if (c.listId === doneId || c.progress >= 100) s.add(c.id);
    }
    return s;
  }, [allCards, doneId]);
  function isCardBlocked(card: Card) {
    const deps = card.dependsOnIds ?? [];
    if (!deps.length) return false;
    return deps.some((id) => !doneSet.has(id));
  }

  function findListOfCard(cardId: string) {
    return lists.find((l) => l.cards.some((c) => c.id === cardId));
  }

  function parseId(id: string | number): { type: "card" | "list"; id: string } | null {
    const s = String(id);
    if (s.startsWith("card:")) return { type: "card", id: s.slice(5) };
    if (s.startsWith("list:")) return { type: "list", id: s.slice(5) };
    return null;
  }

  function onDragStart(e: DragStartEvent) {
    const parsed = parseId(e.active.id);
    if (parsed?.type === "card") {
      const list = findListOfCard(parsed.id);
      setActiveCard(list?.cards.find((c) => c.id === parsed.id) ?? null);
    }
  }

  function onDragOver(e: DragOverEvent) {
    const active = parseId(e.active.id);
    const over = e.over ? parseId(e.over.id) : null;
    if (!active || active.type !== "card" || !over) return;

    const from = findListOfCard(active.id);
    const to = over.type === "list" ? lists.find((l) => l.id === over.id) : findListOfCard(over.id);
    if (!from || !to || from.id === to.id) return;

    setLists((prev) => {
      const source = prev.find((l) => l.id === from.id);
      const dest = prev.find((l) => l.id === to.id);
      if (!source || !dest) return prev;
      const card = source.cards.find((c) => c.id === active.id);
      if (!card) return prev;
      const overIndex =
        over.type === "card" ? dest.cards.findIndex((c) => c.id === over.id) : dest.cards.length;
      const nextSource = { ...source, cards: source.cards.filter((c) => c.id !== active.id) };
      const nextDestCards = [...dest.cards];
      const insertAt = overIndex < 0 ? nextDestCards.length : overIndex;
      nextDestCards.splice(insertAt, 0, { ...card, listId: dest.id });
      return prev.map((l) => {
        if (l.id === source.id) return nextSource;
        if (l.id === dest.id) return { ...dest, cards: nextDestCards };
        return l;
      });
    });
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveCard(null);
    const active = parseId(e.active.id);
    const over = e.over ? parseId(e.over.id) : null;
    if (!active) return;

    if (active.type === "list" && over?.type === "list" && active.id !== over.id) {
      const oldIndex = lists.findIndex((l) => l.id === active.id);
      const newIndex = lists.findIndex((l) => l.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;
      const next = [...lists];
      const [moved] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, moved!);
      setLists(next);
      const before = next[newIndex - 1]?.position;
      const after = next[newIndex + 1]?.position;
      onMoveList(active.id, mid(before, after));
      return;
    }

    if (active.type === "card") {
      const list = findListOfCard(active.id);
      if (!list) return;
      const idx = list.cards.findIndex((c) => c.id === active.id);
      const before = list.cards[idx - 1]?.position;
      const after = list.cards[idx + 1]?.position;
      onMoveCard(active.id, list.id, mid(before, after));
    }
  }

  function exportJson() {
    downloadJson(`sibamotor-${board.title}.json`, {
      title: board.title,
      description: board.description,
      exportedAt: new Date().toISOString(),
      people: board.people,
      labels: board.labels,
      lists: board.lists.map((l) => ({
        title: l.title,
        cards: l.cards.map((c) => ({
          title: c.title,
          notes: c.notes,
          priority: c.priority,
          startDate: c.startDate,
          dueDate: c.dueDate,
          members: c.memberIds.map((id) => {
            const p = board.people.find((x) => x.id === id);
            return p ? personName(p) : id;
          }),
          follower: (() => {
            const p = board.people.find((x) => x.id === c.followerId);
            return p ? personName(p) : null;
          })(),
          labels: c.labelIds.map((id) => board.labels.find((x) => x.id === id)?.name ?? id),
          checklists: c.checklists,
        })),
      })),
    });
    toast.success("فایل پشتیبان ذخیره شد");
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold">{board.title}</h1>
          {board.description && <p className="text-[13px] text-muted">{board.description}</p>}
          <p className="mt-1 text-[12px] text-subtle">
            {stats.queue} در صف · {stats.doing} در حال اجرا · {stats.done} تمام‌شده
            {stats.overdue > 0 ? ` · ${stats.overdue} عقب‌افتاده` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {can("manage_labels") && (
            <Button variant="secondary" size="sm" onClick={() => setLabelsOpen(true)}>
              <Tag className="size-4" />
              برچسب‌ها
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="گزینه‌های تخته">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {can("rename_board") && (
                <DropdownMenuItem onSelect={() => setRenameOpen(true)}>تغییر نام تخته</DropdownMenuItem>
              )}
              {can("sort_board") && (
                <DropdownMenuItem onSelect={() => ctx.sortByPriority()}>
                  <ArrowDownAZ className="size-4" />
                  مرتب‌سازی بر اساس اولویت
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={exportJson}>
                <Download className="size-4" />
                خروجی JSON
              </DropdownMenuItem>
              {can("archive_board") && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-danger"
                    onSelect={() => {
                      if (!confirm(`تخته «${board.title}» بایگانی شود؟`)) return;
                      void ctx.archive().then(() => navigate({ to: "/" }));
                    }}
                  >
                    بایگانی تخته
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3">
        <Chip
          active={filters.overdue}
          onClick={() => setFilters((f) => ({ ...f, overdue: !f.overdue, dueSoon: false }))}
          danger={filters.overdue}
        >
          {stats.overdue > 0 ? `عقب‌افتاده (${stats.overdue})` : "عقب‌افتاده"}
        </Chip>
        <Chip
          active={filters.dueSoon}
          onClick={() => setFilters((f) => ({ ...f, dueSoon: !f.dueSoon, overdue: false }))}
        >
          {stats.dueSoon > 0 ? `سررسید ۷ روز (${stats.dueSoon})` : "سررسید ۷ روز"}
        </Chip>
        {(["high", "med", "low"] as const).map((p) => (
          <Chip
            key={p}
            active={filters.priority === p}
            onClick={() => setFilters((f) => ({ ...f, priority: f.priority === p ? "all" : p }))}
          >
            {PRIORITY_LABEL[p]}
          </Chip>
        ))}
        {board.labels.map((l) => (
          <Chip
            key={l.id}
            active={filters.labelId === l.id}
            onClick={() => setFilters((f) => ({ ...f, labelId: f.labelId === l.id ? "all" : l.id }))}
            swatch={l.color}
          >
            {l.name}
          </Chip>
        ))}
        <label className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 text-[12px] text-muted">
          <span className="hidden sm:inline">مسئول</span>
          <select
            className="max-w-[9rem] bg-transparent text-[12px] text-fg outline-none"
            value={filters.personId}
            onChange={(e) => setFilters((f) => ({ ...f, personId: e.target.value }))}
            aria-label="فیلتر مسئول"
          >
            <option value="all">همه افراد</option>
            {board.people.map((p) => (
              <option key={p.id} value={p.id}>
                {personName(p)}
              </option>
            ))}
          </select>
        </label>
        {filterActive && (
          <button
            type="button"
            className="px-2 text-[12px] text-muted hover:text-fg"
            onClick={() => setFilters(EMPTY_FILTERS)}
          >
            پاک کردن فیلتر
          </button>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={dndDisabled ? undefined : onDragStart}
        onDragOver={dndDisabled ? undefined : onDragOver}
        onDragEnd={dndDisabled ? undefined : onDragEnd}
      >
        <div className="k-scroll flex min-h-0 flex-1 items-start gap-3 overflow-x-auto px-4 pb-6">
          <SortableContext items={visible.map((l) => listDndId(l.id))} strategy={horizontalListSortingStrategy}>
            {visible.map((list) => (
              <ListColumn
                key={list.id}
                list={list}
                people={board.people}
                labels={board.labels}
                isDoneColumn={list.id === doneId}
                canAddCard={can("create_card")}
                canRename={can("rename_list")}
                canDelete={can("delete_list")}
                canMoveList={can("move_list")}
                canMoveCard={can("move_card")}
                onOpenCard={onOpenCard}
                onAddCard={(title, templateId) => onAddCard(list.id, title, templateId)}
                isCardBlocked={isCardBlocked}
                onRename={(title) => onRenameList(list.id, title)}
                onDelete={() => onDeleteList(list.id)}
              />
            ))}
          </SortableContext>

          {can("create_list") && (
          <div className="w-[260px] shrink-0">
            {addingList ? (
              <form
                className="rounded-xl border border-border k-glass p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const t = listTitle.trim();
                  if (!t) return;
                  onAddList(t);
                  setListTitle("");
                  setAddingList(false);
                }}
              >
                <Input
                  autoFocus
                  value={listTitle}
                  onChange={(e) => setListTitle(e.target.value)}
                  placeholder="نام ستون"
                />
                <div className="mt-2 flex justify-end gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setAddingList(false)}>
                    انصراف
                  </Button>
                  <Button size="sm" type="submit">
                    افزودن
                  </Button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setAddingList(true)}
                className="flex h-11 w-full items-center justify-center gap-1 rounded-xl border border-dashed border-border-strong text-[13px] text-muted hover:bg-accent-soft hover:text-fg"
              >
                <Plus className="size-4" />
                ستون جدید
              </button>
            )}
          </div>
          )}
        </div>

        <DragOverlay>
          {activeCard ? (
            <div className="w-[260px]">
              <TaskCard
                card={activeCard}
                people={board.people}
                labels={board.labels}
                done={false}
                onOpen={() => undefined}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <LabelsDialog
        open={labelsOpen}
        onOpenChange={setLabelsOpen}
        labels={board.labels}
        onCreate={onCreateLabel}
        onDelete={onDeleteLabel}
      />

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogTitle>تغییر نام تخته</DialogTitle>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const t = boardTitle.trim();
              if (!t) return;
              ctx.renameTitle(t);
              setRenameOpen(false);
            }}
          >
            <Input value={boardTitle} onChange={(e) => setBoardTitle(e.target.value)} />
            <div className="flex justify-end">
              <Button type="submit" size="sm">
                ذخیره
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
  swatch,
  danger,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
  swatch?: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium",
        active
          ? danger
            ? "border-danger/40 bg-danger/15 text-danger"
            : "border-accent/40 bg-accent-soft text-fg"
          : "border-border bg-surface-2 text-muted hover:text-fg",
      )}
    >
      {swatch && <span className="size-2.5 rounded-full" style={{ background: swatch }} />}
      {children}
    </button>
  );
}

function LabelsDialog({
  open,
  onOpenChange,
  labels,
  onCreate,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  labels: Label[];
  onCreate: (name: string, color: string) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(LABEL_PALETTE[0]!);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>مدیریت برچسب‌ها</DialogTitle>
        <ul className="mt-4 space-y-2">
          {labels.map((l) => (
            <li key={l.id} className="flex items-center gap-2">
              <span className="h-6 w-10 rounded-sm" style={{ background: l.color }} />
              <span className="flex-1 text-sm">{l.name}</span>
              <Button
                variant="ghost"
                size="sm"
                className="text-danger"
                onClick={() => {
                  if (confirm(`برچسب «${l.name}» حذف شود؟`)) onDelete(l.id);
                }}
              >
                حذف
              </Button>
            </li>
          ))}
        </ul>
        <form
          className="mt-4 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const t = name.trim();
            if (!t) return;
            onCreate(t, color);
            setName("");
          }}
        >
          <FieldLabel>برچسب جدید</FieldLabel>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="نام" />
          <div className="flex flex-wrap gap-1.5">
            {LABEL_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="size-7 rounded-sm ring-offset-2"
                style={{ background: c, outline: color === c ? "2px solid var(--k-fg)" : undefined }}
              />
            ))}
          </div>
          <div className="flex justify-end">
            <Button type="submit" size="sm">
              افزودن
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
