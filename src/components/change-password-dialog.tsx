import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { changeOwnPassword } from "@/lib/local-users";
import { useLocalSession } from "@/lib/local-session";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ChangePasswordDialog({ open, onOpenChange }: Props) {
  const { user } = useLocalSession();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const mut = useMutation({
    mutationFn: () =>
      changeOwnPassword({
        data: {
          username: user!.username,
          currentPassword: current,
          newPassword: next,
        },
      }),
    onSuccess: (res) => {
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
      setError("");
    },
    onError: () => setError("خطا در ارتباط با سرور."),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (next !== confirm) {
      setError("رمز جدید و تکرار آن یکسان نیستند.");
      return;
    }
    if (next.length < 6) {
      setError("رمز جدید باید حداقل ۶ کاراکتر باشد.");
      return;
    }
    mut.mutate();
  }

  function handleClose(v: boolean) {
    if (!v) {
      setCurrent("");
      setNext("");
      setConfirm("");
      setError("");
      setDone(false);
    }
    onOpenChange(v);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogTitle>تغییر رمز عبور</DialogTitle>
        <DialogDescription>رمز فعلی را وارد کنید و رمز جدید بگذارید.</DialogDescription>
        {done ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-emerald-600">رمز عبور با موفقیت تغییر کرد.</p>
            <Button className="w-full" onClick={() => handleClose(false)}>
              بستن
            </Button>
          </div>
        ) : (
          <form className="mt-4 space-y-3" onSubmit={submit}>
            <div>
              <Label htmlFor="cur-pass">رمز فعلی</Label>
              <Input
                id="cur-pass"
                type="password"
                className="mt-1"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
                dir="ltr"
                autoComplete="current-password"
              />
            </div>
            <div>
              <Label htmlFor="new-pass">رمز جدید</Label>
              <Input
                id="new-pass"
                type="password"
                className="mt-1"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                required
                minLength={6}
                dir="ltr"
                autoComplete="new-password"
              />
            </div>
            <div>
              <Label htmlFor="conf-pass">تکرار رمز جدید</Label>
              <Input
                id="conf-pass"
                type="password"
                className="mt-1"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                dir="ltr"
                autoComplete="new-password"
              />
            </div>
            {error ? <p className="text-[13px] text-red-600">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={mut.isPending}>
              {mut.isPending ? "در حال ذخیره…" : "ذخیره رمز جدید"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
