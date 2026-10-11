import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { listLocalUsers } from "@/lib/local-users";
import { listBoards, getBoard } from "@/lib/local-db";
import { sendWorkReport } from "@/lib/work-reports";
import { uploadAppFile } from "@/lib/files";
import { useLocalSession } from "@/lib/local-session";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Prefill when forwarding */
  forwardFrom?: {
    parentId: string;
    body: string;
    boardId?: string | null;
    boardTitle?: string | null;
    cardId?: string | null;
    cardTitle?: string | null;
  };
};

export function SendReportDialog({ open, onOpenChange, forwardFrom }: Props) {
  const { user } = useLocalSession();
  const qc = useQueryClient();
  const usersQ = useQuery({ queryKey: ["local-users"], queryFn: () => listLocalUsers(), enabled: open });
  const boardsQ = useQuery({ queryKey: ["boards"], queryFn: () => listBoards(), enabled: open });

  const [to, setTo] = useState("");
  const [boardId, setBoardId] = useState(forwardFrom?.boardId ?? "");
  const [cardId, setCardId] = useState(forwardFrom?.cardId ?? "");
  const [body, setBody] = useState(forwardFrom?.body ?? "");
  const [file, setFile] = useState<File | null>(null);

  const boardQ = useQuery({
    queryKey: ["board", boardId, "report-send"],
    queryFn: () => getBoard({ data: { boardId: boardId! } }),
    enabled: Boolean(boardId) && open,
  });

  const cards =
    boardQ.data?.lists.flatMap((l) =>
      l.cards.filter((c) => !c.archived).map((c) => ({ id: c.id, title: c.title })),
    ) ?? [];

  const mut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("وارد نشده‌اید");
      let fileId: string | undefined;
      let filename: string | undefined;
      if (file) {
        const reader = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => {
            const s = String(r.result ?? "");
            const i = s.indexOf(",");
            resolve(i >= 0 ? s.slice(i + 1) : s);
          };
          r.onerror = () => reject(new Error("خواندن فایل ناموفق"));
          r.readAsDataURL(file);
        });
        const up = await uploadAppFile({
          data: {
            filename: file.name,
            mime: file.type || "application/octet-stream",
            sizeBytes: file.size,
            dataBase64: reader,
            uploadedBy: user.username,
          },
        });
        if (!up.ok) throw new Error(up.error);
        fileId = up.id;
        filename = file.name;
      }
      const boardTitle =
        boardsQ.data?.find((b) => b.id === boardId)?.title ?? forwardFrom?.boardTitle ?? undefined;
      const cardTitle =
        cards.find((c) => c.id === cardId)?.title ?? forwardFrom?.cardTitle ?? undefined;
      return sendWorkReport({
        data: {
          fromUsername: user.username,
          toUsername: to,
          boardId: boardId || undefined,
          boardTitle,
          cardId: cardId || undefined,
          cardTitle,
          body,
          fileId,
          filename,
          parentId: forwardFrom?.parentId,
        },
      });
    },
    onSuccess: async () => {
      toast.success("گزارش ارسال شد");
      await qc.invalidateQueries({ queryKey: ["work-reports"] });
      await qc.invalidateQueries({ queryKey: ["notif"] });
      await qc.invalidateQueries({ queryKey: ["board"] });
      setBody("");
      setFile(null);
      setTo("");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message || "خطا در ارسال"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>{forwardFrom ? "ارجاع گزارش" : "ارسال گزارش کاری"}</DialogTitle>
        <DialogDescription>
          متن یا فایل ورد/PDF را بفرستید و گیرنده، تخته و کارت مرتبط را مشخص کنید.
        </DialogDescription>
        <div className="mt-3 space-y-3">
          <div>
            <Label>گیرنده</Label>
            <select
              className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-2 text-sm"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              required
            >
              <option value="">انتخاب کنید…</option>
              {(usersQ.data ?? [])
                .filter((u) => u.username !== user?.username)
                .map((u) => (
                  <option key={u.username} value={u.username}>
                    {u.displayName} ({u.username})
                  </option>
                ))}
            </select>
          </div>
          <div>
            <Label>تخته مرتبط (اختیاری)</Label>
            <select
              className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-2 text-sm"
              value={boardId}
              onChange={(e) => {
                setBoardId(e.target.value);
                setCardId("");
              }}
            >
              <option value="">—</option>
              {(boardsQ.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
          </div>
          {boardId && (
            <div>
              <Label>کارت مرتبط (اختیاری)</Label>
              <select
                className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-2 text-sm"
                value={cardId}
                onChange={(e) => setCardId(e.target.value)}
              >
                <option value="">—</option>
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <Label>متن گزارش</Label>
            <Textarea
              className="mt-1"
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="شرح گزارش…"
            />
          </div>
          <div>
            <Label>فایل (ورد / PDF / تصویر — حداکثر ۵ مگ)</Label>
            <Input
              type="file"
              className="mt-1"
              accept=".doc,.docx,.pdf,.png,.jpg,.jpeg,.xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && <p className="mt-1 text-[11px] text-muted">{file.name}</p>}
          </div>
          <Button
            className="w-full"
            disabled={mut.isPending || !to || (!body.trim() && !file)}
            onClick={() => mut.mutate()}
          >
            {mut.isPending ? "در حال ارسال…" : forwardFrom ? "ارجاع" : "ارسال گزارش"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
