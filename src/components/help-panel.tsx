import { BookOpen, X } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { cn } from "@/lib/utils";

const SECTIONS = [
  {
    id: "board",
    title: "تخته و کارت",
    items: [
      "کارت جدید: پایین هر ستون → عنوان یا انتخاب قالب آماده",
      "جابه‌جایی: کارت را بکشید بین ستون‌ها",
      "باز کردن کارت: کلیک روی کارت برای جزئیات، چک‌لیست، نظر، وابستگی",
      "کپی به…: پایین کارت → انتخاب تخته و ستون مقصد",
      "انتقال: داخل کارت → انتقال به تخته/ستون دیگر",
      "SLA: بالای کارت نشان می‌دهد چند روز در ستون فعلی مانده",
    ],
  },
  {
    id: "chat",
    title: "پیام‌ها",
    items: [
      "چت خصوصی با هر کاربر و گروه با چند نفر",
      "فقط سازنده گروه عضو اضافه/حذف و نام گروه را عوض می‌کند",
      "فایل تا ۵ مگابایت با دکمه گیره کاغذ",
      "منشن در نظر کارت: @نام‌کاربری مثل @h.mojarad",
    ],
  },
  {
    id: "report",
    title: "گزارش و گانت",
    items: [
      "تب گزارش: سلامت تخته، عقب‌افتاده، سررسید، مسدود، نمودارها",
      "خروجی CSV و JSON از بالای گزارش",
      "گانت: فقط کارت‌هایی که تاریخ شروع یا مهلت دارند",
    ],
  },
  {
    id: "account",
    title: "حساب و امنیت",
    items: [
      "منوی حساب (بالا): تغییر رمز، پین ۲FA، پشتیبان‌گیری",
      "کارهای من: فقط کارهای assign‌شده به شما",
      "زنگوله: اعلان منشن و رویدادها",
      "دکمه راهنما (همینجا) همیشه در دسترس است",
    ],
  },
];

export function HelpButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(SECTIONS[0]!.id);
  const current = SECTIONS.find((s) => s.id === tab) ?? SECTIONS[0]!;

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        className={cn(className)}
        aria-label="راهنما"
        onClick={() => setOpen(true)}
      >
        <BookOpen className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogTitle className="text-base font-semibold">راهنمای سیباموتور</DialogTitle>
          <div className="mt-3 flex flex-wrap gap-1">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setTab(s.id)}
                className={cn(
                  "rounded-full px-3 py-1 text-[12px]",
                  tab === s.id ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted hover:text-fg",
                )}
              >
                {s.title}
              </button>
            ))}
          </div>
          <ul className="mt-4 space-y-2 text-[13px] leading-relaxed text-muted">
            {current.items.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <Button className="mt-4 w-full" variant="secondary" onClick={() => setOpen(false)}>
            بستن
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
