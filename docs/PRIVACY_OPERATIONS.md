# Privacy operations for F1 InsightX

Last reviewed: 2026-10-08. This is a personal, US-based project with a worldwide audience. There are no paid plans, ads, sponsorships, cash prizes, betting, or marketing emails in the current product.

Public privacy contact: `f1.insightx@gmail.com`. The owner has chosen to keep their personal name private. Before intentionally targeting EU/UK residents, obtain jurisdiction-specific advice on whether the public operator identity and address disclosures are sufficient.

## Data map

| Data | Purpose | Where it lives | Deletion path |
| --- | --- | --- | --- |
| Google identity, email, provider metadata, session | Sign-in | Supabase Auth; session in the user's browser local storage | Account deletion calls Supabase Auth Admin `deleteUser`; client signs out |
| Username, avatar choice and profile dates | Account profile | Supabase `user_profiles` | `ON DELETE CASCADE` from `auth.users` |
| Submitted race picks from the earlier database flow | Picks | Supabase `user_race_picks` | `ON DELETE CASCADE` from `auth.users` |
| Current picks | Picks and scoring | User-specific browser local storage key `f1ix.picks.v1.<user id>` | Account deletion removes the current browser's key; users must clear other browsers separately |
| Server and platform request/error logs | Delivery, security and diagnosis | Hosting and service-provider systems | Follow each provider's retention and deletion controls; verify actual settings before publishing a fixed period |

The current active source has no advertising pixel, newsletter sender, third-party behavioral analytics, or payment processing. Recheck the production network and hosting dashboard before relying on this inventory. The optional sidebar UI component writes `sidebar_state` for seven days if rendered.

## Request handling

1. Accept privacy requests through the published contact address. Never ask for a password or bearer token by email.
2. Ask the requester to sign in and use the account controls when possible. For other requests, verify identity using information already held; avoid collecting extra identity documents unless necessary.
3. Record receipt date, request type, verification step, action, and response date in a private log. Do not put tokens or full personal records in the log.
4. Export: the account screen downloads auth summary, profile, database picks and current-browser picks. Other-device browser picks cannot be fetched by the server.
5. Delete: the account screen deletes the Supabase Auth user and its cascading profile/database picks, signs out, and clears picks on the current device. Check provider backup retention and legal exceptions before promising immediate erasure from backups.
6. Handle correction and other rights requests manually until a suitable in-product flow exists. Apply the response periods of the relevant law; for UK/EU requests, the usual deadline is one month, subject to valid extensions.

## Vendor and transfer checks

- Keep a private inventory of the actual contracting entity, data region, subprocessors, retention settings and access roles for Supabase, hosting (including Vercel/Lovable if used), and Google OAuth.
- Review and accept each applicable data processing agreement in the provider account. Confirm the transfer mechanism for EU/UK personal data if processing or access occurs outside those regions. Retain a copy or record of acceptance.
- Limit production admin access, enable MFA, keep `SUPABASE_SERVICE_ROLE_KEY` server-only, rotate compromised secrets, and review provider security and breach notifications.
- Publish only facts verified in the provider dashboards. A repository cannot accept vendor contracts or verify production account settings.

## Changes that require a new review

- Analytics, ads, pixels, sponsorships or affiliate links: inventory all storage and network calls, update notices, and add consent controls before nonessential tracking starts where required.
- Marketing email: separate opt-in, unsubscribe handling, sender details and jurisdiction-specific email rules. Do not add users to a mailing list because they signed in.
- Payments, paid subscriptions, stakes or prizes: review consumer, tax, promotion and gaming rules before launch. Current picks must remain free with no cash value.
- Children: the account flow asks users to confirm they are at least 16. If the service becomes child-directed or the operator knows an account belongs to a younger child, disable that account and obtain jurisdiction-specific advice before processing further data.
- New personal-data fields or vendors: update the data map, privacy notice, retention schedule and access/deletion flows.

## Incident procedure

1. Preserve evidence and revoke exposed credentials or access promptly.
2. Determine what data, users and vendors are affected; record the timeline and containment actions.
3. Contact affected processors, assess applicable notification deadlines, and notify regulators/users where the law requires it.
4. Fix the cause, verify the fix, and document follow-up actions. Do not include personal data or secrets in public issue reports.
