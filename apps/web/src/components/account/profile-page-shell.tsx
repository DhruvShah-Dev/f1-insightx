"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AccountConstructorOption, AccountDriverOption } from "@/lib/account/options";
import { getProfileTheme } from "@/lib/account/profile-theme";
import { AccountAvatar } from "@/components/account/account-avatar";
import { getNetworkErrorMessage, readClientErrorMessage } from "@/lib/errors/client";

type ProfileSnapshot = {
  username: string;
  usernameIsCustom: boolean;
  usernameLastChangedAt: string | null;
  usernameLockedUntil: string | null;
  profileLastChangedAt: string | null;
  profileLockedUntil: string | null;
  favoriteConstructorId: string | null;
  favoriteDriverId: string | null;
  avatarType: "constructor_logo" | "driver_image";
  onboardingCompleted: boolean;
};

type ProfilePageShellProps = {
  userId: string;
  email: string;
  provider: string;
  hasProfilePersistence: boolean;
  constructors: AccountConstructorOption[];
  drivers: AccountDriverOption[];
  initialProfile: ProfileSnapshot | null;
};

type AvailabilityState = "idle" | "checking" | "available" | "taken" | "invalid";

function formatLockDate(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function formatCountdown(value: string | null, now: number) {
  if (!value) {
    return null;
  }

  const target = new Date(value).getTime();
  if (Number.isNaN(target) || target <= now) {
    return null;
  }

  const remainingMs = target - now;
  const totalMinutes = Math.floor(remainingMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${Math.max(minutes, 1)}m`;
}

function readProfileFromPayload(payload: unknown): ProfileSnapshot | null {
  if (!payload || typeof payload !== "object" || !("profile" in payload) || !payload.profile || typeof payload.profile !== "object") {
    return null;
  }

  const profile = payload.profile as Record<string, unknown>;
  if (typeof profile.username !== "string") {
    return null;
  }

  return {
    username: profile.username,
    usernameIsCustom: Boolean(profile.usernameIsCustom),
    usernameLastChangedAt: typeof profile.usernameLastChangedAt === "string" ? profile.usernameLastChangedAt : null,
    usernameLockedUntil: typeof profile.usernameLockedUntil === "string" ? profile.usernameLockedUntil : null,
    profileLastChangedAt: typeof profile.profileLastChangedAt === "string" ? profile.profileLastChangedAt : null,
    profileLockedUntil: typeof profile.profileLockedUntil === "string" ? profile.profileLockedUntil : null,
    favoriteConstructorId: typeof profile.favoriteConstructorId === "string" ? profile.favoriteConstructorId : null,
    favoriteDriverId: typeof profile.favoriteDriverId === "string" ? profile.favoriteDriverId : null,
    avatarType: profile.avatarType === "driver_image" ? "driver_image" : "constructor_logo",
    onboardingCompleted: Boolean(profile.onboardingCompleted),
  };
}

export function ProfilePageShell({
  userId,
  email,
  provider,
  hasProfilePersistence,
  constructors,
  drivers,
  initialProfile,
}: ProfilePageShellProps) {
  const router = useRouter();
  const [savedProfile, setSavedProfile] = useState<ProfileSnapshot | null>(initialProfile);
  const [username, setUsername] = useState(initialProfile?.username ?? "");
  const [usernameTouched, setUsernameTouched] = useState(Boolean(initialProfile?.usernameIsCustom));
  const [constructorId, setConstructorId] = useState(initialProfile?.favoriteConstructorId ?? "");
  const [driverId, setDriverId] = useState(initialProfile?.favoriteDriverId ?? "");
  const [avatarType, setAvatarType] = useState<"constructor_logo" | "driver_image">(initialProfile?.avatarType ?? "constructor_logo");
  const [availabilityState, setAvailabilityState] = useState<AvailabilityState>("idle");
  const [availabilityMessage, setAvailabilityMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);
  const [suggestedUsername, setSuggestedUsername] = useState(initialProfile?.username ?? "");
  const [isUsernameEditing, setIsUsernameEditing] = useState(false);
  const [countdownNow, setCountdownNow] = useState(Date.now());
  const lastUsernameCheckRef = useRef<{ username: string; state: AvailabilityState; message: string } | null>(null);

  const selectedConstructor = useMemo(
    () => constructors.find((item) => item.id === constructorId) ?? null,
    [constructorId, constructors],
  );
  const selectedDriver = useMemo(() => drivers.find((item) => item.id === driverId) ?? null, [driverId, drivers]);
  const savedConstructor = useMemo(
    () => constructors.find((item) => item.id === savedProfile?.favoriteConstructorId) ?? null,
    [constructors, savedProfile?.favoriteConstructorId],
  );

  const usernameLockEndsOn = formatLockDate(savedProfile?.usernameLockedUntil ?? null);
  const usernameLocked = Boolean(
    savedProfile?.usernameIsCustom && savedProfile.usernameLockedUntil && new Date(savedProfile.usernameLockedUntil).getTime() > countdownNow,
  );
  const usernameCountdown = formatCountdown(savedProfile?.usernameLockedUntil ?? null, countdownNow);
  const profileLockEndsOn = formatLockDate(savedProfile?.profileLockedUntil ?? null);
  const profileLocked = Boolean(savedProfile?.profileLockedUntil && new Date(savedProfile.profileLockedUntil).getTime() > countdownNow);
  const profileCountdown = formatCountdown(savedProfile?.profileLockedUntil ?? null, countdownNow);
  const customUsernamePending = username.trim().length > 0 && suggestedUsername && username.trim().toLowerCase() !== suggestedUsername.toLowerCase();
  const displayName = username.trim() || "f1_user";
  const constructorLabel = selectedConstructor?.label ?? "No constructor selected";
  const driverLabel = selectedDriver?.label ?? "No driver selected";
  const usernameInputDisabled = usernameLocked || !isUsernameEditing;
  const activeTheme = getProfileTheme(savedProfile?.favoriteConstructorId);
  const constructorFieldLocked = profileLocked;
  const avatarFieldLocked = profileLocked;

  useEffect(() => {
    const hasAnyCountdown = usernameLocked || profileLocked;
    if (!hasAnyCountdown) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setCountdownNow(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [profileLocked, usernameLocked]);

  useEffect(() => {
    if (usernameLocked) {
      setIsUsernameEditing(false);
    }
  }, [usernameLocked]);

  useEffect(() => {
    if (!hasProfilePersistence || usernameLocked) {
      return;
    }

    const controller = new AbortController();
    const loadSuggestion = async () => {
      try {
        const params = new URLSearchParams();
        if (constructorId) params.set("constructorId", constructorId);
        if (driverId) params.set("driverId", driverId);
        params.set("excludeUserId", userId);
        const response = await fetch(`/api/account/username/suggest?${params.toString()}`, { signal: controller.signal });
        const payload = (await response.json().catch(() => null)) as { username?: string; error?: string } | null;
        if (!response.ok || !payload?.username) {
          setAvailabilityState("idle");
          setAvailabilityMessage("Username suggestion is unavailable right now.");
          return;
        }

        setSuggestedUsername(payload.username);
        if (!usernameTouched || !savedProfile?.usernameIsCustom) {
          setUsername(payload.username);
          setAvailabilityState("available");
          setAvailabilityMessage("Default username generated from your selections.");
          lastUsernameCheckRef.current = {
            username: payload.username,
            state: "available",
            message: "Default username generated from your selections.",
          };
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setAvailabilityState("idle");
          setAvailabilityMessage("Username suggestion is unavailable right now.");
        }
      }
    };

    void loadSuggestion();
    return () => controller.abort();
  }, [constructorId, driverId, hasProfilePersistence, savedProfile?.usernameIsCustom, usernameLocked, usernameTouched, userId]);

  useEffect(() => {
    if (!username.trim()) {
      setAvailabilityState("idle");
      setAvailabilityMessage("A default username is generated automatically.");
      return;
    }

    const normalizedUsername = username.trim().toLowerCase();
    if (savedProfile?.username && normalizedUsername === savedProfile.username.toLowerCase()) {
      setAvailabilityState("available");
      setAvailabilityMessage(savedProfile.usernameIsCustom ? "Current custom username." : "Current default username.");
      return;
    }

    if (lastUsernameCheckRef.current?.username === normalizedUsername) {
      setAvailabilityState(lastUsernameCheckRef.current.state);
      setAvailabilityMessage(lastUsernameCheckRef.current.message);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setAvailabilityState("checking");
      try {
        const response = await fetch(
          `/api/account/username/check?username=${encodeURIComponent(username)}&excludeUserId=${encodeURIComponent(userId)}`,
          { signal: controller.signal },
        );
        const payload = (await response.json().catch(() => null)) as { available?: boolean; error?: string } | null;
        if (!response.ok) {
          setAvailabilityState("invalid");
          const message = payload?.error ?? "Username is not available.";
          setAvailabilityMessage(message);
          lastUsernameCheckRef.current = { username: normalizedUsername, state: "invalid", message };
          return;
        }

        const available = Boolean(payload?.available);
        const state = available ? "available" : "taken";
        const message = available
          ? normalizedUsername === suggestedUsername.toLowerCase()
            ? "Default username is available."
            : "Custom username is available."
          : "Username is already taken.";
        setAvailabilityState(state);
        setAvailabilityMessage(message);
        lastUsernameCheckRef.current = { username: normalizedUsername, state, message };
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setAvailabilityState("idle");
          setAvailabilityMessage("");
        }
      }
    }, 400);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [savedProfile?.username, savedProfile?.usernameIsCustom, suggestedUsername, userId, username]);

  const submitProfile = async (confirmCustomUsernameChange: boolean) => {
    setErrorMessage("");
    setNoticeMessage("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          favoriteConstructorId: constructorId || null,
          favoriteDriverId: driverId || null,
          avatarType,
          confirmCustomUsernameChange,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string | { message?: string }; profile?: unknown } | null;
      if (!response.ok) {
        setErrorMessage(readClientErrorMessage(payload, "Unable to save your profile right now."));
        return false;
      }

      const nextProfile = readProfileFromPayload(payload);
      if (nextProfile) {
        setSavedProfile(nextProfile);
        setUsername(nextProfile.username);
        setConstructorId(nextProfile.favoriteConstructorId ?? "");
        setDriverId(nextProfile.favoriteDriverId ?? "");
        setAvatarType(nextProfile.avatarType);
      }

      setPendingConfirmation(false);
      setIsUsernameEditing(false);
      setNoticeMessage(confirmCustomUsernameChange ? "Custom username saved. It is now locked for 7 days." : "Profile updated.");
      router.refresh();
      return true;
    } catch {
      setErrorMessage(getNetworkErrorMessage("Profile save"));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setNoticeMessage("");

    if (!hasProfilePersistence) {
      setErrorMessage("Profile saving is not configured for this environment.");
      return;
    }

    if (availabilityState === "taken") {
      setErrorMessage("Choose a different username before saving.");
      return;
    }

    if (usernameLocked && savedProfile?.username !== username.trim()) {
      setErrorMessage(`This username is locked until ${usernameLockEndsOn}.`);
      return;
    }

    if (profileLocked) {
      const constructorChanged = (savedProfile?.favoriteConstructorId ?? "") !== constructorId;
      const avatarChanged = (savedProfile?.avatarType ?? "constructor_logo") !== avatarType;
      if (constructorChanged || avatarChanged) {
        setErrorMessage(`Constructor and theme selections are locked until ${profileLockEndsOn}. Driver selection remains editable.`);
        return;
      }
    }

    if (customUsernamePending && savedProfile?.username !== username.trim()) {
      setPendingConfirmation(true);
      return;
    }

    await submitProfile(false);
  };

  const handleConfirmUsernameChange = async () => {
    await submitProfile(true);
  };

  const handleUsernameEditToggle = () => {
    if (usernameLocked) {
      return;
    }

    setPendingConfirmation(false);
    setErrorMessage("");
    setNoticeMessage("");
    setIsUsernameEditing((current) => !current);
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    setErrorMessage("");
    try {
      const response = await fetch("/auth/sign-out", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as { redirectTo?: string; error?: string | { message?: string } } | null;
      if (!response.ok) {
        setErrorMessage(readClientErrorMessage(payload, "Unable to sign out right now."));
        return;
      }
      router.push(payload?.redirectTo ?? "/account");
      router.refresh();
    } catch {
      setErrorMessage(getNetworkErrorMessage("Sign-out"));
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <main className={`subpage-shell account-page ${activeTheme.className}`} style={activeTheme.style}>
      <header className="account-profile-header">
        <Link href="/" className="profile-return-link">
          <span aria-hidden="true">/</span>
          Return home
        </Link>

        <div className="account-profile-hero">
          <div className="account-profile-hero__identity">
            <div className="account-profile-hero__avatar">
              <AccountAvatar constructorId={constructorId} driverId={driverId} avatarType={avatarType} />
            </div>
            <div className="account-profile-hero__copy">
              <p className="subpage-eyebrow">{activeTheme.eyebrow}</p>
              <h1 className="subpage-title">{displayName}</h1>
              <div className="account-profile-hero__meta">
                <span>{savedProfile?.usernameIsCustom ? "Custom username" : "Default username"}</span>
                <span>{provider}</span>
                <span>{email}</span>
                {savedProfile?.favoriteConstructorId ? <span>{activeTheme.label}</span> : null}
              </div>
            </div>
          </div>

          <div className="account-profile-hero__actions">
            <div className="account-profile-hero__summary">
              <strong>{selectedConstructor?.shortLabel ?? "F1"}</strong>
              <p>{constructorLabel}</p>
            </div>
            <div className="account-profile-hero__summary">
              <strong>{selectedDriver?.code ?? "USR"}</strong>
              <p>{driverLabel}</p>
            </div>
            <button className="account-signout" type="button" onClick={handleSignOut} disabled={isSigningOut}>
              {isSigningOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </div>
      </header>

      <section className="account-profile-layout">
        <aside className="workspace-panel account-profile-identity">
          <div className="workspace-panel__eyebrow">Saved profile</div>
          <div className="account-profile-identity__copy">
            <strong>{displayName}</strong>
            <p>{savedConstructor ? savedConstructor.label : "Default styling"}</p>
            <p>{profileLocked ? `Constructor locked for ${profileCountdown ?? "cooldown active"}` : "Driver stays editable after save."}</p>
          </div>
        </aside>

        <section className="workspace-panel account-profile-editor">
          <div className="workspace-panel__eyebrow">Profile settings</div>
          <div className="workspace-panel__headline">Choose a constructor to personalize the profile. Driver changes stay open between race weeks.</div>

          {!hasProfilePersistence ? (
            <div className="status-banner">
              Profile saving is not configured in this environment. Sign-in still works, but profile updates are unavailable.
            </div>
          ) : null}

          {profileLocked && profileLockEndsOn ? (
            <div className="status-banner">Constructor and profile theme are locked until {profileLockEndsOn}. Favorite driver remains editable.</div>
          ) : (
            <div className="status-banner">Saving locks constructor and profile theme choices for 7 days. Favorite driver remains editable.</div>
          )}

          {usernameLocked && usernameLockEndsOn ? (
            <div className="status-banner">Your custom username is locked until {usernameLockEndsOn}. You can still update the rest of your profile.</div>
          ) : null}

          {pendingConfirmation ? (
            <div className="account-feedback account-feedback--notice">
              Saving a custom username will lock username edits for 7 days.
              <div className="account-form__actions">
                <button className="hero__cta hero__cta--primary" type="button" onClick={handleConfirmUsernameChange} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Accept and save"}
                </button>
                <button className="hero__cta hero__cta--secondary" type="button" onClick={() => setPendingConfirmation(false)} disabled={isSaving}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {errorMessage ? <div className="account-feedback account-feedback--error">{errorMessage}</div> : null}
          {noticeMessage ? <div className="account-feedback account-feedback--notice">{noticeMessage}</div> : null}

          <form className="account-form" onSubmit={handleSave}>
            <div className="account-field-grid">
              <label className="account-field">
                <span>Username</span>
                <div className="account-field__input-shell">
                  <input
                    type="text"
                    value={username}
                    onChange={(event) => {
                      setUsernameTouched(true);
                      setPendingConfirmation(false);
                      setUsername(event.target.value);
                    }}
                    placeholder="f1_user1"
                    autoCapitalize="none"
                    autoCorrect="off"
                    disabled={usernameInputDisabled}
                  />
                  <button
                    type="button"
                    className={`account-username-toggle ${usernameLocked ? "is-locked" : isUsernameEditing ? "is-active" : ""}`}
                    onClick={handleUsernameEditToggle}
                    disabled={usernameLocked}
                    aria-label={
                      usernameLocked
                        ? `Username locked for ${usernameCountdown ?? "cooldown active"}`
                        : isUsernameEditing
                          ? "Stop editing username"
                          : "Edit username"
                    }
                    title={
                      usernameLocked
                        ? `Username locked until ${usernameLockEndsOn ?? "cooldown ends"}`
                        : isUsernameEditing
                          ? "Stop editing"
                          : "Edit username"
                    }
                  >
                    {usernameLocked ? <span>{usernameCountdown ?? "Locked"}</span> : <span aria-hidden="true">Edit</span>}
                  </button>
                </div>
                <small
                  className={`account-field__hint ${
                    availabilityState === "taken" || availabilityState === "invalid"
                      ? "is-error"
                      : availabilityState === "available"
                        ? "is-success"
                        : ""
                  }`}
                >
                  {usernameLocked
                    ? `Custom username locked${usernameLockEndsOn ? ` until ${usernameLockEndsOn}` : ""}.`
                    : availabilityState === "checking"
                      ? "Checking availability..."
                      : !isUsernameEditing
                        ? "Username is view-only until you unlock editing."
                        : availabilityMessage || "Generated from constructor and driver abbreviations with a unique number."}
                </small>
              </label>
              <label className="account-field">
                <span>Email</span>
                <input type="email" value={email} disabled />
                <small className="account-field__hint">Managed by your sign-in provider.</small>
              </label>
            </div>

            <div className="account-field-grid">
              <label className="account-field">
                <span>Favorite constructor</span>
                <select value={constructorId} onChange={(event) => setConstructorId(event.target.value)} disabled={constructorFieldLocked}>
                  <option value="">No constructor selected</option>
                  {constructors.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <small className="account-field__hint">
                  {constructorFieldLocked
                    ? `Constructor locked${profileLockEndsOn ? ` until ${profileLockEndsOn}` : ""}.`
                    : "Saving locks the constructor theme for 7 days."}
                </small>
              </label>
              <label className="account-field">
                <span>Favorite driver</span>
                <select value={driverId} onChange={(event) => setDriverId(event.target.value)}>
                  <option value="">No driver selected</option>
                  {drivers.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <small className="account-field__hint is-success">Driver selection stays editable during the 7-day profile lock.</small>
              </label>
            </div>

            <fieldset className={`account-radio-group ${avatarFieldLocked ? "is-disabled" : ""}`}>
              <legend>Profile image</legend>
              <label>
                <input
                  type="radio"
                  name="profile-avatar"
                  checked={avatarType === "constructor_logo"}
                  onChange={() => setAvatarType("constructor_logo")}
                  disabled={avatarFieldLocked}
                />
                Use constructor identity
              </label>
              <label>
                <input
                  type="radio"
                  name="profile-avatar"
                  checked={avatarType === "driver_image"}
                  onChange={() => setAvatarType("driver_image")}
                  disabled={avatarFieldLocked}
                />
                Use favorite driver image
              </label>
              <small className="account-field__hint">
                {avatarFieldLocked
                  ? `Profile image style locked${profileLockEndsOn ? ` until ${profileLockEndsOn}` : ""}.`
                  : "Saving locks the constructor-driven profile presentation for 7 days."}
              </small>
            </fieldset>

            <div className="account-form__actions">
              <button className="hero__cta hero__cta--primary" type="submit" disabled={isSaving || !hasProfilePersistence}>
                {isSaving ? "Saving..." : "Save profile"}
              </button>
            </div>
          </form>
        </section>
      </section>
    </main>
  );
}
