import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, type ReactNode } from "react";
import {
  addChecklistItem,
  addComment,
  archiveBoard,
  createCard,
  duplicateCard,
  setCardArchived,
  createLabel,
  createList,
  deleteCard,
  deleteChecklist,
  deleteChecklistItem,
  deleteLabel,
  deleteList,
  getBoard,
  moveCard,
  moveList,
  renameBoard,
  renameList,
  saveChecklist,
  toggleChecklistItem,
  updateCard,
} from "@/lib/local-db";
import { CARD_TEMPLATES } from "@/lib/constants";
import type { Board, Card, ChecklistItem } from "@/lib/types";
import { mid, nid } from "@/lib/utils";
import { pushNotification } from "@/lib/notifications";
import { toast } from "sonner";

type BoardCtx = {
  board: Board;
  search: string;
  setSearch: (q: string) => void;
  openCard: Card | null;
  setOpenCardId: (id: string | null) => void;
  addCard: (listId: string, title: string, templateId?: string) => void;
  saveCard: (patch: Partial<Card> & { id: string }) => void;
  removeCard: (id: string) => void;
  duplicate: (cardId: string, target?: { boardId?: string; listId?: string }, by?: string) => void;
  setArchived: (cardId: string, archived: boolean, by?: string) => void;
  addList: (title: string) => void;
  rename: (id: string, title: string) => void;
  removeList: (id: string) => void;
  shiftCard: (id: string, listId: string, position: number) => void;
  shiftList: (id: string, position: number) => void;
  comment: (cardId: string, body: string, author?: string) => void;
  upsertChecklist: (cardId: string, id: string | undefined, title: string, items: ChecklistItem[]) => void;
  addCheckItem: (checklistId: string, title: string) => void;
  toggleCheckItem: (checklistId: string, itemId: string) => void;
  removeCheckItem: (checklistId: string, itemId: string) => void;
  removeChecklist: (id: string) => void;
  addLabel: (name: string, color: string) => void;
  removeLabel: (id: string) => void;
  renameTitle: (title: string) => void;
  archive: () => Promise<void>;
  sortByPriority: () => void;
};

const Ctx = createContext<BoardCtx | null>(null);

export function BoardProvider({
  boardId,
  search,
  setSearch,
  openCardId,
  setOpenCardId,
  children,
}: {
  boardId: string;
  search: string;
  setSearch: (q: string) => void;
  openCardId: string | null;
  setOpenCardId: (id: string | null) => void;
  children: ReactNode;
}) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["board", boardId],
    queryFn: () => getBoard({ data: { boardId } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["board", boardId] });

  const board = q.data ?? null;
  const openCard =
    board && openCardId ? (board.lists.flatMap((l) => l.cards).find((c) => c.id === openCardId) ?? null) : null;

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await invalidate();
      void qc.invalidateQueries({ queryKey: ["boards"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در ذخیره");
    }
  };

  if (q.isLoading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <div className="h-2 w-40 overflow-hidden rounded-full bg-surface">
          <div className="k-skeleton h-full w-full" />
        </div>
      </div>
    );
  }
  if (!board) {
    return <div className="grid min-h-[50vh] place-items-center text-muted">تخته پیدا نشد.</div>;
  }

  const value: BoardCtx = {
    board,
    search,
    setSearch,
    openCard: openCard ?? null,
    setOpenCardId,
    addCard: (listId, title, templateId) => {
      const list = board.lists.find((l) => l.id === listId);
      const last = list?.cards[list.cards.length - 1];
      const tpl = templateId ? CARD_TEMPLATES.find((x) => x.id === templateId) : undefined;
      const checklists =
        tpl && tpl.checklistItems.length > 0
          ? [
              {
                id: nid(),
                title: tpl.checklistTitle || "چک‌لیست",
                position: 1000,
                items: tpl.checklistItems.map((title) => ({
                  id: nid(),
                  title,
                  done: false,
                })),
              },
            ]
          : [];
      void run(() =>
        createCard({
          data: {
            boardId,
            listId,
            title: title || tpl?.name || "کارت جدید",
            notes: tpl?.notes ?? "",
            priority: tpl?.priority ?? "med",
            checklists,
            position: mid(last?.position, undefined),
          },
        }),
      );
    },
    saveCard: (patch) => void run(() => updateCard({ data: patch })),
    removeCard: (id) =>
      void run(async () => {
        await deleteCard({ data: { id } });
        setOpenCardId(null);
      }),
    addList: (title) => {
      const last = board.lists[board.lists.length - 1];
      void run(() => createList({ data: { boardId, title, position: mid(last?.position, undefined) } }));
    },
    rename: (id, title) => void run(() => renameList({ data: { id, title } })),
    removeList: (id) => void run(() => deleteList({ data: { id } })),
    shiftCard: (id, listId, position) => void run(() => moveCard({ data: { id, listId, position } })),
    shiftList: (id, position) => void run(() => moveList({ data: { id, position } })),
    comment: (cardId, body, author) =>
      void run(async () => {
        const res = await addComment({ data: { cardId, body, author } });
        const mentions = (res as { mentions?: string[] })?.mentions ?? [];
        const cardTitle = (res as { cardTitle?: string })?.cardTitle ?? "کارت";
        const bId = (res as { boardId?: string })?.boardId ?? boardId;
        for (const m of mentions) {
          await pushNotification({
            data: {
              username: m,
              kind: "mention",
              title: `منشن در «${cardTitle}»`,
              body: body.slice(0, 120),
              href: `/b/${bId}`,
            },
          });
        }
      }),
    upsertChecklist: (cardId, id, title, items) =>
      void run(() => saveChecklist({ data: { cardId, id, title, items } })),
    addCheckItem: (checklistId, title) => void run(() => addChecklistItem({ data: { checklistId, title } })),
    toggleCheckItem: (checklistId, itemId) =>
      void run(() => toggleChecklistItem({ data: { checklistId, itemId } })),
    removeCheckItem: (checklistId, itemId) =>
      void run(() => deleteChecklistItem({ data: { checklistId, itemId } })),
    removeChecklist: (id) => void run(() => deleteChecklist({ data: { id } })),
    addLabel: (name, color) => void run(() => createLabel({ data: { boardId, name, color } })),
    removeLabel: (id) => void run(() => deleteLabel({ data: { id } })),
    renameTitle: (title) => void run(() => renameBoard({ data: { boardId, title } })),
    archive: async () => {
      await archiveBoard({ data: { boardId } });
      await qc.invalidateQueries({ queryKey: ["boards"] });
    },
    sortByPriority: () => {
      const weight: Record<string, number> = { high: 0, med: 1, low: 2 };
      void run(async () => {
        for (const list of board.lists) {
          const sorted = [...list.cards].sort((a, b) => {
            const pw = (weight[a.priority] ?? 1) - (weight[b.priority] ?? 1);
            if (pw) return pw;
            return (a.dueDate || "9999").localeCompare(b.dueDate || "9999");
          });
          for (let i = 0; i < sorted.length; i++) {
            await moveCard({
              data: { id: sorted[i]!.id, listId: list.id, position: (i + 1) * 1000 },
            });
          }
        }
      });
    },
  };

  return (
    <Ctx.Provider value={value}>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </Ctx.Provider>
  );
}

export function useBoardCtx() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBoardCtx outside provider");
  return ctx;
}

export function useBoardQuery(boardId: string) {
  return useQuery({
    queryKey: ["board", boardId],
    queryFn: () => getBoard({ data: { boardId } }),
  });
}
