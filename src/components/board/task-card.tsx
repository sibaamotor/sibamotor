import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, CheckSquare, Link2, UserRound } from "lucide-react";
import type { Card, Label, Person } from "@/lib/types";
import { isOverdue, isoToJalaaliStr } from "@/lib/jalali";
import { personById, personName } from "@/lib/names";
import { PRIORITY_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function cardDndId(id: string) {
  return `card:${id}`;
}

type Props = {
  card: Card;
  people: Person[];
  labels: Label[];
  done: boolean;
  blocked?: boolean;
  canMove?: boolean;
  onOpen: () => void;
};

export function TaskCard({ card, people, labels, done, blocked = false, canMove = true, onOpen }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cardDndId(card.id),
    data: { type: "card", card },
    disabled: !canMove,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const overdue = isOverdue(card.dueDate, done);
  const cardLabels = labels.filter((l) => card.labelIds.includes(l.id));
  const members = card.memberIds.map((id) => personById(people, id)).filter(Boolean) as Person[];
  const follower = personById(people, card.followerId);
  const checkTotal = card.checklists.reduce((n, c) => n + c.items.length, 0);
  const checkDone = card.checklists.reduce((n, c) => n + c.items.filter((i) => i.done).length, 0);

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      className={cn(
        "group cursor-pointer rounded-lg border border-border bg-bg-elevated shadow-[var(--shadow-card)]",
        "transition-[transform,box-shadow] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "hover:border-border-strong",
        isDragging && "opacity-40",
      )}
    >
      {card.coverColor && (
        <div className="h-8 rounded-t-lg" style={{ background: card.coverColor }} />
      )}
      <div className="p-3">
        {cardLabels.length > 0 && (
          <div className="mb-2 flex flex-wrap justify-end gap-1">
            {cardLabels.map((l) => (
              <span
                key={l.id}
                className="h-2 w-10 rounded-sm"
                style={{ background: l.color }}
                title={l.name}
              />
            ))}
          </div>
        )}
        <h3 className="text-sm font-medium leading-snug text-fg">{card.title}</h3>
        {blocked && (
          <span className="mt-1 inline-flex items-center gap-1 rounded-sm bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning">
            <Link2 className="size-3" />
            مسدود (وابستگی)
          </span>
        )}
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-200",
                card.progress >= 100 ? "bg-success" : "bg-accent",
              )}
              style={{ width: `${card.progress}%` }}
            />
          </div>
          <span className="shrink-0 text-[10px] tabular-nums text-subtle">{card.progress}٪</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-end gap-1.5">
          <span
            className={cn(
              "rounded-sm px-1.5 py-0.5 text-[10px] font-medium",
              card.priority === "high" && "bg-danger/15 text-danger",
              card.priority === "med" && "bg-warning/15 text-warning",
              card.priority === "low" && "bg-success/15 text-success",
            )}
          >
            {PRIORITY_LABEL[card.priority]}
          </span>
          {card.dueDate && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] tabular-nums",
                overdue ? "bg-danger/15 text-danger" : "text-subtle",
              )}
            >
              <Calendar className="size-3" />
              {overdue ? "عقب‌افتاده " : ""}
              {isoToJalaaliStr(card.dueDate)}
            </span>
          )}
          {checkTotal > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] tabular-nums text-subtle">
              <CheckSquare className="size-3" />
              {checkDone}/{checkTotal}
            </span>
          )}
        </div>
        {(members.length > 0 || follower) && (
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex -space-x-1 space-x-reverse">
              {members.slice(0, 4).map((m) => (
                <span
                  key={m.id}
                  title={personName(m)}
                  className="grid size-6 place-items-center rounded-full border border-bg-elevated bg-accent-soft text-[10px] font-medium"
                >
                  {m.firstName.slice(0, 1)}
                </span>
              ))}
            </div>
            {follower && (
              <span className="inline-flex items-center gap-1 text-[10px] text-subtle">
                <UserRound className="size-3" />
                {personName(follower)}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
