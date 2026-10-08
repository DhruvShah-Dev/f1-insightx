import { Link } from "@tanstack/react-router";
import type { ComponentType, FormEvent, ReactNode } from "react";
import { ArrowUpRight, Download, Flag, Lock, LogOut, RefreshCw, Save, Shield, Trash2 } from "lucide-react";
import { constructorStandings, driverStandings, seasonState, teams } from "@/data/season";
import { fmtDateTime } from "@/lib/format";

type AvatarOption = { id: string; label: string; icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }> };

export function AccountDashboard({
  identityName, email, userId, providerAvatar, username, savedUsername, avatarType, avatars,
  createdAt, profileLockedUntil, usernameLocked, profileLocked, lockCopy, saveState, message,
  onUsernameChange, onAvatarChange, onSave, onSignOut, onExport, onDelete,
  dataAction, deleteConfirmation, onDeleteConfirmationChange, avatarFallback,
}: {
  identityName: string;
  email: string;
  userId: string;
  providerAvatar: string;
  username: string;
  savedUsername: string;
  avatarType: string;
  avatars: readonly AvatarOption[];
  createdAt: string | null;
  profileLockedUntil: string | null;
  usernameLocked: boolean;
  profileLocked: boolean;
  lockCopy: string;
  saveState: "idle" | "saving" | "saved" | "error";
  message: string;
  onUsernameChange: (value: string) => void;
  onAvatarChange: (value: string) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onSignOut: () => void;
  onExport: () => void;
  onDelete: () => void;
  dataAction: "idle" | "exporting" | "deleting";
  deleteConfirmation: string;
  onDeleteConfirmationChange: (value: string) => void;
  avatarFallback: ReactNode;
}) {
  const leader = driverStandings[0]!;
  const leadingTeam = constructorStandings[0]!;

  return <div className="account-dashboard">
    <div className="account-dashboard-head">
      <div><p className="account-eyebrow">ACCOUNT / {seasonState.season}</p><h1>Your <em>account.</em></h1></div>
      <Link to="/picks" className="account-head-link">Go to picks <ArrowUpRight aria-hidden="true" /></Link>
    </div>

    <div className="account-main-grid">
      <section className="account-identity" aria-labelledby="identity-title">
        <div className="account-identity-top"><span className="account-section-label"><Shield aria-hidden="true" /> Your identity</span><span className="account-connected"><i /> Connected</span></div>
        <div className="account-identity-body">
          <div className="account-personal-avatar">{providerAvatar ? <img src={providerAvatar} alt="" referrerPolicy="no-referrer" /> : avatarFallback}</div>
          <div className="account-identity-copy"><p id="identity-title">{identityName}</p><strong>@{savedUsername}</strong><span>{email}</span></div>
        </div>
        <div className="account-identity-foot"><span>Google account</span><span>{createdAt ? `Member since ${new Date(createdAt).getFullYear()}` : "Profile loading"}</span></div>
      </section>

      <section className="account-season" aria-labelledby="account-season-title">
        <div className="account-season-copy">
          <p className="account-section-label">Season snapshot <span>/{seasonState.season}</span></p>
          <h2 id="account-season-title">The season,<br /><em>at a glance.</em></h2>
          <div className="account-season-facts">
            <div><span>Latest result</span><strong>R{seasonState.resultsThrough.round} · {seasonState.resultsThrough.name}</strong></div>
            <div><span>Driver leader</span><strong>{leader.name} · {leader.points} pts</strong></div>
            <div><span>Team leader</span><strong>{teams[leadingTeam.team].name} · {leadingTeam.points} pts</strong></div>
          </div>
          <Link to="/championship" className="account-season-link">View championship <ArrowUpRight aria-hidden="true" /></Link>
        </div>
        <div className="account-season-visual" aria-hidden="true"><span className="account-season-orbit" /><img className="account-season-driver" src={`/assets/drivers/2026/full-body/front/${leader.code.toLowerCase()}.png`} alt="" /><img className="account-season-team" src={`/assets/teams/logos/2026/white-svg/${leader.team}.svg`} alt="" /></div>
      </section>
    </div>

    <div className="account-lower-grid">
      <section className="account-editor" aria-labelledby="account-editor-title">
        <SectionTitle index="01 / 02" eyebrow="PROFILE" title="Make it yours." id="account-editor-title" />
        <form onSubmit={onSave}>
          <div className="account-field-head"><label htmlFor="username">Username</label><span>{usernameLocked ? <Lock aria-hidden="true" /> : null}{usernameLocked ? "Locked" : "Editable"}</span></div>
          <div className="account-input-wrap"><span>@</span><input id="username" value={username} onChange={(event) => onUsernameChange(event.target.value)} minLength={3} maxLength={24} disabled={usernameLocked} autoComplete="username" /></div>
          <p className="account-field-hint">{lockCopy}</p>
          <div className="account-avatar-head"><span>Avatar</span><small>{profileLocked ? "Locked" : "Choose a mark"}</small></div>
          <div className="account-avatar-options" role="group" aria-label="Avatar type">{avatars.map((avatar) => { const Icon = avatar.icon; return <button key={avatar.id} type="button" onClick={() => onAvatarChange(avatar.id)} disabled={profileLocked} aria-pressed={avatarType === avatar.id} className={avatarType === avatar.id ? "is-selected" : ""}><Icon aria-hidden={true} /><span>{avatar.label}</span></button>; })}</div>
          <div className="account-form-end"><button type="submit" disabled={saveState === "saving" || profileLocked} className="account-save">{saveState === "saving" ? <RefreshCw className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />} Save changes</button><p className={saveState === "error" ? "is-error" : ""} role={saveState === "error" ? "alert" : "status"}>{message}</p></div>
        </form>
      </section>

      <aside className="account-details" aria-labelledby="account-details-title">
        <SectionTitle index="02 / 02" eyebrow="ACCOUNT" title="The details." id="account-details-title" />
        <dl>
          <Detail label="Email" value={email} />
          <Detail label="User ID" value={userId.slice(0, 8)} />
          <Detail label="Joined" value={createdAt ? fmtDateTime(createdAt) : "Pending"} />
          <Detail label="Profile lock" value={profileLocked && profileLockedUntil ? fmtDateTime(profileLockedUntil) : "Open"} />
        </dl>
        <div className="account-details-bottom"><span><Flag aria-hidden="true" /> Data through R{seasonState.resultsThrough.round}</span><button type="button" onClick={onSignOut}><LogOut aria-hidden="true" /> Sign out</button></div>
      </aside>
    </div>
    <section className="account-data-controls" aria-labelledby="account-data-title">
      <h2 id="account-data-title">Your data</h2>
      <p>Download your account details and picks. Browser picks are saved on this device, so export from each device you use.</p>
      <button type="button" onClick={onExport} disabled={dataAction !== "idle"}><Download aria-hidden="true" /> {dataAction === "exporting" ? "Preparing download…" : "Download my data"}</button>
      <div className="account-delete-controls">
        <h3>Delete your account</h3>
        <p>This permanently removes your Google sign-in record, F1 InsightX profile, and submitted picks. It also clears picks saved in this browser. Type DELETE to confirm.</p>
        <label htmlFor="delete-confirmation">Confirmation</label>
        <input id="delete-confirmation" value={deleteConfirmation} onChange={(event) => onDeleteConfirmationChange(event.target.value)} autoComplete="off" />
        <button type="button" className="account-delete-button" onClick={onDelete} disabled={deleteConfirmation !== "DELETE" || dataAction !== "idle"}><Trash2 aria-hidden="true" /> {dataAction === "deleting" ? "Deleting…" : "Permanently delete account"}</button>
      </div>
      <p>For access, correction, or deletion help, see the <Link to="/privacy">Privacy Policy</Link>.</p>
    </section>
  </div>;
}

function SectionTitle({ index, eyebrow, title, id }: { index: string; eyebrow: string; title: string; id: string }) {
  return <div className="account-section-heading"><div><p className="account-eyebrow">{eyebrow}</p><h2 id={id}>{title}</h2></div><span>{index}</span></div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="account-detail-row"><dt>{label}</dt><dd title={value}>{value}</dd></div>;
}
