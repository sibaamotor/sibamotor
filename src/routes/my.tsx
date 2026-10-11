import { createFileRoute } from "@tanstack/react-router";
import { MyTasksView } from "@/components/my-tasks-view";
import { WorkspaceLayout } from "@/components/workspace-layout";

export const Route = createFileRoute("/my")({ component: MyPage });

function MyPage() {
  return (
    <WorkspaceLayout>
      <MyTasksView />
    </WorkspaceLayout>
  );
}
