# ClinicKa

ClinicKa is a Gordon College clinic management portal for student medical records, clearance review, clinic staff workflows, and administrator oversight. The app runs as a Vite + React single page application with Supabase for authentication, database access, storage, and edge functions.

## Core Features

- Role-based portals for students, clinic staff, and administrators.
- Student medical record submission with profile, health history, measurements, file uploads, and clearance tracking.
- Staff review queue for validating records, lab files, physical exam results, notes, status changes, and clearance release.
- Admin tools for system settings, clinic staff management, user accounts, and reporting.
- PWA support for installable mobile-friendly access.
- Demo mode for local development without a live Supabase project.

## Tech Stack

- React 18, TypeScript, React Router 7
- Vite 6 and Tailwind CSS 4
- Radix UI primitives and lucide-react icons
- Supabase Auth, Postgres, Storage, and Edge Functions
- vite-plugin-pwa / Workbox

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- Supabase CLI if you plan to deploy or run edge functions locally

## Quick Start

```bash
npm install
npm run dev
```

The app is served at `http://localhost:5173` by default.

## Environment Setup

Create `.env.local` from `.env.example`.

```bash
cp .env.example .env.local
```

For demo-only local work, keep:

```env
VITE_DEMO_MODE=true
```

For a live Supabase-backed run, set:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_DEMO_MODE=false

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=server-only-service-role-key
```

Do not commit `.env.local` or service role keys.

## Demo Accounts

These accounts are intended for local/demo testing:

| Role | Email | Password |
| --- | --- | --- |
| Student | `202310417@gordoncollege.edu.ph` | `Clinic123!` |
| Staff | `clinic.staff@gordoncollege.edu.ph` | `Clinic123!` |
| Admin | `clinic.admin@gordoncollege.edu.ph` | `Clinic123!` |

## Available Scripts

```bash
npm run dev
```

Starts the local Vite development server.

```bash
npm run build
```

Creates a production build in `dist/`.

## Supabase Notes

- Edge function entry point: `supabase/functions/server/index.ts`
- Generated key-value helper: `supabase/functions/server/kv_store.tsx`
- Storage and RLS policy reference: `supabase/rls_storage_and_files_policies.sql`
- Files bucket migration helper: `supabase/fix_files_bucket_migration.sql`

The frontend expects the `medical-files` storage bucket and related file-type buckets used by `src/app/lib/api.ts`. Apply the SQL policy files before using uploads in a live project.

## Project Structure

```text
src/
  app/
    components/        Shared UI, previews, reports, and portal shell
    lib/               Auth, API, and demo data helpers
    pages/             Student, staff, admin, and auth routes
  styles/              Tailwind, theme tokens, and global styles
supabase/
  functions/server/    Edge function API
  *.sql                Storage, RLS, and migration helpers
public/                PWA icons, logo, and static imagery
exports/figma/         Imported design reference screenshots
```

## Production Build

```bash
npm run build
```

The build uses route-level lazy loading plus vendor chunk splitting for better browser caching. Deploy the contents of `dist/` to your static host, and deploy the Supabase edge function separately when using the live backend.

## Troubleshooting

- Missing Supabase config: verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Upload failures: confirm storage buckets and RLS policies have been applied.
- Google sign-in domain errors: only `@gordoncollege.edu.ph` accounts are accepted.
- Demo data looks stale: clear the browser keys `gc_demo_submissions` and `gc_supabase_session`.
