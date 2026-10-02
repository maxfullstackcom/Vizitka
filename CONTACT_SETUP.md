# Contact form email setup

## What is in the repo
- `index.html`, `ru/index.html`, `he/index.html` — static pages with the contact form (`data-contact-form`)
- `script.js` — posts JSON to the Cloudflare Worker URL
- `worker.js` — validates the request and sends email via [Resend](https://resend.com) (API key stays on the Worker)
- `wrangler.toml.example` — Wrangler template

## Why Resend
- Works from a Cloudflare Worker with a single HTTPS API call
- No SMTP password in the static site or in `script.js`
- Free tier is enough for a personal landing page

Alternatives (Mailchannels, SendGrid, etc.) need similar Worker secrets; this repo is wired for Resend.

## 1. Resend account and sender
1. Sign up at [resend.com](https://resend.com).
2. Add and verify the `maxfullstack.com` domain (DNS records in Resend dashboard), **or** use `onboarding@resend.dev` as `CONTACT_FROM_EMAIL` only for testing.
3. Create an API key with permission to send email.

## 2. Cloudflare KV (rate limit)
Create a KV namespace for a 60-second per-IP rate limit:

```bash
wrangler kv namespace create CONTACT_KV
```

Copy the namespace `id` into `wrangler.toml` (from `wrangler.toml.example`).

## 3. Worker secrets and vars
Copy `wrangler.toml.example` to `wrangler.toml` and set `ALLOWED_ORIGIN` / `CONTACT_FROM_EMAIL`.

Set secrets (never commit these):

```bash
wrangler secret put RESEND_API_KEY
wrangler secret put CONTACT_TO_EMAIL
```

| Name | Type | Purpose |
|------|------|---------|
| `RESEND_API_KEY` | secret | Resend API key |
| `CONTACT_TO_EMAIL` | secret | Your inbox (e.g. `max@example.com`) |
| `ALLOWED_ORIGIN` | var | `https://maxfullstack.com` (exact match for `Origin` header) |
| `CONTACT_FROM_EMAIL` | var | Verified sender, e.g. `Max Full Stack <contact@maxfullstack.com>` |
| `CONTACT_KV` | binding | KV namespace for rate limiting |

Local preview with secrets: `wrangler secret put …` or `.dev.vars` (do not commit).

## 4. Deploy the Worker

```bash
wrangler deploy
```

Note the URL printed after deploy, typically:

`https://vizitka-contact-relay.<your-account-subdomain>.workers.dev`

Optional: add a route in Cloudflare Workers, e.g. `https://maxfullstack.com/api/contact`, pointing to this Worker. If you use a custom URL, put that URL in `script.js` instead.

## 5. Wire the site
In `script.js`, replace `YOUR_SUBDOMAIN` with your Cloudflare account subdomain from the deploy URL:

```js
const CONTACT_ENDPOINT = 'https://vizitka-contact-relay.<your-account-subdomain>.workers.dev';
```

Commit and deploy the static site (GitHub Pages or your usual flow).

## 6. Smoke test
1. Open `https://maxfullstack.com/#contact` (or `/ru/`, `/he/`).
2. Submit the form with a real email in the contact field.
3. Confirm mail arrives at `CONTACT_TO_EMAIL` with name, company, contact, message, and source URL.
4. Reply-to is set automatically when the contact field contains an email address.

## Security (unchanged behavior)
- Resend API key and destination inbox only in Worker secrets
- CORS limited to `ALLOWED_ORIGIN`
- `Referer` must start with the same origin
- Honeypot field `hp_field` — bots get a fake success, no email sent
- Rate limit: one submission per IP per 60 seconds (KV)
- Field length limits on the Worker
- Errors do not echo API keys or full upstream responses to the client

## Troubleshooting
- **403 Origin / Referer**: form must be opened on `https://maxfullstack.com` (not `www` unless you change `ALLOWED_ORIGIN`).
- **502 Delivery failed**: check Resend dashboard logs; verify domain and `CONTACT_FROM_EMAIL`.
- **500 Internal server error**: missing `RESEND_API_KEY` or `CONTACT_TO_EMAIL` on the Worker.
- **Client says endpoint not configured**: `script.js` still contains `YOUR_SUBDOMAIN`.
