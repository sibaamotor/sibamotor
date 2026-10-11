import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  CheckCheck,
  MessageSquare,
  MoreVertical,
  Pencil,
  File as FileIcon,
  Paperclip,
  Plus,
  Send,
  Settings2,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown";
import { EmojiPicker } from "@/components/emoji-picker";
import {
  addGroupMember,
  clearGroupMessages,
  createGroup,
  deleteGroupMessage,
  editGroupMessage,
  groupUnreadCounts,
  listGroupMessages,
  listGroupReads,
  listMyGroups,
  markGroupRead,
  removeGroupMember,
  renameGroup,
  sendGroupMessage,
  type GroupMessage,
} from "@/lib/groups";
import { formatRelativeFa, formatTimeFa, isoToJalaaliStr } from "@/lib/jalali";
import { useLocalSession } from "@/lib/local-session";
import { listLocalUsers, type LocalUser } from "@/lib/local-users";
import { isSoundEnabled, playReceiveSound, playSendSound, setSoundEnabled } from "@/lib/message-sounds";
import {
  clearConversation,
  deleteMessage,
  editMessage,
  listMyMessages,
  markConversationRead,
  sendMessage,
  type ChatMessage,
} from "@/lib/messages";
import {
  decodeFileBody,
  decodeFileRef,
  encodeFileRef,
  formatFileSize,
  isFileBody,
  isFileRefBody,
  readFileAsBase64,
} from "@/lib/chat-file";
import { getAppFile, uploadAppFile } from "@/lib/files";
import { cn, initials } from "@/lib/utils";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

type Props = { initialTo?: string };

type Active = { kind: "dm"; id: string } | { kind: "group"; id: string } | null;

type Conversation = {
  other: LocalUser;
  last?: ChatMessage;
  unread: number;
  messages: ChatMessage[];
};

export function MessagesView({ initialTo }: Props) {
  const { user } = useLocalSession();
  const qc = useQueryClient();
  const me = user?.username ?? "";
  const [active, setActive] = useState<Active>(initialTo ? { kind: "dm", id: initialTo } : null);
  const [draft, setDraft] = useState("");
  const [fileSending, setFileSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; fromDisplayName: string; body: string } | null>(null);
  const [filter, setFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [soundOn, setSoundOn] = useState(true);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [manageGroupOpen, setManageGroupOpen] = useState(false);
  const [addMemberUser, setAddMemberUser] = useState("");
  const [groupRenameName, setGroupRenameName] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const seenMsgIds = useRef<Set<string> | null>(null);
  const seenGroupMsgIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    setSoundOn(isSoundEnabled());
  }, []);

  const usersQ = useQuery({ queryKey: ["local-users"], queryFn: () => listLocalUsers() });
  const msgQ = useQuery({
    queryKey: ["messages", me],
    queryFn: () => listMyMessages({ data: { username: me } }),
    enabled: Boolean(me),
    refetchInterval: 6000,
  });
  const groupsQ = useQuery({
    queryKey: ["groups", me],
    queryFn: () => listMyGroups({ data: { username: me } }),
    enabled: Boolean(me),
    refetchInterval: 8000,
  });
  const groupUnreadQ = useQuery({
    queryKey: ["groups-unread", me],
    queryFn: () => groupUnreadCounts({ data: { username: me } }),
    enabled: Boolean(me),
    refetchInterval: 8000,
  });

  const activeGroupId = active?.kind === "group" ? active.id : null;
  const groupMsgQ = useQuery({
    queryKey: ["group-messages", activeGroupId, me],
    queryFn: () => listGroupMessages({ data: { groupId: activeGroupId!, username: me } }),
    enabled: Boolean(activeGroupId && me),
    refetchInterval: 5000,
  });
  const groupReadsQ = useQuery({
    queryKey: ["group-reads", activeGroupId],
    queryFn: () => listGroupReads({ data: { groupId: activeGroupId! } }),
    enabled: Boolean(activeGroupId),
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (initialTo) setActive({ kind: "dm", id: initialTo });
  }, [initialTo]);

  // Play a chirp whenever a message addressed to me shows up for the first time.
  useEffect(() => {
    const msgs = msgQ.data ?? [];
    if (seenMsgIds.current === null) {
      seenMsgIds.current = new Set(msgs.map((m) => m.id));
      return;
    }
    const fresh = msgs.filter((m) => m.toUsername === me && !seenMsgIds.current!.has(m.id));
    if (fresh.length > 0) playReceiveSound();
    seenMsgIds.current = new Set(msgs.map((m) => m.id));
  }, [msgQ.data, me]);

  useEffect(() => {
    const msgs = groupMsgQ.data ?? [];
    if (seenGroupMsgIds.current === null) {
      seenGroupMsgIds.current = new Set(msgs.map((m) => m.id));
      return;
    }
    const fresh = msgs.filter((m) => m.fromUsername !== me && !seenGroupMsgIds.current!.has(m.id));
    if (fresh.length > 0) playReceiveSound();
    seenGroupMsgIds.current = new Set(msgs.map((m) => m.id));
  }, [groupMsgQ.data, me]);

  const others = useMemo(
    () => (usersQ.data ?? []).filter((u) => u.username !== me),
    [usersQ.data, me],
  );

  const conversations = useMemo<Conversation[]>(() => {
    const msgs = msgQ.data ?? [];
    return others
      .map((other) => {
        const thread = msgs.filter(
          (m) =>
            (m.fromUsername === other.username && m.toUsername === me) ||
            (m.fromUsername === me && m.toUsername === other.username),
        );
        const last = thread[thread.length - 1];
        const unread = thread.filter((m) => m.toUsername === me && !m.readAt).length;
        return { other, last, unread, messages: thread };
      })
      .sort((a, b) => (b.last?.createdAt ?? "").localeCompare(a.last?.createdAt ?? ""));
  }, [others, msgQ.data, me]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.other.displayName.toLowerCase().includes(q) ||
        c.other.username.includes(q) ||
        c.other.role.toLowerCase().includes(q),
    );
  }, [conversations, filter]);

  const groups = groupsQ.data ?? [];
  const visibleGroups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, filter]);

  const currentDm = active?.kind === "dm" ? (conversations.find((c) => c.other.username === active.id) ?? null) : null;
  const currentGroup = active?.kind === "group" ? (groups.find((g) => g.id === active.id) ?? null) : null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentDm?.messages.length, currentGroup?.id, groupMsgQ.data?.length, active]);

  useEffect(() => {
    if (!me || active?.kind !== "dm") return;
    const conv = conversations.find((c) => c.other.username === active.id);
    if (!conv || conv.unread === 0) return;
    void markConversationRead({ data: { username: me, other: active.id } }).then(() => {
      void qc.invalidateQueries({ queryKey: ["messages"] });
      void qc.invalidateQueries({ queryKey: ["messages-unread"] });
      void qc.invalidateQueries({ queryKey: ["messages-unread-list"] });
    });
  }, [me, active, conversations, qc]);

  useEffect(() => {
    if (!me || active?.kind !== "group") return;
    void markGroupRead({ data: { username: me, groupId: active.id } }).then(() => {
      void qc.invalidateQueries({ queryKey: ["groups-unread"] });
      void qc.invalidateQueries({ queryKey: ["group-reads"] });
    });
  }, [me, active, groupMsgQ.data, qc]);

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  }

  const sendMut = useMutation({
    mutationFn: (body: string) =>
      sendMessage({
        data: { from: me, to: active!.id, body, replyToId: replyTo?.id ?? null },
      }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      playSendSound();
      setDraft("");
      setReplyTo(null);
      void qc.invalidateQueries({ queryKey: ["messages"] });
      void qc.invalidateQueries({ queryKey: ["messages-unread"] });
    },
  });

  const sendGroupMut = useMutation({
    mutationFn: (body: string) =>
      sendGroupMessage({ data: { from: me, groupId: active!.id, body, replyToId: replyTo?.id ?? null } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      playSendSound();
      setDraft("");
      setReplyTo(null);
      void qc.invalidateQueries({ queryKey: ["group-messages"] });
      void qc.invalidateQueries({ queryKey: ["groups-unread"] });
    },
  });

  const editDmMut = useMutation({
    mutationFn: (vars: { id: string; body: string }) =>
      editMessage({ data: { username: me, id: vars.id, body: vars.body } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setEditingId(null);
      void qc.invalidateQueries({ queryKey: ["messages"] });
    },
  });

  const deleteDmMut = useMutation({
    mutationFn: (id: string) => deleteMessage({ data: { username: me, id } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      void qc.invalidateQueries({ queryKey: ["messages"] });
    },
  });

  const editGroupMut = useMutation({
    mutationFn: (vars: { id: string; body: string }) =>
      editGroupMessage({ data: { username: me, id: vars.id, body: vars.body } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setEditingId(null);
      void qc.invalidateQueries({ queryKey: ["group-messages"] });
    },
  });

  const deleteGroupMut = useMutation({
    mutationFn: (id: string) => deleteGroupMessage({ data: { username: me, id } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      void qc.invalidateQueries({ queryKey: ["group-messages"] });
    },
  });

  const createGroupMut = useMutation({
    mutationFn: () => createGroup({ data: { by: me, name: groupName, members: groupMembers } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setGroupDialogOpen(false);
      setGroupName("");
      setGroupMembers([]);
      void qc.invalidateQueries({ queryKey: ["groups"] });
      setActive({ kind: "group", id: res.id });
    },
  });

  const addMemberMut = useMutation({
    mutationFn: (username: string) =>
      addGroupMember({ data: { by: me, groupId: active?.kind === "group" ? active.id : "", username } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("عضو اضافه شد");
      setAddMemberUser("");
      void qc.invalidateQueries({ queryKey: ["groups"] });
    },
  });

  const removeMemberMut = useMutation({
    mutationFn: (username: string) =>
      removeGroupMember({ data: { by: me, groupId: active?.kind === "group" ? active.id : "", username } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("عضو حذف شد");
      void qc.invalidateQueries({ queryKey: ["groups"] });
    },
  });

  const clearGroupMut = useMutation({
    mutationFn: () =>
      clearGroupMessages({ data: { by: me, groupId: active?.kind === "group" ? active.id : "" } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("چت گروه پاک شد");
      setManageGroupOpen(false);
      void qc.invalidateQueries({ queryKey: ["group-messages"] });
    },
  });

  const renameGroupMut = useMutation({
    mutationFn: (name: string) =>
      renameGroup({ data: { by: me, groupId: active?.kind === "group" ? active.id : "", name } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("نام گروه تغییر کرد");
      void qc.invalidateQueries({ queryKey: ["groups"] });
    },
  });

  const clearDmMut = useMutation({
    mutationFn: (other: string) => clearConversation({ data: { username: me, other } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("گفتگو پاک شد");
      void qc.invalidateQueries({ queryKey: ["messages"] });
    },
  });

  function submit() {
    const t = draft.trim();
    if (!t || !active || sendMut.isPending || sendGroupMut.isPending) return;
    if (active.kind === "dm") sendMut.mutate(t);
    else sendGroupMut.mutate(t);
  }

  async function submitFile(file: File) {
    if (!active || sendMut.isPending || sendGroupMut.isPending || fileSending) return;
    setFileSending(true);
    try {
      const payload = await readFileAsBase64(file);
      const up = await uploadAppFile({
        data: {
          filename: payload.name,
          mime: payload.mime,
          sizeBytes: payload.size,
          dataBase64: payload.data,
          uploadedBy: me,
        },
      });
      if (!up.ok) {
        toast.error(up.error);
        return;
      }
      const body = encodeFileRef({
        fileId: up.id,
        name: payload.name,
        mime: payload.mime,
        size: payload.size,
      });
      if (active.kind === "dm") sendMut.mutate(body);
      else sendGroupMut.mutate(body);
      playSendSound();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ارسال فایل ناموفق بود.");
    } finally {
      setFileSending(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function startEdit(id: string, body: string) {
    setEditingId(id);
    setEditingBody(body);
  }

  function saveEdit() {
    const t = editingBody.trim();
    if (!t || !editingId) return;
    if (active?.kind === "dm") editDmMut.mutate({ id: editingId, body: t });
    else editGroupMut.mutate({ id: editingId, body: t });
  }

  function askDelete(id: string) {
    if (!window.confirm("این پیام حذف شود؟")) return;
    if (active?.kind === "dm") deleteDmMut.mutate(id);
    else deleteGroupMut.mutate(id);
  }

  if (!user) return null;

  const headerTitle = currentDm ? currentDm.other.displayName : currentGroup?.name;

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <aside
        className={cn(
          "flex w-full shrink-0 flex-col border-e border-border lg:w-[300px]",
          active ? "hidden lg:flex" : "flex",
        )}
      >
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h1 className="text-lg font-semibold">پیام‌ها</h1>
              <p className="text-[12px] text-muted">گفتگو با همکاران واحد</p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={soundOn ? "قطع صدا" : "فعال‌سازی صدا"}
                onClick={toggleSound}
                title={soundOn ? "صدای پیام‌ها فعال است" : "صدای پیام‌ها خاموش است"}
              >
                {soundOn ? <Volume2 /> : <VolumeX />}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="گروه جدید"
                onClick={() => setGroupDialogOpen(true)}
                title="ایجاد گروه جدید"
              >
                <Plus />
              </Button>
            </div>
          </div>
          <Input
            className="mt-2 h-9"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="جستجوی همکار یا گروه…"
          />
        </div>
        <ul className="k-scroll min-h-0 flex-1 overflow-y-auto">
          {visible.length === 0 && visibleGroups.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-muted">چیزی برای پیام پیدا نشد.</li>
          ) : (
            <>
              {visibleGroups.map((g) => {
                const on = active?.kind === "group" && active.id === g.id;
                const unread = (groupUnreadQ.data ?? {})[g.id] ?? 0;
                return (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() => setActive({ kind: "group", id: g.id })}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-accent-soft",
                        on && "bg-accent-soft",
                      )}
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-fg">
                        <Users className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">{g.name}</span>
                        </span>
                        <span className="mt-0.5 flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-[12px] text-muted">
                            {g.members.length} عضو
                          </span>
                          {unread > 0 && (
                            <span className="grid min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[10px] font-semibold text-accent-fg">
                              {unread}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
              {visible.map((c) => {
                const on = active?.kind === "dm" && active.id === c.other.username;
                return (
                  <li key={c.other.username}>
                    <button
                      type="button"
                      onClick={() => setActive({ kind: "dm", id: c.other.username })}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-accent-soft",
                        on && "bg-accent-soft",
                      )}
                    >
                      <Avatar name={c.other.displayName} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">{c.other.displayName}</span>
                          {c.last && (
                            <span className="shrink-0 text-[11px] text-subtle">
                              {formatRelativeFa(c.last.createdAt)}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-[12px] text-muted">
                            {c.last?.deletedAt ? "این پیام حذف شد" : c.last?.body || c.other.role}
                          </span>
                          {c.unread > 0 && (
                            <span className="grid min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[10px] font-semibold text-accent-fg">
                              {c.unread}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </>
          )}
        </ul>
      </aside>

      <section className={cn("flex min-w-0 flex-1 flex-col", !active && "hidden lg:flex")}>
        {!currentDm && !currentGroup ? (
          <div className="grid flex-1 place-items-center px-6 text-center">
            <div>
              <MessageSquare className="mx-auto size-10 text-subtle" strokeWidth={1.5} />
              <p className="mt-3 text-sm font-medium">یک گفتگو را انتخاب کنید</p>
              <p className="mt-1 text-[13px] text-muted">از فهرست سمت راست برای شروع پیام استفاده کنید.</p>
            </div>
          </div>
        ) : (
          <>
            <header className="flex items-center gap-2 border-b border-border px-3 py-2.5">
              <Button
                variant="ghost"
                size="icon-sm"
                className="lg:hidden"
                aria-label="بازگشت"
                onClick={() => setActive(null)}
              >
                <ArrowRight />
              </Button>
              {currentGroup ? (
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-fg">
                  <Users className="size-5" />
                </span>
              ) : (
                <Avatar name={currentDm!.other.displayName} />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{headerTitle}</p>
                <p className="truncate text-[12px] text-muted">
                  {currentGroup ? (
                    `${currentGroup.members.length} عضو`
                  ) : (
                    <>
                      {currentDm!.other.role} · <span dir="ltr">{currentDm!.other.username}</span>
                    </>
                  )}
                </p>
              </div>
              {currentGroup ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="مدیریت گروه"
                  onClick={() => {
                    setGroupRenameName(currentGroup.name);
                    setManageGroupOpen(true);
                  }}
                >
                  <Settings2 className="size-4" />
                </Button>
              ) : currentDm ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="پاک کردن گفتگو"
                  onClick={() => {
                    if (confirm("همه پیام‌های این گفتگو پاک شوند؟")) {
                      clearDmMut.mutate(currentDm.other.username);
                    }
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </header>

            <div className="k-scroll min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4">
              {currentGroup ? (
                <GroupThread
                  me={me}
                  messages={groupMsgQ.data ?? []}
                  reads={groupReadsQ.data ?? []}
                  members={currentGroup.members}
                  editingId={editingId}
                  editingBody={editingBody}
                  onEditingBodyChange={setEditingBody}
                  onSaveEdit={saveEdit}
                  onCancelEdit={() => setEditingId(null)}
                  onStartEdit={startEdit}
                  onDelete={askDelete}
                  onReply={(m) => setReplyTo({ id: m.id, fromDisplayName: m.fromDisplayName, body: m.body })}
                />
              ) : (
                <DmThread
                  me={me}
                  messages={currentDm!.messages}
                  editingId={editingId}
                  editingBody={editingBody}
                  onEditingBodyChange={setEditingBody}
                  onSaveEdit={saveEdit}
                  onCancelEdit={() => setEditingId(null)}
                  onStartEdit={startEdit}
                  onDelete={askDelete}
                  onReply={(m) => setReplyTo({ id: m.id, fromDisplayName: m.fromDisplayName, body: m.body })}
                />
              )}
              <div ref={bottomRef} />
            </div>

            <footer className="border-t border-border p-3">
              {replyTo && (
                <div className="mb-2 flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2 text-[12px]">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">پاسخ به {replyTo.fromDisplayName}</p>
                    <p className="line-clamp-2 text-muted">{replyTo.body}</p>
                  </div>
                  <button type="button" className="text-subtle hover:text-fg" onClick={() => setReplyTo(null)} aria-label="لغو پاسخ">
                    <X className="size-4" />
                  </button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void submitFile(f);
                }}
              />
              <div className="flex items-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="ارسال فایل"
                  disabled={!active || sendMut.isPending || sendGroupMut.isPending || fileSending}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="size-4" />
                </Button>
                <EmojiPicker onPick={(e) => setDraft((d) => d + e)} />
                <Textarea
                  rows={2}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="پیام خود را بنویسید… (Enter برای ارسال)"
                  className="min-h-12 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="icon"
                  disabled={!draft.trim() || sendMut.isPending || sendGroupMut.isPending || fileSending}
                  onClick={submit}
                  aria-label="ارسال"
                >
                  <Send />
                </Button>
              </div>
            </footer>
          </>
        )}
      </section>

      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent>
          <DialogTitle>ایجاد گروه جدید</DialogTitle>
          <DialogDescription>یک نام برای گروه انتخاب کنید و همکاران را اضافه کنید.</DialogDescription>
          <div className="mt-4 space-y-3">
            <Input
              placeholder="نام گروه"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
            <div>
              <p className="mb-2 text-[12px] font-medium text-muted">اعضا</p>
              <ul className="k-scroll max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                {others.map((u) => {
                  const checked = groupMembers.includes(u.username);
                  return (
                    <li key={u.username}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent-soft">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setGroupMembers((prev) =>
                              e.target.checked
                                ? [...prev, u.username]
                                : prev.filter((x) => x !== u.username),
                            );
                          }}
                        />
                        <span className="flex-1 truncate">{u.displayName}</span>
                        <span className="text-[11px] text-subtle">{u.role}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
            <Button
              className="w-full"
              disabled={!groupName.trim() || groupMembers.length === 0 || createGroupMut.isPending}
              onClick={() => createGroupMut.mutate()}
            >
              ایجاد گروه
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={manageGroupOpen} onOpenChange={setManageGroupOpen}>
        <DialogContent>
          <DialogTitle>مدیریت گروه</DialogTitle>
          <DialogDescription>
            {currentGroup ? currentGroup.name : "گروه"}
          </DialogDescription>
          {currentGroup ? (
            <div className="mt-4 space-y-4">
              <div>
                <p className="mb-2 text-[12px] font-medium text-muted">اعضای فعلی</p>
                <ul className="k-scroll max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                  {currentGroup.members.map((uname) => {
                    const u = (usersQ.data ?? []).find((x) => x.username === uname);
                    const isCreator = currentGroup.createdBy === me;
                    return (
                      <li key={uname} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
                        <span className="flex-1 truncate">
                          {u?.displayName ?? uname}
                          {uname === currentGroup.createdBy ? (
                            <span className="ms-1 text-[10px] text-subtle">(سازنده)</span>
                          ) : null}
                        </span>
                        {isCreator && uname !== me ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="حذف عضو"
                            disabled={removeMemberMut.isPending}
                            onClick={() => {
                              if (confirm(`حذف ${u?.displayName ?? uname} از گروه؟`)) {
                                removeMemberMut.mutate(uname);
                              }
                            }}
                          >
                            <UserMinus className="size-4 text-danger" />
                          </Button>
                        ) : uname === me ? (
                          <span className="text-[11px] text-subtle">شما</span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
              {currentGroup.createdBy === me ? (
                <>
                  <div>
                    <p className="mb-2 text-[12px] font-medium text-muted">تغییر نام گروه</p>
                    <div className="flex gap-2">
                      <Input
                        value={groupRenameName}
                        onChange={(e) => setGroupRenameName(e.target.value)}
                        placeholder="نام جدید"
                      />
                      <Button
                        disabled={!groupRenameName.trim() || renameGroupMut.isPending}
                        onClick={() => renameGroupMut.mutate(groupRenameName.trim())}
                      >
                        ذخیره
                      </Button>
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-[12px] font-medium text-muted">افزودن عضو</p>
                    <div className="flex gap-2">
                      <select
                        className="h-10 flex-1 rounded-lg border border-border bg-surface px-2 text-sm"
                        value={addMemberUser}
                        onChange={(e) => setAddMemberUser(e.target.value)}
                      >
                        <option value="">انتخاب کاربر…</option>
                        {(usersQ.data ?? [])
                          .filter((u) => u.username !== me && !currentGroup.members.includes(u.username))
                          .map((u) => (
                            <option key={u.username} value={u.username}>
                              {u.displayName}
                            </option>
                          ))}
                      </select>
                      <Button
                        disabled={!addMemberUser || addMemberMut.isPending}
                        onClick={() => addMemberMut.mutate(addMemberUser)}
                      >
                        <UserPlus className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    className="w-full text-danger"
                    disabled={clearGroupMut.isPending}
                    onClick={() => {
                      if (confirm("همه پیام‌های این گروه پاک شوند؟ این کار قابل برگشت نیست.")) {
                        clearGroupMut.mutate();
                      }
                    }}
                  >
                    پاک کردن همه پیام‌های گروه
                  </Button>
                </>
              ) : (
                <p className="text-[12px] text-muted">
                  فقط سازنده گروه می‌تواند نام را عوض کند، عضو اضافه/حذف کند یا چت را پاک کند.
                </p>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

type ThreadActionsProps = {
  editingId: string | null;
  editingBody: string;
  onEditingBodyChange: (v: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onStartEdit: (id: string, body: string) => void;
  onDelete: (id: string) => void;
};

function DmThread({
  me,
  messages,
  onReply,
  ...actions
}: ThreadActionsProps & {
  me: string;
  messages: ChatMessage[];
  onReply: (m: ChatMessage) => void;
}) {
  if (messages.length === 0) {
    return <p className="py-10 text-center text-sm text-muted">هنوز پیامی نیست. اولین پیام را بفرستید.</p>;
  }
  return (
    <>
      {messages.map((m) => {
        const mine = m.fromUsername === me;
        return (
          <MessageBubble
            key={m.id}
            id={m.id}
            mine={mine}
            body={m.body}
            createdAt={m.createdAt}
            editedAt={m.editedAt}
            deleted={Boolean(m.deletedAt)}
            replyFromName={m.replyFromName}
            replyBody={m.replyBody}
            tick={mine ? (m.readAt ? "read" : "sent") : null}
            onReply={() => onReply(m)}
            {...actions}
          />
        );
      })}
    </>
  );
}

function GroupThread({
  me,
  messages,
  reads,
  members,
  onReply,
  ...actions
}: ThreadActionsProps & {
  me: string;
  messages: GroupMessage[];
  reads: { username: string; lastReadAt: string }[];
  members: string[];
  onReply: (m: GroupMessage) => void;
}) {
  if (messages.length === 0) {
    return <p className="py-10 text-center text-sm text-muted">هنوز پیامی نیست. اولین پیام را بفرستید.</p>;
  }
  const otherMembers = members.filter((u) => u !== me);
  function readByAll(createdAt: string) {
    if (otherMembers.length === 0) return false;
    return otherMembers.every((u) => {
      const r = reads.find((x) => x.username === u);
      return r && r.lastReadAt >= createdAt;
    });
  }
  return (
    <>
      {messages.map((m) => {
        const mine = m.fromUsername === me;
        return (
          <MessageBubble
            key={m.id}
            id={m.id}
            mine={mine}
            body={m.body}
            createdAt={m.createdAt}
            editedAt={m.editedAt}
            deleted={Boolean(m.deletedAt)}
            senderName={!mine ? m.fromDisplayName : undefined}
            replyFromName={m.replyFromName}
            replyBody={m.replyBody}
            tick={mine ? (readByAll(m.createdAt) ? "read" : "sent") : null}
            onReply={() => onReply(m)}
            {...actions}
          />
        );
      })}
    </>
  );
}

function MessageBubble({
  id,
  mine,
  body,
  createdAt,
  editedAt,
  deleted,
  senderName,
  replyFromName,
  replyBody,
  tick,
  editingId,
  editingBody,
  onEditingBodyChange,
  onSaveEdit,
  onCancelEdit,
  onStartEdit,
  onDelete,
  onReply,
}: {
  id: string;
  mine: boolean;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
  senderName?: string;
  replyFromName?: string | null;
  replyBody?: string | null;
  tick: "sent" | "read" | null;
} & ThreadActionsProps & { onReply: () => void }) {
  const isEditing = editingId === id;

  return (
    <article className={cn("flex", mine ? "justify-start" : "justify-end")}>
      <div className={cn("group flex max-w-[85%] items-center gap-1", mine ? "flex-row" : "flex-row-reverse")}>
        {!deleted && !isEditing && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="گزینه‌های پیام"
                className="shrink-0 rounded-full p-1 text-subtle opacity-0 transition-opacity hover:bg-accent-soft group-hover:opacity-100 focus-visible:opacity-100"
              >
                <MoreVertical className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={mine ? "start" : "end"}>
              <DropdownMenuItem onSelect={onReply}>پاسخ</DropdownMenuItem>
              {mine && (
                <>
                  {!isFileBody(body) && (
                    <DropdownMenuItem onSelect={() => onStartEdit(id, body)}>
                      <Pencil className="size-3.5" /> ویرایش
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem className="text-danger" onSelect={() => onDelete(id)}>
                    <Trash2 className="size-3.5" /> حذف
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div
          className={cn(
            "rounded-2xl px-3 py-2 text-start text-[13px] leading-relaxed",
            mine ? "rounded-es-md bg-accent text-accent-fg" : "rounded-ee-md bg-surface-2 text-fg",
            deleted && "italic opacity-70",
          )}
        >
          {senderName && !deleted && (
            <span className="mb-0.5 block text-[11px] font-semibold text-accent">{senderName}</span>
          )}
          {replyBody && !deleted && (
            <span
              className={cn(
                "mb-1 block rounded-md border-s-2 px-2 py-1 text-[12px]",
                mine
                  ? "border-accent-fg/50 bg-black/10 text-accent-fg/90"
                  : "border-accent bg-accent-soft text-muted",
              )}
            >
              <span className="block font-medium">{replyFromName}</span>
              <span className="line-clamp-2">{replyBody}</span>
            </span>
          )}

          {deleted ? (
            <span>این پیام حذف شد</span>
          ) : isEditing ? (
            <div className="min-w-[200px]">
              <Textarea
                autoFocus
                rows={2}
                value={editingBody}
                onChange={(e) => onEditingBodyChange(e.target.value)}
                className="min-h-10 resize-none bg-transparent text-[13px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSaveEdit();
                  }
                  if (e.key === "Escape") onCancelEdit();
                }}
              />
              <div className="mt-1 flex justify-end gap-1">
                <Button size="sm" variant="ghost" onClick={onCancelEdit}>
                  انصراف
                </Button>
                <Button size="sm" onClick={onSaveEdit} disabled={!editingBody.trim()}>
                  ذخیره
                </Button>
              </div>
            </div>
          ) : isFileBody(body) ? (
            <FileAttachment body={body} mine={mine} />
          ) : (
            <span className="whitespace-pre-wrap">{body}</span>
          )}

          {!deleted && !isEditing && (
            <span
              className={cn(
                "mt-1 flex items-center gap-1 text-[10px] tabular-nums",
                mine ? "text-accent-fg/70" : "text-subtle",
              )}
            >
              {editedAt && <span>(ویرایش شده)</span>}
              {isoToJalaaliStr(createdAt)} {formatTimeFa(createdAt)}
              {tick === "sent" && <Check className="size-3.5" />}
              {tick === "read" && <CheckCheck className="size-3.5 text-sky-400" />}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

function FileAttachment({ body, mine }: { body: string; mine: boolean }) {
  const legacy = decodeFileBody(body);
  const ref = decodeFileRef(body);
  const [href, setHref] = useState<string | null>(legacy ? `data:${legacy.mime};base64,${legacy.data}` : null);
  const [meta, setMeta] = useState<{ name: string; mime: string; size: number } | null>(
    legacy ? { name: legacy.name, mime: legacy.mime, size: legacy.size } : ref,
  );

  useEffect(() => {
    if (!ref || legacy) return;
    let cancelled = false;
    void getAppFile({ data: { id: ref.fileId } }).then((res) => {
      if (cancelled || !res.ok) return;
      setHref(`data:${res.mime};base64,${res.dataBase64}`);
      setMeta({ name: res.filename, mime: res.mime, size: res.sizeBytes });
    });
    return () => {
      cancelled = true;
    };
  }, [ref?.fileId]);

  if (!meta) return <span className="text-[12px] opacity-70">در حال بارگذاری فایل…</span>;
  const isImage = meta.mime.startsWith("image/");
  return (
    <div className="space-y-2">
      {isImage && href ? (
        <a href={href} download={meta.name} target="_blank" rel="noreferrer">
          <img src={href} alt={meta.name} className="max-h-56 max-w-full rounded-lg object-contain" />
        </a>
      ) : null}
      <a
        href={href ?? "#"}
        download={meta.name}
        onClick={(e) => {
          if (!href) e.preventDefault();
        }}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] underline-offset-2 hover:underline",
          mine ? "bg-black/10" : "bg-accent-soft",
        )}
      >
        <FileIcon className="size-4 shrink-0" />
        <span className="min-w-0 truncate font-medium">{meta.name}</span>
        <span className="shrink-0 opacity-70">{formatFileSize(meta.size)}</span>
      </a>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-[13px] font-semibold text-fg">
      {initials(name)}
    </span>
  );
}
