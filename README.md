# StreamBoXX

A responsive streaming-library web app and installable PWA prototype, built with React, TypeScript, and Supabase. The project focuses on a polished viewer interface and a backend designed for rights-cleared media and server-verified access.

## Project status

The repository contains working interface and backend code, but the service is not yet ready to accept paid viewers. The public website must be redeployed from the latest build, Supabase migrations and Edge Functions must be deployed and configured, and the owner account must be assigned before member and admin features are ready.

| Area | Current state |
| --- | --- |
| Viewer interface | Home, feature films, series, African/Asian categories, Shorts, Trailers, genre browsing, search, title details, responsive layouts, and a device-local watchlist |
| Public collection | Public-domain and openly licensed short films plus official rights-holder embeds; source and attribution details are available per title |
| Accounts | Email/password signup and sign-in work without an SMS provider. Phone OTP and the one-time phone-verified trial are deferred until an SMS provider is configured |
| Owner tools | Role-gated dashboard supports viewer status, rights records, content metadata, and protected media linking; the owner UUID must be assigned in Supabase |
| Playback | Native video and HLS playback UI supports available audio, subtitles, quality, and authorized backup sources; protected member playback requires deployed Edge Functions and configured media assets |
| M-Pesa | The backend supports one KES 50 daily pass and Daraja callback verification; checkout is disabled in the public build. African/Asian and monthly plan-aware payments are not implemented |
| Installable app | PWA manifest, icons, and service worker are included. A signed Windows installer or app-store release is not included. |

No commercial films or series are bundled. Popular copyrighted titles must not be added without distribution rights. Official embeds remain controlled by the rights holder’s player and can depend on the source’s availability, captions, and regional settings. To play member titles directly in StreamBoXX, upload authorized masters to the configured protected streaming provider.

## Run locally

Install Node.js and pnpm, then in the project folder run:

```powershell
pnpm install
pnpm dev
```

Open `http://127.0.0.1:5174/` in a browser. To connect a Supabase project locally, copy `.env.example` to `.env` and set only the project URL and **publishable** key. Never put a Supabase secret/service-role key, Daraja credentials, passkey, or Cloudflare Stream token in a `VITE_` variable or commit them to GitHub.

Build the web app with:

```powershell
pnpm build
```

The output is written to `dist/`. See [PUBLIC_LAUNCH_STEPS.md](PUBLIC_LAUNCH_STEPS.md) for deploying the prepared Cloudflare Pages package and completing the required account setup.

See [PRODUCT_ROADMAP.md](PRODUCT_ROADMAP.md) for phased work, proposed African/Asian plan rules, and current launch gates.

## Architecture

- Supabase Auth and Postgres hold viewer profiles, trial/pass records, published title metadata, and private rights/media records.
- Row-level security and owner checks protect account and catalogue operations.
- Supabase Edge Functions authorize playback and M-Pesa checkout on the server.
- Cloudflare Stream signed playback is supported; source assets must be rights-cleared and configured to require signed URLs.
- Payment checkout defaults to disabled. Sandbox and production settings are separate; production requires Safaricom’s approved merchant product and credentials.

The browser only receives the Supabase publishable key. Keep all privileged credentials in Supabase Edge Function secrets. Review [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md) before accepting public signups or payments.

## Content and attribution

Every catalogue item needs appropriate streaming rights and artwork rights. The open-film entries link to their official sources and rights information. Required credits and source notices must stay with the relevant works. Do not scrape or redistribute unauthorized streams, bypass DRM, or present fictional sample titles as real productions.

## Technology

React, TypeScript, Vite, CSS, HTML5 video, HLS.js, Supabase, Cloudflare Stream, and Electron.
