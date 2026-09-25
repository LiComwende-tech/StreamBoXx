# StreamBoXx backend foundation

The migration in `migrations/` is a starting schema for Supabase Auth, viewer profiles, the two-day trial, a rights-aware catalogue, private media storage, viewer lists/progress, and KES 50 daily-pass records.

## Security design

- A single owner is designated manually in `owner_control`; there is no first-visitor or self-service admin claim.
- Viewer permissions are enforced by PostgreSQL grants and row-level security (RLS), not by hiding controls in the website.
- New accounts receive a server-timestamped 48-hour trial. Viewers cannot edit their trial or payment records.
- Paid access is derived only from a server-confirmed pass with a receipt and an active time window. A payment request or browser redirect must never grant access.
- The public title table contains viewer-safe metadata only. Private rights evidence is kept in a separate owner-only table. Publishing requires a private content-rights reference, a cleared-rights timestamp, a ready streaming asset, and (when poster artwork is used) a separate artwork-rights reference. Database triggers reject publication when any requirement is missing and unpublish titles if rights or media are later withdrawn.
- StreamBoXx production builds read only published title rows from Supabase. Fictional sample titles and the external test player are development-only and are excluded from the production bundle.
- Playback requests go through the `stream-access` Edge Function. It validates the viewer's Supabase token, checks `has_streamboxx_access()`, requires a published title and ready asset, then issues an expiring provider token or signed object URL for each available authorized server (up to eight). Cloudflare Stream HLS uses one-hour signed tokens; Supabase Storage currently accepts only single-file MP4/M4V/WebM paths. Viewers can choose among available servers in the player. Never publish raw provider URLs.
- Cloudflare Stream assets must have signed URLs required at the provider, and their database provider must be `cloudflare_stream`. Supabase Storage objects remain in the private `streamboxx-media` bucket with provider `supabase_storage`. A provider asset ID is a Cloudflare video ID or an object path inside that bucket.
- Cloudflare Stream subtitle/caption tracks in the HLS manifest are surfaced as a subtitle menu by the player; available audio tracks and video qualities are selectable too. Cloudflare Stream accepts WebVTT (`.vtt`) captions. Add a separate, properly licensed subtitle file per language to the video using Cloudflare's caption API, then play the title to confirm that the language appears. A track is shown only when that selected server's stream actually provides it. Supabase Storage single-file playback does not yet have subtitle-file management.
- The `mpesa-checkout` Edge Function starts the KES 50 STK Push using a server-selected PayBill or Buy Goods adapter. The `mpesa-callback` function verifies successful callbacks against Daraja STK Query before calling the server-only atomic pass-completion function. Browser input, a redirect, or an unverified callback cannot create paid access.
- The browser may receive only Supabase's publishable key. Put secret keys, M-Pesa credentials, and callback verification secrets in Edge Function secrets or another server-only secret store. A desktop/mobile package is also a public client and cannot protect secrets.

## Connect a project

1. Create a Supabase project under an account controlled by the StreamBoXx owner. Configure email sign-in and the public site's allowed redirect URLs in the Auth settings.
2. Install and sign in to the Supabase CLI. Link this folder to the new project and apply migrations with `supabase db push`. Keep future schema changes in migration files; do not make untracked production schema edits in the dashboard.
3. Create the owner account through the Auth signup flow and verify its email. In the Supabase dashboard, copy that exact user's UUID from Authentication → Users.
4. Using the SQL editor as the project owner, set the singleton once, replacing the UUID with the verified owner account's UUID:

   ```sql
   update public.owner_control
   set owner_user_id = 'OWNER-USER-UUID', updated_at = now()
   where singleton = true and owner_user_id is null;
   ```

   Confirm one row changed, and then sign in with that account. Do not make this a public API or include a secret key in the app.
5. Copy the project URL and publishable key into a local `.env` file as `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. `.env` is ignored by Git. Do not use the service/secret key for either variable.
6. Before production, apply and review the migration on a disposable local or staging project, check the RLS allow/deny behavior for owner, viewer, and signed-out roles, and inspect the storage policies. Do not push this starter migration into an existing database that has not been reviewed.

## Deploy playback and payment functions

Deploy the migration before the functions. Install and authenticate the Supabase CLI, then deploy each function from the project folder:

```powershell
supabase functions deploy stream-access
supabase functions deploy mpesa-checkout
supabase functions deploy mpesa-callback
supabase functions deploy register-stream-asset
```

Set Edge Function secrets in Supabase, never in `.env`, source code, or a client app. For deliberate sandbox tests, configure `MPESA_CHECKOUT_ENABLED=true`, `MPESA_ENVIRONMENT=sandbox`, and `MPESA_PRODUCT=paybill` or `buygoods`, along with `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_PASSKEY`, `MPESA_CALLBACK_SECRET`, and `MPESA_CALLBACK_URL`. For Buy Goods, additionally set `MPESA_TILL_NUMBER` to the Safaricom-issued Till value. The code maps PayBill to `CustomerPayBillOnline` and Buy Goods to `CustomerBuyGoodsOnline`; Safaricom must confirm your merchant setup and support the selected sandbox transaction before enabling it. Set `MPESA_CALLBACK_URL` to the deployed HTTPS endpoint with the same long random secret in its `token` query parameter, for example `https://PROJECT.supabase.co/functions/v1/mpesa-callback?token=LONG_RANDOM_SECRET`. Also set `STREAMBOXX_ALLOWED_ORIGINS` to the exact HTTPS site origins that may call playback and checkout, comma-separated. For local testing, include the precise local Vite origin.

Daraja credentials and the shortcode/passkey must belong to the owner's Safaricom setup. Start in the Daraja sandbox. Before production, complete Safaricom's Go Live steps and replace sandbox credentials with production credentials. Checkout defaults to disabled. The server-side product setting selects the matching transaction type, and Buy Goods requires a separate Till number. Production mode additionally requires `MPESA_LIVE_PAYMENTS_ENABLED=true`; keep it unset and keep `VITE_ENABLE_CHECKOUT=false` until Safaricom approves the actual merchant product, production app, callback, and live credentials. The adapter selection is implemented but must be verified with Safaricom sandbox credentials before relying on Buy Goods.

The account screen hides paid checkout by default. Keep `VITE_ENABLE_CHECKOUT=false` while the correct Safaricom product is pending. Set it to `true` only in the desired website build environment after the matching checkout Edge Function and server secrets are configured and the payment flow has been validated. This flag only controls the user interface; the Edge Function must continue enforcing configuration and payment verification server-side.

For adaptive streaming, create a Cloudflare Stream account, enable **Require Signed URLs** on every asset, and set `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_STREAM_API_TOKEN`, and `CLOUDFLARE_STREAM_CUSTOMER_CODE` as Edge Function secrets. Give the token only the required Stream read/edit permissions. Upload only titles with documented StreamBoXx distribution rights. In the owner dashboard, select the title and paste a Cloudflare video ID; **Verify and link video** checks that the asset belongs to the configured account, signed URLs are required, and Cloudflare has finished encoding. You can link more than one authorized Cloudflare asset to the same title to provide backup servers; viewers only receive short-lived signed playback links for assets that pass all checks. The row shows `processing`, `ready`, or `unavailable`. Sync it again after processing completes. Publishing requires the private rights records and at least one ready media asset, and the database rechecks those requirements. Keep the Cloudflare API token server-side. Direct unauthenticated provider IDs must remain disabled.

## Still required before subscriptions work

The checkout adapters, callback verification, atomic pass provisioning, owner dashboard, media synchronization, and playback authorization are implemented in code, but the migration and functions have not been deployed or tested against real Supabase, Daraja, or media-provider accounts. The payment flow is not live until the owner configures and validates their own Safaricom PayBill and Daraja production credentials. Video uploads are currently performed by the owner in Cloudflare Stream; web-based direct uploads, email verification and account recovery, payment/webhook reconciliation, rate limiting, privacy/terms pages, data retention, and production operations also remain to be configured or completed.

Never mark a pass paid from a client request. Never store or log full payment credentials or unnecessary personal data.
