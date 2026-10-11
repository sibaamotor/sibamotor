import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { CARD_TEMPLATES } from "@/lib/constants";
import type { Card, Label, List, Person } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown";
import { Input } from "../ui/input";
import { cardDndId, TaskCard } from "./task-card";

export function listDndId(id: string) {
  return `list:${id}`;
}

type Props = {
  list: List;
  people: Person[];
  labels: Label[];
  isDoneColumn: boolean;
  canAddCard?: boolean;
  canRename?: boolean;
  canDelete?: boolean;
  canMoveList?: boolean;
  canMoveCard?: boolean;
  onOpenCard: (card: Card) => void;
  isCardBlocked?: (card: Card) => boolean;
  onAddCard: (title: string, templateId?: string) => void;
  onRename: (title: string) => void;
  onDelete: () => void;
};

export function ListColumn({
  list,
  people,
  labels,
  isDoneColumn,
  canAddCard = true,
  canRename = true,
  canDelete = true,
  canMoveList = true,
  canMoveCard = true,
  onOpenCard,
  isCardBlocked,
  onAddCard,
  onRename,
  onDelete,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: listDndId(list.id),
    data: { type: "list", list },
    disabled: !canMoveList,
  });
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [templateId, setTemplateId] = useState("blank");
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(list.title);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function submitAdd() {
    const t = draft.trim();
    const tpl = CARD_TEMPLATES.find((x) => x.id === templateId);
    const finalTitle = t || (templateId !== "blank" ? tpl?.name ?? "" : "");
    if (!finalTitle) {
      setAdding(false);
      return;
    }
    onAddCard(finalTitle, templateId !== "blank" ? templateId : undefined);
    setDraft("");
    setTemplateId("blank");
    setAdding(false);
  }

  function submitRename() {
    const t = title.trim();
    if (t && t !== list.title) onRename(t);
    else setTitle(list.title);
    setEditing(false);
  }

  return (
    <section
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex w-[280px] shrink-0 flex-col rounded-xl border border-border k-glass",
        isDragging && "opacity-50",
      )}
    >
      <header
        className="flex items-center gap-1 px-3 py-2.5"
        {...attributes}
        {...listeners}
      >
        {editing ? (
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={submitRename}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRename();
              if (e.key === "Escape") {
                setTitle(list.title);
                setEditing(false);
              }
            }}
            className="h-8"
          />
        ) : (
          <button
            type="button"
            className="min-w-0 flex-1 truncate text-start text-sm font-semibold"
            onDoubleClick={() => canRename && setEditing(true)}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {list.title}
          </button>
        )}
        <span className="tabular-nums text-[12px] text-subtle">{list.cards.length}</span>
        {(canRename || canDelete) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="گزینه‌های ستون" onPointerDown={(e) => e.stopPropagation()}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canRename && <DropdownMenuItem onSelect={() => setEditing(true)}>تغییر نام</DropdownMenuItem>}
            {canDelete && (
            <DropdownMenuItem
              className="text-danger"
              onSelect={() => {
                if (confirm(`ستون «${list.title}» و کارت‌هایش حذف شود؟`)) onDelete();
              }}
            >
              <Trash2 className="size-4" />
              حذف ستون
            </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        )}
      </header>

      <div className="k-scroll flex max-h-[calc(100dvh-13rem)] flex-col gap-2 overflow-y-auto px-2 pb-2">
        <SortableContext items={list.cards.map((c) => cardDndId(c.id))} strategy={verticalListSortingStrategy}>
          {list.cards.map((card) => (
            <TaskCard
              key={card.id}
              card={card}
              people={people}
              labels={labels}
              done={isDoneColumn}
              canMove={canMoveCard}
              blocked={isCardBlocked?.(card) ?? false}
              onOpen={() => onOpenCard(card)}
            />
          ))}
        </SortableContext>

        {adding && canAddCard ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitAdd();
            }}
            className="rounded-lg border border-border bg-bg-elevated p-2"
          >
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="عنوان کارت (یا از قالب)"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setAdding(false);
                  setDraft("");
                  setTemplateId("blank");
                }
              }}
            />
            <select
              className="mt-2 h-9 w-full rounded-lg border border-border bg-surface px-2 text-[12px]"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              {CARD_TEMPLATES.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  قالب: {tpl.name}
                </option>
              ))}
            </select>
            <div className="mt-2 flex justify-end gap-1">
              <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
                انصراف
              </Button>
              <Button size="sm" type="submit">
                افزودن
              </Button>
            </div>
          </form>
        ) : canAddCard ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex h-10 items-center justify-center gap-1 rounded-md text-[13px] text-muted hover:bg-accent-soft hover:text-fg"
          >
            <Plus className="size-4" />
            کارت جدید
          </button>
        ) : null}
      </div>
    </section>
  );
}
