import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { CardModal } from "@/components/board/card-modal";
import { WorkspaceLayout } from "@/components/workspace-layout";
import { BoardProvider, useBoardCtx } from "@/lib/board-context";

export const Route = createFileRoute("/b/$boardId")({ component: BoardLayout });

function BoardLayout() {
  const { boardId } = Route.useParams();
  const [search, setSearch] = useState("");
  const [openCardId, setOpenCardId] = useState<string | null>(null);

  return (
    <WorkspaceLayout boardId={boardId} search={search} onSearch={setSearch}>
      <BoardProvider
        boardId={boardId}
        search={search}
        setSearch={setSearch}
        openCardId={openCardId}
        setOpenCardId={setOpenCardId}
      >
        <Outlet />
        <BoardCardModal />
      </BoardProvider>
    </WorkspaceLayout>
  );
}

function BoardCardModal() {
  const ctx = useBoardCtx();
  return (
    <CardModal
      open={Boolean(ctx.openCard)}
      board={ctx.board}
      card={ctx.openCard}
      onClose={() => ctx.setOpenCardId(null)}
      onSave={ctx.saveCard}
      onDelete={ctx.removeCard}
      onDuplicate={(id, target) => ctx.duplicate(id, target)}
      onSetArchived={(id, archived) => ctx.setArchived(id, archived)}
      onAddComment={ctx.comment}
      onSaveChecklist={ctx.upsertChecklist}
      onAddCheckItem={ctx.addCheckItem}
      onToggleCheckItem={ctx.toggleCheckItem}
      onRemoveCheckItem={ctx.removeCheckItem}
      onDeleteChecklist={ctx.removeChecklist}
    />
  );
}
