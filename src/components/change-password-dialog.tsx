import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { changeOwnPassword, setOwnPin } from "@/lib/local-users";
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
        <PinSection username={user?.username ?? ""} onDone={() => {}} />
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


function PinSection({ username, onDone }: { username: string; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState("");
  const mut = useMutation({
    mutationFn: () =>
      setOwnPin({
        data: {
          username,
          password,
          pin: pin.trim() ? pin.trim() : null,
        },
      }),
    onSuccess: (res) => {
      if (!res.ok) setMsg(res.error);
      else {
        setMsg(pin.trim() ? "پین ۲FA فعال شد." : "پین ۲FA غیرفعال شد.");
        onDone();
      }
    },
  });
  if (!username) return null;
  return (
    <div className="mt-6 border-t border-border pt-4">
      <p className="text-sm font-medium">پین امنیتی (اختیاری)</p>
      <p className="mt-1 text-[12px] text-muted">بعد از رمز عبور، یک پین ۴–۸ رقمی برای ورود لازم می‌شود.</p>
      <div className="mt-3 space-y-2">
        <Input type="password" placeholder="رمز فعلی" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
        <Input type="password" inputMode="numeric" placeholder="پین جدید (خالی = غیرفعال)" value={pin} onChange={(e) => setPin(e.target.value)} dir="ltr" />
        {msg ? <p className="text-[12px] text-muted">{msg}</p> : null}
        <Button type="button" variant="secondary" className="w-full" disabled={mut.isPending || !password} onClick={() => mut.mutate()}>
          ذخیره پین
        </Button>
      </div>
    </div>
  );
}
