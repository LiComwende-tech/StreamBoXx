# Deploy the current StreamBoXX website

The prepared release will be `StreamBoXX-Public-Upload-2026-09-26-v10.zip`. It is an account-connected website build with M-Pesa checkout and phone/SMS trials disabled. Viewers can create email accounts without entering a phone number; a free trial does not start until phone verification is configured. The browser build contains only the Supabase project URL and publishable key; it contains no Supabase secret key, Daraja secret, passkey, or Cloudflare Stream token. This release adds separate African, Asian, Shorts, and Trailers catalogue sections plus the new catalogue metadata. Apply the new Supabase migration before using those fields in the owner dashboard.

## 1. Set the Supabase Auth return URL

In Supabase, open **Authentication → URL Configuration**:

1. Set **Site URL** to `https://streamboxx-ke.pages.dev`.
2. Add `https://streamboxx-ke.pages.dev/**` to the allowed redirect URLs. Add any custom domain separately after you connect one.
3. Save the settings.

The signup flow returns to the site’s current address. Supabase must allow that address or email confirmation can fail or return to the wrong page.

## 2. Deploy the website update

1. Open Cloudflare **Workers & Pages** and select the existing `streamboxx-ke` Pages project.
2. Start a new Direct Upload deployment and upload `StreamBoXX-Public-Upload-2026-09-26-v10.zip`.
3. Deploy to production, then open `https://streamboxx-ke.pages.dev`.
4. If the site was previously opened or installed, reload it once after deployment; the new service worker clears the earlier cached app files.

This replaces the older public catalogue-only build. Direct Upload is separate from GitHub source; if the Cloudflare project was created as Direct Upload, Cloudflare says it cannot later be converted to Git integration. See [Cloudflare Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/).

## 3. Finish account and owner setup

The app code expects the Supabase migrations and Edge Functions in this repository. The website build alone does not deploy the database or functions. Follow the setup in [supabase/README.md](supabase/README.md), including applying migrations, deploying the functions, and setting Auth redirects.

After your verified account exists in **Authentication → Users**, copy its user UUID. In the Supabase SQL Editor, run the owner bootstrap query from `supabase/README.md`, replacing `OWNER-USER-UUID` with that UUID. Then sign in to the website and open the account menu; the owner dashboard should appear for the assigned account.

The public title catalogue can load without a viewer login. Email signup, owner access, and protected playback depend on the deployed Supabase setup and policies. Phone verification and trials are deferred, so do not advertise a free trial yet. Use a separate test viewer account to confirm that ordinary accounts cannot open the owner dashboard.

## 4. Keep payments off until Safaricom setup is complete

The release keeps `VITE_ENABLE_CHECKOUT=false`. The KES 50 day-pass design and Daraja sandbox adapter remain in the code, but viewers cannot pay in this build. Do not accept money until the matching Safaricom merchant product is approved, credentials and callback are set as Supabase function secrets, the functions are deployed, and the sandbox payment lifecycle is validated. Never put payment credentials in this website build or GitHub.

## 5. Add streamable member titles

Only publish titles and artwork you have distribution rights to. Upload authorized masters to Cloudflare Stream, require signed URLs, configure the server-side Stream secrets, and link ready assets and private rights records in the owner dashboard. Playback remains unavailable for titles without cleared rights and a ready media asset.

## Useful references

- [Supabase Auth redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Cloudflare Pages Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)
- [Full launch checklist](LAUNCH_CHECKLIST.md)
