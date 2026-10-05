# GistVille

Vendor-first marketplace + community app, started for Nigerian fashion & beauty vendors (Abuja), now expanding to global vendors via Stripe.

## Stack
Vite + React + TypeScript + Tailwind CSS v4 + Supabase (DB, Auth, Storage, Realtime) + Paystack + Stripe + Vercel (incl. serverless functions in `api/`).

## Structure
- `/` — marketing landing page + waitlist signup
- `/app` — public vendor directory + chat/pay flow (no login required to browse)
- `/signup`, `/login` — buyer or vendor account creation (vendors pick a country, which routes them to Paystack or Stripe)
- `/vendor` — dashboard: overview, listings (photo/video upload), orders, ads, gifts/payout, verification
- `/buyer` — dashboard: feed (incl. boosted listings), games, orders, saved, coins
- `/buyer/games` — multiplayer word game
- `/admin/disputes` — internal dispute queue

## Running locally
```
npm install
npm run dev
```
Copy `.env.example` to `.env.local` and fill in what you have — the app runs on mock data for anything left unset.

## Connecting Supabase
The app runs on mock data (`src/lib/data.ts`) until `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are set. Once both are present, the app automatically switches to real queries — no code changes needed.

`supabase/schema.sql` is a consolidated, verified-against-the-live-database reference — run it in the SQL editor on a fresh project. (This project's actual Supabase instance already has all of this applied via incremental migrations, not by running this file directly — the file was written by querying the live schema, not the other way around.)

## Connecting Paystack (Nigeria, Ghana, South Africa, Kenya, Cote d'Ivoire)
Order checkout and the N1,000/month verification badge both go through Paystack's Inline popup, then a server-side verify step that's the only thing actually trusted (`api/paystack/verify.ts`).

1. Get keys from Paystack dashboard -> Settings -> API Keys & Webhooks.
2. Add to Vercel env vars: `VITE_PAYSTACK_PUBLIC_KEY` (client), `PAYSTACK_SECRET_KEY` (server), `SUPABASE_SERVICE_ROLE_KEY` (server).
3. **Recurring billing needs a webhook**: register `https://<your-domain>/api/paystack/webhook` in the Paystack dashboard. Without it, the first charge still works but monthly renewals silently stop.
4. **Vendor payout** (`/vendor/gifts`, labeled "Earnings" in the UI, for Paystack vendors): real bank withdrawal via Paystack Transfers. The withdrawable amount is recomputed server-side every time (`vendor_available_balance()`), never trusted from the client. **Includes both order sales (95%, 5% platform commission) and gift earnings (70%)** — order revenue previously never fed into the payout balance at all, which meant Paystack vendors had no way to get paid for actual sales, only for gifts. Fixed and verified against the live database (inserted a real test order, confirmed the function returned exactly 95% of it, then cleaned up).

### Getting paid — setup checklist
1. Open a Paystack business account (Nigeria) and a Stripe account with Connect enabled.
2. Get API keys from both dashboards.
3. Add them to Vercel env vars (full list in `.env.example`).
4. Register the two webhooks (`api/paystack/webhook.ts`, `api/stripe/webhook.ts`) in each dashboard, using your deployed domain once live.
5. **Subscriptions**: 100% to you automatically, no setup beyond the above.
6. **Gifts**: 70% vendor / 30% you, vendor withdraws manually from Earnings.
7. **Orders (Paystack vendors)**: 95% vendor / 5% you, vendor withdraws manually from Earnings (same balance as gifts, combined).
8. **Orders (Stripe vendors)**: 95% vendor / 5% you, auto-split and auto-paid-out by Stripe at the moment of sale — nothing manual.

**Why the server verify step exists**: a client-side "success" callback is not proof money moved. `api/paystack/verify.ts` re-checks the transaction and charged amount directly with Paystack's API before writing anything to the database.

**Cancellation grace period**: `subscription.disable` (webhook) no longer revokes the verified badge immediately — see `src/lib/verification.ts`. The badge stays live until `verified_until` (set on the last successful charge) actually runs out.

## Connecting Stripe (everywhere else)
Vendors outside Paystack's 5 supported countries route to Stripe Connect instead. Uses **destination charges** - a buyer's payment splits automatically at charge time (5% platform fee stays with GistVille, the rest transfers straight to the vendor's connected account). Stripe pays vendors out to their own bank on its own schedule - no manual "withdraw" step to build for Stripe vendors.

1. Get keys from the Stripe dashboard -> Developers -> API keys.
2. Add to Vercel env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
3. Register a webhook at `https://<your-domain>/api/stripe/webhook` listening for `checkout.session.completed` and `account.updated`.
4. Vendor onboarding: `/vendor/gifts` shows "Connect with Stripe" for Stripe-routed vendors.

**Gifting economy is Paystack/Naira-only.** A Stripe-routed vendor's profile won't show "Send a gift" at all - gifts are NGN-denominated end to end, no currency conversion built. Enforced in two places (UI hidden + a defense-in-depth check in the send handler).

**Verification badge is also Paystack-only** for now - Stripe vendors see a clear "not available yet" message on `/vendor/verification`.

## Connecting Twilio (WhatsApp/SMS notifications)
Order creation, order status changes, and dispute filing/resolution all fire a
best-effort notification via `api/notify.ts` / `api/_lib/notifications.ts` —
WhatsApp first, falling back to SMS. Missing Twilio env vars simply skip the
send (never blocks the underlying order/dispute action).

1. Create a free account at https://www.twilio.com/try-twilio.
2. From the Console dashboard, copy your Account SID and Auth Token into
   `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN`.
3. For WhatsApp (recommended): Console -> Messaging -> Try it out -> Send a
   WhatsApp message. Use the sandbox number Twilio gives you as
   `TWILIO_WHATSAPP_FROM` (e.g. `whatsapp:+14155238886`). Each recipient has
   to join the sandbox once (sends a join code to that number from their own
   WhatsApp) before you can message them — a paid WhatsApp Business sender
   removes this limitation when you're ready to go live.
4. For SMS instead/as a fallback: buy a Twilio number (Console -> Phone
   Numbers -> Buy a number) and set `TWILIO_SMS_FROM`.
5. Add whichever of the four vars you set up to your Vercel env vars.

## Multi-country payment routing
`src/lib/payments.ts` maps a vendor's country to a provider at signup: Nigeria/Ghana/South Africa/Kenya/Cote d'Ivoire -> Paystack, everywhere else -> Stripe. Stripe-routed vendors are priced in their actual local currency (`COUNTRY_CURRENCY` map — GBP for UK, EUR for Germany/France, CAD for Canada, AUD for Australia, INR for India, USD as the fallback for anywhere not explicitly listed), not a single global USD. The Stripe checkout backend (`api/stripe/checkout.ts`) already reads currency per-order rather than assuming a fixed one, so this was purely a mapping gap on the frontend, not an integration limitation — verified with a real `tsc` type-check and production `vite build` after the change, not just read-through.

## Multiplayer game - One Letter
`/buyer/games` - 2-player word duel, real-time via **Supabase Realtime** (`broadcast` for moves, `presence` for join/leave), no separate backend.
- Dictionary: `public/words.json`, ~41,700 words (3-6 letters), from the `word-list` npm package.
- Room flow: create -> 5-character code -> share -> join. Invite-only, no matchmaking.
- **No server-authoritative referee** - each client validates its own moves and reports its own timeout. Fine for casual play; not something to build a real-money mode on without a server-side validator.

## Media upload
Real photo/video upload to Supabase Storage (`listings` bucket - public read, write scoped to `auth.uid()`-prefixed folders).

## Ad delivery
Boosted campaigns surface in a "Boosted" section at the top of the buyer feed. Viewing records an impression (atomic RPC); tapping records a click. Spend depletes the campaign's budget until exhausted. Simplified - no targeting, no frequency capping, no real CPM auction.

## Admin - disputes
`/admin/disputes` - real per-admin login, not a shared password. An admin logs in with
their own Supabase account (same auth as any buyer/vendor), then `api/_lib/authenticateAdmin.ts`
checks the `admin_users` table (service-role only — no client-side policies at all) for their
`auth_user_id`. `ADMIN_ACCESS_CODE` is now only the **bootstrap** secret: a logged-in user submits
it once via `api/admin/bootstrap-admin.ts` to add themselves to `admin_users`. Rotate the code
once you've bootstrapped the admins you need — it's not checked on every request anymore.

## Row Level Security - current state
- `profiles`, `listings`, `ad_campaigns`, `vendor_subscriptions`, `payouts`, `coin_purchases`, `gift_transactions`: scoped to the owning user via `auth_user_id = auth.uid()`.
- `orders`: select/insert scoped to the buyer who placed it or the vendor fulfilling it; update is vendor-owner-only; `paid` is written server-side regardless of policy.
- `disputes`: insert is public; select is scoped to the vendor whose order it concerns; the admin view bypasses this via service role.
- `saved_vendors`: scoped to the owning buyer via `auth_user_id = auth.uid()` (select/insert/delete).
- `admin_users`: no policies at all — only ever readable via the service-role key from `api/admin/*.ts`.
- `messages`, `vendor_requests`, `waitlist`: insert/select remain public.
- `add_coins()`: **service-role only.** Mints coins with zero balance/payment check - see the security note below.
- `vendor_available_balance()`: identity-checked — only the vendor themselves (`auth.uid()`) or the service role (used by `api/paystack/payout.ts`, which has already authenticated the vendor independently) can read a given vendor's balance. Previously callable by anyone who knew a vendor's profile id.

## A real security bug found and fixed during development
Supabase grants `EXECUTE` on new functions to the `anon`/`authenticated` roles by default - an earlier `revoke ... from public` did NOT undo this. `add_coins()` was callable directly by any anon or logged-in client, not just the server. Anyone could have minted themselves unlimited coins, sent them as gifts, and withdrawn real money via the payout flow. Found by actually running Supabase's security advisor against the live project; fixed with an explicit `revoke execute ... from anon, authenticated`; confirmed fixed by re-running the advisor. `supabase/schema.sql` includes this fix from the start.

## Known gaps, not silently left
- **Multiplayer game**: no stranger matchmaking, no spectating, no leaderboards, no server-authoritative referee.
- **Stripe verification + gifting**: not built - Stripe vendors can sell and get paid for orders, nothing else monetization-wise yet.
- **Live streaming + video calls**: not started. Needs a WebRTC provider decision (Agora recommended for Africa network performance) before any code gets written.
- **Vendor payout OTP finalization** (Paystack): if a transfer comes back with status `otp`, it's stuck until finalized manually in the Paystack dashboard.

### Fixed since the last pass
- **Paystack recurring billing grace period**: `subscription.disable` no longer revokes the verified badge immediately — see `src/lib/verification.ts`.
- **Real admin auth**: per-admin login via `admin_users`, not a shared access code (which is now only a one-time bootstrap secret).
- **WhatsApp/SMS notifications**: order created/status changed, dispute filed/resolved — see "Connecting Twilio" above. Requires your own Twilio account/credentials to actually send.
- **Saved vendors**: fully wired — `saved_vendors` table, bookmark button on a vendor's profile, real list at `/buyer/saved`.
- **`vendor_available_balance()` identity check**: now scoped to the vendor's own `auth.uid()` (or the service role for the payout endpoint), and folds in order revenue (95%) alongside gift earnings (70%) — the version of this function in this file previously only counted gifts, which didn't match how payouts actually work.
- **Visual redesign**: bold, high-contrast "fast-fashion marketplace" look (flash-sale red/black, gold accents, sharp-cornered tags and price chips, bold condensed display type) — see `src/index.css` for the token system; most of the app repaints from those tokens automatically.

## Deployment status
Not yet deployed. Code is complete and the Supabase backend is live and verified; getting this onto Vercel (previously blocked by a connector permissions issue) is the next real step before any of this is usable by an actual person.
