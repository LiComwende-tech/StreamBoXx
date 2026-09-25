# Publish the free StreamBoXX collection

This release is a public catalogue of films and episodes that link to their official sources. It does not collect viewer account details, accept M-Pesa payments, or host commercial titles. Checkout is disabled. The site's free links do not require a StreamBoXX account or day pass. Playback, ads, captions, regional availability, and the third-party services' own privacy rules are controlled by those services.

## Prepare the upload

From the `streambox-stage1` project folder, run:

```powershell
pnpm run build:public
```

The public build uses `.env.public`; it blanks the local Supabase settings, disables checkout, and hides account controls. Do not upload the normal `dist` build if you intend to publish the free catalogue only.

## Upload to Cloudflare Pages

1. Sign in to a Cloudflare account you control at [dash.cloudflare.com](https://dash.cloudflare.com/).
2. Open **Workers & Pages**, choose **Create application**, then choose **Pages** and **Direct Upload / Drag and drop**.
3. Name the project, for example `streamboxx-public`, and upload the contents of the `dist` folder created by `build:public` (or the prepared ZIP, if using the dashboard's ZIP upload control).
4. Select **Deploy site**. Cloudflare will show a public `*.pages.dev` address. Open it on a phone and computer and check the film and series links.
5. Keep checkout disabled. Do not add Supabase or Daraja secrets to Cloudflare Pages variables for this free catalogue deployment.

Cloudflare says a Direct Upload project cannot later be changed into a Git-integrated project. Choose GitHub integration instead if you want Cloudflare to rebuild automatically on every code push; that requires a GitHub repository first. See [Cloudflare's Direct Upload guide](https://developers.cloudflare.com/pages/get-started/direct-upload/).

## Later, after rights and payment setup

The account, owner, protected-playback, and M-Pesa features remain in the development build. After you obtain the required rights, complete the Supabase deployment and Safaricom setup, and review the service policies, prepare a separate production build with the correct Supabase public settings. Keep the Daraja Consumer Secret, passkey, callback secret, Cloudflare Stream token, and Supabase secret key in their provider-side secret stores only. Test sandbox checkout and server-confirmed playback before enabling paid access.
