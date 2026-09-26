# StreamBoXX upgrade plan

This is an implementation plan for the existing React, Supabase, Cloudflare Stream, Daraja, and Pages project. It does not replace the existing app or enable unapproved payments/content.

## Current foundation

- Supabase email/password accounts, an account profile, an email-account-based 48-hour trial, watchlist, owner assignment, and an owner dashboard exist.
- The owner can record title and poster rights, attach a Cloudflare Stream asset, and publish only after rights and media checks pass.
- Signed Cloudflare playback and the Daraja STK Push/callback flow exist. Public checkout remains disabled; the current checkout adapter handles one KES 50 daily pass.
- The public site has installable PWA files and a lawful public archive. The public archive currently has short films and one official series source; it does not yet provide a rights-cleared African/Asian feature catalogue.
- The latest code now waits for Supabase phone confirmation before starting a 48-hour trial and records one claim per verified phone. The owner still must apply the new migration and configure an SMS provider in Supabase before this works on the public site.

## Phased implementation

### Phase 1 — Catalogue foundation (implemented in code; database migration pending)

- Separate feature films, series, shorts, and trailers in navigation and catalogue metadata.
- Add African, Asian, and global content classifications without inventing catalogue titles.
- Add language, country, duration, director, age rating, and download permission metadata.
- Record licence start/end, territory, and explicit streaming permission; prevent publication without current streaming permission and ready signed media.
- Add season and episode tables for series administration.

### Phase 2 — Trial identity and access plans (phone trial implemented; plan system remains)

- Configure and test Supabase phone OTP delivery and verified-phone uniqueness.
- Phone trial claims now start only after verified phone confirmation and prevent reusing a claimed number for another account. Validate that behavior against Supabase SMS before launch.
- Add editable African/Asian daily and monthly plan settings, with monthly prices unset until the owner selects them.
- Enforce the selected plan and title category on the server before signing playback URLs.

### Phase 3 — Payment provider connection

- Keep sandbox and production credentials separate in Supabase Edge Function secrets.
- Add plan-aware checkout only after the approved PayBill/Buy Goods product and amount rules are known.
- Validate pending, success, failed, cancelled, duplicate, reversal, and refund records with Daraja sandbox callbacks.
- Keep real-money payments disabled until Safaricom approves the merchant setup and owner runs production checks.

### Phase 4 — Viewer experience

- Add a clear welcome and onboarding flow, account recovery, account settings, persistent watchlist, profiles, and viewing history.
- Add rich title/series details, searchable cast/crew/language/country metadata, recommendations, and notification preferences.
- Add responsive subtitles and quality controls where the uploaded authorized media and captions support them.
- Keep downloads disabled unless the title's licence expressly permits offline copies and a secure implementation is ready.

### Phase 5 — Operations and launch

- Add pricing/content homepage controls and owner reporting after the backend data model is live.
- Configure policies, support, monitoring, backups, account deletion, production domain, and privacy/legal documents.
- Complete the launch gates in `LAUNCH_CHECKLIST.md`; then publish a tagged release and update the public Pages deployment from the repository.

## Proposed category access rules

These are the default rules for the next access-control implementation; current paid checkout is not yet plan-aware.

| Title category | African day/month plan | Asian day/month plan | No active access |
|---|---:|---:|---:|
| African | Allow | Deny by default; owner may later enable cross-access in settings | Deny for premium titles |
| Asian | Deny | Allow | Deny for premium titles |
| Global | Deny unless explicitly configured as included/free | Deny unless explicitly configured as included/free | Only titles marked free and rights-cleared |

An Asian plan does not automatically include African premium titles. Each plan may later include an explicit configurable cross-access rule. A public-domain licence alone does not mean a title is free to StreamBoXX to redistribute or monetize; the owner must verify streaming, artwork, and territory rights.

## Current launch gates

- [ ] Apply the catalogue/rights extension migration to the connected Supabase project.
- [ ] Verify signup confirmation and account/owner access on the public domain.
- [ ] Configure verified-phone OTP and trial uniqueness, or keep the current email-based trial description accurate.
- [ ] Configure and enforce plan-based African/Asian access server-side before exposing new prices.
- [ ] Obtain rights and artwork evidence plus ready signed media for each public catalogue title.
- [ ] Finish the approved Safaricom product setup, sandbox callback validation, and production payment checks.
- [ ] Finish support, privacy, terms, deletion, monitoring, backup, domain, and device-install checks.
