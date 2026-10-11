import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useState } from "react";
import {
  listNotifications,
  markNotificationsRead,
  unreadNotificationCount,
} from "@/lib/notifications";
import { useLocalSession } from "@/lib/local-session";
import { formatRelativeFa } from "@/lib/jalali";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown";

export function NotificationsBell() {
  const { user } = useLocalSession();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const me = user?.username ?? "";

  const countQ = useQuery({
    queryKey: ["notif-count", me],
    queryFn: () => unreadNotificationCount({ data: { username: me } }),
    enabled: Boolean(me),
    refetchInterval: 15000,
  });

  const listQ = useQuery({
    queryKey: ["notif-list", me],
    queryFn: () => listNotifications({ data: { username: me } }),
    enabled: Boolean(me) && open,
  });

  const markMut = useMutation({
    mutationFn: (ids?: string[]) => markNotificationsRead({ data: { username: me, ids } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notif-count"] });
      void qc.invalidateQueries({ queryKey: ["notif-list"] });
    },
  });

  if (!user) return null;
  const unread = countQ.data ?? 0;

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) void listQ.refetch();
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="اعلان‌ها" className="relative">
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -start-0.5 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-danger-fg">
              {unread > 9 ? "۹+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>اعلان‌ها</span>
          {unread > 0 && (
            <button
              type="button"
              className="text-[11px] font-normal text-accent hover:underline"
              onClick={() => markMut.mutate(undefined)}
            >
              خواندن همه
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(listQ.data ?? []).length === 0 ? (
          <p className="px-2 py-4 text-center text-[12px] text-muted">اعلانی نیست</p>
        ) : (
          (listQ.data ?? []).slice(0, 15).map((n) => (
            <DropdownMenuItem
              key={n.id}
              className="flex flex-col items-stretch gap-0.5 py-2"
              onSelect={() => {
                markMut.mutate([n.id]);
                if (n.href) {
                  if (n.href.startsWith("/")) void navigate({ to: n.href as never });
                }
              }}
            >
              <span className="text-[13px] font-medium">{n.title}</span>
              {n.body ? <span className="text-[11px] text-muted line-clamp-2">{n.body}</span> : null}
              <span className="text-[10px] text-subtle">{formatRelativeFa(n.createdAt)}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
