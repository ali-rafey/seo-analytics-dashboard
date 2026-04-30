# SEO & Analytics Dashboard

A multi-product SEO and analytics platform with a split-panel UI: an embedded
live preview of your product on the left, a tabbed real-time analytics
dashboard on the right.

> **Build status — Checkpoints 1, 2, 3, 4, 6 are wired; Checkpoint 5 (GitHub
> codebase audit) is intentionally deferred** — its tab shows a "Coming soon"
> placeholder, but the scanner logic, OAuth flow, and audit endpoints are all
> already implemented in the codebase (see
> `lib/integrations/github/scanner.ts`,
> `app/api/integrations/github/*`, `app/api/products/[id]/audit`). Wiring
> these into the tab is a small UI-only follow-up.

## Tech stack

- **Next.js 14 (App Router) + TypeScript**
- **Tailwind CSS + Shadcn UI** — dark slate/navy theme with neon accents
- **Prisma + PostgreSQL** — users, products, integrations, snapshots, audits
- **Redis** — pub/sub bus for real-time updates streamed via **Server-Sent Events**
  (chosen over Socket.io for App Router compatibility — same UX, no custom server)
- **NextAuth (Credentials provider)** — email/password
- **Recharts** — all charts
- **Sonner** — toasts

## Folder structure

```
.
├── app/
│   ├── (auth)/login, signup        # auth pages
│   ├── api/
│   │   └── auth/                   # NextAuth route + signup
│   ├── dashboard/                  # protected app shell
│   ├── globals.css
│   ├── layout.tsx
│   ├── providers.tsx
│   └── page.tsx                    # redirects to /dashboard or /login
├── components/
│   ├── ui/                         # Shadcn primitives
│   ├── layout/                     # split-panel, header
│   └── dashboard/                  # shell, tabs, product preview
├── lib/
│   ├── auth.ts                     # NextAuth options
│   ├── env.ts                      # env access + provider-configured checks
│   ├── prisma.ts                   # Prisma client singleton
│   ├── types.ts
│   └── utils.ts
├── hooks/                          # added in checkpoint 3 (useSse, etc.)
├── prisma/
│   └── schema.prisma
├── types/
│   └── next-auth.d.ts
├── middleware.ts                   # protects /dashboard/*
├── .env.example
├── components.json                 # shadcn config
├── tailwind.config.ts
├── postcss.config.mjs
├── next.config.mjs
├── tsconfig.json
└── package.json
```

## Prerequisites

- Node 20+
- PostgreSQL 14+ running locally (or any reachable instance)
- Redis 7+ (used from checkpoint 3 onward — not required to run checkpoint 1)

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# fill in DATABASE_URL, REDIS_URL, NEXTAUTH_SECRET (openssl rand -base64 32)

# 3. Run database migrations
npx prisma migrate dev --name init

# 4. Start the dev server
npm run dev
```

Then visit <http://localhost:3000>. Create an account at `/signup`, sign in,
and you'll land on the empty dashboard.

## Per-integration setup

Each integration is configured per product, after sign-in. The cards below
list everything you'll need to provide before the relevant tab can show data.

### Google Analytics 4 + Search Console

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Enable **Google Analytics Admin API**, **Google Analytics Data API**, and
   **Google Search Console API**.
3. Create an OAuth 2.0 Client ID (type: Web application). Authorized redirect URI:
   `${NEXTAUTH_URL}/api/integrations/google/callback`
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`.

> Wired in checkpoint 4.

### PageSpeed Insights

1. In Google Cloud Console, enable **PageSpeed Insights API**.
2. Create an API key, restrict to PageSpeed Insights API.
3. Set `PAGESPEED_API_KEY` in `.env`.

> Wired in checkpoint 4 (Core Web Vitals on the SEO Score tab).

### GitHub

1. Create a [GitHub OAuth App](https://github.com/settings/developers).
2. Authorization callback URL: `${NEXTAUTH_URL}/api/integrations/github/callback`
3. Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in `.env`.

> Backend wired (OAuth + repo picker + scanner endpoint). The Codebase Audit
> tab UI itself is a "Coming soon" placeholder — wiring the audit display
> back up is the only remaining piece of Checkpoint 5.

### Meta (Facebook + Instagram)

> ⚠️ This integration **requires Meta App Review and Business Verification**.
> Until both are approved (1–4 weeks typical), the Reach/Traffic tabs render a
> "pending app review" empty state for Meta sources — no fake numbers.

1. Create an app at <https://developers.facebook.com/apps/>.
2. Add **Facebook Login**, **Instagram Graph API**, and request the
   `pages_read_engagement`, `instagram_basic`, and `read_insights` permissions.
3. Submit for App Review with a screen recording demonstrating use.
4. Complete Business Verification.
5. Set `META_APP_ID` and `META_APP_SECRET` in `.env`.

### LinkedIn

> ⚠️ This integration **requires Marketing Developer Platform access**, which
> is approval-gated. Until approved, the LinkedIn source renders a
> "pending app review" empty state — no fake numbers.

1. Create an app at <https://www.linkedin.com/developers/apps>.
2. Request access to **Marketing Developer Platform**.
3. Set `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` in `.env`.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start Next.js dev server |
| `npm run build` | `prisma generate` + `next build` |
| `npm run start` | Run production server |
| `npm run lint` | ESLint |
| `npm run prisma:migrate` | Apply migrations in dev |
| `npm run prisma:studio` | Browse the database |

## Real-data policy

This codebase contains **no mock data** anywhere. Every metric is fetched from
a live API. If an integration is not connected (or pending app review for
Meta/LinkedIn), the relevant card renders an explicit empty/disconnected state
rather than showing fabricated numbers.
