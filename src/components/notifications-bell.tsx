import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useMemo, useState } from "react";
import {
  listNotifications,
  markNotificationsRead,
  unreadNotificationCount,
} from "@/lib/notifications";
import { listBoards, getBoard } from "@/lib/local-db";
import { useLocalSession } from "@/lib/local-session";
import { formatRelativeFa, isOverdue, isoToday, addDaysIso, isoToJalaaliStr } from "@/lib/jalali";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown";

type FeedItem = {
  id: string;
  title: string;
  body: string;
  href?: string | null;
  at: string;
  kind: string;
  unread?: boolean;
};

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

  const boardsQ = useQuery({
    queryKey: ["boards"],
    queryFn: () => listBoards(),
    enabled: Boolean(me) && open,
  });

  const boardsFullQ = useQuery({
    queryKey: ["notif-boards-full", boardsQ.data?.map((b) => b.id)],
    queryFn: async () => {
      const boards = boardsQ.data ?? [];
      return (await Promise.all(boards.map((b) => getBoard({ data: { boardId: b.id } })))).filter(
        Boolean,
      );
    },
    enabled: Boolean(open && boardsQ.data?.length),
  });

  const derived = useMemo(() => {
    const items: FeedItem[] = [];
    const today = isoToday();
    const soon = addDaysIso(today, 3);
    const uname = me.toLowerCase();
    for (const board of boardsFullQ.data ?? []) {
      if (!board) continue;
      const doneId = board.lists[board.lists.length - 1]?.id;
      for (const list of board.lists) {
        for (const card of list.cards) {
          if (card.archived) continue;
          const mine =
            !uname ||
            board.people.some(
              (p) =>
                p.username?.toLowerCase() === uname &&
                (card.memberIds.includes(p.id) || card.followerId === p.id),
            );
          if (mine && card.dueDate) {
            const overdue = isOverdue(card.dueDate, list.id === doneId);
            if (overdue || (card.dueDate >= today && card.dueDate <= soon)) {
              items.push({
                id: `due-${card.id}`,
                title: overdue ? "سررسید گذشته" : "سررسید نزدیک",
                body: `${card.title} · ${isoToJalaaliStr(card.dueDate)}`,
                href: `/b/${board.id}`,
                at: card.dueDate + "T00:00:00.000Z",
                kind: "due",
                unread: true,
              });
            }
          }
          for (const a of (card.activities ?? []).slice(0, 3)) {
            items.push({
              id: `act-${a.id}`,
              title: "فعالیت کارت",
              body: `${card.title}: ${a.text} — ${a.by}`,
              href: `/b/${board.id}`,
              at: a.at,
              kind: "activity",
            });
          }
        }
      }
    }
    items.sort((a, b) => b.at.localeCompare(a.at));
    return items.slice(0, 20);
  }, [boardsFullQ.data, me]);

  const serverItems: FeedItem[] = (listQ.data ?? []).map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    href: n.href,
    at: n.createdAt,
    kind: n.kind,
    unread: !n.readAt,
  }));

  const feed = useMemo(() => {
    const merged = [...serverItems, ...derived];
    merged.sort((a, b) => b.at.localeCompare(a.at));
    return merged.slice(0, 25);
  }, [serverItems, derived]);

  const markMut = useMutation({
    mutationFn: (ids?: string[]) => markNotificationsRead({ data: { username: me, ids } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notif-count"] });
      void qc.invalidateQueries({ queryKey: ["notif-list"] });
    },
  });

  if (!user) return null;
  const unread = (countQ.data ?? 0) + derived.filter((d) => d.kind === "due").length;

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
          {(countQ.data ?? 0) > 0 && (
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
        {feed.length === 0 ? (
          <p className="px-2 py-4 text-center text-[12px] text-muted">اعلانی نیست</p>
        ) : (
          feed.map((n) => (
            <DropdownMenuItem
              key={n.id}
              className="flex flex-col items-stretch gap-0.5 py-2"
              onSelect={() => {
                if (!n.id.startsWith("due-") && !n.id.startsWith("act-")) {
                  markMut.mutate([n.id]);
                }
                if (n.href?.startsWith("/")) void navigate({ to: n.href as never });
              }}
            >
              <span className="flex items-center gap-2 text-[13px] font-medium">
                {n.unread && <span className="size-1.5 rounded-full bg-accent" />}
                {n.title}
              </span>
              {n.body ? <span className="text-[11px] text-muted line-clamp-2">{n.body}</span> : null}
              <span className="text-[10px] text-subtle">{formatRelativeFa(n.at)}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
