# BrandGuard AI Digital Risk Protection Platform

BrandGuard is a human-reviewed Digital Risk Protection prototype for assessing analyst-submitted social profiles, websites, and app listings against registered brand assets. It does not continuously discover or monitor social accounts, and it has not been validated for real-world detection performance.

---

## 1. System Components
1. **AI Detection Engine (`backend/app/detection/`, `ml/`)**:
   - Normalized string similarity and token set matching via RapidFuzz.
   - Homoglyph canonicalization (leetspeak, Cyrillic look-alikes).
   - Domain and punycode (IDN homograph) structure analyzer.
   - Server-Side Request Forgery (SSRF) defense blocking private and reserved IP addresses.
   - Deterministic explainable rule engine with granular evidence items.
   - Optional tabular classifier with sigmoid calibration; evaluation is synthetic-only and does not establish real-world accuracy or calibrated probabilities.
2. **Backend API (`backend/app/`)**:
   - FastAPI REST API with OpenAPI documentation at `/docs`.
   - SQLite default for local Windows development, PostgreSQL ready for production.
   - JWT authentication, password hashing (PBKDF2-HMAC-SHA256), and organization isolation.
   - Comprehensive endpoints: `/auth`, `/brands`, `/scans`, `/dashboard`, `/health`.
3. **Web Dashboard (`frontend/`)**:
   - BrandGuard workspace using the FastAPI authentication, brand, scan, review, and history endpoints.
   - Analyst-submitted social profiles and app listings; Apple public-catalog search is available on request, but social crawlers and Google Play search are not configured.
4. **Browser Extension (`extension/`)**:
   - Chrome Manifest V3 extension for one-click URL and active-tab inspection.
   - Zero background tracking; only transmits user-submitted URLs upon explicit interaction.

---

## 2. Directory Structure
```
d:\BrandGard\
├── backend/
│   ├── app/
│   │   ├── api/v1/         # Endpoints: auth, brands, scans, dashboard, health
│   │   ├── core/           # Security, JWT, SSRF protection
│   │   ├── database.py     # SQLAlchemy session & engine
│   │   ├── detection/      # Normalizer, similarity, domain analysis, rules, risk engine
│   │   ├── models/         # User, Org, Brand, Asset, Scan, RiskAssessment, Audit
│   │   ├── schemas/        # Pydantic request & response schemas
│   │   └── main.py         # FastAPI application entrypoint
│   ├── tests/              # Pytest automated test suites
│   ├── requirements.txt    # Python dependencies
│   ├── .env.example        # Environment variable template
│   └── Dockerfile          # Production container configuration
├── ml/
│   ├── data/               # Feature schema & dataset documentation
│   ├── src/                # Feature engineering, model, train, evaluate, predict, calibrate
│   ├── models/             # Trained baseline model & evaluation report
│   └── tests/              # ML pipeline automated unit tests
├── extension/              # Chrome Manifest V3 browser extension
├── docs/                   # Architecture & Threat modeling guides
├── docker-compose.yml      # Multi-container orchestration
└── README.md
```

---

## 3. Quick Start on Windows

### Prerequisites
- Python 3.10+ (Tested on Python 3.14 on Windows 11)

### A. Backend Setup
1. Open PowerShell and navigate to the project directory:
   ```powershell
   cd d:\BrandGard\backend
   ```
2. Activate the virtual environment:
   ```powershell
   .\.venv\Scripts\Activate.ps1
   ```
3. Install dependencies:
   ```powershell
   pip install -r requirements.txt
   ```
4. Start the backend server:
   ```powershell
   uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```
5. Access interactive Swagger documentation at:
   **[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)**

### B. Frontend Setup
Open a second PowerShell window:
```powershell
cd d:\BrandGard\frontend
bun install
bun run dev
```
Open **[http://127.0.0.1:8080](http://127.0.0.1:8080)**. The frontend uses the backend at `http://127.0.0.1:8000/api/v1` by default.

### Current Demo Boundaries
- Brand logo entry accepts a URL; binary upload storage is not configured.
- Official assets are entered by an analyst. Website assets can be verified by publishing a DNS TXT challenge; social and app assets use analyst review, which does not independently prove ownership.
- Social profiles and Google Play listings must be submitted manually; live social-network and Google Play integrations are not configured.
- Apple App Store monitoring can search Apple's public catalog and import observed listing details for analysis. A catalog result is not proof that an app is official; it must still be reviewed against registered assets.
- App publisher mismatch is a corroborating review signal only. Logo similarity, external listing availability, and automated takedowns are not implemented.
- Scan history retains source-provenance metadata; Apple listing observation time is client-reported, not an immutable or independently authenticated evidence record.
- Read the [architecture and evidence-flow documentation](docs/ARCHITECTURE.md) for implemented sources, trusted-asset exclusion, persistence, provenance limits, and future integrations.
- Follow [the demo guide](docs/DEMO_GUIDE.md) for the walkthrough and sample cases; open the [demo slides](docs/demo-slides.html) in a browser for the presentation.

### Demo Account
Create an account through the sign-in page. To enable the seeded demo analyst,
set a private `DEMO_ADMIN_PASSWORD` in `backend/.env`; the account email is
`security@brandguard.io`. Never commit your `.env` file.

---

## 4. Running Automated Tests
From the repository root, run the backend API, detection, SSRF, and ML
regression suites with the project virtual environment:
```powershell
.\backend\.venv\Scripts\python.exe -m pytest -v backend\tests ml\tests
```
The backend tests cover:
- Normalization & homoglyphs
- SSRF private IP rejection
- Rule-based detection & official match overrides
- Authentication, organization isolation, asset verification, and scan lifecycle endpoints
- Apple App Store search behavior and error handling

The ML unit tests exercise feature extraction, the NumPy classifier, probability
calibration, and inference. Feature preparation and model training use NumPy;
Pandas and scikit-learn are not required.

---

## 5. Machine Learning Evaluation
The included benchmark is synthetic and row-split; it is for pipeline
verification only. No suitably sourced, independently labeled real-world
brand-impersonation dataset is currently included, so the project makes no
real-world performance or calibration claims. See
[`ml/data/README.md`](ml/data/README.md) for the validation-data requirements
and instructions for group-separated real-world evaluation, and see
[`ml/models/EVALUATION_REPORT.md`](ml/models/EVALUATION_REPORT.md) for the
current synthetic benchmark results and limitations.

---

## 6. Chrome Browser Extension Setup
1. Open Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode** in the upper right.
3. Click **Load unpacked** and select the `d:\BrandGard\extension` folder.
4. Ensure the backend is running at `http://localhost:8000`.
5. Click the BrandGuard icon in the extensions bar to analyze any active tab.
