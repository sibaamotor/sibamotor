import { createFileRoute } from "@tanstack/react-router";
import { ReportsInboxView } from "@/components/reports-inbox-view";
import { WorkspaceLayout } from "@/components/workspace-layout";

export const Route = createFileRoute("/reports-inbox")({ component: Page });

function Page() {
  return (
    <WorkspaceLayout>
      <ReportsInboxView />
    </WorkspaceLayout>
  );
}
