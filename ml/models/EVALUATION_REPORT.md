# BrandGuard Model Evaluation Report

**Evaluation Dataset:** Synthetic Impersonation Benchmark (N=1200, seed=42)  
**Dataset scope:** Synthetic benchmark; this is not real-world validation.  
**Ranking metric:** Average precision (non-interpolated precision-recall area).
No acceptance thresholds are applied; these synthetic results are for
pipeline verification and are not evidence of model performance on real data.

## Synthetic Benchmark Metrics
| Metric | Score |
| :--- | :--- |
| **Precision** | `1.0000` |
| **Recall** | `0.9643` |
| **F1 Score** | `0.9818` |
| **Average precision (PR)** | `0.9985` |
| **ROC-AUC** | `0.9993` |
| **Brier Score** | `0.0105` |
| **Log loss** | `0.0394` |

**Uncalibrated Brier score on the same test split:** `0.0321`  

## Confusion Matrix (held-out test split)
| | Predicted Negative (0) | Predicted Positive (1) |
| :--- | :--- | :--- |
| **Actual Negative (0)** | **TN:** 123 | **FP:** 0 |
| **Actual Positive (1)** | **FN:** 2 | **TP:** 54 |

## Interpretation and limitations

The classifier and calibrator were fit without using this held-out test split.
Calibration is fit on validation labels and Brier score is measured on the
test split. The benchmark uses generated feature distributions; these scores
do not estimate performance on real accounts, app listings, domains, or
production traffic. Splits are stratified by row label; related-example
grouping is not implemented.
