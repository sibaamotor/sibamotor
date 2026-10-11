import * as Dialog from "@radix-ui/react-dialog";
import { Archive, Calendar, Check, Copy, History, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { COVER_COLORS, PRIORITY_LABEL } from "@/lib/constants";
import { isoToJalaaliLong, isoToJalaaliStr } from "@/lib/jalali";
import { personName } from "@/lib/names";
import { useLocalSession } from "@/lib/local-session";
import { usePermissions } from "@/lib/permissions-context";
import { listBoards, getBoard, moveCardToBoard } from "@/lib/local-db";
import type { Board, Card, ChecklistItem, Priority } from "@/lib/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { JalaliPicker } from "../jalali-picker";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";

type Props = {
  open: boolean;
  board: Board;
  card: Card | null;
  onClose: () => void;
  onSave: (patch: Partial<Card> & { id: string }) => void;
  onDelete: (id: string) => void;
  onDuplicate?: (cardId: string, target?: { boardId?: string; listId?: string }) => void;
  onSetArchived?: (cardId: string, archived: boolean) => void;
  onAddComment: (cardId: string, body: string, author?: string) => void;
  onSaveChecklist: (cardId: string, id: string | undefined, title: string, items: ChecklistItem[]) => void;
  onAddCheckItem: (checklistId: string, title: string) => void;
  onToggleCheckItem: (checklistId: string, itemId: string) => void;
  onRemoveCheckItem: (checklistId: string, itemId: string) => void;
  onDeleteChecklist: (id: string) => void;
};

export function CardModal({
  open,
  board,
  card,
  onClose,
  onSave,
  onDelete,
  onDuplicate,
  onSetArchived,
  onAddComment,
  onSaveChecklist,
  onAddCheckItem,
  onToggleCheckItem,
  onRemoveCheckItem,
  onDeleteChecklist,
}: Props) {
  const { user } = useLocalSession();
  const { can } = usePermissions();
  const canEdit = can("edit_card");
  const canDates = can("change_dates");
  const canPri = can("change_priority");
  const canProg = can("change_progress");
  const canAssign = can("assign_people");
  const canChecks = can("manage_checklists");
  const canComment = can("comment");
  const canDel = can("delete_card");

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<Priority>("med");
  const [progress, setProgress] = useState(0);
  const [due, setDue] = useState<string | null>(null);
  const [start, setStart] = useState<string | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [followerId, setFollowerId] = useState<string | null>(null);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [dependsOnIds, setDependsOnIds] = useState<string[]>([]);
  const [listId, setListId] = useState("");
  const [comment, setComment] = useState("");
  const [pickDue, setPickDue] = useState(false);
  const [pickStart, setPickStart] = useState(false);
  const [checkTitle, setCheckTitle] = useState("");
  const [dupOpen, setDupOpen] = useState(false);

  useEffect(() => {
    if (!card) return;
    setTitle(card.title);
    setNotes(card.notes);
    setPriority(card.priority);
    setProgress(card.progress ?? 0);
    setDue(card.dueDate);
    setStart(card.startDate);
    setCover(card.coverColor);
    setFollowerId(card.followerId);
    setMemberIds(card.memberIds);
    setLabelIds(card.labelIds);
    setDependsOnIds(card.dependsOnIds ?? []);
    setListId(card.listId);
    setComment("");
    setPickDue(false);
    setPickStart(false);
    setDupOpen(false);
  }, [card]);

  const doneListId = useMemo(() => {
    const last = board.lists[board.lists.length - 1];
    return last?.id;
  }, [board.lists]);

  if (!card) return null;

  function persist(extra: Partial<Card> = {}) {
    if (!canEdit && !("priority" in extra) && !("progress" in extra) && !("dueDate" in extra) && !("startDate" in extra) && !("memberIds" in extra) && !("followerId" in extra) && !("listId" in extra)) {
      if (!canEdit) return;
    }
    onSave({
      id: card!.id,
      title,
      notes,
      priority,
      progress,
      dueDate: due,
      startDate: start,
      coverColor: cover,
      followerId,
      memberIds,
      labelIds,
      dependsOnIds,
      listId,
      ...extra,
    });
  }

  function toggleMember(id: string) {
    if (!canAssign) return;
    const next = memberIds.includes(id) ? memberIds.filter((x) => x !== id) : [...memberIds, id];
    setMemberIds(next);
    persist({ memberIds: next });
  }
  function toggleLabel(id: string) {
    if (!canEdit) return;
    const next = labelIds.includes(id) ? labelIds.filter((x) => x !== id) : [...labelIds, id];
    setLabelIds(next);
    persist({ labelIds: next });
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            "fixed z-50 flex flex-col k-elevated shadow-[var(--shadow-flyout)]",
            "inset-0 sm:inset-auto sm:start-auto sm:end-0 sm:top-0 sm:h-dvh sm:w-[min(100%,440px)]",
            "border-s border-border",
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-left-4",
          )}
        >
          <div className="flex items-center gap-2 border-b border-border px-3 py-3">
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon-sm" className="shrink-0" aria-label="بستن">
                <X />
              </Button>
            </Dialog.Close>
            <Dialog.Title className="min-w-0 flex-1 truncate text-sm font-semibold">جزئیات کارت</Dialog.Title>
          </div>

          {cover && <div className="h-16" style={{ background: cover }} />}

          <div className="k-scroll min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
            {/* SLA-banner */}
            <div className="rounded-lg border border-border bg-accent-soft/60 px-3 py-2 text-[12px]">
              <span className="font-medium">⏱ زمان در ستون فعلی: </span>
              <span className="tabular-nums font-semibold">
                {card.enteredListAt
                  ? `${Math.max(0, Math.floor((Date.now() - new Date(card.enteredListAt).getTime()) / 86400000))} روز`
                  : "نامشخص"}
              </span>
              {card.enteredListAt && (
                <span className="text-muted"> (از {isoToJalaaliLong(card.enteredListAt.slice(0, 10))})</span>
              )}
            </div>

            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => canEdit && persist()}
              className="h-11 text-base font-semibold"
              disabled={!canEdit}
            />

            <Field label="ستون">
              <select
                className="h-10 w-full rounded-md border border-border bg-bg-elevated px-3 text-sm disabled:opacity-50"
                value={listId}
                disabled={!canEdit}
                onChange={(e) => {
                  setListId(e.target.value);
                  persist({ listId: e.target.value });
                }}
              >
                {board.lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="اولویت">
              <div className="flex gap-1">
                {(["high", "med", "low"] as Priority[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    disabled={!canPri}
                    onClick={() => {
                      setPriority(p);
                      persist({ priority: p });
                    }}
                    className={cn(
                      "h-9 flex-1 rounded-md text-[13px] font-medium disabled:opacity-50",
                      priority === p ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted",
                    )}
                  >
                    {PRIORITY_LABEL[p]}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="درصد پیشرفت">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={progress}
                  disabled={!canProg}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  onPointerUp={() => canProg && persist({ progress })}
                  onKeyUp={() => canProg && persist({ progress })}
                  className="h-2 w-full flex-1 cursor-pointer appearance-none rounded-full bg-surface-2 accent-[var(--color-accent)] disabled:opacity-50"
                />
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={progress}
                  disabled={!canProg}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                    setProgress(v);
                  }}
                  onBlur={() => canProg && persist({ progress })}
                  className="h-9 w-16 shrink-0 text-center tabular-nums"
                />
                <span className="shrink-0 text-[13px] text-subtle">٪</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-200",
                    progress >= 100 ? "bg-success" : "bg-accent",
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="شروع">
                <button
                  type="button"
                  disabled={!canDates}
                  className="flex h-10 w-full items-center justify-between rounded-md border border-border bg-bg-elevated px-3 text-sm disabled:opacity-50"
                  onClick={() => {
                    setPickStart((v) => !v);
                    setPickDue(false);
                  }}
                >
                  <span>{start ? isoToJalaaliStr(start) : "—"}</span>
                  <Calendar className="size-4 text-subtle" />
                </button>
              </Field>
              <Field label="مهلت">
                <button
                  type="button"
                  disabled={!canDates}
                  className="flex h-10 w-full items-center justify-between rounded-md border border-border bg-bg-elevated px-3 text-sm disabled:opacity-50"
                  onClick={() => {
                    setPickDue((v) => !v);
                    setPickStart(false);
                  }}
                >
                  <span>{due ? isoToJalaaliStr(due) : "—"}</span>
                  <Calendar className="size-4 text-subtle" />
                </button>
              </Field>
            </div>
            {pickStart && canDates && (
              <JalaliPicker
                value={start}
                onChange={(iso) => {
                  setStart(iso);
                  persist({ startDate: iso });
                  setPickStart(false);
                }}
              />
            )}
            {pickDue && canDates && (
              <JalaliPicker
                value={due}
                onChange={(iso) => {
                  setDue(iso);
                  persist({ dueDate: iso });
                  setPickDue(false);
                }}
              />
            )}
            {(start || due) && (
              <p className="text-[12px] text-subtle">
                {start ? `شروع: ${isoToJalaaliLong(start)}` : ""}
                {start && due ? " · " : ""}
                {due ? `مهلت: ${isoToJalaaliLong(due)}` : ""}
              </p>
            )}

            <Field label="توضیحات">
              <Textarea
                rows={4}
                value={notes}
                disabled={!canEdit}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => canEdit && persist()}
                placeholder="جزئیات کار…"
              />
            </Field>

            <Field label="برچسب">
              <div className="flex flex-wrap gap-1.5">
                {board.labels.map((l) => {
                  const on = labelIds.includes(l.id);
                  return (
                    <button
                      key={l.id}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => toggleLabel(l.id)}
                      className={cn(
                        "rounded-sm px-2 py-1 text-[12px] font-medium disabled:opacity-50",
                        on ? "ring-2 ring-fg/40" : "opacity-70",
                      )}
                      style={{ background: l.color, color: "#111" }}
                    >
                      {l.name}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="رنگ جلد">
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => {
                    setCover(null);
                    persist({ coverColor: null });
                  }}
                  className={cn(
                    "size-7 rounded-sm border border-border disabled:opacity-50",
                    !cover && "ring-2 ring-accent",
                  )}
                />
                {COVER_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => {
                      setCover(c);
                      persist({ coverColor: c });
                    }}
                    className={cn("size-7 rounded-sm disabled:opacity-50", cover === c && "ring-2 ring-fg")}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </Field>

            <Field label="مسئول اجرا">
              <div className="max-h-40 space-y-1 overflow-y-auto k-scroll rounded-md border border-border p-1">
                {board.people.map((p) => {
                  const on = memberIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={!canAssign}
                      onClick={() => toggleMember(p.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-[13px] disabled:opacity-50",
                        on ? "bg-accent-soft" : "hover:bg-surface-2",
                      )}
                    >
                      <span className="grid size-4 place-items-center rounded-sm border border-border">
                        {on && <Check className="size-3" />}
                      </span>
                      <span className="flex-1">{personName(p)}</span>
                      <span className="text-[11px] text-subtle">{p.role}</span>
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="مسئول پیگیری">
              <select
                className="h-10 w-full rounded-md border border-border bg-bg-elevated px-3 text-sm disabled:opacity-50"
                value={followerId ?? ""}
                disabled={!canAssign}
                onChange={(e) => {
                  const v = e.target.value || null;
                  setFollowerId(v);
                  persist({ followerId: v });
                }}
              >
                <option value="">بدون مسئول</option>
                {board.people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {personName(p)} — {p.role}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="چک‌لیست">
              {card.checklists.map((ch) => (
                <ChecklistBlock
                  key={ch.id}
                  title={ch.title}
                  items={ch.items}
                  locked={!canChecks}
                  onAddItem={(t) => onAddCheckItem(ch.id, t)}
                  onToggle={(itemId) => onToggleCheckItem(ch.id, itemId)}
                  onRemoveItem={(itemId) => onRemoveCheckItem(ch.id, itemId)}
                  onRename={(title0) => onSaveChecklist(card.id, ch.id, title0, ch.items)}
                  onDelete={() => onDeleteChecklist(ch.id)}
                />
              ))}
              {canChecks && (
                <div className="mt-2 flex gap-1">
                  <Input
                    value={checkTitle}
                    onChange={(e) => setCheckTitle(e.target.value)}
                    placeholder="عنوان چک‌لیست"
                    className="h-9"
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      const t = checkTitle.trim();
                      if (!t) return;
                      onSaveChecklist(card.id, undefined, t, []);
                      setCheckTitle("");
                    }}
                  />
                  <Button
                    size="sm"
                    type="button"
                    onClick={() => {
                      const t = checkTitle.trim();
                      if (!t) return;
                      onSaveChecklist(card.id, undefined, t, []);
                      setCheckTitle("");
                    }}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              )}
            </Field>

            <Field label="زمان ماندن در ستون (SLA)">
              <p className="text-[13px] tabular-nums text-muted">
                {card.enteredListAt
                  ? `${Math.max(0, Math.floor((Date.now() - new Date(card.enteredListAt).getTime()) / 86400000))} روز در ستون فعلی`
                  : "نامشخص"}
              </p>
              {card.enteredListAt && (
                <p className="mt-1 text-[11px] text-subtle">
                  ورود به ستون: {isoToJalaaliLong(card.enteredListAt.slice(0, 10))}
                </p>
              )}
            </Field>

            <MoveBoardPanel card={card} onMoved={onClose} />


            <Field label="وابستگی (مسدود شده توسط)">
              <p className="mb-2 text-[11px] text-muted">
                این کارت تا تکمیل این کارها قابل اتمام نیست.
              </p>
              <ul className="k-scroll max-h-36 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                {board.lists
                  .flatMap((l) => l.cards.map((c) => ({ ...c, listTitle: l.title })))
                  .filter((c) => c.id !== card.id && !c.archived)
                  .map((c) => {
                    const checked = dependsOnIds.includes(c.id);
                    return (
                      <li key={c.id}>
                        <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12px] hover:bg-accent-soft">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!canEdit}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...dependsOnIds, c.id]
                                : dependsOnIds.filter((x) => x !== c.id);
                              setDependsOnIds(next);
                              // auto-save dependency change
                              onSave({ id: card.id, dependsOnIds: next });
                            }}
                          />
                          <span className="min-w-0 flex-1 truncate">{c.title}</span>
                          <span className="shrink-0 text-[10px] text-subtle">{c.listTitle}</span>
                        </label>
                      </li>
                    );
                  })}
              </ul>
            </Field>

            <Field label="نظرها">
              <ul className="space-y-2">
                {card.comments.map((c) => (
                  <li key={c.id} className="rounded-md bg-surface-2 px-3 py-2 text-[13px]">
                    {c.author && <p className="text-[11px] font-medium text-muted">{c.author}</p>}
                    <p>{c.body}</p>
                    <p className="mt-1 text-[11px] text-subtle">{isoToJalaaliLong(c.createdAt.slice(0, 10))}</p>
                  </li>
                ))}
              </ul>
              {canComment && (
                <div className="mt-2 flex gap-1">
                  <Input
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="نظر… برای منشن بنویسید: @username"
                    className="h-9"
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      const t = comment.trim();
                      if (!t) return;
                      onAddComment(card.id, t, user?.displayName);
                      setComment("");
                    }}
                  />
                  <Button
                    size="sm"
                    type="button"
                    onClick={() => {
                      const t = comment.trim();
                      if (!t) return;
                      onAddComment(card.id, t, user?.displayName);
                      setComment("");
                    }}
                  >
                    ثبت
                  </Button>
                </div>
              )}
            </Field>

            <Field label="تاریخچه فعالیت">
              <ul className="k-scroll max-h-40 space-y-1.5 overflow-y-auto">
                {(card.activities ?? []).length === 0 ? (
                  <li className="text-[12px] text-muted">هنوز فعالیتی ثبت نشده.</li>
                ) : (
                  (card.activities ?? []).map((a) => (
                    <li key={a.id} className="rounded-md bg-surface-2 px-2.5 py-1.5 text-[12px]">
                      <span className="font-medium text-muted">{a.by}</span>
                      <span className="text-fg"> — {a.text}</span>
                      <span className="mt-0.5 block text-[10px] text-subtle">
                        {isoToJalaaliLong(a.at.slice(0, 10))}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </Field>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
            <div className="flex flex-wrap gap-1">
              {canDel ? (
                <Button
                  variant="ghost"
                  className="text-danger"
                  onClick={() => {
                    if (confirm(`کارت «${card.title}» حذف شود؟`)) onDelete(card.id);
                  }}
                >
                  <Trash2 className="size-4" />
                  حذف
                </Button>
              ) : null}
              {onDuplicate && canEdit ? (
                <Button variant="ghost" onClick={() => setDupOpen(true)}>
                  <Copy className="size-4" />
                  کپی به…
                </Button>
              ) : null}
              {onSetArchived && canEdit ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    onSetArchived(card.id, !card.archived);
                  }}
                >
                  <Archive className="size-4" />
                  {card.archived ? "خروج از بایگانی" : "بایگانی"}
                </Button>
              ) : null}
            </div>
            {doneListId && listId !== doneListId && canEdit && (
              <Button
                size="sm"
                onClick={() => {
                  setListId(doneListId);
                  persist({ listId: doneListId });
                }}
              >
                انتقال به تمام‌شده
              </Button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    
      {card && onDuplicate ? (
        <CopyToDialog
          open={dupOpen}
          onOpenChange={setDupOpen}
          card={card}
          board={board}
          onConfirm={(target) => {
            onDuplicate(card.id, target);
            onClose();
          }}
        />
      ) : null}
</Dialog.Root>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ChecklistBlock({
  title,
  items,
  locked,
  onAddItem,
  onToggle,
  onRemoveItem,
  onRename,
  onDelete,
}: {
  title: string;
  items: ChecklistItem[];
  locked: boolean;
  onAddItem: (title: string) => void;
  onToggle: (itemId: string) => void;
  onRemoveItem: (itemId: string) => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [localItems, setLocalItems] = useState(items);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);

  useEffect(() => {
    setLocalItems(items);
  }, [items]);
  useEffect(() => {
    setTitleDraft(title);
  }, [title]);

  const done = localItems.filter((i) => i.done).length;
  const pct = localItems.length ? Math.round((done / localItems.length) * 100) : 0;

  function addItem() {
    const t = draft.trim();
    if (!t || locked) return;
    setLocalItems((prev) => [...prev, { id: `tmp-${Date.now()}`, title: t, done: false }]);
    setDraft("");
    onAddItem(t);
  }

  return (
    <div className="mb-3 rounded-lg border border-border p-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        {editingTitle && !locked ? (
          <Input
            autoFocus
            value={titleDraft}
            className="h-8 text-[13px]"
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => {
              const t = titleDraft.trim();
              setEditingTitle(false);
              if (t && t !== title) onRename(t);
              else setTitleDraft(title);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setTitleDraft(title);
                setEditingTitle(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="min-w-0 flex-1 truncate text-start text-[13px] font-medium"
            onClick={() => !locked && setEditingTitle(true)}
          >
            {title}
          </button>
        )}
        {!locked && (
          <button type="button" className="text-subtle hover:text-danger" onClick={onDelete} aria-label="حذف چک‌لیست">
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
      <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full bg-success transition-[width] duration-200" style={{ width: `${pct}%` }} />
      </div>
      <ul className="space-y-1">
        {localItems.map((it) => (
          <li key={it.id} className="flex items-center gap-2">
            <button
              type="button"
              disabled={locked}
              onClick={() => {
                setLocalItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)));
                onToggle(it.id);
              }}
              className={cn(
                "grid size-4 place-items-center rounded-sm border border-border disabled:opacity-50",
                it.done && "bg-success text-bg",
              )}
            >
              {it.done && <Check className="size-3" />}
            </button>
            <span className={cn("flex-1 text-[13px]", it.done && "text-subtle line-through")}>{it.title}</span>
            {!locked && (
              <button
                type="button"
                className="text-subtle hover:text-danger"
                aria-label="حذف آیتم"
                onClick={() => {
                  setLocalItems((prev) => prev.filter((x) => x.id !== it.id));
                  onRemoveItem(it.id);
                }}
              >
                <X className="size-3" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {!locked && (
        <div className="mt-2 flex gap-1">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="آیتم جدید"
            className="h-8"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                addItem();
              }
            }}
          />
          <Button size="sm" variant="secondary" type="button" onClick={addItem} aria-label="افزودن آیتم">
            <Plus className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

function CopyToDialog({
  open,
  onOpenChange,
  card,
  board,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  card: Card;
  board: Board;
  onConfirm: (target: { boardId?: string; listId?: string }) => void;
}) {
  const boardsQ = useQuery({ queryKey: ["boards"], queryFn: () => listBoards(), enabled: open });
  const [targetBoardId, setTargetBoardId] = useState(card.boardId);
  const targetQ = useQuery({
    queryKey: ["board", targetBoardId, "dup-dlg"],
    queryFn: () => getBoard({ data: { boardId: targetBoardId } }),
    enabled: Boolean(targetBoardId) && open,
  });
  const lists = targetQ.data?.lists ?? board.lists;
  const [targetListId, setTargetListId] = useState(card.listId);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/40" />
        <Dialog.Content className="fixed start-1/2 top-1/2 z-[61] w-[min(92vw,400px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-bg-elevated p-5 shadow-xl">
          <Dialog.Title className="text-base font-semibold">کپی کارت به مقصد</Dialog.Title>
          <p className="mt-1 text-[12px] text-muted">تخته و ستون مقصد را انتخاب کنید.</p>
          <div className="mt-4 space-y-3">
            <div>
              <label className="text-[12px] text-muted">تخته</label>
              <select
                className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-2 text-sm"
                value={targetBoardId}
                onChange={(e) => {
                  setTargetBoardId(e.target.value);
                  setTargetListId("");
                }}
              >
                {(boardsQ.data ?? [{ id: board.id, title: board.title }]).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[12px] text-muted">ستون</label>
              <select
                className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-2 text-sm"
                value={targetListId || lists[0]?.id || ""}
                onChange={(e) => setTargetListId(e.target.value)}
              >
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                className="h-9 flex-1 rounded-lg border border-border text-sm"
                onClick={() => onOpenChange(false)}
              >
                انصراف
              </button>
              <button
                type="button"
                className="h-9 flex-1 rounded-lg bg-accent text-sm font-medium text-accent-fg"
                onClick={() => {
                  onConfirm({
                    boardId: targetBoardId,
                    listId: targetListId || lists[0]?.id,
                  });
                  onOpenChange(false);
                }}
              >
                تأیید و کپی
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function MoveBoardPanel({ card, onMoved }: { card: Card; onMoved: () => void }) {
  const qc = useQueryClient();
  const boardsQ = useQuery({ queryKey: ["boards"], queryFn: () => listBoards() });
  const [targetBoardId, setTargetBoardId] = useState(card.boardId);
  const targetQ = useQuery({
    queryKey: ["board", targetBoardId, "move"],
    queryFn: () => getBoard({ data: { boardId: targetBoardId } }),
    enabled: Boolean(targetBoardId),
  });
  const [targetListId, setTargetListId] = useState("");
  const lists = targetQ.data?.lists ?? [];
  const mut = useMutation({
    mutationFn: () =>
      moveCardToBoard({
        data: { cardId: card.id, targetBoardId, targetListId: targetListId || lists[0]?.id || "" },
      }),
    onSuccess: async () => {
      toast.success("کارت منتقل شد");
      await qc.invalidateQueries({ queryKey: ["board"] });
      await qc.invalidateQueries({ queryKey: ["boards"] });
      onMoved();
    },
    onError: (e: Error) => toast.error(e.message || "خطا در انتقال"),
  });
  return (
    <Field label="انتقال به تخته / ستون دیگر">
      <div className="space-y-2">
        <select
          className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-sm"
          value={targetBoardId}
          onChange={(e) => {
            setTargetBoardId(e.target.value);
            setTargetListId("");
          }}
        >
          {(boardsQ.data ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.title}
            </option>
          ))}
        </select>
        <select
          className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-sm"
          value={targetListId || lists[0]?.id || ""}
          onChange={(e) => setTargetListId(e.target.value)}
        >
          {lists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={mut.isPending || !lists.length}
          onClick={() => mut.mutate()}
        >
          انتقال کارت
        </Button>
      </div>
    </Field>
  );
}


