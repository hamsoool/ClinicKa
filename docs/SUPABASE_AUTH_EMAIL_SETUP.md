# Supabase Signup Email Setup

This project's signup verification email is sent by **Supabase Auth**. The `nodemailer` flow in `vite.config.ts` only sends clinic workflow notifications and does not replace Supabase's built-in confirmation email sender.

## What this repo now handles

- The branded confirmation template lives in `docs/supabase-confirm-signup-email.html`.
- Password signup and resend verification both redirect back to `/auth?mode=signin&verified=1`.
- `VITE_SITE_URL` can now be set in `.env.local` so the redirect target is explicit instead of relying only on `window.location.origin`.

## Important limitation

`nodemailer` is a Node mail library, not an SMTP provider. Supabase can only send custom auth emails through:

- Supabase's built-in sender
- A real SMTP server that you configure in the Supabase dashboard

If you want to use Gmail with `nodemailer` elsewhere in this app, you still need Gmail SMTP credentials, usually an App Password rather than the account's normal password.

## How to apply your HTML design to Supabase verification

1. Open Supabase Dashboard.
2. Go to `Authentication` -> `Email Templates`.
3. Open `Confirm sign up`.
4. Set the subject to `Confirm your ClinicKa! account`.
5. Paste the contents of `docs/supabase-confirm-signup-email.html`.

The template already uses supported Supabase variables:

- `{{ .Email }}`
- `{{ .ConfirmationURL }}`

## Required dashboard settings

1. In Supabase Dashboard, open `Authentication` -> `URL Configuration`.
2. Set the Site URL to your real app URL.
3. Add your local and deployed callback URLs to the allowed redirect list.

Recommended redirect URLs:

- `http://localhost:5173/auth?mode=signin&verified=1`
- `https://your-production-domain/auth?mode=signin&verified=1`

## Using Supabase's default sender

If you leave custom SMTP disabled, Supabase will use its built-in default sender for auth emails. That is enough for local testing, but Supabase's docs note that the default sender is restricted and not intended for production use.
