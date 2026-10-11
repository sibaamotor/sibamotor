import { Palette } from "lucide-react";
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

export function LoginScreen() {
  const { login, completePinLogin } = useLocalSession();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
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
    <div className="k-wallpaper relative min-h-dvh overflow-hidden">
      <button
        type="button"
        onClick={() => setAppearanceOpen(true)}
        className="absolute end-4 top-4 z-10 inline-flex h-10 items-center gap-2 rounded-full border border-border k-glass px-3 text-[13px] text-muted hover:text-fg"
        aria-label="ظاهر برنامه"
      >
        <Palette className="size-4" />
        <span className="hidden sm:inline">ظاهر</span>
      </button>
      <div className="mx-auto grid min-h-dvh max-w-6xl items-center gap-10 px-4 py-10 lg:grid-cols-2">
        <section className="hidden lg:block">
          <LogoMark className="size-16" />
          <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight">{APP_NAME}</h1>
          <p className="mt-3 max-w-md text-lg text-muted">{APP_TAGLINE}</p>
          <ul className="mt-8 space-y-3 text-sm text-muted">
            <li className="rounded-xl border border-border k-glass px-4 py-3">پیگیری امور واحد با تخته کانبان</li>
            <li className="rounded-xl border border-border k-glass px-4 py-3">داشبورد کنترل و رصد لحظه‌ای</li>
            <li className="rounded-xl border border-border k-glass px-4 py-3">{APP_CREDIT}</li>
          </ul>
        </section>

        <section className="mx-auto w-full max-w-md">
          <div className="rounded-3xl border border-border k-glass p-6 shadow-[var(--shadow-flyout)] sm:p-8">
            <div className="mb-6 flex items-center gap-3">
              <LogoMark className="size-10" />
              <div>
                <h1 className="font-semibold">{APP_NAME}</h1>
                <p className="text-[12px] text-muted">{APP_TAGLINE}</p>
              </div>
            </div>
            <p className="mb-5 text-[13px] leading-relaxed text-muted">
              ورود فقط برای کاربران مجاز واحد برنامه‌ریزی و انبار.
            </p>

            <form className="space-y-3" onSubmit={onSubmit}>
              <div>
                <Label htmlFor="username">نام کاربری</Label>
                <Input
                  id="username"
                  autoComplete="username"
                  required
                  className="mt-1"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  dir="ltr"
                  disabled={Boolean(pendingUser)}
                />
              </div>
              <div>
                <Label htmlFor="password">رمز عبور</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required={!pendingUser}
                  className="mt-1"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  dir="ltr"
                  disabled={Boolean(pendingUser)}
                />
              </div>
              {pendingUser && (
                <div>
                  <Label htmlFor="pin">پین امنیتی (۲FA)</Label>
                  <Input
                    id="pin"
                    type="password"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    className="mt-1"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    dir="ltr"
                    placeholder="۴ تا ۸ رقم"
                    autoFocus
                  />
                </div>
              )}
              {error && <p className="text-[13px] text-danger">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "لطفاً صبر کنید…" : pendingUser ? "تأیید پین" : "ورود"}
              </Button>
              {pendingUser && (
                <button
                  type="button"
                  className="w-full text-center text-[12px] text-muted hover:text-fg"
                  onClick={() => {
                    setPendingUser(null);
                    setPin("");
                    setError(null);
                  }}
                >
                  بازگشت
                </button>
              )}
            </form>
            <p className="mt-5 text-center text-[11px] leading-relaxed text-subtle">{APP_CREDIT}</p>
          </div>
        </section>
      </div>
      <AppearancePanel open={appearanceOpen} onOpenChange={setAppearanceOpen} />
    </div>
  );
}
