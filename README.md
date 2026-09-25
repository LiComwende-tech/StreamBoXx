# StreamBoXx

An original streaming-style website and desktop app project. StreamBoXx uses a responsive React and TypeScript interface with Vite; Electron is the planned Windows desktop shell. This is an independent project and does not use OnStream or Reezn code, branding, or assets.

## Current development stage

The web prototype currently includes:

- Original dark interface with responsive desktop and mobile navigation.
- Fictional sample catalogue with CSS artwork in local development only. Production builds omit sample titles and the test player, and read only titles that pass the backend's rights and media checks.
- Home rows, Films, Series, and Genres views.
- Title search, genre filtering, and detail previews.
- Email/password account creation and sign-in screens that activate when a Supabase project is configured.
- Dedicated HLS test-player screen with browser controls, loading and error states, fullscreen, and subtitle selection when the stream exposes tracks (development only).
- A Supabase migration foundation and owner dashboard for verified owner controls, 48-hour viewer trials, a rights-aware catalogue, private media storage, and KES 50 daily passes.
- A member playback screen backed by a server-side access function, with authorized backup-server selection, available Cloudflare HLS subtitles/audio tracks/qualities, signed playback links, and private single-file storage playback support.
- KES 50 M-Pesa PayBill checkout plus server-side STK Push, Daraja status verification, and atomic pass activation, ready for owner credentials and staging validation.
- Clear labels separating test playback from the catalogue.
- A checkout-ready state that keeps paid checkout hidden until the owner explicitly enables it after connecting and validating an approved payment service. Set `VITE_ENABLE_CHECKOUT=true` only in the desired build environment after backend setup; leave it false while Safaricom product approval is pending.

No commercial films, copyrighted posters, connected viewer accounts, subscription payments, or licensed catalogue streams are included. The free catalogue includes a public-domain archive short and openly licensed Blender Foundation movies *Sintel*, *Big Buck Bunny*, and *Tears of Steel*, linked to the official Blender releases with required CC BY 3.0 credits. *Big Buck Bunny* alone has over 23 million views on Blender official 4K YouTube release. It also lists *Sesame Street* full episodes through the rights holder official YouTube playlist; those copyrighted episodes are linked externally, not copied, hosted, or covered by the StreamBoXX viewing pass. Free-source viewing is kept separate from member-gated titles. The sample player uses a public development stream only in local development; it is removed from production builds. The owner dashboard records a title's origin (StreamBoXX original, independent creator, public domain, or licensed) separately from whether it is human-made, AI-assisted, or AI-generated. Every title still needs its own rights evidence and ready media before it can be published.

## Run the website locally

1. Install Node.js LTS from [nodejs.org](https://nodejs.org/) using the default installer options. This also installs npm.
2. Open PowerShell and move into the project folder:

   ```powershell
   cd "$HOME\Documents\Codex\2026-09-25\files-pasted-by-the-user-i\outputs\streambox-stage1"
   ```

3. Install the project libraries once:

   ```powershell
   npm install
   ```

4. Start the web preview:

   ```powershell
   npm run dev
   ```

5. Open `http://127.0.0.1:5174/` in a browser. Stop the server with Ctrl+C.

To create a production web build, run `npm run build`. The files are written to `dist/`.

For public hosting setup and the remaining launch gates, see [`LAUNCH_CHECKLIST.md`](LAUNCH_CHECKLIST.md). The project includes a Pages fallback rule for the client-side routes. A production build alone does not connect accounts, payments, or a licensed catalogue.

To connect email sign-in, copy `.env.example` to `.env` and add your Supabase project URL and publishable key after following [`supabase/README.md`](supabase/README.md). The database migration must be applied and your owner account bootstrapped before account data can work. The browser key is public by design; never put a Supabase secret key in `.env` variables beginning with `VITE_`.

## Run the Windows desktop preview

After `npm install`, start the desktop development preview with:

```powershell
npm run electron:dev
```

To open the built production website inside Electron locally:

```powershell
npm run electron:prod-preview
```

The production preview uses the local `dist/` website build. A signed Windows installer is not generated yet; the Electron shell still needs installer packaging and platform-signing setup before public distribution.

## Owner, trial, and subscription requirements

The planned public service rules are:

- The project owner is the sole administrator and manages the catalogue, viewer accounts, and subscription status.
- New viewers receive a two-day free trial.
- After the trial, access costs KES 50 per day.
- A viewer with an active trial or paid subscription can watch any title in the catalogue; access expires when the trial or paid period ends.
- Only titles the service has permission to stream may be offered.

The backend migration and Edge Functions are written but have not been deployed to a Supabase project or validated with live accounts. Account creation, owner tools, checkout, callback verification, and protected playback require that deployment and owner bootstrap. M-Pesa remains inactive until the owner configures and validates a Daraja PayBill app, and video playback requires cleared content rights plus ready assets on a configured media provider. Payment and streaming credentials must remain server-side. Do not put secrets in this repository or the browser app. See [`supabase/README.md`](supabase/README.md) before connecting a project.

## Technology

React, TypeScript, Vite, CSS, HTML5 video, HLS.js, Electron, and a Supabase backend foundation.

## Screenshots

Add screenshots here as the interface grows.

## Legal and content note

Only stream content that you own, that is public domain, or that you have licensed for the service. Do not scrape or redistribute unauthorized copies or bypass DRM or other access controls.

## Roadmap

1. Project scaffold and starter screen.
2. Responsive visual design and navigation.
3. Mock catalogue data and content cards.
4. Browsing, search, and genre filtering.
5. Movie and series detail views.
6. Legal demo video player, playback state, and subtitles where available.
7. Favorites and continue watching.
8. Secure backend schema and owner bootstrap instructions (starting foundation created; connection and security audit still needed).
9. Supabase sign-in, owner dashboard, two-day trials, provider-confirmed KES 50/day payments, and gated media delivery.
10. Installable web app, Windows packaging, and later phone and TV support.
11. Production hosting, security review, licensed catalogue, payments, and public launch.

The current build includes the responsive browse interface, development-only sample titles and HLS player, a device-local My List, Supabase sign-in, an owner dashboard, protected playback integration, M-Pesa checkout functions, and installable-web-app configuration. Its database migration and server functions are not deployed or tested against Supabase, Daraja, or a streaming provider. The rights-cleared catalogue beyond the linked public-domain short, production deployment, and Windows desktop packaging remain future work.
