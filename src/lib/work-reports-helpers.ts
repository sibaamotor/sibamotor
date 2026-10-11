import { getSql } from "./db";
import { nid } from "./utils";

const WORKSPACE_ID = "main";

/** Append activity on a card inside shared workspace JSON. */
export async function pushCardActivity(cardId: string, by: string, text: string): Promise<void> {
  const sql = await getSql();
  const rows = await sql<{ data: unknown }>`
    select data from workspace_state where id = ${WORKSPACE_ID}
  `;
  const raw = rows[0]?.data;
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!parsed || typeof parsed !== "object") return;
  const ws = parsed as {
    boards: Array<{
      lists: Array<{
        cards: Array<{
          id: string;
          activities?: Array<{ id: string; at: string; by: string; text: string }>;
        }>;
      }>;
    }>;
  };
  for (const b of ws.boards ?? []) {
    for (const l of b.lists ?? []) {
      const card = l.cards?.find((c) => c.id === cardId);
      if (!card) continue;
      if (!Array.isArray(card.activities)) card.activities = [];
      card.activities.unshift({
        id: nid(),
        at: new Date().toISOString(),
        by: by || "سیستم",
        text,
      });
      if (card.activities.length > 50) card.activities.length = 50;
      await sql`
        insert into workspace_state (id, data, updated_at)
        values (${WORKSPACE_ID}, ${JSON.stringify(ws)}::jsonb, now())
        on conflict (id) do update set data = excluded.data, updated_at = now()
      `;
      return;
    }
  }
}

export async function loadWorkspaceForReports() {
  return null;
}
