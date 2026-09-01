import { createFileRoute } from "@tanstack/react-router";
import type { Session, User } from "@supabase/supabase-js";
import {
  CalendarClock,
  Check,
  Flag,
  Gauge,
  Lock,
  LogOut,
  RefreshCw,
  Save,
  Shield,
  Trophy,
  UserRound,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { SectionHeading, SiteShell, Stat } from "@/components/site-shell";
import { RaceFlagHero } from "@/components/race-flag-hero";
import { nextRace } from "@/data/season";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { fmtDateTime } from "@/lib/format";

type Profile = Database["public"]["Tables"]["user_profiles"]["Row"];
type AuthState = "loading" | "ready" | "unavailable";
type SaveState = "idle" | "saving" | "saved" | "error";

const AVATARS = [
  { id: "helmet", label: "Helmet", icon: Trophy },
  { id: "pit-wall", label: "Pit wall", icon: Gauge },
  { id: "timing", label: "Timing", icon: CalendarClock },
] as const;

const USERNAME_LOCK_UNTIL = nextRace.sessions[0]?.startISO ?? nextRace.raceStartISO;

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Account - F1 InsightX" },
      {
        name: "description",
        content:
          "Sign in to F1 InsightX or manage your profile, prediction card identity and account session.",
      },
      { property: "og:title", content: "Account - F1 InsightX" },
      {
        property: "og:description",
        content: "Account sign-in and profile controls for F1 InsightX.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Account,
});

function defaultUsername(user: User) {
  const emailName = cleanUsername(user.email?.split("@")[0] ?? "").slice(0, 18);
  return emailName || `driver_${user.id.slice(0, 8)}`;
}

function cleanUsername(value: string) {
  return value.trim().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24);
}

function isLocked(value: string | null) {
  return Boolean(value && new Date(value).getTime() > Date.now());
}

function displayName(user: User) {
  const metadata = user.user_metadata ?? {};
  const name = metadata.full_name ?? metadata.name;
  return typeof name === "string" && name.trim() ? name.trim() : user.email?.split("@")[0] ?? "F1 InsightX user";
}

function googleAvatarUrl(user: User) {
  const metadata = user.user_metadata ?? {};
  const avatar = metadata.avatar_url ?? metadata.picture;
  return typeof avatar === "string" && avatar.startsWith("https://") ? avatar : "";
}

function Account() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState("");
  const [avatarType, setAvatarType] = useState<(typeof AVATARS)[number]["id"]>("helmet");
  const [message, setMessage] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const user = session?.user ?? null;
  const usernameLocked = isLocked(profile?.username_locked_until ?? null);
  const profileLocked = isLocked(profile?.profile_locked_until ?? null);
  const currentAvatar = AVATARS.find((avatar) => avatar.id === avatarType) ?? AVATARS[0];
  const lockCopy = usernameLocked
    ? `Locked until ${fmtDateTime(profile?.username_locked_until ?? USERNAME_LOCK_UNTIL)}`
    : `Next change locks until ${fmtDateTime(USERNAME_LOCK_UNTIL)}`;
  const identityName = useMemo(() => (user ? displayName(user) : "Driver profile"), [user]);
  const providerAvatar = useMemo(() => (user ? googleAvatarUrl(user) : ""), [user]);

  const loadProfile = useCallback(async (currentUser: User) => {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      setProfile(data);
      setUsername(data.username);
      setAvatarType(AVATARS.some((a) => a.id === data.avatar_type) ? (data.avatar_type as typeof avatarType) : "helmet");
      return;
    }

    const nextProfile = {
      user_id: currentUser.id,
      username: defaultUsername(currentUser),
      avatar_type: "helmet",
      onboarding_completed: true,
    };
    const { data: created, error: createError } = await supabase
      .from("user_profiles")
      .upsert(nextProfile, { onConflict: "user_id" })
      .select("*")
      .single();

    if (createError) throw createError;
    setProfile(created);
    setUsername(created.username);
    setAvatarType(AVATARS.some((a) => a.id === created.avatar_type) ? (created.avatar_type as typeof avatarType) : "helmet");
  }, []);

  const refreshSession = useCallback(async () => {
    setAuthState("loading");
    setMessage("");
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      setSession(data.session);
      if (data.session?.user) {
        await loadProfile(data.session.user);
      } else {
        setProfile(null);
      }
      setAuthState("ready");
    } catch (error) {
      setAuthState("unavailable");
      setMessage(error instanceof Error ? error.message : "Account services are unavailable.");
    }
  }, [loadProfile]);

  useEffect(() => {
    void refreshSession();
    try {
      const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        setSession(nextSession);
        if (nextSession?.user) {
          void loadProfile(nextSession.user).catch((error: unknown) => {
            setMessage(error instanceof Error ? error.message : "Profile could not be loaded.");
          });
        } else {
          setProfile(null);
        }
        setAuthState("ready");
      });
      return () => data.subscription.unsubscribe();
    } catch (error) {
      setAuthState("unavailable");
      setMessage(error instanceof Error ? error.message : "Account services are unavailable.");
      return undefined;
    }
  }, [loadProfile, refreshSession]);

  async function signInWithGoogle() {
    setSaveState("saving");
    setMessage("");
    try {
      const redirectTo = `${window.location.origin}/account`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) throw error;
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "Google sign-in failed.");
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !profile) return;
    setSaveState("saving");
    setMessage("");
    try {
      const nextUsername = usernameLocked ? profile.username : cleanUsername(username);
      if (nextUsername.length < 3) {
        throw new Error("Username must be at least 3 characters.");
      }
      const usernameChanged = nextUsername !== profile.username;
      const update: Database["public"]["Tables"]["user_profiles"]["Update"] = {
        username: nextUsername,
        avatar_type: avatarType,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
        ...(usernameChanged
          ? {
              username_is_custom: true,
              username_last_changed_at: new Date().toISOString(),
              username_locked_until: USERNAME_LOCK_UNTIL,
            }
          : {}),
      };
      const { data, error } = await supabase
        .from("user_profiles")
        .update(update)
        .eq("user_id", user.id)
        .select("*")
        .single();
      if (error) throw error;
      setProfile(data);
      setUsername(data.username);
      setAvatarType(AVATARS.some((a) => a.id === data.avatar_type) ? (data.avatar_type as typeof avatarType) : "helmet");
      setSaveState("saved");
      setMessage(
        usernameChanged
          ? `Profile saved. Username locked until ${fmtDateTime(USERNAME_LOCK_UNTIL)}.`
          : "Profile saved.",
      );
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "Profile could not be saved.");
    }
  }

  async function signOut() {
    setSaveState("saving");
    setMessage("");
    const { error } = await supabase.auth.signOut();
    if (error) {
      setSaveState("error");
      setMessage(error.message);
      return;
    }
    setSession(null);
    setProfile(null);
    setSaveState("idle");
  }

  if (authState === "loading") {
    return (
      <SiteShell fullWidth>
        <AccountFrame title="Account" kicker="Session" subtitle="Checking account state..." />
      </SiteShell>
    );
  }

  if (!user) {
    return (
      <SiteShell fullWidth>
        <AccountFrame
          title="Account"
          kicker="Sign in"
          subtitle="Use Google sign-in to save picks and keep a stable identity across race weeks."
        >
          <div className="mt-8 max-w-xl border border-border bg-card/50 p-4">
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              disabled={saveState === "saving"}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 bg-primary px-4 text-xs font-black uppercase italic text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              <GoogleLogo className="size-4" />
              Continue with Google
            </button>
            {message ? <p className="mt-3 text-xs text-muted-foreground">{message}</p> : null}
          </div>

          <section className="mt-10">
            <SectionHeading kicker="Account access" title="What unlocks" />
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Picks identity" value="Saved" note="One profile across cards" icon={<UserRound className="size-3.5" />} />
              <Stat label="Session" value="Secure" note="Supabase auth token" icon={<Shield className="size-3.5" />} />
              <Stat label="Race week" value="Ready" note="Return after Google sign-in" icon={<Flag className="size-3.5" />} />
            </div>
          </section>
        </AccountFrame>
      </SiteShell>
    );
  }

  return (
    <SiteShell fullWidth>
      <AccountFrame
        title="Profile"
        kicker="Signed in"
        subtitle="Manage the profile attached to picks, locks and race-week scoring."
      >
        <section className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
          <div className="pw-flip-in relative overflow-hidden border border-border bg-card/50 p-5 sm:p-6">
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <F1XLogo />
                  <span className="inline-flex items-center gap-2 border border-border bg-background/80 px-2.5 py-1 text-[11px] font-black uppercase tracking-widest text-foreground">
                    <GoogleLogo className="size-3.5" />
                    Google
                  </span>
                </div>
                <p className="mt-6 label-xs">Driver identity</p>
                <h2 className="mt-2 break-words text-4xl font-black uppercase italic leading-none tracking-tighter sm:text-6xl">
                  @{profile?.username ?? username}
                </h2>
                <p className="mt-3 max-w-xl text-sm text-muted-foreground">
                  {identityName} · {user.email ?? "Private Google account"}
                </p>
              </div>
              <div className="relative size-28 shrink-0 overflow-hidden border border-primary/40 bg-background sm:size-36">
                {providerAvatar ? (
                  <img
                    src={providerAvatar}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="size-full object-cover"
                  />
                ) : (
                  <AvatarMark avatar={currentAvatar.id} className="size-full" />
                )}
                <span className="absolute inset-x-0 bottom-0 bg-primary px-2 py-1 text-center text-[10px] font-black uppercase tracking-widest text-primary-foreground">
                  {currentAvatar.label}
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <IdentityMetric
              icon={<Shield className="size-4" />}
              label="Account"
              value="Connected"
              detail={user.id.slice(0, 8)}
            />
            <IdentityMetric
              icon={<Lock className="size-4" />}
              label="Username"
              value={usernameLocked ? "Locked" : "Open"}
              detail={lockCopy}
            />
            <IdentityMetric
              icon={<Flag className="size-4" />}
              label="Race week"
              value={`R${nextRace.round}`}
              detail={`${nextRace.shortName} · ${fmtDateTime(USERNAME_LOCK_UNTIL)}`}
            />
          </div>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <form onSubmit={saveProfile} className="pw-flip-in border border-border bg-card/50 p-5 [animation-delay:0.08s] sm:p-6">
            <SectionHeading kicker="Profile controls" title="Driver card" />
            <label className="label-xs" htmlFor="username">
              Username
            </label>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                minLength={3}
                maxLength={24}
                disabled={usernameLocked}
                className="min-h-11 border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={saveState === "saving" || profileLocked}
                className="inline-flex min-h-11 items-center justify-center gap-2 bg-primary px-4 text-xs font-black uppercase italic text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60"
              >
                {saveState === "saving" ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{lockCopy}</p>

            <div className="mt-6">
              <p className="label-xs">Avatar type</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {AVATARS.map((avatar) => {
                  const Icon = avatar.icon;
                  const selected = avatarType === avatar.id;
                  return (
                    <button
                      key={avatar.id}
                      type="button"
                      onClick={() => setAvatarType(avatar.id)}
                      disabled={profileLocked}
                      className={`group min-h-24 border p-3 text-left transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60 ${
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-foreground hover:border-primary/50"
                      }`}
                    >
                      <Icon className="size-5" />
                      <span className="mt-5 block text-xs font-black uppercase italic">{avatar.label}</span>
                      <span className={`mt-1 block text-[10px] uppercase tracking-widest ${selected ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
                        {selected ? "Selected" : "Available"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {message ? (
              <p className={`mt-4 text-xs ${saveState === "error" ? "text-destructive" : "text-positive"}`}>
                {message}
              </p>
            ) : null}
          </form>

          <aside className="pw-flip-in border border-border bg-card/50 p-5 [animation-delay:0.16s] sm:p-6">
            <SectionHeading kicker="Session" title="Account state" />
            <dl className="space-y-3 text-xs">
              <ProfileRow label="Email" value={user.email ?? "Private"} />
              <ProfileRow label="User id" value={user.id.slice(0, 8)} />
              <ProfileRow label="Created" value={profile?.created_at ? fmtDateTime(profile.created_at) : "Pending"} />
              <ProfileRow label="Updated" value={profile?.updated_at ? fmtDateTime(profile.updated_at) : "Pending"} />
              <ProfileRow label="Username lock" value={usernameLocked ? fmtDateTime(profile?.username_locked_until ?? "") : "Open"} />
              <ProfileRow label="Profile lock" value={profileLocked ? fmtDateTime(profile?.profile_locked_until ?? "") : "Open"} />
            </dl>
            <button
              type="button"
              onClick={() => void signOut()}
              className="mt-5 inline-flex min-h-10 w-full items-center justify-center gap-2 border border-border bg-background px-4 text-xs font-black uppercase italic text-foreground transition-colors hover:bg-accent"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </aside>
        </section>
      </AccountFrame>
    </SiteShell>
  );
}

function AccountFrame({
  title,
  kicker,
  subtitle,
  children,
}: {
  title: string;
  kicker: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <>
      <RaceFlagHero
        kicker={
          <span className="inline-flex items-center gap-1">
            {title === "Profile" ? <Check className="size-3" /> : <Lock className="size-3" />}
            {kicker}
          </span>
        }
        title={title}
        meta={subtitle}
      />
      {children}
    </>
  );
}

function F1XLogo() {
  return (
    <span className="inline-flex items-center gap-2 bg-primary px-2.5 py-1 text-xs font-black uppercase italic tracking-tight text-primary-foreground">
      <span className="grid size-5 place-items-center bg-primary-foreground text-[10px] text-primary">X</span>
      F1 InsightX
    </span>
  );
}

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.6-.2-2.3H12v4.4h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8.1Z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1-3.7 1-2.8 0-5.2-1.9-6.1-4.5H2.2v2.8A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.9 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.2a11 11 0 0 0 0 9.8l3.7-2.8Z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.3 1.7l3.1-3.2A10.6 10.6 0 0 0 12 1 11 11 0 0 0 2.2 7.1l3.7 2.8c.9-2.6 3.3-4.5 6.1-4.5Z" />
    </svg>
  );
}

function AvatarMark({
  avatar,
  className,
}: {
  avatar: (typeof AVATARS)[number]["id"];
  className?: string;
}) {
  const Icon = AVATARS.find((option) => option.id === avatar)?.icon ?? Trophy;
  return (
    <span className={`grid place-items-center bg-primary/10 text-primary ${className ?? ""}`}>
      <Icon className="size-14" />
    </span>
  );
}

function IdentityMetric({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="pw-ticker border border-border bg-card/50 p-4">
      <div className="flex items-center gap-2 text-primary">
        {icon}
        <span className="label-xs">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-black uppercase italic tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-3 border-b border-border/70 pb-2">
      <dt className="label-xs">{label}</dt>
      <dd className="num truncate text-right text-foreground" title={value}>
        {value}
      </dd>
    </div>
  );
}
