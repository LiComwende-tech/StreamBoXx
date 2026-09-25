# StreamBoXX public launch checklist

This project can be deployed as a static website, but it is not ready to accept viewers or payments until every **owner setup** and **release gate** below is complete. Do not advertise paid access while the backend is unconfigured.

## 1. Choose and control the accounts

- Create a Git repository in an account you control and put this project there. Do not commit `.env`, payment credentials, service-role keys, or private rights documents.
- Create a Supabase project in your own account. Record its project URL and publishable key; use only those two values in the website build.
- Create and verify your owner account, apply the SQL migration, and set its UUID in `owner_control` using the owner bootstrap instructions in [`supabase/README.md`](supabase/README.md).
- Register for a Safaricom Daraja account and a PayBill owned by you. Begin with sandbox credentials. Production payments require Safaricom approval and the production credentials issued for your account.
- Create a Cloudflare Stream account controlled by you. Enable **Require Signed URLs** on every asset. Upload only content you have distribution rights to.
- Create a Cloudflare Pages project connected to your repository. Configure the build command as `pnpm run build` (or `npm run build`) and the output directory as `dist`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in both preview and production environments. Keep `VITE_ENABLE_CHECKOUT=false` until the Safaricom product is approved, matching backend checkout is deployed, and payment tests pass. A successful first deploy is a preview only until the backend and release gates below pass.

## 2. Connect and secure Supabase

1. Use the Supabase CLI to link the project, inspect the migration on a disposable project first, and apply it to the production project only after review.
2. Deploy `stream-access`, `mpesa-checkout`, `mpesa-callback`, and `register-stream-asset` from this folder.
3. Configure the function secrets listed in [`supabase/README.md`](supabase/README.md). Set `STREAMBOXX_ALLOWED_ORIGINS` to the exact Pages preview and production HTTPS origins. Set `MPESA_CHECKOUT_ENABLED=true`, `MPESA_ENVIRONMENT=sandbox`, and `MPESA_PRODUCT=paybill` only while deliberately validating sandbox checkout. For a Safaricom-approved Buy Goods sandbox setup, select `MPESA_PRODUCT=buygoods` and set `MPESA_TILL_NUMBER`.
4. Add the Pages preview and production URLs to Supabase Auth's allowed redirect URLs. Set the production site URL to your eventual custom domain.
5. Bootstrap the single owner only after confirming the owner account UUID. Confirm a normal viewer cannot access owner data or functions.
6. Turn on email confirmation and recovery, configure the sender domain, and test sign-up, sign-in, verification, password recovery, and trial expiry with dedicated test accounts.

## 3. Add a rights-cleared catalogue and streaming assets

- Obtain written streaming rights for each film or series and territory, term, languages, devices, and subscription model you intend to offer. Obtain separate rights for each poster or artwork image.
- Keep the agreements and evidence in private storage. Enter the evidence references in the owner dashboard; never upload rights documents into the public web repository.
- Upload authorized video masters to Cloudflare Stream. Confirm signed URLs are required and encoding is complete, then sync the asset and publish the title from the owner dashboard.
- Verify playback for an active-trial viewer, an expired viewer, and a signed-out visitor. Confirm expired and signed-out viewers cannot obtain playable media URLs.

## 4. Validate KES 50 day passes

- In Daraja sandbox, verify the STK prompt, cancellation, timeout, duplicate callback, failed callback, wrong amount, and successful callback paths. A pass must become active only after the server confirms the transaction with Daraja.
- Reconcile the payment record and M-Pesa receipt in the owner dashboard. Document who handles failed payments, reversals, complaints, and refund requests before taking real payments.
- Complete Safaricom's production Go Live process for the merchant product it approves (PayBill or Buy Goods), set those production credentials only as Supabase function secrets, then perform a controlled owner-run payment. Set `MPESA_ENVIRONMENT=production` and `MPESA_LIVE_PAYMENTS_ENABLED=true` only after the merchant setup and production tests pass; keep the browser flag off until launch is approved.
- Never paste Daraja secrets, M-Pesa PINs, or Supabase secret keys into chat or a browser field. Enter credentials directly into the provider dashboard/secret settings.

## 5. Legal, operations, and public release

- Publish reviewed Terms of Service, Privacy Notice, cancellation/refund policy, content complaints/takedown contact, and support contact. These must accurately identify the business/operator, how email and M-Pesa phone/payment references are used, retention, trial and renewal behavior, access expiry, and complaint handling. Do not publish generic placeholder legal text.
- Confirm applicable Kenyan business, tax, consumer-protection, data-protection, and content-distribution obligations with qualified local advisers and Safaricom. This checklist is not legal or tax advice.
- Test mobile and desktop layouts, installability, email links on the production domain, accessibility, slow connections, monitoring/alerts, backup/restore, and account deletion/support procedures.
- Connect a domain you control to Cloudflare Pages, enforce HTTPS, check the production environment values and allowed origins, and launch only after the gates above are signed off.

## 6. Desktop and phone/TV apps

- The current Electron folder is a local desktop shell, not a signed installable release. Packaging, Windows code signing, updates, and distribution still need a separate release setup.
- The current PWA can be installed from a supported browser. Native Android/iOS/TV apps require separate packaging and device testing; they are not produced by the current web build.
- Keep all clients as untrusted public apps. Server-side Supabase authorization, signed media access, and payment verification remain mandatory.

## Launch is blocked until

- Owner-controlled Supabase project is connected and its database, access rules, Auth, and functions are deployed and checked.
- At least one real title and artwork have documented rights and ready private streaming assets.
- The owner's PayBill and Daraja production app are approved, sandbox behavior is validated, and the production callback is verified.
- Policies, support, custom domain, backups, monitoring, and production smoke checks are ready.
