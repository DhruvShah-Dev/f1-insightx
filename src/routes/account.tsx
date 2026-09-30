import { createFileRoute, Link } from "@tanstack/react-router";
import type { Session, User } from "@supabase/supabase-js";
import {
  CalendarClock,
  Gauge,
  Trophy,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { SiteShell } from "@/components/site-shell";
import { SiteHeader } from "@/components/site-chrome";
import { AccountDashboard } from "@/components/account-dashboard";
import { nextRace } from "@/data/season";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { fmtDateTime } from "@/lib/format";
import { FastArrowRight } from "iconoir-react/regular";
import { driverStandings, seasonState, teams } from "@/data/season";
import "./account.css";

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
  return value
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 24);
}

function isLocked(value: string | null) {
  return Boolean(value && new Date(value).getTime() > Date.now());
}

function displayName(user: User) {
  const metadata = user.user_metadata ?? {};
  const name = metadata["full_name"] ?? metadata["name"];
  return typeof name === "string" && name.trim()
    ? name.trim()
    : (user.email?.split("@")[0] ?? "F1 InsightX user");
}

function googleAvatarUrl(user: User) {
  const metadata = user.user_metadata ?? {};
  const avatar = metadata["avatar_url"] ?? metadata["picture"];
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
    : new Date(USERNAME_LOCK_UNTIL).getTime() > Date.now()
      ? `Next change locks until ${fmtDateTime(USERNAME_LOCK_UNTIL)}`
      : "Username can be changed now.";
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
      setAvatarType(
        AVATARS.some((a) => a.id === data.avatar_type)
          ? (data.avatar_type as typeof avatarType)
          : "helmet",
      );
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
    setAvatarType(
      AVATARS.some((a) => a.id === created.avatar_type)
        ? (created.avatar_type as typeof avatarType)
        : "helmet",
    );
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
              username_locked_until: new Date(USERNAME_LOCK_UNTIL).getTime() > Date.now()
                ? USERNAME_LOCK_UNTIL
                : null,
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
      setAvatarType(
        AVATARS.some((a) => a.id === data.avatar_type)
          ? (data.avatar_type as typeof avatarType)
          : "helmet",
      );
      setSaveState("saved");
      setMessage(
        usernameChanged && new Date(USERNAME_LOCK_UNTIL).getTime() > Date.now()
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
    return <SignInScreen onSignIn={signInWithGoogle} loading message="" checking />;
  }

  if (!user) {
    return <SignInScreen onSignIn={signInWithGoogle} loading={saveState === "saving"} message={message} />;
  }

  return (
    <SiteShell fullWidth>
      <AccountDashboard
        identityName={identityName}
        email={user.email ?? "Private Google account"}
        userId={user.id}
        providerAvatar={providerAvatar}
        username={username}
        savedUsername={profile?.username ?? username}
        avatarType={avatarType}
        avatars={AVATARS}
        createdAt={profile?.created_at ?? null}
        profileLockedUntil={profile?.profile_locked_until ?? null}
        usernameLocked={usernameLocked}
        profileLocked={profileLocked}
        lockCopy={lockCopy}
        saveState={saveState}
        message={message}
        onUsernameChange={setUsername}
        onAvatarChange={(value) => setAvatarType(value as typeof avatarType)}
        onSave={saveProfile}
        onSignOut={() => void signOut()}
        avatarFallback={<AvatarMark avatar={currentAvatar.id} />}
      />
    </SiteShell>
  );
}
function SignInScreen({
  onSignIn,
  loading,
  message,
  checking = false,
}: {
  onSignIn: () => Promise<void>;
  loading: boolean;
  message: string;
  checking?: boolean;
}) {
  const featuredDriver = driverStandings.find(({ code }) => code === "BOT");
  const featuredTeam = featuredDriver?.team ?? "cadillac";

  return (
    <>
    <SiteHeader />
    <main className="account-login">
      <section className="account-login-art" aria-label="2026 season feature">
        <div className="account-login-art-grid" aria-hidden="true" />
        <span className="account-login-year" aria-hidden="true">{String(seasonState.season).slice(-2)}</span>
        <img
          className="account-login-driver"
          src={`/assets/drivers/2026/full-body/front/${featuredDriver?.code.toLowerCase() ?? "bot"}.png`}
          alt=""
          aria-hidden="true"
        />
        <div className="account-login-art-top">
          <span>INSIGHT / {seasonState.season}</span>
          <span className="account-login-art-rule" />
        </div>
        <div className="account-login-art-bottom">
          <div>
            <span className="account-login-art-label">IN THE FRAME</span>
            <strong>Valtteri {featuredDriver?.name ?? "Bottas"}</strong>
            <span>{teams[featuredTeam].name}</span>
          </div>
          <img src={`/assets/teams/logos/2026/white-svg/${featuredTeam}.svg`} alt={teams[featuredTeam].name} />
        </div>
      </section>

      <section className="account-login-content" aria-labelledby="account-login-title">
        <header className="account-login-header">
          <span className="account-login-brand">ACCOUNT / {seasonState.season}</span>
          <Link to="/" className="account-login-back">
            Explore <FastArrowRight aria-hidden="true" />
          </Link>
        </header>

        <div className="account-login-center">
          <p className="account-login-overline"><span /> YOUR ACCOUNT</p>
          <h1 id="account-login-title">Your seat<br /><em>awaits.</em></h1>
          <p className="account-login-description">Save your picks. Follow the season.</p>
          <button
            type="button"
            className="account-login-google"
            onClick={() => void onSignIn()}
            disabled={loading || checking}
          >
            <GoogleLogo className="account-login-google-icon" />
            <span>{checking ? "Checking account…" : loading ? "Connecting…" : "Continue with Google"}</span>
            <FastArrowRight aria-hidden="true" />
          </button>
          {message ? <p className="account-login-error" role="alert">{message}</p> : null}
        </div>

        <footer className="account-login-footer">
          <span>One account. Every race week.</span>
          <span>{seasonState.season} SEASON <span className="account-login-footer-dot" /> F1 INSIGHTX</span>
        </footer>
      </section>
    </main>
    </>
  );
}

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.6 12.2c0-.8-.1-1.6-.2-2.3H12v4.4h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1-3.7 1-2.8 0-5.2-1.9-6.1-4.5H2.2v2.8A11 11 0 0 0 12 23Z"
      />
      <path fill="#FBBC05" d="M5.9 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.2a11 11 0 0 0 0 9.8l3.7-2.8Z" />
      <path
        fill="#EA4335"
        d="M12 5.4c1.6 0 3.1.6 4.3 1.7l3.1-3.2A10.6 10.6 0 0 0 12 1 11 11 0 0 0 2.2 7.1l3.7 2.8c.9-2.6 3.3-4.5 6.1-4.5Z"
      />
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
