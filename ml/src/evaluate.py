from typing import Any, Dict

import numpy as np


def _validated_arrays(y_true: np.ndarray, y_pred: np.ndarray, y_prob: np.ndarray):
    y_true = np.asarray(y_true)
    y_pred = np.asarray(y_pred)
    y_prob = np.asarray(y_prob, dtype=np.float64)

    if y_true.ndim != 1 or y_pred.ndim != 1 or y_prob.ndim != 1:
        raise ValueError("Evaluation inputs must be one-dimensional arrays.")
    if not (len(y_true) == len(y_pred) == len(y_prob)) or len(y_true) == 0:
        raise ValueError("Evaluation inputs must have the same non-zero length.")
    if not np.isin(y_true, (0, 1)).all() or not np.isin(y_pred, (0, 1)).all():
        raise ValueError("Labels and predictions must contain only 0 and 1.")
    if not np.isfinite(y_prob).all() or ((y_prob < 0) | (y_prob > 1)).any():
        raise ValueError("Predicted probabilities must be finite and in [0, 1].")

    return y_true.astype(np.int64), y_pred.astype(np.int64), y_prob


def compute_evaluation_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    y_prob: np.ndarray,
) -> Dict[str, Any]:
    """Compute thresholded metrics, ROC-AUC, average precision, and Brier score."""
    y_true, y_pred, y_prob = _validated_arrays(y_true, y_pred, y_prob)

    tp = int(np.sum((y_true == 1) & (y_pred == 1)))
    fp = int(np.sum((y_true == 0) & (y_pred == 1)))
    tn = int(np.sum((y_true == 0) & (y_pred == 0)))
    fn = int(np.sum((y_true == 1) & (y_pred == 0)))

    precision = float(tp / (tp + fp)) if tp + fp else 0.0
    recall = float(tp / (tp + fn)) if tp + fn else 0.0
    f1 = float(2 * precision * recall / (precision + recall)) if precision + recall else 0.0
    brier = float(np.mean((y_prob - y_true) ** 2))
    clipped_probabilities = np.clip(y_prob, 1e-15, 1.0 - 1e-15)
    log_loss = float(-np.mean(
        y_true * np.log(clipped_probabilities)
        + (1 - y_true) * np.log1p(-clipped_probabilities)
    ))

    positives = int(np.sum(y_true == 1))
    negatives = len(y_true) - positives
    if not positives or not negatives:
        raise ValueError("Evaluation labels must contain both binary classes.")

    order = np.argsort(-y_prob, kind="stable")
    sorted_labels = y_true[order]
    cumulative_tp = np.cumsum(sorted_labels)
    sorted_scores = y_prob[order]
    distinct_score_ends = np.r_[
        np.flatnonzero(np.diff(sorted_scores)),
        len(sorted_scores) - 1,
    ]
    true_positives = cumulative_tp[distinct_score_ends]
    false_positives = distinct_score_ends + 1 - true_positives
    precision_at_threshold = true_positives / (true_positives + false_positives)
    recall_increments = np.diff(np.r_[0.0, true_positives / positives])
    average_precision = float(np.sum(precision_at_threshold * recall_increments))
    true_positive_rate = np.r_[0.0, true_positives / positives]
    false_positive_rate = np.r_[0.0, false_positives / negatives]
    roc_auc = float(np.trapezoid(true_positive_rate, false_positive_rate))

    return {
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1_score": round(f1, 4),
        "pr_auc": round(average_precision, 4),
        "average_precision": round(average_precision, 4),
        "roc_auc": round(roc_auc, 4),
        "brier_score": round(brier, 4),
        "log_loss": round(log_loss, 4),
        "positive_count": positives,
        "negative_count": negatives,
        "confusion_matrix": {"tn": tn, "fp": fp, "fn": fn, "tp": tp},
    }


def generate_evaluation_markdown(
    metrics: Dict[str, Any],
    dataset_name: str = "Synthetic Test Fixture",
) -> str:
    """Generate a report that states dataset scope and benchmark limitations."""
    cm = metrics["confusion_matrix"]
    return f"""# BrandGuard Model Evaluation Report

**Evaluation Dataset:** {dataset_name}  
**Dataset scope:** Synthetic benchmark; this is not real-world validation.  
**Ranking metric:** Average precision (non-interpolated precision-recall area).
No acceptance thresholds are applied; these synthetic results are for
pipeline verification and are not evidence of model performance on real data.

## Synthetic Benchmark Metrics
| Metric | Score |
| :--- | :--- |
| **Precision** | `{metrics['precision']:.4f}` |
| **Recall** | `{metrics['recall']:.4f}` |
| **F1 Score** | `{metrics['f1_score']:.4f}` |
| **Average precision (PR)** | `{metrics['average_precision']:.4f}` |
| **ROC-AUC** | `{metrics['roc_auc']:.4f}` |
| **Brier Score** | `{metrics['brier_score']:.4f}` |
| **Log loss** | `{metrics['log_loss']:.4f}` |

**Uncalibrated Brier score on the same test split:** `{metrics.get('raw_model_brier_score', float('nan')):.4f}`  

## Confusion Matrix (held-out test split)
| | Predicted Negative (0) | Predicted Positive (1) |
| :--- | :--- | :--- |
| **Actual Negative (0)** | **TN:** {cm['tn']} | **FP:** {cm['fp']} |
| **Actual Positive (1)** | **FN:** {cm['fn']} | **TP:** {cm['tp']} |

## Interpretation and limitations

The classifier and calibrator were fit without using this held-out test split.
Calibration is fit on validation labels and Brier score is measured on the
test split. The benchmark uses generated feature distributions; these scores
do not estimate performance on real accounts, app listings, domains, or
production traffic. Splits are stratified by row label; related-example
grouping is not implemented.
"""
