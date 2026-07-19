# The Stock Market

A simulated stock exchange for events — owner lists companies, sets share
supply, publishes news events, and manages trader accounts; traders buy and
sell shares against a live-ish price feed with real-time-style charts.

This is a normal React + Vite app, plus one small serverless function
(`api/kv.js`) that gives it shared, persistent storage via Redis — so
everyone who opens the site sees the same market data.

## 1. Put this on GitHub

```bash
cd the-stock-market-app
git init
git add .
git commit -m "Initial commit"
```

Create a new empty repo on GitHub, then:

```bash
git remote add origin https://github.com/<your-username>/<your-repo>.git
git branch -M main
git push -u origin main
```

## 2. Import it into Vercel

1. Go to https://vercel.com/new
2. Import the GitHub repo you just pushed
3. Framework preset: Vercel should auto-detect **Vite** — leave the defaults
4. Click **Deploy**

It will deploy successfully at this point, but trading/owner changes won't
save yet — that needs step 3.

## 3. Add a Redis store (one-time, ~1 minute)

The app needs somewhere to persist companies, traders, and portfolios.

1. In your Vercel project, open the **Storage** tab
2. Click **Create Database** → choose **Redis** (via the Marketplace,
   Upstash-backed) — the free tier is enough for this
3. Connect it to your project — Vercel automatically adds the
   `KV_REST_API_URL` and `KV_REST_API_TOKEN` environment variables that
   `api/kv.js` reads
4. Go to **Deployments** → redeploy the latest deployment (or just push a
   new commit) so the new env vars take effect

That's it — the site is live and shared state now persists.

## 4. Change the default passwords

Before sharing the link, log in as the owner (`owner` / `owner123`) and:
- Delete or change the seeded `trader1` / `trader123` account in the Owner
  panel → Trader accounts
- Create the real trader accounts you want people to use

You may also want to change the owner password itself — it's set in
`src/App.jsx` under `OWNER_CREDENTIAL`.

## Making changes later

Once it's connected, Vercel redeploys automatically on every push:

```bash
# edit files, then:
git add .
git commit -m "describe your change"
git push
```

Vercel picks up the push and redeploys in under a minute — no manual
redeploy step needed. You can watch progress in the Vercel dashboard's
**Deployments** tab, and each push gets its own preview URL before it
becomes the live one (if pushed to a branch other than `main`).

## Local development

```bash
npm install
npm run dev
```

Note: `npm run dev` runs the frontend only. The `/api/kv` serverless
function needs the Vercel dev environment to run locally with real env
vars — use `vercel dev` instead (after `npm install -g vercel` and
`vercel link`) if you want local storage to work too.

## Project structure

```
index.html          entry HTML
src/main.jsx         React entry point
src/App.jsx           the whole app (UI, trading logic, owner panel)
src/storage.js        talks to /api/kv from the browser
api/kv.js              serverless function, reads/writes Redis
vercel.json            pins the API function to the Node runtime
```
