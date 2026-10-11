import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { listBoards, getBoard } from "@/lib/local-db";
import { isOverdue, isoToJalaaliStr } from "@/lib/jalali";
import { useLocalSession } from "@/lib/local-session";
import { PRIORITY_LABEL } from "@/lib/constants";
import type { Card } from "@/lib/types";
import { cn } from "@/lib/utils";

type Row = {
  boardId: string;
  boardTitle: string;
  listTitle: string;
  card: Card;
  done: boolean;
};

export function MyTasksView() {
  const { user } = useLocalSession();
  const navigate = useNavigate();
  const boardsQ = useQuery({ queryKey: ["boards"], queryFn: () => listBoards() });

  const boardQueries = useQuery({
    queryKey: ["my-tasks-boards", boardsQ.data?.map((b) => b.id)],
    queryFn: async () => {
      const boards = boardsQ.data ?? [];
      const full = await Promise.all(boards.map((b) => getBoard({ data: { boardId: b.id } })));
      return full.filter(Boolean);
    },
    enabled: Boolean(boardsQ.data?.length),
  });

  const rows = useMemo(() => {
    const out: Row[] = [];
    const uname = user?.username?.toLowerCase();
    if (!uname) return out;
    for (const board of boardQueries.data ?? []) {
      if (!board) continue;
      const doneId = board.lists[board.lists.length - 1]?.id;
      for (const list of board.lists) {
        for (const card of list.cards) {
          if (card.archived) continue;
          const people = board.people.filter(
            (p) =>
              card.memberIds.includes(p.id) || card.followerId === p.id,
          );
          const mine = people.some((p) => p.username?.toLowerCase() === uname);
          if (!mine) continue;
          out.push({
            boardId: board.id,
            boardTitle: board.title,
            listTitle: list.title,
            card,
            done: list.id === doneId,
          });
        }
      }
    }
    out.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return (a.card.dueDate || "9999").localeCompare(b.card.dueDate || "9999");
    });
    return out;
  }, [boardQueries.data, user?.username]);

  return (
    <div className="k-scroll mx-auto max-w-3xl overflow-y-auto px-4 py-5 pb-24">
      <h1 className="text-xl font-semibold">کارهای من</h1>
      <p className="mt-1 text-[13px] text-muted">
        کارت‌هایی که شما مسئول اجرا یا پیگیری آن‌ها هستید
      </p>
      {rows.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted">کاری به نام شما ثبت نشده.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((r) => {
            const overdue = isOverdue(r.card.dueDate, r.done);
            return (
              <li key={r.card.id}>
                <button
                  type="button"
                  onClick={() =>
                    void navigate({
                      to: "/b/$boardId",
                      params: { boardId: r.boardId },
                    })
                  }
                  className="flex w-full flex-col gap-1 rounded-xl border border-border k-glass px-3 py-3 text-start hover:border-border-strong"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{r.card.title}</span>
                    <span
                      className={cn(
                        "shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-medium",
                        r.card.priority === "high" && "bg-danger/15 text-danger",
                        r.card.priority === "med" && "bg-warning/15 text-warning",
                        r.card.priority === "low" && "bg-success/15 text-success",
                      )}
                    >
                      {PRIORITY_LABEL[r.card.priority]}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[12px] text-muted">
                    <span>{r.boardTitle}</span>
                    <span>·</span>
                    <span>{r.listTitle}</span>
                    {r.card.dueDate && (
                      <>
                        <span>·</span>
                        <span className={overdue ? "text-danger" : ""}>
                          {overdue ? "عقب‌افتاده " : ""}
                          {isoToJalaaliStr(r.card.dueDate)}
                        </span>
                      </>
                    )}
                    <span>·</span>
                    <span>{r.card.progress}٪</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
