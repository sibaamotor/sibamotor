// Shared workspace data layer.
//
// This used to read/write the browser's localStorage, so every user had a
// private, never-synced copy of the boards/tasks/people. Every export below
// now runs on the SERVER (via TanStack Start's `createServerFn`) against the
// `workspace_state` table in Postgres (see migrations/0002_workspace.sql), so
// every user — any device, any browser — sees the exact same data.
//
// The exported function names, input shapes (`{ data: {...} }`) and return
// types are unchanged from before on purpose, so every component that already
// calls these (board-context.tsx, workspace-layout.tsx, routes/*, ...) keeps
// working without modification.
import { createServerFn } from "@tanstack/react-start";
import { getSql } from "./db";
import { addDaysIso, isoToday } from "./jalali";
import type { Board, BoardSummary, Card, ChecklistItem, Label, List, Person, Priority } from "./types";
import { mid, nid } from "./utils";

const WORKSPACE_ID = "main";

function clampProgress(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

type Workspace = {
  people: Person[];
  boards: Board[];
};

function isWorkspace(v: unknown): v is Workspace {
  return Boolean(v) && Array.isArray((v as Workspace).boards) && Array.isArray((v as Workspace).people);
}

const CODE_TO_USER: Record<string, string> = {
  "6122": "h.mojarad",
  "13177": "a.abbasi",
  "6276": "s.aghdasi",
};

function normalizeWorkspace(ws: Workspace): Workspace {
  for (const p of ws.people) {
    if (!p.username && CODE_TO_USER[p.code]) p.username = CODE_TO_USER[p.code];
  }
  for (const b of ws.boards) {
    b.people = ws.people;
    if (!Array.isArray(b.labels)) b.labels = [];
    if (!Array.isArray(b.lists)) b.lists = [];
    for (const l of b.lists) {
      if (!Array.isArray(l.cards)) l.cards = [];
      for (const c of l.cards) {
        if (!Array.isArray(c.checklists)) c.checklists = [];
        if (!Array.isArray(c.comments)) c.comments = [];
        if (!Array.isArray(c.activities)) c.activities = [];
        if (!Array.isArray(c.dependsOnIds)) c.dependsOnIds = [];
        if (c.enteredListAt === undefined) c.enteredListAt = c.createdAt || null;
        if (!Array.isArray(c.memberIds)) c.memberIds = [];
        if (!Array.isArray(c.labelIds)) c.labelIds = [];
        for (const ch of c.checklists) {
          if (!Array.isArray(ch.items)) ch.items = [];
        }
      }
    }
  }
  return ws;
}


/** Load the single shared workspace row from Postgres, seeding it on first use. */
async function loadWorkspace(): Promise<Workspace> {
  const sql = await getSql();
  const rows = await sql<{ data: unknown }>`select data from workspace_state where id = ${WORKSPACE_ID}`;
  const raw = rows[0]?.data;
  const parsed = typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;
  if (isWorkspace(parsed)) return normalizeWorkspace(parsed);
  const seeded = createSeedWorkspace();
  await saveWorkspace(seeded);
  return seeded;
}

async function saveWorkspace(ws: Workspace): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into workspace_state (id, data, updated_at)
    values (${WORKSPACE_ID}, ${JSON.stringify(ws)}::jsonb, now())
    on conflict (id) do update set data = excluded.data, updated_at = now()
  `;
}

function findBoard(ws: Workspace, id: string): Board | undefined {
  return ws.boards.find((b) => b.id === id);
}

function allCards(board: Board): Card[] {
  return board.lists.flatMap((l) => l.cards);
}

/** Serializes the whole workspace (boards + people) for manual backup. Runs server-side. */
export const exportWorkspaceJson = createServerFn({ method: "GET" }).handler(async (): Promise<string> => {
  const ws = await loadWorkspace();
  return JSON.stringify(ws, null, 2);
});

/** Restores a workspace previously produced by exportWorkspaceJson. Replaces the SHARED workspace for everyone. */
export const importWorkspaceJson = createServerFn({ method: "POST" })
  .validator((raw: string) => raw)
  .handler(async ({ data: raw }): Promise<{ ok: true } | { ok: false; error: string }> => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, error: "فایل پشتیبان معتبر نیست (JSON خراب است)." };
    }
    if (!isWorkspace(parsed)) {
      return { ok: false, error: "ساختار فایل پشتیبان با این برنامه سازگار نیست." };
    }
    await saveWorkspace(parsed);
    return { ok: true };
  });

export const listBoards = createServerFn({ method: "GET" }).handler(async (): Promise<BoardSummary[]> => {
  const ws = await loadWorkspace();
  return ws.boards.map((b) => ({
    id: b.id,
    title: b.title,
    description: b.description,
    createdAt: b.lists[0]?.cards[0]?.createdAt ?? isoToday(),
    cardCount: allCards(b).filter((c) => !c.archived).length,
  }));
});

export const getBoard = createServerFn({ method: "GET" })
  .validator((data: { boardId: string }) => data)
  .handler(async ({ data }): Promise<Board | null> => {
    const ws = await loadWorkspace();
    const b = findBoard(ws, data.boardId);
    if (!b) return null;
    return { ...b, people: ws.people };
  });

export const createBoard = createServerFn({ method: "POST" })
  .validator((data: { title: string; description?: string }) => data)
  .handler(async ({ data }) => {
    const ws = await loadWorkspace();
    const board = newEmptyBoard(ws, data.title, data.description ?? "");
    ws.boards.unshift(board);
    await saveWorkspace(ws);
    return { id: board.id };
  });

export const renameBoard = createServerFn({ method: "POST" })
  .validator((data: { boardId: string; title: string }) => data)
  .handler(async ({ data }) => {
    const ws = await loadWorkspace();
    const b = findBoard(ws, data.boardId);
    if (b) b.title = data.title;
    await saveWorkspace(ws);
    return { ok: true as const };
  });

export const archiveBoard = createServerFn({ method: "POST" })
  .validator((data: { boardId: string }) => data)
  .handler(async ({ data }) => {
    const ws = await loadWorkspace();
    ws.boards = ws.boards.filter((b) => b.id !== data.boardId);
    await saveWorkspace(ws);
    return { ok: true as const };
  });

export const createList = createServerFn({ method: "POST" })
  .validator((data: { boardId: string; title: string; position: number }) => data)
  .handler(async ({ data }) => {
    const ws = await loadWorkspace();
    const b = findBoard(ws, data.boardId);
    if (!b) throw new Error("تخته پیدا نشد");
    const id = nid();
    b.lists.push({ id, boardId: b.id, title: data.title, position: data.position, cards: [] });
    b.lists.sort((a, c) => a.position - c.position);
    await saveWorkspace(ws);
    return { id };
  });

export const renameList = createServerFn({ method: "POST" })
  .validator((data: { id: string; title: string }) => data)
  .handler(async ({ data }) => {
    const ws = await loadWorkspace();
    for (const b of ws.boards) {
      const l = b.lists.find((x) => x.id === data.id);
      if (l) {
        l.title = data.title;
        await saveWorkspace(ws);
        return { ok: true as const };
      }
    }
    return { ok: true as const };
  });

export const deleteList = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const ws = await loadWorkspace();
    for (const b of ws.boards) {
      b.lists = b.lists.filter((l) => l.id !== data.id);
    }
    await saveWorkspace(ws);
    return { ok: true as const };
  });

export const moveList = createServerFn({ method: "POST" })
  .validator((data: { id: string; position: number }) => data)
  .handler(async ({ data }) => {
    const ws = await loadWorkspace();
    for (const b of ws.boards) {
      const l = b.lists.find((x) => x.id === data.id);
      if (l) {
        l.position = data.position;
        b.lists.sort((a, c) => a.position - c.position);
        await saveWorkspace(ws);
        return { ok: true as const };
      }
    }
    return { ok: true as const };
  });

type CardPatch = Partial<Card> & { id?: string; boardId?: string; listId?: string; title?: string };

export const createCard = createServerFn({ method: "POST" })
  .validator((data: CardPatch & { boardId: string; listId: string; title: string }) => data)
  .handler(async ({ data: d }) => {
    const ws = await loadWorkspace();
    const b = findBoard(ws, d.boardId);
    if (!b) throw new Error("تخته پیدا نشد");
    const list = b.lists.find((l) => l.id === d.listId);
    if (!list) throw new Error("ستون پیدا نشد");
    const id = nid();
    const card: Card = {
      id,
      listId: d.listId,
      boardId: d.boardId,
      title: d.title,
      notes: d.notes ?? "",
      priority: (d.priority as Priority) ?? "med",
      dueDate: d.dueDate ?? null,
      startDate: d.startDate ?? null,
      coverColor: d.coverColor ?? null,
      position: d.position ?? mid(list.cards[list.cards.length - 1]?.position, undefined),
      archived: false,
      followerId: d.followerId ?? null,
      memberIds: d.memberIds ?? [],
      labelIds: d.labelIds ?? [],
      progress: typeof d.progress === "number" ? clampProgress(d.progress) : 0,
      createdAt: isoToday(),
      checklists: Array.isArray(d.checklists) ? d.checklists : [],
      comments: [],
      activities: [{ id: nid(), at: new Date().toISOString(), by: "سیستم", text: "کارت ایجاد شد" }],
      dependsOnIds: Array.isArray(d.dependsOnIds) ? d.dependsOnIds : [],
      enteredListAt: new Date().toISOString(),
    };
    list.cards.push(card);
    await saveWorkspace(ws);
    return { id };
  });

async function applyCardPatch(d: Partial<Card> & { id: string }): Promise<{ ok: true }> {
  const ws = await loadWorkspace();
  for (const b of ws.boards) {
    for (const l of b.lists) {
      const idx = l.cards.findIndex((c) => c.id === d.id);
      if (idx < 0) continue;
      let card = l.cards[idx]!;
      if (d.listId && d.listId !== l.id) {
        const dest = b.lists.find((x) => x.id === d.listId);
        if (dest) {
          l.cards.splice(idx, 1);
          card = { ...card, listId: dest.id, enteredListAt: new Date().toISOString() };
          dest.cards.push(card);
        }
      }
      Object.assign(card, {
        ...(d.title != null ? { title: d.title } : {}),
        ...(d.notes != null ? { notes: d.notes } : {}),
        ...(d.priority != null ? { priority: d.priority } : {}),
        ...(d.dueDate !== undefined ? { dueDate: d.dueDate } : {}),
        ...(d.startDate !== undefined ? { startDate: d.startDate } : {}),
        ...(d.coverColor !== undefined ? { coverColor: d.coverColor } : {}),
        ...(d.followerId !== undefined ? { followerId: d.followerId } : {}),
        ...(d.memberIds ? { memberIds: d.memberIds } : {}),
        ...(d.labelIds ? { labelIds: d.labelIds } : {}),
        ...(d.dependsOnIds ? { dependsOnIds: d.dependsOnIds } : {}),
        ...(d.progress != null ? { progress: clampProgress(d.progress) } : {}),
        ...(d.position != null ? { position: d.position } : {}),
      });
      await saveWorkspace(ws);
      return { ok: true as const };
    }
  }
  return { ok: true as const };
}

export const updateCard = createServerFn({ method: "POST" })
  .validator((data: Partial<Card> & { id: string }) => data)
  .handler(async ({ data }) => applyCardPatch(data));

export const moveCard = createServerFn({ method: "POST" })
  .validator((data: { id: string; listId: string; position: number }) => data)
  .handler(async ({ data }) => applyCardPatch(data));


export const moveCardToBoard = createServerFn({ method: "POST" })
  .validator((data: { cardId: string; targetBoardId: string; targetListId: string }) => data)
  .handler(async ({ data }) => {
    const ws = await loadWorkspace();
    let card: Card | null = null;
    let sourceBoardId = "";
    for (const b of ws.boards) {
      for (const l of b.lists) {
        const idx = l.cards.findIndex((c) => c.id === data.cardId);
        if (idx < 0) continue;
        card = l.cards[idx]!;
        sourceBoardId = b.id;
        l.cards.splice(idx, 1);
        break;
      }
      if (card) break;
    }
    if (!card) throw new Error("کارت پیدا نشد");
    const destBoard = findBoard(ws, data.targetBoardId);
    if (!destBoard) throw new Error("تخته مقصد پیدا نشد");
    const destList = destBoard.lists.find((l) => l.id === data.targetListId);
    if (!destList) throw new Error("ستون مقصد پیدا نشد");
    const moved: Card = {
      ...card,
      boardId: data.targetBoardId,
      listId: data.targetListId,
      position: mid(destList.cards[destList.cards.length - 1]?.position, undefined),
      enteredListAt: new Date().toISOString(),
      activities: [
        {
          id: nid(),
          at: new Date().toISOString(),
          by: "سیستم",
          text: sourceBoardId === data.targetBoardId ? "جابه‌جایی ستون" : "انتقال به تخته دیگر",
        },
        ...(card.activities || []),
      ].slice(0, 50),
    };
    destList.cards.push(moved);
    await saveWorkspace(ws);
    return { ok: true as const, id: moved.id };
  });

export const deleteCard = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const ws = await loadWorkspace();
    for (const b of ws.boards) {
      for (const l of b.lists) {
        l.cards = l.cards.filter((c) => c.id !== data.id);
      }
    }
    await saveWorkspace(ws);
    return { ok: true as const };
  });

export const addComment = createServerFn({ method: "POST" })
  .validator((data: { cardId: string; body: string; author?: string }) => data)
  .handler(async ({ data }) => {
    const ws = await loadWorkspace();
    const id = nid();
    for (const b of ws.boards) {
      for (const l of b.lists) {
        const c = l.cards.find((x) => x.id === data.cardId);
        if (c) {
          c.comments.push({
            id,
            body: data.body,
            createdAt: new Date().toISOString(),
            author: data.author,
          });
          pushActivity(c, data.author || "کاربر", "نظر ثبت کرد");
          await saveWorkspace(ws);
          const mentions = Array.from(
            new Set(
              (data.body.match(/@([a-z0-9._-]+)/gi) || []).map((m) => m.slice(1).toLowerCase()),
            ),
          );
          return { id, mentions, cardTitle: c.title, boardId: c.boardId };
        }
      }
    }
    throw new Error("کارت پیدا نشد");
  });

export const saveChecklist = createServerFn({ method: "POST" })
  .validator((data: { cardId: string; id?: string; title: string; items: ChecklistItem[]; position?: number }) => data)
  .handler(async ({ data: d }) => {
    const ws = await loadWorkspace();
    for (const b of ws.boards) {
      for (const l of b.lists) {
        const c = l.cards.find((x) => x.id === d.cardId);
        if (!c) continue;
        if (d.id) {
          const ch = c.checklists.find((x) => x.id === d.id);
          if (ch) {
            ch.title = d.title;
            ch.items = d.items;
          }
        } else {
          c.checklists.push({
            id: nid(),
            title: d.title,
            items: d.items,
            position: d.position ?? (c.checklists.length + 1) * 1000,
          });
        }
        await saveWorkspace(ws);
        return { id: d.id ?? c.checklists[c.checklists.length - 1]!.id };
      }
    }
    throw new Error("کارت پیدا نشد");
  });

export const deleteChecklist = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const ws = await loadWorkspace();
    for (const b of ws.boards) {
      for (const l of b.lists) {
        for (const c of l.cards) {
          c.checklists = c.checklists.filter((ch) => ch.id !== data.id);
        }
      }
    }
    await saveWorkspace(ws);
    return { ok: true as const };
  });

function findChecklist(ws: Workspace, checklistId: string) {
  for (const b of ws.boards) {
    for (const l of b.lists) {
      for (const c of l.cards) {
        const ch = c.checklists.find((x) => x.id === checklistId);
        if (ch) return ch;
      }
    }
  }
  return undefined;
}

export const addChecklistItem = createServerFn({ method: "POST" })
  .validator((data: { checklistId: string; title: string }) => data)
  .handler(async ({ data }) => {
    const title = data.title.trim();
    if (!title) throw new Error("عنوان آیتم خالی است");
    const ws = await loadWorkspace();
    const ch = findChecklist(ws, data.checklistId);
    if (!ch) throw new Error("چک‌لیست پیدا نشد");
    if (!Array.isArray(ch.items)) ch.items = [];
    const id = nid();
    ch.items.push({ id, title, done: false });
    await saveWorkspace(ws);
    return { id };
  });

export const toggleChecklistItem = createServerFn({ method: "POST" })
  .validator((data: { checklistId: string; itemId: string }) => data)
  .handler(async ({ data }) => {
    const ws = await loadWorkspace();
    const ch = findChecklist(ws, data.checklistId);
    if (!ch) throw new Error("چک‌لیست پیدا نشد");
    const item = ch.items.find((x) => x.id === data.itemId);
    if (!item) throw new Error("آیتم پیدا نشد");
    item.done = !item.done;
    await saveWorkspace(ws);
    return { ok: true as const, done: item.done };
  });

export const deleteChecklistItem = createServerFn({ method: "POST" })
  .validator((data: { checklistId: string; itemId: string }) => data)
  .handler(async ({ data }) => {
    const ws = await loadWorkspace();
    const ch = findChecklist(ws, data.checklistId);
    if (!ch) throw new Error("چک‌لیست پیدا نشد");
    ch.items = ch.items.filter((x) => x.id !== data.itemId);
    await saveWorkspace(ws);
    return { ok: true as const };
  });


function pushActivity(card: Card, by: string, text: string) {
  if (!Array.isArray(card.activities)) card.activities = [];
  card.activities.unshift({ id: nid(), at: new Date().toISOString(), by: by || "سیستم", text });
  if (card.activities.length > 50) card.activities.length = 50;
}

export const duplicateCard = createServerFn({ method: "POST" })
  .validator((data: { cardId: string; by?: string }) => data)
  .handler(async ({ data }) => {
    const ws = await loadWorkspace();
    for (const b of ws.boards) {
      for (const l of b.lists) {
        const src = l.cards.find((c) => c.id === data.cardId);
        if (!src) continue;
        const id = nid();
        const copy: Card = {
          ...structuredClone(src),
          id,
          title: src.title + " (کپی)",
          position: mid(src.position, undefined),
          createdAt: isoToday(),
          comments: [],
          activities: [
            {
              id: nid(),
              at: new Date().toISOString(),
              by: data.by || "سیستم",
              text: "کپی از کارت «" + src.title + "»",
            },
          ],
        };
        // re-id checklists/items
        copy.checklists = (src.checklists || []).map((ch) => ({
          ...ch,
          id: nid(),
          items: (ch.items || []).map((it) => ({ ...it, id: nid() })),
        }));
        l.cards.push(copy);
        await saveWorkspace(ws);
        return { id };
      }
    }
    throw new Error("کارت پیدا نشد");
  });

export const setCardArchived = createServerFn({ method: "POST" })
  .validator((data: { cardId: string; archived: boolean; by?: string }) => data)
  .handler(async ({ data }) => {
    const ws = await loadWorkspace();
    for (const b of ws.boards) {
      for (const l of b.lists) {
        const card = l.cards.find((c) => c.id === data.cardId);
        if (!card) continue;
        card.archived = data.archived;
        pushActivity(card, data.by || "سیستم", data.archived ? "کارت بایگانی شد" : "کارت از بایگانی خارج شد");
        await saveWorkspace(ws);
        return { ok: true as const };
      }
    }
    throw new Error("کارت پیدا نشد");
  });

export const listPeople = createServerFn({ method: "GET" }).handler(async (): Promise<Person[]> => {
  const ws = await loadWorkspace();
  return ws.people;
});

export const upsertPerson = createServerFn({ method: "POST" })
  .validator((data: { id?: string; code: string; firstName: string; lastName: string; role: string; username?: string }) => data)
  .handler(async ({ data: d }) => {
    const ws = await loadWorkspace();
    const username = d.username?.trim() || undefined;
    if (d.id) {
      const p = ws.people.find((x) => x.id === d.id);
      if (p) {
        p.code = d.code;
        p.firstName = d.firstName;
        p.lastName = d.lastName;
        p.role = d.role;
        p.username = username;
      }
      await saveWorkspace(ws);
      return { id: d.id };
    }
    const id = nid();
    ws.people.push({
      id,
      code: d.code,
      firstName: d.firstName,
      lastName: d.lastName,
      role: d.role,
      username,
    });
    await saveWorkspace(ws);
    return { id };
  });

export const deletePerson = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const ws = await loadWorkspace();
    ws.people = ws.people.filter((p) => p.id !== data.id);
    for (const b of ws.boards) {
      for (const l of b.lists) {
        for (const c of l.cards) {
          c.memberIds = c.memberIds.filter((id) => id !== data.id);
          if (c.followerId === data.id) c.followerId = null;
        }
      }
    }
    await saveWorkspace(ws);
    return { ok: true as const };
  });

export const createLabel = createServerFn({ method: "POST" })
  .validator((data: { boardId: string; name: string; color: string }) => data)
  .handler(async ({ data }) => {
    const ws = await loadWorkspace();
    const b = findBoard(ws, data.boardId);
    if (!b) throw new Error("تخته پیدا نشد");
    const id = nid();
    b.labels.push({ id, name: data.name, color: data.color });
    await saveWorkspace(ws);
    return { id };
  });

export const deleteLabel = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const ws = await loadWorkspace();
    for (const b of ws.boards) {
      b.labels = b.labels.filter((l) => l.id !== data.id);
      for (const l of b.lists) {
        for (const c of l.cards) {
          c.labelIds = c.labelIds.filter((id) => id !== data.id);
        }
      }
    }
    await saveWorkspace(ws);
    return { ok: true as const };
  });

function newEmptyBoard(ws: Workspace, title: string, description: string): Board {
  const boardId = nid();
  const labels: Label[] = [
    { id: nid(), name: "برنامه‌ریزی تولید", color: "#4C8DBE" },
    { id: nid(), name: "انبار / موجودی", color: "#4E9490" },
    { id: nid(), name: "تدارکات", color: "#D9724F" },
    { id: nid(), name: "گزارش / هماهنگی", color: "#C9A24B" },
  ];
  const lists: List[] = [
    { id: nid(), boardId, title: "در صف", position: 1000, cards: [] },
    { id: nid(), boardId, title: "در حال اجرا", position: 2000, cards: [] },
    { id: nid(), boardId, title: "تمام‌شده", position: 3000, cards: [] },
  ];
  return { id: boardId, title, description, lists, people: ws.people, labels };
}

function createSeedWorkspace(): Workspace {
  const peopleSrc: { code: string; first: string; last: string; role: string }[] = [
    { code: "19499", first: "هوشنگ", last: "صداقت", role: "کارشناس برنامه ریزی" },
    { code: "6217", first: "حسین", last: "حسین پور", role: "سرپرست انبار پشتیبانی" },
    { code: "6147", first: "احمد", last: "بنی زین العابدین", role: "سرپرست انبار پیچ و مهره" },
    { code: "12338", first: "مرتضی", last: "محمودی", role: "کاردان انبار" },
    { code: "6094", first: "محمد حسن", last: "علیزاده کاشانی", role: "سرپرست UNPACK" },
    { code: "6122", first: "حسن", last: "مجرد", role: "کارشناس انبار" },
    { code: "12269", first: "ناصر", last: "پیامی", role: "کارشناس انبار" },
    { code: "6276", first: "سید صالح", last: "اقدسی علمداری", role: "کارشناس برنامه ریزی" },
    { code: "12434", first: "وحید", last: "افلاکی بدرلو", role: "کارشناس برنامه ریزی" },
    { code: "17544", first: "داریوش", last: "ملک زاده آبدار", role: "کارشناس لجستیک" },
    { code: "6083", first: "ایرج", last: "خداوندی", role: "کاردان انبار" },
    { code: "13073", first: "حسین", last: "نجفی", role: "کاردان انبار" },
    { code: "13177", first: "علی", last: "عباسی باباگنجه", role: "کارشناس انبار" },
    { code: "6173", first: "محسن", last: "شهبازی اسفستانی", role: "کارمند انبار" },
  ];
  const people: Person[] = peopleSrc.map((p) => ({
    id: `p-${p.code}`,
    code: p.code,
    firstName: p.first,
    lastName: p.last,
    role: p.role,
    username: CODE_TO_USER[p.code],
  }));
  const byLast = (last: string) => people.find((p) => p.lastName === last)?.id ?? people[0]!.id;
  const boardId = "board-main";
  const listQueue = "list-queue";
  const listDoing = "list-doing";
  const listDone = "list-done";
  const labels: Label[] = [
    { id: "lab-0", name: "برنامه‌ریزی تولید", color: "#4C8DBE" },
    { id: "lab-1", name: "انبار / موجودی", color: "#4E9490" },
    { id: "lab-2", name: "تدارکات", color: "#D9724F" },
    { id: "lab-3", name: "گزارش / هماهنگی", color: "#C9A24B" },
  ];
  const today = isoToday();

  const mk = (
    id: string,
    listId: string,
    title: string,
    notes: string,
    priority: Priority,
    pos: number,
    opts: {
      start?: string;
      due?: string;
      members: string[];
      follower?: string;
      label: number;
      cover?: string;
      progress?: number;
      checks?: { title: string; items: { title: string; done: boolean }[] }[];
    },
  ): Card => ({
    id,
    listId,
    boardId,
    title,
    notes,
    priority,
    dueDate: opts.due ?? null,
    startDate: opts.start ?? null,
    coverColor: opts.cover ?? null,
    position: pos,
    archived: false,
    followerId: opts.follower ?? null,
    memberIds: opts.members,
    labelIds: [labels[opts.label]!.id],
    progress: clampProgress(opts.progress ?? 0),
    createdAt: today,
    checklists: (opts.checks ?? []).map((ch, i) => ({
      id: `${id}-ch-${i}`,
      title: ch.title,
      position: (i + 1) * 1000,
      items: ch.items.map((it, j) => ({ id: `${id}-it-${i}-${j}`, title: it.title, done: it.done })),
    })),
    comments: [],
  });

  const queueCards: Card[] = [
    mk("c1", listQueue, "هماهنگی با تدارکات برای سفارش ورق", "نیاز خط تولید هفته آینده. حداقل موجودی ایمنی را در نظر بگیرید.", "high", 1000, {
      start: today,
      due: addDaysIso(today, 5),
      members: [byLast("ملک زاده آبدار")],
      follower: byLast("صداقت"),
      label: 2,
      cover: "#D9724F",
    }),
    mk("c2", listQueue, "گزارش هفتگی برنامه‌ریزی تولید", "جمع‌بندی پیشرفت نسبت به برنامه و گلوگاه‌های انبار.", "med", 2000, {
      start: addDaysIso(today, 1),
      due: addDaysIso(today, 6),
      members: [byLast("اقدسی علمداری"), byLast("افلاکی بدرلو")],
      follower: byLast("صداقت"),
      label: 3,
    }),
    mk("c3", listQueue, "پیگیری تأخیر تأمین‌کننده", "سفارش مهره M12 سه روز از موعد گذشته. تماس و ثبت وضعیت.", "high", 3000, {
      start: addDaysIso(today, -8),
      due: addDaysIso(today, -2),
      members: [byLast("پیامی")],
      follower: byLast("ملک زاده آبدار"),
      label: 2,
    }),
    mk("c4", listQueue, "به‌روزرسانی موجودی UNPACK", "ثبت اقلام بازشده در سیستم و انتقال به موجودی قابل برداشت.", "low", 4000, {
      due: addDaysIso(today, 10),
      members: [byLast("مجرد")],
      follower: byLast("علیزاده کاشانی"),
      label: 1,
    }),
  ];
  const doingCards: Card[] = [
    mk("c5", listDoing, "بررسی موجودی پیچ و مهره انبار", "شمارش قفسه‌های A تا D و تطبیق با سیستم. کسری را به تدارکات اعلام کنید.", "high", 1000, {
      start: addDaysIso(today, -3),
      due: addDaysIso(today, 2),
      members: [byLast("بنی زین العابدین"), byLast("محمودی")],
      follower: byLast("حسین پور"),
      label: 1,
      cover: "#4E9490",
      progress: 40,
      checks: [
        {
          title: "شمارش و تطبیق",
          items: [
            { title: "قفسه A تا B", done: true },
            { title: "قفسه C تا D", done: false },
            { title: "اعلام کسری به تدارکات", done: false },
          ],
        },
      ],
    }),
    mk("c6", listDoing, "آنپک محموله جدید", "محموله ورودی اسکله — باز کردن، برچسب‌گذاری و انتقال به قفسه UNPACK.", "med", 2000, {
      start: addDaysIso(today, -1),
      due: addDaysIso(today, 1),
      members: [byLast("علیزاده کاشانی"), byLast("نجفی")],
      follower: byLast("حسین پور"),
      label: 1,
      cover: "#4C8DBE",
      progress: 65,
      checks: [
        {
          title: "آنپک",
          items: [
            { title: "باز کردن محموله", done: true },
            { title: "برچسب‌گذاری", done: false },
            { title: "انتقال به قفسه UNPACK", done: false },
          ],
        },
      ],
    }),
  ];
  const doneCards: Card[] = [
    mk("c7", listDone, "جلسه هماهنگی انبار پشتیبانی", "مرور کارهای باز و تقسیم شیفت هفته بعد.", "med", 1000, {
      start: addDaysIso(today, -10),
      due: addDaysIso(today, -7),
      members: [byLast("حسین پور"), byLast("خداوندی")],
      follower: byLast("صداقت"),
      label: 3,
      progress: 100,
    }),
    mk("c8", listDone, "کنترل کیفیت ورود کالا", "بازرسی ظاهری و تطبیق تعداد با بارنامه.", "low", 2000, {
      start: addDaysIso(today, -12),
      due: addDaysIso(today, -9),
      members: [byLast("عباسی باباگنجه")],
      follower: byLast("حسین پور"),
      label: 1,
      progress: 100,
    }),
  ];

  const board: Board = {
    id: boardId,
    title: "واحد برنامه‌ریزی و انبار",
    description: "تخته پیگیری کارهای عقب‌مونده — سیباموتور",
    people,
    labels,
    lists: [
      { id: listQueue, boardId, title: "در صف", position: 1000, cards: queueCards },
      { id: listDoing, boardId, title: "در حال اجرا", position: 2000, cards: doingCards },
      { id: listDone, boardId, title: "تمام‌شده", position: 3000, cards: doneCards },
    ],
  };

  return { people, boards: [board] };
}
