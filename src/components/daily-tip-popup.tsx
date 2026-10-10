import { useEffect, useState } from "react";
import { Lightbulb } from "lucide-react";
import { hasSeenTipToday, markTipSeenToday, pickDailyTip } from "@/lib/daily-tips";
import { useLocalSession } from "@/lib/local-session";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";

export function DailyTipPopup() {
  const { user } = useLocalSession();
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState("");

  useEffect(() => {
    if (!user?.username) return;
    if (hasSeenTipToday(user.username)) return;
    const { text } = pickDailyTip(user.username);
    setTip(text);
    setOpen(true);
  }, [user?.username]);

  function close() {
    if (user?.username) markTipSeenToday(user.username);
    setOpen(false);
  }

  if (!user || !tip) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-md">
        <DialogTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="size-5 text-amber-500" />
          نکته روز — مهندسی صنایع
        </DialogTitle>
        <DialogDescription className="sr-only">پیام آموزشی روزانه</DialogDescription>
        <p className="mt-2 text-[15px] leading-7 text-fg">{tip}</p>
        <div className="mt-5 flex justify-end">
          <Button onClick={close}>متوجه شدم</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
