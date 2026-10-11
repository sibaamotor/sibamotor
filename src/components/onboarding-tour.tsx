import { useEffect, useState } from "react";
import {
  BarChart3,
  GanttChart,
  LayoutGrid,
  ListTodo,
  MessageSquare,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useLocalSession } from "@/lib/local-session";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";

const STEPS = [
  {
    icon: LayoutGrid,
    title: "تخته کانبان",
    body: "کارها را در ستون‌ها بکشید. برای کارت جدید از «کارت جدید» و قالب‌های آماده استفاده کنید.",
  },
  {
    icon: ListTodo,
    title: "کارهای من",
    body: "از منوی کناری، فقط کارت‌هایی که شما مسئول آن‌ها هستید را یکجا ببینید.",
  },
  {
    icon: MessageSquare,
    title: "پیام‌ها و گروه",
    body: "چت خصوصی و گروهی. فایل تا ۵ مگابایت بفرستید. در نظر کارت با @نام‌کاربری منشن کنید.",
  },
  {
    icon: BarChart3,
    title: "گزارشات",
    body: "سلامت تخته، عقب‌افتاده‌ها، سررسید، مسدودها و خروجی CSV/JSON در تب گزارش.",
  },
  {
    icon: GanttChart,
    title: "گانت",
    body: "بازه زمانی کارها را روی محور تاریخ ببینید. برای هر کارت تاریخ شروع و مهلت بگذارید.",
  },
  {
    icon: Users,
    title: "افراد و مجوزها",
    body: "افراد را به کارت‌ها وصل کنید. ادمین می‌تواند کاربر و نقش بسازد.",
  },
  {
    icon: ShieldCheck,
    title: "امنیت",
    body: "رمز را قوی نگه دارید. در منوی حساب می‌توانید پین ۲FA اختیاری فعال کنید.",
  },
];

function key(username: string) {
  return `sibamotor-onboarded:${username}`;
}

export function OnboardingTour({ forceOpen }: { forceOpen?: boolean }) {
  const { user } = useLocalSession();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!user) return;
    if (user.mustChangePassword) return; // after password first
    try {
      const seen = localStorage.getItem(key(user.username));
      if (!seen || forceOpen) {
        setStep(0);
        setOpen(true);
      }
    } catch {
      setOpen(true);
    }
  }, [user?.username, user?.mustChangePassword, forceOpen]);

  if (!user) return null;
  const s = STEPS[step]!;
  const Icon = s.icon;
  const last = step >= STEPS.length - 1;

  function finish() {
    try {
      localStorage.setItem(key(user!.username), "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && finish()}>
      <DialogContent className="max-w-md">
        <DialogTitle className="sr-only">آموزش اولیه</DialogTitle>
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <div className="grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
            <Icon className="size-7" />
          </div>
          <div>
            <p className="text-[12px] text-muted">
              مرحله {step + 1} از {STEPS.length}
            </p>
            <h2 className="mt-1 text-lg font-semibold">{s.title}</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">{s.body}</p>
          </div>
          <div className="flex w-full gap-1">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full ${i <= step ? "bg-accent" : "bg-surface-2"}`}
              />
            ))}
          </div>
          <div className="flex w-full gap-2">
            {step > 0 && (
              <Button variant="ghost" className="flex-1" onClick={() => setStep((x) => x - 1)}>
                قبلی
              </Button>
            )}
            <Button
              className="flex-1"
              onClick={() => {
                if (last) finish();
                else setStep((x) => x + 1);
              }}
            >
              {last ? "شروع کار" : "بعدی"}
            </Button>
          </div>
          <button type="button" className="text-[12px] text-subtle hover:text-fg" onClick={finish}>
            رد کردن آموزش
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function resetOnboarding(username: string) {
  try {
    localStorage.removeItem(key(username));
  } catch {
    /* ignore */
  }
}
