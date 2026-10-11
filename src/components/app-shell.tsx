import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Download,
  FileText,
  GanttChart,
  Archive,
  LayoutGrid,
  ListTodo,
  KeyRound,
  LogOut,
  MessageSquare,
  Palette,
  Plus,
  Search,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useLocalSession } from "@/lib/local-session";
import {
  exportWorkspaceJson,
  importWorkspaceJson,
  listArchivedBoards,
  restoreBoard,
  deleteBoardPermanently,
} from "@/lib/local-db";
import { groupUnreadCounts } from "@/lib/groups";
import { unreadCount } from "@/lib/messages";
import { usePermissions } from "@/lib/permissions-context";
import { APP_NAME } from "@/lib/constants";
import type { BoardSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AppearancePanel } from "./appearance-panel";
import { ChangePasswordDialog } from "./change-password-dialog";
import { HelpButton } from "./help-panel";
import { OnboardingTour } from "./onboarding-tour";
import { SendReportDialog } from "./send-report-dialog";
import { DailyTipPopup } from "./daily-tip-popup";
import { DueReminderPopup } from "./due-reminder-popup";
import { NotificationsBell } from "./notifications-bell";
import { LogoMark } from "./logo";
import { MessagePopup } from "./message-popup";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown";
import { Input } from "./ui/input";

type Props = {
  boards: BoardSummary[];
  boardId?: string;
  search?: string;
  onSearch?: (q: string) => void;
  onCreateBoard?: () => void;
  children: ReactNode;
};

export function AppShell({ boards, boardId, search, onSearch, onCreateBoard, children }: Props) {
  const { user, ready, isAdmin, logout } = useLocalSession();
  const { can } = usePermissions();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [forcePwd, setForcePwd] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [sendReportOpen, setSendReportOpen] = useState(false);
  useEffect(() => {
    if (!user) {
      setForcePwd(false);
      return;
    }
    if (user.mustChangePassword) {
      setForcePwd(true);
      return;
    }
    try {
      const k = `sibamotor-pwd-changed:${user.username}`;
      if (!localStorage.getItem(k)) setForcePwd(true);
      else setForcePwd(false);
    } catch {
      setForcePwd(false);
    }
  }, [user?.username, user?.mustChangePassword]);

  const importInputRef = useRef<HTMLInputElement | null>(null);

  const unreadQ = useQuery({
    queryKey: ["messages-unread", user?.username],
    queryFn: () => unreadCount({ data: { username: user!.username } }),
    enabled: Boolean(user),
    refetchInterval: 8000,
  });
  const groupUnreadQ = useQuery({
    queryKey: ["groups-unread", user?.username],
    queryFn: () => groupUnreadCounts({ data: { username: user!.username } }),
    enabled: Boolean(user),
    refetchInterval: 8000,
  });
  const unread =
    (unreadQ.data ?? 0) + Object.values(groupUnreadQ.data ?? {}).reduce((a, b) => a + b, 0);

  const nav = useMemo(() => {
    const bid = boardId ?? boards[0]?.id;
    const items: {
      to: string;
      icon: typeof LayoutGrid;
      label: string;
      match: (p: string) => boolean;
      badge?: number;
    }[] = [
      { to: bid ? `/b/${bid}` : "/", icon: LayoutGrid, label: "تخته", match: (p: string) => p.startsWith("/b/") && !p.includes("/gantt") && !p.includes("/report") },
      { to: bid ? `/b/${bid}/gantt` : "/", icon: GanttChart, label: "گانت", match: (p: string) => p.includes("/gantt") },
      { to: bid ? `/b/${bid}/report` : "/", icon: BarChart3, label: "گزارش", match: (p: string) => p.includes("/report") && !p.includes("reports-inbox") },
      { to: "/reports-inbox", icon: FileText, label: "ارسال گزارش", match: (p: string) => p.startsWith("/reports-inbox") },
      { to: "/my", icon: ListTodo, label: "کارهای من", match: (p: string) => p.startsWith("/my") },
      { to: "/messages", icon: MessageSquare, label: "پیام‌ها", match: (p: string) => p.startsWith("/messages"), badge: unread },
    ];
    if (isAdmin) {
      items.push({ to: "/admin", icon: ShieldCheck, label: "کاربران", match: (p: string) => p.startsWith("/admin") });
    }
    return items;
  }, [boardId, boards, isAdmin, unread]);

  async function handleExport() {
    try {
      const json = await exportWorkspaceJson();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sibamotor-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("فایل پشتیبان ذخیره شد.");
    } catch {
      toast.error("خطا در ساخت فایل پشتیبان.");
    }
  }

  function handleImportPick() {
    importInputRef.current?.click();
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const res = await importWorkspaceJson({ data: String(reader.result ?? "") });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("بازیابی انجام شد. صفحه بارگذاری می‌شود…");
      window.setTimeout(() => window.location.reload(), 800);
    };
    reader.onerror = () => toast.error("خطا در خواندن فایل.");
    reader.readAsText(file);
  }

  return (
    <div className="k-wallpaper flex min-h-dvh flex-col text-fg">
      <header className="k-glass sticky top-0 z-30 border-b border-border">
        <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
          <Link to="/" className="flex items-center gap-2 pe-2">
            <LogoMark className="size-7" />
            <span className="hidden text-[15px] font-semibold sm:inline">{APP_NAME}</span>
          </Link>

          <HelpButton />
            <BoardSwitcher
            boards={boards}
            boardId={boardId}
            onCreate={can("create_board") ? onCreateBoard : undefined}
          />

          <div className="mx-auto hidden max-w-sm flex-1 md:block">
            {onSearch && (
              <div className="relative">
                <Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
                <Input
                  value={search ?? ""}
                  onChange={(e) => onSearch(e.target.value)}
                  placeholder="جستجوی کارت…"
                  className="h-9 bg-surface-2 pe-9 placeholder:text-subtle"
                />
              </div>
            )}
          </div>

          <div className="ms-auto flex items-center gap-1">
            <Link
              to="/messages"
              className="relative grid size-8 place-items-center rounded-md text-muted hover:bg-accent-soft hover:text-fg"
              aria-label="پیام‌ها"
            >
              <MessageSquare className="size-4" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -start-0.5 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-danger-fg">
                  {unread > 9 ? "۹+" : unread}
                </span>
              )}
            </Link>
            <Link
              to="/people"
              className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-accent-soft hover:text-fg"
              aria-label="افراد"
              title="افراد"
            >
              <Users className="size-4" />
            </Link>
            <NotificationsBell />
            <Button variant="ghost" size="icon-sm" aria-label="ظاهر برنامه" onClick={() => setAppearanceOpen(true)}>
              <Palette />
            </Button>

            {!ready ? (
              <div className="size-8 animate-pulse rounded-full bg-accent-soft" />
            ) : user ? (
              <AccountChip
                name={user.displayName}
                username={user.username}
                role={user.role}
                signingOut={signingOut}
                onExport={handleExport}
                onImportPick={handleImportPick}
                onChangePassword={() => setPasswordOpen(true)}
                onSignOut={() => {
                  setSigningOut(true);
                  logout();
                  void navigate({ to: "/login" });
                }}
              />
            ) : null}
          </div>
        </div>
        {onSearch && (
          <div className="border-t border-border px-3 py-2 md:hidden">
            <div className="relative">
              <Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
              <Input
                value={search ?? ""}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="جستجوی کارت…"
                className="h-10 bg-surface-2 pe-9 placeholder:text-subtle"
              />
            </div>
          </div>
        )}
      </header>

      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleImportFile}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <nav className="k-glass hidden w-[72px] shrink-0 flex-col items-center gap-1 border-e border-border py-3 lg:flex">
          {nav.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                to={item.to}
                className={cn(
                  "relative flex w-16 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] transition-colors duration-150",
                  active ? "bg-accent-soft text-fg" : "text-muted hover:bg-accent-soft hover:text-fg",
                )}
              >
                <Icon className="size-5" strokeWidth={1.75} />
                {item.label}
                {item.badge ? (
                  <span className="absolute top-1 start-2 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-semibold text-danger-fg">
                    {item.badge > 9 ? "۹+" : item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col pb-20 lg:pb-0">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
        </main>
      </div>

      <nav className="k-glass fixed inset-x-0 bottom-0 z-30 border-t border-border lg:hidden">
        <div className="flex overflow-x-auto">
          {nav.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                to={item.to}
                className={cn(
                  "relative flex min-h-14 min-w-[4.5rem] flex-1 flex-col items-center justify-center gap-0.5 text-[11px]",
                  active ? "text-accent" : "text-muted",
                )}
              >
                <Icon className="size-5" strokeWidth={1.75} />
                {item.label}
                {item.badge ? (
                  <span className="absolute top-1 start-1/2 ms-2 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-semibold text-danger-fg">
                    {item.badge > 9 ? "۹+" : item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>
      <MessagePopup />
      <DailyTipPopup />
      <DueReminderPopup />
      <AppearancePanel open={appearanceOpen} onOpenChange={setAppearanceOpen} />
      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
      <ChangePasswordDialog
        open={forcePwd}
        onOpenChange={() => {}}
        forced
        onForcedDone={() => {
          try {
            if (user) localStorage.setItem(`sibamotor-pwd-changed:${user.username}`, "1");
          } catch { /* ignore */ }
          setForcePwd(false);
          setTourOpen(true);
        }}
      />
      {!forcePwd && <OnboardingTour forceOpen={tourOpen} />}
      <SendReportDialog open={sendReportOpen} onOpenChange={setSendReportOpen} />
    </div>
  );
}

function BoardSwitcher({
  boards,
  boardId,
  onCreate,
}: {
  boards: BoardSummary[];
  boardId?: string;
  onCreate?: () => void;
}) {
  const current = boards.find((b) => b.id === boardId);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const archivedQ = useQuery({
    queryKey: ["boards-archived"],
    queryFn: () => listArchivedBoards(),
  });
  const restoreMut = useMutation({
    mutationFn: (id: string) => restoreBoard({ data: { boardId: id } }),
    onSuccess: async (_r, id) => {
      toast.success("تخته از بایگانی خارج شد");
      await qc.invalidateQueries({ queryKey: ["boards"] });
      await qc.invalidateQueries({ queryKey: ["boards-archived"] });
      void navigate({ to: "/b/$boardId", params: { boardId: id } });
    },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteBoardPermanently({ data: { boardId: id } }),
    onSuccess: async () => {
      toast.success("تخته برای همیشه حذف شد");
      await qc.invalidateQueries({ queryKey: ["boards"] });
      await qc.invalidateQueries({ queryKey: ["boards-archived"] });
    },
  });
  const archived = archivedQ.data ?? [];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className="max-w-[46vw] truncate sm:max-w-xs">
          <LayoutGrid className="size-3.5" />
          <span className="truncate">{current?.title ?? "تخته‌ها"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>تخته‌های فعال</DropdownMenuLabel>
        {boards.map((b) => (
          <DropdownMenuItem
            key={b.id}
            className={cn(b.id === boardId && "bg-accent-soft")}
            onSelect={() => navigate({ to: "/b/$boardId", params: { boardId: b.id } })}
          >
            <span className="flex-1 truncate">{b.title}</span>
            <span className="tabular-nums text-[11px] text-subtle">{b.cardCount}</span>
          </DropdownMenuItem>
        ))}
        {onCreate && (
          <DropdownMenuItem onSelect={onCreate}>
            <Plus className="size-4" />
            تخته جدید
          </DropdownMenuItem>
        )}
        {archived.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>
              <span className="inline-flex items-center gap-1">
                <Archive className="size-3.5" /> بایگانی تخته‌ها
              </span>
            </DropdownMenuLabel>
            {archived.map((b) => (
              <div key={b.id} className="flex items-center gap-1 px-2 py-1">
                <span className="min-w-0 flex-1 truncate text-[13px] text-muted">{b.title}</span>
                <button
                  type="button"
                  className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-accent hover:bg-accent-soft"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    restoreMut.mutate(b.id);
                  }}
                >
                  بازگردانی
                </button>
                <button
                  type="button"
                  className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-danger hover:bg-danger/10"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (confirm(`تخته «${b.title}» برای همیشه حذف شود؟ این کار برگشت‌ناپذیر است.`)) {
                      deleteMut.mutate(b.id);
                    }
                  }}
                >
                  حذف
                </button>
              </div>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AccountChip({
  name,
  username,
  role,
  signingOut,
  onExport,
  onImportPick,
  onChangePassword,
  onSignOut,
}: {
  name: string;
  username: string;
  role: string;
  signingOut: boolean;
  onExport: () => void;
  onImportPick: () => void;
  onChangePassword: () => void;
  onSignOut: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full p-0.5 pe-2 hover:bg-accent-soft"
          aria-label="حساب کاربری"
        >
          <span className="grid size-8 place-items-center rounded-full bg-accent text-[12px] font-medium text-accent-fg">
            {name.slice(0, 1)}
          </span>
          <span className="hidden max-w-28 truncate text-[13px] sm:inline">{name}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-0.5">
            <span>{name}</span>
            <span className="text-[11px] font-normal text-muted" dir="ltr">
              {username}
            </span>
            <span className="text-[11px] font-normal text-subtle">{role}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onChangePassword}>
          <KeyRound className="size-4" />
          تغییر رمز عبور
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onExport}>
          <Download className="size-4" />
          پشتیبان‌گیری (خروجی فایل)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onImportPick}>
          <Upload className="size-4" />
          بازیابی از فایل پشتیبان
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={signingOut} onSelect={onSignOut}>
          <LogOut className="size-4" />
          {signingOut ? "در حال خروج…" : "خروج"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function BootScreen() {
  return (
    <div className="k-wallpaper grid min-h-dvh place-items-center">
      <div className="flex flex-col items-center gap-3">
        <LogoMark className="size-12" />
        <p className="text-sm font-medium text-muted">{APP_NAME}</p>
        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-surface">
          <div className="k-skeleton h-full w-full" />
        </div>
      </div>
    </div>
  );
}
