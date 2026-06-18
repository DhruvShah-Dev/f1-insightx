"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LegalLinks } from "@/components/legal/legal-links";
import { AppFooter } from "@/components/ui/app-footer";
import { ACCOUNT_API_ROUTES, buildUsernameCheckUrl, buildUsernameSuggestUrl, readAccountApiData } from "@/lib/account/api";
import type { AccountConstructorOption, AccountDriverOption } from "@/lib/account/options";
import { getProfileTheme } from "@/lib/account/profile-theme";
import { AssetImage } from "@/components/ui/asset-image";
import { getNetworkErrorMessage, readClientErrorMessage } from "@/lib/errors/client";
import { getTeamAsset } from "@/lib/ui/asset-manifest";

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
  hasProfilePersistence: boolean;
  privacyContactEmail: string | null;
  constructors: AccountConstructorOption[];
  drivers: AccountDriverOption[];
  constructorPositions: Record<string, number>;
  driverPositions: Record<string, number>;
  initialProfile: ProfileSnapshot | null;
};

type AvailabilityState = "idle" | "checking" | "available" | "taken" | "invalid" | "error";

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
  const accountPayload = readAccountApiData<{ profile?: unknown }>(payload);
  const candidateProfile =
    accountPayload && typeof accountPayload === "object" && "profile" in accountPayload
      ? accountPayload.profile
      : payload && typeof payload === "object" && "profile" in payload
        ? (payload as Record<string, unknown>).profile
        : null;

  if (!candidateProfile || typeof candidateProfile !== "object") {
    return null;
  }

  const profile = candidateProfile as Record<string, unknown>;
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
  hasProfilePersistence,
  privacyContactEmail,
  constructors,
  drivers,
  constructorPositions,
  driverPositions,
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
  const [isExporting, setIsExporting] = useState(false);
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
  const constructorAsset = useMemo(() => getTeamAsset(constructorId || savedProfile?.favoriteConstructorId), [constructorId, savedProfile?.favoriteConstructorId]);
  const selectedDriverTeamAsset = useMemo(
    () => getTeamAsset(selectedDriver?.teamId ?? constructorId ?? savedProfile?.favoriteConstructorId),
    [constructorId, savedProfile?.favoriteConstructorId, selectedDriver?.teamId],
  );

  const usernameLockEndsOn = formatLockDate(savedProfile?.usernameLockedUntil ?? null);
  const usernameLocked = Boolean(
    savedProfile?.usernameIsCustom && savedProfile.usernameLockedUntil && new Date(savedProfile.usernameLockedUntil).getTime() > countdownNow,
  );
  const usernameCountdown = formatCountdown(savedProfile?.usernameLockedUntil ?? null, countdownNow);
  const profileLockEndsOn = formatLockDate(savedProfile?.profileLockedUntil ?? null);
  const profileLocked = Boolean(savedProfile?.profileLockedUntil && new Date(savedProfile.profileLockedUntil).getTime() > countdownNow);
  const customUsernamePending = username.trim().length > 0 && suggestedUsername && username.trim().toLowerCase() !== suggestedUsername.toLowerCase();
  const displayName = username.trim() || "f1_user";
  const constructorLabel = selectedConstructor?.label ?? "No constructor selected";
  const driverLabel = selectedDriver?.label ?? "No driver selected";
  const usernameInputDisabled = usernameLocked || !isUsernameEditing;
  const activeTheme = getProfileTheme(savedProfile?.favoriteConstructorId);
  const constructorFieldLocked = profileLocked;
  const avatarFieldLocked = profileLocked;
  const constructorLogoMedia = constructorAsset.badgeAssetPath;
  const driverIdentityMedia = selectedDriver?.photoPath ?? selectedDriver?.fallbackPhotoPath ?? null;
  const constructorStanding = selectedConstructor ? constructorPositions[selectedConstructor.id] ?? null : null;
  const driverStanding = selectedDriver ? driverPositions[selectedDriver.id] ?? null : null;
  const usernameHintMessage = usernameLocked
    ? `Custom username locked${usernameLockEndsOn ? ` until ${usernameLockEndsOn}` : ""}.`
    : availabilityState === "checking"
      ? "Checking availability..."
      : availabilityState === "error"
        ? availabilityMessage || "Username availability could not be checked right now."
        : isUsernameEditing
          ? availabilityMessage || ""
          : "";
  const constructorHintMessage =
    constructorFieldLocked && profileLockEndsOn ? `Constructor locked until ${profileLockEndsOn}.` : constructorFieldLocked ? "Constructor locked." : "";
  const avatarHintMessage =
    avatarFieldLocked && profileLockEndsOn ? `Profile image style locked until ${profileLockEndsOn}.` : avatarFieldLocked ? "Profile image style locked." : "";

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
        const response = await fetch(
          buildUsernameSuggestUrl({ constructorId, driverId }),
          { signal: controller.signal },
        );
        const payload = (await response.json().catch(() => null)) as { username?: string; error?: string } | null;
        if (!response.ok || !payload?.username) {
          setAvailabilityState("error");
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
          setAvailabilityState("error");
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
        const response = await fetch(buildUsernameCheckUrl(username), { signal: controller.signal });
        const payload = (await response.json().catch(() => null)) as { available?: boolean; error?: string } | null;
        if (!response.ok) {
          const isValidationFailure = response.status === 400;
          const state = isValidationFailure ? "invalid" : "error";
          const message = isValidationFailure
            ? payload?.error ?? "That username cannot be used."
            : "Username availability could not be checked right now.";
          setAvailabilityState(state);
          setAvailabilityMessage(message);
          lastUsernameCheckRef.current = { username: normalizedUsername, state, message };
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
          setAvailabilityState("error");
          setAvailabilityMessage("Username availability could not be checked right now.");
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
      const response = await fetch(ACCOUNT_API_ROUTES.profile, {
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
      setErrorMessage("Profile saving is unavailable right now.");
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

  const handleExport = async () => {
    setIsExporting(true);
    setErrorMessage("");
    setNoticeMessage("");

    try {
      const response = await fetch(ACCOUNT_API_ROUTES.export, { method: "POST" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string | { message?: string } } | null;
        setErrorMessage(readClientErrorMessage(payload, "Unable to export your account data right now."));
        return;
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = "f1-insightx-account-export.json";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
      setNoticeMessage("Account data export downloaded.");
    } catch {
      setErrorMessage(getNetworkErrorMessage("Account export"));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <main className={`subpage-shell account-page ${activeTheme.className}`} style={activeTheme.style}>
      <header className="account-profile-header">
        <div className="account-profile-hero">
          <div className="account-profile-strip">
            <article className="account-profile-hero__snapshot-card account-profile-hero__snapshot-card--constructor">
              <div className="account-profile-hero__snapshot-media account-profile-hero__snapshot-media--team">
                {constructorLogoMedia ? (
                  <AssetImage
                    src={constructorLogoMedia}
                    fallbackSrc={constructorAsset.fallbackImagePath}
                    alt={`${constructorLabel} logo`}
                    fill
                    className="account-profile-hero__snapshot-image account-profile-hero__snapshot-image--logo"
                    sizes="112px"
                    priority
                    style={{ objectFit: "contain", objectPosition: "center center" }}
                  />
                ) : (
                  <div className="account-profile-hero__snapshot-fallback">{constructorLabel}</div>
                )}
              </div>
              <div className="account-profile-hero__snapshot-copy">
                <strong>{constructorLabel}</strong>
                <p>{constructorStanding ? `P${constructorStanding} - Constructors Championship` : "Constructors Championship"}</p>
              </div>
            </article>

            <div className="account-profile-strip__username">
              <h1 className="subpage-title">{displayName}</h1>
            </div>

            <article className="account-profile-hero__snapshot-card account-profile-hero__snapshot-card--driver">
              <div
                className="account-profile-hero__snapshot-media account-profile-hero__snapshot-media--driver"
                style={
                  {
                    "--driver-team-primary": selectedDriverTeamAsset.primary,
                    "--driver-team-accent": selectedDriverTeamAsset.accent,
                  } as CSSProperties
                }
              >
                {driverIdentityMedia ? (
                  <AssetImage
                    src={driverIdentityMedia}
                    fallbackSrc={selectedDriver?.fallbackPhotoPath ?? "/assets/drivers/driver-placeholder.svg"}
                    alt={`${driverLabel} portrait`}
                    fill
                    className="account-profile-hero__snapshot-image"
                    sizes="112px"
                    style={{ objectFit: "contain", objectPosition: "center center" }}
                  />
                ) : (
                  <div className="account-profile-hero__snapshot-fallback">{driverLabel}</div>
                )}
              </div>
              <div className="account-profile-hero__snapshot-copy">
                <strong>{driverLabel}</strong>
                <p>{driverStanding ? `P${driverStanding} - Drivers Championship` : "Drivers Championship"}</p>
              </div>
            </article>
          </div>
        </div>
      </header>

      <section className="account-profile-layout">
        <section className="workspace-panel account-profile-editor">
          <div className="account-profile-editor__header">
            <div className="account-profile-editor__copy">
              <strong>Identity settings</strong>
              <p>Choose the constructor, driver, and identity style tied to your profile.</p>
            </div>
          </div>

          {!hasProfilePersistence ? (
            <div className="status-banner">
              Profile saving is temporarily unavailable.
            </div>
          ) : null}

          {usernameLocked && usernameLockEndsOn ? (
            <div className="status-banner">Custom username locked until {usernameLockEndsOn}.</div>
          ) : null}

          {pendingConfirmation ? (
            <div className="account-feedback account-feedback--notice">
              Saving a custom username locks edits for 7 days.
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
                {usernameHintMessage ? (
                  <small
                    className={`account-field__hint ${
                      availabilityState === "taken" || availabilityState === "invalid"
                        ? "is-error"
                        : availabilityState === "available"
                          ? "is-success"
                          : ""
                    }`}
                  >
                    {usernameHintMessage}
                  </small>
                ) : null}
              </label>
              <label className="account-field">
                <span>Email</span>
                <input type="email" value={email} disabled />
              </label>
            </div>

            <div className="account-field-grid account-field-grid--paired">
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
              </label>
              {constructorHintMessage ? <small className="account-field-grid__note">{constructorHintMessage}</small> : null}
            </div>

            <fieldset className={`account-radio-group account-radio-group--identity ${avatarFieldLocked ? "is-disabled" : ""}`}>
              <legend>Profile image</legend>
              <label className={avatarType === "constructor_logo" ? "is-selected" : ""}>
                <input
                  type="radio"
                  name="profile-avatar"
                  checked={avatarType === "constructor_logo"}
                  onChange={() => setAvatarType("constructor_logo")}
                  disabled={avatarFieldLocked}
                />
                <div className="account-radio-card__media account-radio-card__media--team">
                  <AssetImage
                    src={constructorAsset.badgeAssetPath ?? constructorAsset.carImagePath ?? constructorAsset.fallbackImagePath}
                    fallbackSrc={constructorAsset.fallbackImagePath}
                    alt={`${constructorLabel} identity`}
                    fill
                    className="account-radio-card__image account-radio-card__image--team"
                    sizes="112px"
                    style={{ objectFit: constructorAsset.badgeAssetPath ? "contain" : "cover", objectPosition: constructorAsset.imagePosition ?? "center center" }}
                  />
                </div>
                <div className="account-radio-card__copy">
                  <strong>Use constructor identity</strong>
                  <span>{constructorLabel}</span>
                </div>
              </label>
              <label className={avatarType === "driver_image" ? "is-selected" : ""}>
                <input
                  type="radio"
                  name="profile-avatar"
                  checked={avatarType === "driver_image"}
                  onChange={() => setAvatarType("driver_image")}
                  disabled={avatarFieldLocked}
                />
                <div
                  className="account-radio-card__media account-radio-card__media--driver"
                  style={
                    {
                      "--driver-team-primary": selectedDriverTeamAsset.primary,
                      "--driver-team-accent": selectedDriverTeamAsset.accent,
                    } as CSSProperties
                  }
                >
                  {driverIdentityMedia ? (
                    <AssetImage
                      src={driverIdentityMedia}
                      fallbackSrc={selectedDriver?.fallbackPhotoPath ?? "/assets/drivers/driver-placeholder.svg"}
                      alt={`${driverLabel} portrait`}
                      fill
                      className="account-radio-card__image"
                      sizes="112px"
                      style={{ objectFit: "contain", objectPosition: "center center" }}
                    />
                  ) : (
                    <div className="account-radio-card__fallback">{selectedDriver?.code ?? "DRV"}</div>
                  )}
                </div>
                <div className="account-radio-card__copy">
                  <strong>Use favorite driver image</strong>
                  <span>{driverLabel}</span>
                </div>
              </label>
              {avatarHintMessage ? <small className="account-field__hint">{avatarHintMessage}</small> : null}
            </fieldset>

            <div className="account-form__actions">
              <button className="hero__cta hero__cta--primary" type="submit" disabled={isSaving || !hasProfilePersistence}>
                {isSaving ? "Saving..." : "Save profile"}
              </button>
            </div>
          </form>

          <section className="account-privacy-panel account-privacy-panel--inline">
            <div className="account-profile-identity__copy">
              <strong>Data controls</strong>
              <p>Export your profile data or contact us to request deletion.</p>
            </div>
            <div className="account-form__actions">
              <button className="hero__cta hero__cta--secondary" type="button" onClick={handleExport} disabled={isExporting}>
                {isExporting ? "Preparing export..." : "Download my data"}
              </button>
              <button className="account-signout" type="button" onClick={handleSignOut} disabled={isSigningOut}>
                {isSigningOut ? "Signing out..." : "Sign out"}
              </button>
            </div>
            <p className="account-privacy-panel__note">
              Deletion requests are handled by email.
              {privacyContactEmail ? (
                <>
                  {" "}Contact <a href={`mailto:${privacyContactEmail}?subject=${encodeURIComponent("F1 InsightX account deletion request")}`}>{privacyContactEmail}</a>.
                </>
              ) : (
                " Add a privacy contact before public launch."
              )}
            </p>
            <LegalLinks className="legal-links legal-links--stacked" />
          </section>
        </section>
      </section>
      <AppFooter />
    </main>
  );
}

