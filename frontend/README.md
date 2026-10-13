# BrandGuard frontend

The web app uses the BrandGuard FastAPI backend for email/password
authentication, brand profiles, official assets, analyst-submitted monitoring,
risk reports, and scan history. Start both processes in separate PowerShell
terminals.

## Start the backend

```powershell
cd D:\BrandGard\backend
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The API health check should return healthy at
`http://127.0.0.1:8000/api/v1/health`.

## Start the frontend

```powershell
cd D:\BrandGard\frontend
bun install
bun run dev
```

Open `http://127.0.0.1:8080/`. The API defaults to
`http://127.0.0.1:8000/api/v1`; set `VITE_BRANDGUARD_API_URL` in the frontend
environment to use another API URL.

## Scope and data-source status

- Create an account or sign in using the BrandGuard API. Google OAuth is not
  configured for this backend.
- Brand logo entry currently accepts an image URL; binary upload storage is
  not configured.
- Official social and app-store assets are manually entered. Analyst
  verification records a review note; it does not independently verify DNS,
  contact the platform, or fetch the listing.
- Social profiles and Google Play listings must be submitted by the analyst.
  Apple App Store monitoring can query Apple's public catalog and import
  listing metadata; catalog results are not verified official assets.
- The app does not crawl social networks or query Google Play.
- App publisher mismatch is a corroborating review signal only when an
  official app publisher is registered and the submitted app name is similar.
  A publisher mismatch alone is not proof of impersonation.
- Logo-image similarity, source availability checks, automated takedowns, and
  recording/demo assets are not implemented.
