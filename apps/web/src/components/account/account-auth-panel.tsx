"use client";

import { startTransition, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LegalLinks } from "@/components/legal/legal-links";
import { getSupabaseBrowserClient } from "@/lib/auth/supabase-browser";
import { getNetworkErrorMessage } from "@/lib/errors/client";

type AccountAuthPanelProps = {
  hasSupabaseAuth: boolean;
  hasProfilePersistence: boolean;
  initialError?: string;
  initialMode?: Mode;
  surface?: "page" | "modal";
  onClose?: () => void;
};

type Mode = "sign-in" | "sign-up";
type SignUpStep = "identity" | "credentials";

const PASSWORD_MIN_LENGTH = 8;

function getFriendlyErrorMessage(message: string) {
  if (!message) return "Something went wrong. Try again.";
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "Email or password is incorrect.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Check your inbox and confirm your email before signing in.";
  }
  if (normalized.includes("user already registered")) {
    return "If an account already exists for this email, sign in or check your inbox for a confirmation link.";
  }
  if (normalized.includes("provider is not enabled") || normalized.includes("unsupported provider")) {
    return "Google sign-in is unavailable right now. Try email sign-in instead.";
  }
  if (normalized.includes("rate limit")) {
    return "Too many attempts were made from this browser. Wait a moment and try again.";
  }

  return message;
}

function readEmailPreview(email: string) {
  const normalized = email.trim();
  if (!normalized) return "Enter an email to continue.";
  return normalized;
}

export function AccountAuthPanel(props: AccountAuthPanelProps) {
  const {
    hasSupabaseAuth,
    hasProfilePersistence,
    initialError,
    initialMode = "sign-in",
    surface = "page",
    onClose,
  } = props;
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [signUpStep, setSignUpStep] = useState<SignUpStep>(initialMode === "sign-up" ? "identity" : "credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState(initialError ? getFriendlyErrorMessage(initialError) : "");
  const [noticeMessage, setNoticeMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const isModalSurface = surface === "modal";

  useEffect(() => {
    if (mode === "sign-up" && signUpStep === "credentials") {
      return;
    }
    setPassword("");
  }, [mode, signUpStep]);

  const switchMode = (nextMode: Mode) => {
    startTransition(() => {
      setMode(nextMode);
      setSignUpStep(nextMode === "sign-up" ? "identity" : "credentials");
      setErrorMessage("");
      setNoticeMessage("");
      setPassword("");
    });
  };

  const handleGoogleSignIn = async () => {
    if (!hasSupabaseAuth) return;

    setErrorMessage("");
    setNoticeMessage("");
    setIsGoogleLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=/account`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });

      if (error) {
        setErrorMessage(getFriendlyErrorMessage(error.message));
      }
    } catch {
      setErrorMessage(getNetworkErrorMessage("Google sign-in"));
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleContinueToSignUp = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setNoticeMessage("");

    if (!hasSupabaseAuth) {
      setErrorMessage("Authentication is unavailable right now.");
      return;
    }

    if (!email.trim()) {
      setErrorMessage("Enter your email to continue.");
      return;
    }

    setSignUpStep("credentials");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setNoticeMessage("");

    if (!hasSupabaseAuth) {
      setErrorMessage("Authentication is unavailable right now.");
      return;
    }

    if (!email.trim()) {
      setErrorMessage("Enter your email.");
      return;
    }

    if (!password.trim() || password.length < PASSWORD_MIN_LENGTH) {
      setErrorMessage("Use a password with at least 8 characters.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = getSupabaseBrowserClient();

      if (mode === "sign-in") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          setErrorMessage(getFriendlyErrorMessage(error.message));
          return;
        }

        router.push("/account");
        router.refresh();
        return;
      }

      const redirectTo = `${window.location.origin}/auth/callback?next=/account`;
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (error) {
        const friendly = getFriendlyErrorMessage(error.message);
        setErrorMessage(friendly);
        return;
      }

      if (data.session) {
        router.push("/account");
        router.refresh();
        return;
      }

      setNoticeMessage("Check your inbox to confirm your email. Once the confirmation completes, you'll land in your profile.");
      setMode("sign-in");
    } catch {
      setErrorMessage(getNetworkErrorMessage(mode === "sign-in" ? "Sign-in" : "Account creation"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const panelClassName = surface === "modal" ? "account-shell account-shell--modal" : "account-shell";

  return (
    <section className={panelClassName}>
      {surface === "page" ? (
        <div className="account-shell__intro">
          <p className="subpage-eyebrow">Profile Access</p>
          <h1 className="subpage-title">Enter your F1 profile.</h1>
          <p className="race-detail__lede">
            Sign in to return to your profile, or create a new account and finish the rest of your identity inside the product.
          </p>
          <div className="account-preview account-preview--gateway">
            <div className="account-entry__mark account-entry__mark--large" aria-hidden="true">
              <span className="account-entry__glyph" />
            </div>
            <div className="account-preview__copy">
              <span>Profile destination</span>
              <strong>One account, one profile</strong>
              <p>Strategy Lab, Analytics, and your saved identity meet in one place.</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className={`account-card ${surface === "modal" ? "account-card--modal" : ""}`}>
        {surface === "modal" ? (
          <div className="account-card__modal-header">
            <div className="account-card__modal-copyblock">
              <p className="subpage-eyebrow">Account</p>
              <h2 id="account-modal-title" className="account-card__modal-title">
                Enter F1 InsightX
              </h2>
              <p className="account-card__modal-copy">Sign in or create a profile.</p>
            </div>
            {onClose ? (
              <button type="button" className="account-modal__close" onClick={onClose} aria-label="Close profile access dialog">
                <span />
                <span />
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="account-card__tabs" role="tablist" aria-label="Account mode">
          <button type="button" className={mode === "sign-in" ? "is-active" : ""} onClick={() => switchMode("sign-in")}>
            Sign in
          </button>
          <button type="button" className={mode === "sign-up" ? "is-active" : ""} onClick={() => switchMode("sign-up")}>
            Sign up
          </button>
        </div>

        {!hasSupabaseAuth ? (
          <div className="status-banner">
            Authentication is temporarily unavailable right now. Check the Supabase connection.
          </div>
        ) : null}
        {hasSupabaseAuth && !hasProfilePersistence ? (
          <div className="status-banner">
            Profile customization is temporarily unavailable. Sign-in still works.
          </div>
        ) : null}

        {errorMessage ? <div className="account-feedback account-feedback--error">{errorMessage}</div> : null}
        {noticeMessage ? <div className="account-feedback account-feedback--notice">{noticeMessage}</div> : null}

        {mode === "sign-up" && signUpStep === "identity" ? (
          <form className={`account-form ${isModalSurface ? "account-form--modal" : ""}`} onSubmit={handleContinueToSignUp}>
            <div className="account-form__section account-form__section--first">
              <div className="account-form__heading">
                <strong>Create your profile</strong>
                {isModalSurface ? <p>Email first. Finish the rest inside your profile.</p> : <p>Start with your email, or use Google and go straight into your profile.</p>}
              </div>
              <label className="account-field">
                <span>Email</span>
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@raceweek.com" />
              </label>
            </div>

            <div className={`account-form__actions account-form__actions--stacked ${isModalSurface ? "account-form__actions--modal" : ""}`}>
              <button className="hero__cta hero__cta--primary" type="submit" disabled={!hasSupabaseAuth}>
                Continue with email
              </button>
              <button
                className="hero__cta hero__cta--secondary"
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading || !hasSupabaseAuth}
              >
                {isGoogleLoading ? "Opening Google..." : "Continue with Google"}
              </button>
            </div>
          </form>
        ) : (
          <form className={`account-form ${isModalSurface ? "account-form--modal" : ""}`} onSubmit={handleSubmit}>
            <div className="account-form__section account-form__section--first">
              <div className="account-form__heading">
                <strong>{mode === "sign-in" ? "Sign in" : "Finish your account"}</strong>
                {isModalSurface ? (
                  <p>{mode === "sign-in" ? "Email and password, or Google." : `Password for ${readEmailPreview(email)}.`}</p>
                ) : (
                  <p>
                    {mode === "sign-in"
                      ? "Use your email and password or jump in with Google."
                      : `Use ${readEmailPreview(email)} as the account email, then set a secure password.`}
                  </p>
                )}
              </div>

              <div className="account-field-grid">
                <label className="account-field">
                  <span>Email</span>
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@raceweek.com" />
                </label>
                <label className="account-field">
                  <span>Password</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={mode === "sign-in" ? "Enter your password" : "At least 8 characters"}
                  />
                  {mode === "sign-up" && !isModalSurface ? (
                    <small className="account-field__hint">
                      A default username is created automatically. You can review your avatar, favorites, and username after you land in your profile.
                    </small>
                  ) : null}
                </label>
              </div>
            </div>

            <div className={`account-form__actions ${isModalSurface ? "account-form__actions--modal" : ""}`}>
              <button className="hero__cta hero__cta--primary" type="submit" disabled={isSubmitting || !hasSupabaseAuth}>
                {isSubmitting ? "Working..." : mode === "sign-up" ? "Create account" : "Sign in"}
              </button>
              <button
                className="hero__cta hero__cta--secondary"
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading || !hasSupabaseAuth}
              >
                {isGoogleLoading ? "Opening Google..." : "Continue with Google"}
              </button>
              {mode === "sign-up" ? (
                <button type="button" className="account-inline-link" onClick={() => setSignUpStep("identity")}>
                  Change email
                </button>
              ) : null}
            </div>
          </form>
        )}

        <div className={`account-legal-copy ${isModalSurface ? "account-legal-copy--modal" : ""}`}>
          {isModalSurface
            ? "Privacy, cookies, and terms apply."
            : "By creating an account or signing in, you acknowledge the Privacy Policy and Cookie Notice and agree to the Terms of Use."}
          <LegalLinks className="legal-links legal-links--inline" />
        </div>
      </div>
    </section>
  );
}
