# BrandGuard ML Dataset Documentation

## 1. Overview and Problem Formulation
The goal of the BrandGuard ML model is supervised binary classification to detect digital brand impersonation and fake accounts across social media platforms (Instagram, X/Twitter, Facebook, Telegram) and web domains.

- **Target Label $Y \in \{0, 1\}$**:
  - `1`: Confirmed Impersonation (fraudulent account, typosquatted domain, deceptive support mimic, phishing asset).
  - `0`: Legitimate or verified non-impersonating entity (official verified asset, non-infringing third-party, unaffiliated general account).

These definitions describe the intended real-world task. The current
synthetic generator assigns labels from its own rules; it does not contain
independently confirmed examples.

## 2. Dataset Provenance & Synthetic Benchmarking
No real-world records are used in this benchmark:
- No private social media data, passwords, or personal identifying information (PII) is collected or stored.
- A synthetic benchmark generator creates controlled, manually specified test distributions illustrating patterns of interest:
  - Homoglyph attacks (e.g., Cyrillic 'a', '0' for 'o', '1' for 'l').
  - Deceptive support suffixes (`_support`, `_helpdesk`, `_claims`, `_official`).
  - Subdomain spoofing (brand in subdomain of an unrelated apex domain).
  - Punycode IDN homograph domain attacks (`xn--...`).
  - Legitimate official handles and standard non-infringing third-party usernames.

## 3. Data Splitting & Leakage Prevention
The current synthetic benchmark:
- Train / Validation / Test sets are split **70% / 15% / 15%** using stratified sampling on the label.
- Splits individual generated rows. It does not group related examples, brands, or attack templates; template leakage is possible.
- Fixed random seeds (`seed=42`) ensure reproducible partitions across runs.

These splits are useful for checking code behavior and repeatability, but do
not establish generalization to real accounts, brands, platforms, or attacks.
The generated class balance and feature distributions are not estimates of
real-world prevalence or behavior.

## 4. Requirements for a real-world validation set

No real-world labeled brand-impersonation dataset is included in this project.
Do not present the synthetic benchmark as real-world model validation. Before
making performance claims, obtain a dataset with documented source, license
and collection permissions, timestamped examples, independently reviewed
labels, and enough fields to reproduce the model's feature extraction.
Deduplicate and split by brand/campaign or other related-example group, keep
the test set untouched during model and calibrator selection, and document
class prevalence and missing-data handling. If the data cannot legally be
redistributed, retain a source manifest and reproducible evaluation procedure
without committing the raw records.

### Public dataset assessment

The [UCI PhiUSIIL Phishing URL dataset](https://archive.ics.uci.edu/dataset/967/phiusiil+phishing+url+dataset)
is listed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) and
contains real URLs with phishing/legitimate labels. It is a possible source
for a separate phishing-detection benchmark, but phishing is not equivalent
to brand impersonation, and its records do not provide all brand-aware fields
required by this model. It was not used to validate this model.

[PhishTank's verified feed](https://www.phishtank.com/developer_info.php) can
provide some real phishing URLs and an impersonated target where known, but is
positive-only and does not state an open-data license. It was not used; review
current terms and obtain a defensible independently verified negative set
before any evaluation or redistribution.

### Reproducible group-separated evaluation

When a suitable and authorized labeled dataset is available, prepare a CSV
with the feature columns in `feature_schema.json`, a binary `label`, and a
`group_id` that keeps related records (at minimum the same brand or campaign)
together. Labels must be independently reviewed, and the source, license or
terms, and labeling method must be recorded. Do not include raw sensitive
records in the repository.

Run the evaluation from the repository root:

```powershell
.\backend\.venv\Scripts\python.exe -m ml.src.evaluate_real_world `
  --input D:\approved-data\brandguard-features.csv `
  --output ml\models\approved-dataset-evaluation.json `
  --group-column group_id `
  --source "Dataset citation and version" `
  --license "License or terms URL" `
  --labeling-method "Independent review procedure"
```

The pipeline assigns entire groups to train/validation/test partitions,
requires both classes in every partition, fits the classifier on training
groups, fits calibration on validation groups, and evaluates once on the
held-out test groups. It reports false-positive rate and other ranking,
threshold, and probability metrics. The output describes a newly fitted model;
it does not validate the currently deployed synthetic-trained artifact.
Keep the test groups untouched during all model, feature, calibration, and
threshold selection. A failed group/class split is reported as an error
rather than silently falling back to a row-wise split.

## 5. Training and Ranking Metrics
The synthetic benchmark has an assigned class balance that is not based on live
traffic. The training pipeline uses:
- Cost-sensitive learning (`class_weight='balanced'`).
- Log-loss optimization for model fitting.
- Average precision (reported as PR-AUC) and ROC-AUC as ranking metrics; these
  do not function as training objectives.
