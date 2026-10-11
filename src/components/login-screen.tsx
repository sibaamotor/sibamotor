import {
  BarChart3,
  Eye,
  EyeOff,
  GanttChart,
  LayoutGrid,
  MessageSquare,
  Palette,
  Shield,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { APP_CREDIT, APP_NAME, APP_TAGLINE } from "@/lib/constants";
import type { LocalUser } from "@/lib/local-users";
import { useLocalSession } from "@/lib/local-session";
import { AppearancePanel } from "@/components/appearance-panel";
import { LogoMark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const HIGHLIGHTS = [
  {
    icon: LayoutGrid,
    title: "کانبان زنده",
    desc: "کارها را بکشید، قالب بزنید، وابستگی و مهلت بگذارید.",
  },
  {
    icon: BarChart3,
    title: "گزارش لحظه‌ای",
    desc: "سلامت تخته، ریسک‌ها و خروجی CSV در یک نگاه.",
  },
  {
    icon: MessageSquare,
    title: "ارتباط تیمی",
    desc: "چت خصوصی و گروهی با فایل و منشن.",
  },
  {
    icon: GanttChart,
    title: "گانت زمانی",
    desc: "بازه شروع تا مهلت هر کار روی محور تاریخ.",
  },
];

export function LoginScreen() {
  const { login, completePinLogin } = useLocalSession();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [pendingUser, setPendingUser] = useState<LocalUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (pendingUser) {
        const user = await completePinLogin(username, pin, pendingUser);
        if (!user) {
          setError("پین نادرست است.");
          return;
        }
        void navigate({ to: "/" });
        return;
      }

      const result = await login(username, password);
      if (!result) {
        setError("نام کاربری یا رمز عبور نادرست است.");
        return;
      }
      if ("needsPin" in result && result.needsPin) {
        setPendingUser(result.pending);
        return;
      }
      void navigate({ to: "/" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[var(--k-bg,#0b0d12)] text-fg">
      {/* Dynamic background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="k-wallpaper absolute inset-0 opacity-80" />
        <div
          className="absolute -top-32 -start-24 size-[28rem] rounded-full opacity-40 blur-3xl"
          style={{
            background: "radial-gradient(circle, color-mix(in oklab, var(--color-accent) 55%, transparent), transparent 70%)",
            animation: "floatA 14s ease-in-out infinite",
          }}
        />
        <div
          className="absolute -bottom-40 -end-20 size-[32rem] rounded-full opacity-30 blur-3xl"
          style={{
            background: "radial-gradient(circle, color-mix(in oklab, #38bdf8 40%, transparent), transparent 70%)",
            animation: "floatB 18s ease-in-out infinite",
          }}
        />
        <div
          className="absolute top-1/3 start-1/2 size-64 -translate-x-1/2 rounded-full opacity-20 blur-3xl"
          style={{
            background: "radial-gradient(circle, color-mix(in oklab, #a78bfa 35%, transparent), transparent 70%)",
            animation: "floatC 20s ease-in-out infinite",
          }}
        />
        {/* subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(var(--k-fg) 1px, transparent 1px), linear-gradient(90deg, var(--k-fg) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <style>{`
        @keyframes floatA {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(40px, 24px) scale(1.08); }
        }
        @keyframes floatB {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-32px, -20px) scale(1.05); }
        }
        @keyframes floatC {
          0%, 100% { transform: translate(-50%, 0); opacity: 0.15; }
          50% { transform: translate(-50%, 16px); opacity: 0.28; }
        }
        @keyframes riseIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .login-rise { animation: riseIn 0.55s ease-out both; }
        .login-rise-delay-1 { animation-delay: 0.08s; }
        .login-rise-delay-2 { animation-delay: 0.16s; }
        .login-rise-delay-3 { animation-delay: 0.24s; }
      `}</style>

      <button
        type="button"
        onClick={() => setAppearanceOpen(true)}
        className="absolute end-4 top-4 z-20 inline-flex h-10 items-center gap-2 rounded-full border border-border/80 bg-bg-elevated/70 px-3 text-[13px] text-muted backdrop-blur-md transition hover:text-fg"
        aria-label="ظاهر برنامه"
      >
        <Palette className="size-4" />
        <span className="hidden sm:inline">ظاهر</span>
      </button>

      <div className="relative z-10 mx-auto grid min-h-dvh max-w-6xl items-center gap-12 px-4 py-12 lg:grid-cols-2 lg:gap-16">
        {/* Brand panel */}
        <section className="hidden lg:block">
          <div className="login-rise flex items-center gap-3">
            <LogoMark className="size-12" />
            <div>
              <p className="text-[13px] font-medium text-muted">سامانه داخلی</p>
              <p className="text-sm text-subtle">واحد برنامه‌ریزی و انبار</p>
            </div>
          </div>
          <h1 className="login-rise login-rise-delay-1 mt-8 text-4xl font-semibold leading-[1.2] tracking-tight xl:text-5xl">
            {APP_NAME}
          </h1>
          <p className="login-rise login-rise-delay-1 mt-3 max-w-md text-[17px] leading-relaxed text-muted">
            {APP_TAGLINE}. همه کارها، گزارش‌ها و گفتگوهای تیم در یک محیط یکپارچه.
          </p>

          <ul className="login-rise login-rise-delay-2 mt-10 grid gap-3">
            {HIGHLIGHTS.map((h) => (
              <li
                key={h.title}
                className="group flex items-start gap-3 rounded-2xl border border-border/70 bg-bg-elevated/40 p-3.5 backdrop-blur-sm transition hover:border-border-strong hover:bg-bg-elevated/70"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent transition group-hover:scale-105">
                  <h.icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-medium">{h.title}</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{h.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Form card */}
        <section className="login-rise login-rise-delay-3 mx-auto w-full max-w-[420px]">
          <div className="rounded-3xl border border-border/80 bg-bg-elevated/80 p-6 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-8">
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              <LogoMark className="size-10" />
              <div>
                <h1 className="font-semibold">{APP_NAME}</h1>
                <p className="text-[12px] text-muted">{APP_TAGLINE}</p>
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-lg font-semibold tracking-tight">
                {pendingUser ? "تأیید هویت دومرحله‌ای" : "ورود به حساب"}
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                {pendingUser
                  ? "پین امنیتی حساب خود را وارد کنید."
                  : "فقط کاربران مجاز واحد می‌توانند وارد شوند."}
              </p>
            </div>

            <form className="space-y-3.5" onSubmit={onSubmit}>
              <div>
                <Label htmlFor="username">نام کاربری</Label>
                <Input
                  id="username"
                  autoComplete="username"
                  required
                  className="mt-1.5 h-11"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  dir="ltr"
                  disabled={Boolean(pendingUser)}
                  placeholder="username"
                />
              </div>
              <div>
                <Label htmlFor="password">رمز عبور</Label>
                <div className="relative mt-1.5">
                  <Input
                    id="password"
                    type={showPass ? "text" : "password"}
                    autoComplete="current-password"
                    required={!pendingUser}
                    className="h-11 pe-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    dir="ltr"
                    disabled={Boolean(pendingUser)}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-subtle hover:text-fg"
                    onClick={() => setShowPass((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPass ? "مخفی کردن رمز" : "نمایش رمز"}
                  >
                    {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {pendingUser && (
                <div className="rounded-xl border border-accent/30 bg-accent-soft/40 p-3">
                  <div className="mb-2 flex items-center gap-2 text-[12px] text-muted">
                    <Shield className="size-3.5 text-accent" />
                    پین امنیتی فعال است
                  </div>
                  <Label htmlFor="pin">پین (۴ تا ۸ رقم)</Label>
                  <Input
                    id="pin"
                    type="password"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    className="mt-1.5 h-11 tracking-[0.3em]"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    dir="ltr"
                    placeholder="••••"
                    autoFocus
                  />
                </div>
              )}

              {error && (
                <p
                  className={cn(
                    "rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-[13px] text-danger",
                  )}
                  role="alert"
                >
                  {error}
                </p>
              )}

              <Button type="submit" className="h-11 w-full text-[14px]" disabled={busy}>
                {busy ? "در حال بررسی…" : pendingUser ? "تأیید و ورود" : "ورود به سامانه"}
              </Button>

              {pendingUser && (
                <button
                  type="button"
                  className="w-full text-center text-[12px] text-muted transition hover:text-fg"
                  onClick={() => {
                    setPendingUser(null);
                    setPin("");
                    setError(null);
                  }}
                >
                  بازگشت به ورود
                </button>
              )}
            </form>

            <div className="mt-8 border-t border-border/70 pt-4 text-center">
              <p className="text-[11px] leading-relaxed text-subtle">{APP_CREDIT}</p>
            </div>
          </div>

          <p className="mt-5 text-center text-[11px] text-subtle/80">
            با ورود، شما به‌عنوان کاربر مجاز این واحد شناخته می‌شوید.
          </p>
        </section>
      </div>

      <AppearancePanel open={appearanceOpen} onOpenChange={setAppearanceOpen} />
    </div>
  );
}
