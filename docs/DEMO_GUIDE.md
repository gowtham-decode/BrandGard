# BrandGuard demo guide

## Before the demo

1. Start the backend and frontend using the Windows commands in the root
   [README](../README.md).
2. Check that `http://127.0.0.1:8000/api/v1/health` reports a healthy database,
   then open `http://127.0.0.1:8080/`.
3. Use a fresh account for a clean walkthrough. Registration creates a private
   workspace. The existing Northstar Demo workspace is also available for a
   pre-populated tour.
4. If using the pre-populated workspace, its logo displays the bundled
   Northstar demo mark. This is a local demo asset, not an uploaded customer
   logo.

## Seven-minute walkthrough

### 1. Sign in or register (1 minute)

Register with an email you control and a demo password, or sign in to the
existing demo account. Show the empty workspace and explain that every account
has its own private organization.

### 2. Register a brand and trusted assets (2 minutes)

Create a fictional brand such as **Northstar Demo**. Add a description and
official website or profile identifiers. Add the records only if they are
known to be official. In the asset list, open manual verification and enter a
short note describing the evidence reviewed. Explain that this records an
analyst's review; it does not independently contact a platform or prove
ownership.

For a website asset, the authenticated API also supports a DNS TXT challenge:
start verification with `POST /api/v1/brands/{brand_id}/assets/{asset_id}/verify`,
publish the returned token at the instructed DNS name, and complete it with
`POST /api/v1/brands/{brand_id}/assets/{asset_id}/verify/dns`. The second call
checks the public TXT record before trusting the website. This automated
method does not verify social accounts, apps, or the uploaded identity of a
brand.

### 3. Analyze a social profile (1 minute)

Open **Social monitoring** and submit a fictional profile such as
`northstar_demo_support`, with display name **Northstar Demo Support** and a
description that claims to be official customer support. Point out the risk
tier, score, evidence items, and the fact that the profile details were
submitted by the analyst rather than crawled from a social network.

### 4. Analyze an app listing (1 minute)

Open **App monitoring**. Search Apple's public App Store catalog if online
access is available, or submit a clearly identified sample listing. A similar
name and a different publisher are review signals, not proof of impersonation.
Do not present a manually entered Google Play example as a live store result.

### 5. Review and revisit a finding (2 minutes)

Open **Analysis & history**, inspect the evidence and uncertainty, and mark a
result for review or as a false positive. Refresh the page and reopen the saved
history entry to demonstrate persistence.

## Suggested cases and expected interpretation

| Case | Expected interpretation |
| --- | --- |
| Exact registered, verified social handle or app identifier | Trusted official match; no impersonation alert |
| Exact brand name on an unknown profile | Review; name match alone is not proof |
| Similar handle with a character substitution | Potential impersonation; inspect supporting evidence |
| Brand name plus `support` or `help` | A signal to review; require corroborating evidence |
| Similar app name with a different publisher | Investigate; publisher mismatch alone is not proof |
| Missing profile details or an inaccessible listing | State what evidence is missing; do not invent source data |
| Unrelated account with no brand signals | No significant evidence of impersonation |

## What is and is not live

- Email/password authentication, private workspaces, brand and asset records,
  submitted analyses, reviews, and scan history use the local API and database.
- Website ownership can be verified through a DNS TXT challenge using the API;
  other asset types still require analyst review.
- Apple App Store search queries Apple's public catalog when online access is
  available. Catalog metadata is not ownership verification.
- Social networks are not crawled. Google Play is not queried. Those examples
  must be submitted manually and described as analyst-provided.
- Google OAuth and binary logo uploads are not configured.
- Detection is an explainable prototype. It is not a platform enforcement,
  takedown, or legal determination service.

## Final presenter checklist

- Confirm both local servers respond before presenting.
- Use fictional or approved data; do not submit real sensitive account details.
- Demonstrate one official match and one suspicious-looking candidate.
- Explain evidence and uncertainty, not just the score.
- Say explicitly when data is analyst-submitted, demo content, or fetched from
  Apple's public catalog.
