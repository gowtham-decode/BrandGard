# BrandGuard Browser Extension (Manifest V3)

A lightweight, privacy-preserving browser companion tool for instant inspection of potential brand impersonation, deceptive look-alike websites, and suspicious social media profiles.

## Features
- **Active Tab Inspection**: Queries the current active URL upon explicit user click.
- **Domain & Social Platform Auto-Detection**: Recognizes Instagram, X/Twitter, Telegram, Facebook, or apex websites.
- **Backend API Integration**: Securely submits target metadata to the BrandGuard AI engine (`/api/v1/scans`).
- **Real-Time Risk Categorization**: Displays risk tier (`Low`, `Medium`, `High`, `Critical`), aggregate score, explainable triggered rules, and deep links to full investigation reports.
- **Zero Background Tracking**: Does NOT monitor background browsing history, read private messages, or persist credentials.

## Installation in Google Chrome / Brave / Edge
1. Open Chrome and navigate to `chrome://extensions/`.
2. Toggle **Developer mode** in the top-right corner.
3. Click **Load unpacked**.
4. Select the `extension/` directory from this repository (`d:\BrandGard\extension`).
5. Ensure the BrandGuard backend is running at `http://localhost:8000`.
6. Click the BrandGuard icon in your extension toolbar to inspect any active page!
