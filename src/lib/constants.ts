import type { AccentId, ColorScheme, FontId, Priority, ThemeId } from "./types";

export const APP_NAME = "سیباموتور";
export const APP_TAGLINE = "سامانه مدیریت کار واحد برنامه‌ریزی و انبار";
export const APP_CREDIT = "طراحی و توسعه · شهریور ۱۴۰۵ · Abbasi & Mojarrad";

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: "بالا",
  med: "متوسط",
  low: "پایین",
};

export const THEMES: {
  id: ThemeId;
  label: string;
  hint: string;
  scheme: ColorScheme;
  swatch: [string, string, string];
}[] = [
  { id: "snow", label: "برف", hint: "روشنِ خطی، ۲۰۲۶", scheme: "light", swatch: ["#f6f6f4", "#ffffff", "#171717"] },
  { id: "light", label: "روشن", hint: "Fluent کلاسیک", scheme: "light", swatch: ["#f3f3f3", "#ffffff", "#1a1a1a"] },
  { id: "sand", label: "کاغذ", hint: "کرم گرم اداری", scheme: "light", swatch: ["#f3eee4", "#fbf7f0", "#2a241c"] },
  { id: "glass", label: "شیشه روشن", hint: "بلور روشن", scheme: "light", swatch: ["#e7eef5", "#ffffff", "#1a1d22"] },
  { id: "ink", label: "مرکب", hint: "تیرهٔ خطی", scheme: "dark", swatch: ["#0c0c0d", "#161618", "#f4f4f5"] },
  { id: "dark", label: "تیره", hint: "Fluent تیره", scheme: "dark", swatch: ["#1c1c1c", "#2a2a2a", "#f3f3f3"] },
  { id: "midnight", label: "نیمه‌شب", hint: "سرمه‌ای صنعتی", scheme: "dark", swatch: ["#0b1220", "#121a2a", "#e8eef8"] },
  { id: "forest", label: "زیتون", hint: "انبار و تولید", scheme: "dark", swatch: ["#141612", "#1c1f19", "#eef0e8"] },
  { id: "mica", label: "میکا", hint: "شیشه مات تیره", scheme: "dark", swatch: ["#16181d", "#2a2d34", "#f4f5f7"] },
  { id: "acrylic", label: "اکریلیک", hint: "بلور رنگی", scheme: "dark", swatch: ["#0e141c", "#1a2838", "#f5f7fb"] },
];

export const THEME_SCHEME: Record<ThemeId, ColorScheme> = Object.fromEntries(
  THEMES.map((t) => [t.id, t.scheme]),
) as Record<ThemeId, ColorScheme>;

export const ACCENTS: { id: AccentId; label: string; light: string; dark: string }[] = [
  { id: "blue", label: "آبی", light: "#0078d4", dark: "#60cdff" },
  { id: "teal", label: "فیروزه‌ای", light: "#0f7a7c", dark: "#54d1c6" },
  { id: "sky", label: "آسمانی", light: "#0369a1", dark: "#7dd3fc" },
  { id: "forest", label: "سبز", light: "#3f6f4a", dark: "#8fbf8a" },
  { id: "slate", label: "سنگی", light: "#3b4453", dark: "#c8ccd4" },
  { id: "graphite", label: "گرافیت", light: "#3f3f46", dark: "#e4e4e7" },
];

export const FONTS: {
  id: FontId;
  label: string;
  hint: string;
  sample: string;
  stack: string;
}[] = [
  {
    id: "vazirmatn",
    label: "وزیرمتن",
    hint: "خواناترین برای رابط فارسی",
    sample: "سیباموتور برنامه‌ریزی و انبار",
    stack: '"Vazirmatn Variable", "Vazirmatn", system-ui, sans-serif',
  },
  {
    id: "estedad",
    label: "استعداد",
    hint: "متغیر مدرن ۱۴۰۳",
    sample: "سیباموتور برنامه‌ریزی و انبار",
    stack: '"Estedad", "Vazirmatn Variable", system-ui, sans-serif',
  },
  {
    id: "noto",
    label: "نوتو سنس",
    hint: "گوگل، پوشش کامل عربی",
    sample: "سیباموتور برنامه‌ریزی و انبار",
    stack: '"Noto Sans Arabic Variable", "Vazirmatn Variable", system-ui, sans-serif',
  },
  {
    id: "plex",
    label: "IBM Plex",
    hint: "اداری و دقیق",
    sample: "سیباموتور برنامه‌ریزی و انبار",
    stack: '"IBM Plex Sans Arabic", "Vazirmatn Variable", system-ui, sans-serif',
  },
  {
    id: "readex",
    label: "ریدکس پرو",
    hint: "نرم و معاصر",
    sample: "سیباموتور برنامه‌ریزی و انبار",
    stack: '"Readex Pro Variable", "Vazirmatn Variable", system-ui, sans-serif',
  },
  {
    id: "rubik",
    label: "روبیک",
    hint: "هندسی، مناسب عنوان",
    sample: "سیباموتور برنامه‌ریزی و انبار",
    stack: '"Rubik Variable", "Vazirmatn Variable", system-ui, sans-serif',
  },
];

export const THEME_IDS = THEMES.map((t) => t.id);
export const ACCENT_IDS = ACCENTS.map((a) => a.id);
export const FONT_IDS = FONTS.map((f) => f.id);

export const COVER_COLORS = [
  "#4C8DBE",
  "#4E9490",
  "#D9724F",
  "#C9A24B",
  "#9A6FBE",
  "#5FA872",
  "#C15E82",
  "#6E7EC9",
];

export const LABEL_PALETTE = COVER_COLORS;


/** قالب‌های آماده کارت برای واحد برنامه‌ریزی و انبار */
export type CardTemplate = {
  id: string;
  name: string;
  notes: string;
  priority: Priority;
  checklistTitle: string;
  checklistItems: string[];
};

export const CARD_TEMPLATES: CardTemplate[] = [
  {
    id: "warehouse-inspect",
    name: "بازرسی انبار",
    notes: "بازرسی دوره‌ای موجودی و شرایط نگهداری.",
    priority: "high",
    checklistTitle: "چک‌لیست بازرسی",
    checklistItems: [
      "بررسی موجودی فیزیکی با سیستم",
      "کنترل شرایط دمایی/رطوبت",
      "بررسی چیدمان و ایمنی",
      "ثبت مغایرت‌ها",
      "گزارش به مسئول انبار",
    ],
  },
  {
    id: "purchase-order",
    name: "سفارش خرید",
    notes: "پیگیری سفارش خرید تا تحویل.",
    priority: "med",
    checklistTitle: "مراحل سفارش",
    checklistItems: [
      "ثبت درخواست خرید",
      "استعلام از تأمین‌کننده",
      "تأیید مالی",
      "صدور سفارش",
      "پیگیری ارسال",
      "تحویل و کنترل کیفیت",
    ],
  },
  {
    id: "production-plan",
    name: "برنامه‌ریزی تولید",
    notes: "تنظیم برنامه تولید هفتگی/ماهانه.",
    priority: "high",
    checklistTitle: "مراحل برنامه‌ریزی",
    checklistItems: [
      "جمع‌آوری سفارشات",
      "بررسی ظرفیت خطوط",
      "تخصیص منابع",
      "انتشار برنامه",
      "پایش اجرا",
    ],
  },
  {
    id: "quality-issue",
    name: "مشکل کیفی",
    notes: "ثبت و پیگیری مشکل کیفیت.",
    priority: "high",
    checklistTitle: "اقدامات کیفی",
    checklistItems: [
      "شرح مشکل و شواهد",
      "جداسازی محموله مشکوک",
      "تحلیل علت ریشه‌ای",
      "اقدام اصلاحی",
      "تأیید بسته شدن",
    ],
  },
  {
    id: "maintenance",
    name: "نگهداری و تعمیرات",
    notes: "درخواست یا برنامه نگهداری تجهیزات.",
    priority: "med",
    checklistTitle: "مراحل نت",
    checklistItems: [
      "ثبت خرابی/نیاز",
      "زمان‌بندی تعمیر",
      "تأمین قطعات",
      "اجرای تعمیر",
      "تست و تحویل",
    ],
  },
  {
    id: "blank",
    name: "کارت خالی",
    notes: "",
    priority: "med",
    checklistTitle: "",
    checklistItems: [],
  },
];
