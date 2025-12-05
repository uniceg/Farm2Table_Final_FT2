# Farm2Table

Farm2Table is a marketplace web app connecting local farmers and buyers. This README provides a developer quick-start, environment variables, and troubleshooting tips (especially around payments and the `payment-success` flow).

## Contents
- Project overview
- Prerequisites
- Setup & run (local)
- Important environment variables
- Payment flow & troubleshooting
- Useful API endpoints
- Contributing & contact

## Project overview
Farm2Table is built with Next.js (App Router) and uses Firebase for Auth/Firestore/Storage and PayMongo for payments. Code is organized under `src/` with API routes in `src/app/api` and utilities in `src/utils/lib`.

## Prerequisites
- Node.js (LTS) and npm (or pnpm)
- A Firebase project (Firestore + Auth)
- PayMongo account (test and/or live keys)
- Cloudinary account for optional image uploads

## Setup & run (local)
1. Install dependencies:

```powershell
npm install
```

2. Create a `.env.local` in the project root and add required environment variables (see below).

3. Run the dev server:

```powershell
npm run dev
```

Open `http://localhost:3000`.

## Important environment variables
Create `.env.local` with these values (or set them in your deployment platform):

- Firebase (client-side):
  - `NEXT_PUBLIC_FIREBASE_API_KEY`
  - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
  - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
  - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
  - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
  - `NEXT_PUBLIC_FIREBASE_APP_ID`

- PayMongo (server-side):
  - `PAYMONGO_TEST_SECRET_KEY` — test secret key
  - `PAYMONGO_SECRET_KEY` — live secret key (if using production)
  - `PAYMONGO_WEBHOOK_SECRET` — webhook signing secret (optional)

- Cloudinary (optional):
  - `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`

Notes:
- The code accepts either `PAYMONGO_TEST_SECRET_KEY` or `PAYMONGO_SECRET_KEY` (it now falls back to the test key if the live key is absent).
- Ensure the environment variables are available to the Next.js server runtime (Vercel env settings, or local `.env.local`).

## Payment flow & troubleshooting
Key routes:
- `POST /api/payment-intent` — creates a PayMongo payment intent (`src/app/api/payment-intent/route.js`).
- `POST /api/verify-payment` — verifies a payment intent (`src/app/api/verify-payment/route.js`).
- Client success page: `src/app/payment-success/page.js` reads `payment_intent_id` (and aliases) and calls `/api/verify-payment` to confirm metadata + save orders.

Common issues:
- Missing keys / 401 responses: confirm `PAYMONGO_TEST_SECRET_KEY` or `PAYMONGO_SECRET_KEY` is set in the environment used by your Next.js server.
- Return URL mismatch: the `return_url` set when creating a payment intent must match where PayMongo should redirect. For local testing, set it to `http://localhost:3000/payment-success` or use your deployed URL.

How to manually verify a payment intent (PowerShell):

```powershell
Invoke-RestMethod -Uri 'http://localhost:3000/api/verify-payment' -Method POST -ContentType 'application/json' -Body (@{ paymentIntentId = 'pi_rcJ6YygwMCGFQEaSGYJwXcS6' } | ConvertTo-Json)
```

Or with curl:

```powershell
curl -X POST http://localhost:3000/api/verify-payment -H 'Content-Type: application/json' -d '{"paymentIntentId":"pi_rcJ6YygwMCGFQEaSGYJwXcS6"}'
```

Check the server logs and the response JSON. If verification fails with `Invalid Paymongo API credentials` or status 401, re-check your env keys.

## Useful internal notes
- `payment-success` checks multiple query params for payment id: `payment_intent_id`, `pi`, `payment_id`, `payment_intent`.
- Payment metadata (e.g., `order_data`, `order_number`) is stored on payment intents so the server can rehydrate orders even if local storage is lost.
- `CartContext` enforces stock, MOQ and provides helpers (`useCart()`).

## Useful commands
- Install: `npm install`
- Dev server: `npm run dev`
- Build: `npm run build`
- Start (production): `npm start` (or use your host's recommended start command)

## Contributing
- Fork the repo and open a PR. Keep changes focused and test locally.

## Troubleshooting checklist (payments)
- Confirm `PAYMONGO_TEST_SECRET_KEY` or `PAYMONGO_SECRET_KEY` is present at runtime.
- Confirm `PAYMONGO_WEBHOOK_SECRET` is set if webhooks are used.
- Ensure `return_url` used in `payment-intent` points to the domain where `payment-success` will run.
- Inspect browser console on `payment-success` for logs and the `/api/verify-payment` network request.

---

## Firebase Quickstart (developer)
Follow these steps to create a Firebase project, enable Firestore and Auth, and connect the app.

1. Create a Firebase project
  - Go to https://console.firebase.google.com/ and click **Add project**.
  - Enter a project name (e.g., `farm2table-dev`) and follow the prompts.

2. Enable Firestore
  - In the Firebase console, select **Firestore Database** → **Create database**.
  - Choose **Start in test mode** for local development (remember to tighten rules before production) and choose a region.

3. Enable Authentication
  - In **Authentication** → **Sign-in method**, enable **Email/Password**. Enable any other providers you plan to support.

4. Create a Web app to get config values
  - In Project settings → **Your apps** → **</> Add app**, register a new Web app (e.g., `farm2table-web`).
  - Copy the Firebase config values and add them to your `.env.local` as `NEXT_PUBLIC_FIREBASE_*` variables.

5. Firestore rules (development recommendation)
  - For early development you can use permissive rules, but NEVER leave these in production. Example for dev only:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
   match /{document=**} {
    allow read, write: if request.auth != null;
   }
  }
}
```

  - For production, restrict writes/reads based on `request.auth.uid` and document ownership. Example snippet for user-owned documents:

```js
match /buyers/{userId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

6. Storage (optional)
  - If you use Cloudinary you may skip Firebase Storage. If you need Firebase Storage, enable it in the console and add rules similar to Firestore (restrict access to authenticated users).

7. Local testing notes
  - Add the Firebase config to `.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-auth-domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

  - Run `npm run dev` and authenticate via UI to ensure sign-in works and Firestore reads/writes succeed.

8. Migrate to production
  - Update Firestore rules to be strict, set appropriate indexes, and configure backups if needed.
  - Move to the live project and ensure env vars on your hosting provider (Vercel) are set to the production Firebase config.

## Vercel deployment checklist
Follow these steps to deploy Farm2Table to Vercel and ensure environment variables and webhooks work correctly.

1. Create/Connect a Vercel Project
  - Import the Git repository into Vercel or connect the repo from your Vercel dashboard.
  - Set the Framework Preset to **Next.js**.

2. Add Environment Variables
  - In your Vercel project settings, add the relevant env vars under **Settings → Environment Variables**. Add them for `Preview` and `Production` as appropriate.

Required environment variables (server + client):
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `PAYMONGO_TEST_SECRET_KEY` (for test flows)
- `PAYMONGO_SECRET_KEY` (production/live)
- `PAYMONGO_WEBHOOK_SECRET` (if using webhooks)
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` (if using Cloudinary)

3. Configure PayMongo return URLs & webhooks
  - In PayMongo dashboard, set the `return_url` used in your payment intents to your deployed domain, e.g. `https://your-vercel-app.vercel.app/payment-success`.
  - Configure PayMongo webhook endpoint to your Vercel app route `/api/verify-payment` (or a dedicated webhook route) and set the `PAYMONGO_WEBHOOK_SECRET` env var in Vercel.

4. Build & Runtime settings
  - Vercel handles building Next.js automatically. Ensure build command is `npm run build` and output is default.
  - If using the serverless runtime or Edge functions, ensure secrets are available to the correct runtime. This app uses App Router server routes; make sure env vars are available to server.

5. Domain & HTTPS
  - Add a custom domain if desired and ensure HTTPS is enabled (Vercel provisions certificates automatically).

6. Verify after deploy
  - Place a test order using PayMongo test keys and confirm redirect to `/payment-success` with `payment_intent_id` query param.
  - Check Vercel server logs and the `/api/verify-payment` request/response for any 401 errors due to missing keys.

7. Rollout to production
  - Replace `PAYMONGO_TEST_SECRET_KEY` with `PAYMONGO_SECRET_KEY` in production env vars.
  - Update `return_url` in live PayMongo settings to the production domain.

