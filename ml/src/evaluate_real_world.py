"""Group-separated evaluation for approved, independently labeled datasets."""

import argparse
import csv
import json
from pathlib import Path
from typing import Any, Dict, List, Sequence, Tuple

import numpy as np

from ml.src.calibrate import PlattCalibrator
from ml.src.evaluate import compute_evaluation_metrics
from ml.src.feature_engineering import FEATURE_NAMES
from ml.src.model import BrandGuardTabularClassifier


def group_stratified_split(
    labels: np.ndarray,
    group_ids: Sequence[str],
    random_seed: int = 42,
    ratios: Tuple[float, float, float] = (0.70, 0.15, 0.15),
) -> Dict[str, np.ndarray]:
    """Assign whole groups to train/validation/test while approximating class ratios."""
    labels = np.asarray(labels)
    groups = np.asarray(group_ids, dtype=str)
    if labels.ndim != 1 or groups.ndim != 1 or labels.shape != groups.shape or not len(labels):
        raise ValueError("Labels and group IDs must be non-empty one-dimensional arrays of equal length.")
    if not np.isin(labels, (0, 1)).all():
        raise ValueError("Labels must contain only 0 and 1.")
    if np.any(np.char.str_len(np.char.strip(groups)) == 0):
        raise ValueError("Every record must have a non-empty related-example group ID.")
    if len(ratios) != 3 or any(ratio <= 0 for ratio in ratios) or not np.isclose(sum(ratios), 1.0):
        raise ValueError("Train, validation, and test ratios must be positive and sum to 1.")

    unique_groups = np.unique(groups)
    if len(unique_groups) < 3:
        raise ValueError("At least three distinct groups are required for a group-separated split.")
    if np.unique(labels).size != 2:
        raise ValueError("The dataset must contain both binary classes.")

    rng = np.random.default_rng(random_seed)
    shuffled_groups = rng.permutation(unique_groups)
    per_group = {
        group: np.bincount(labels[groups == group].astype(int), minlength=2)
        for group in shuffled_groups
    }
    ordered_groups = sorted(
        shuffled_groups,
        key=lambda group: -int(per_group[group].sum()),
    )

    names = ("train", "validation", "test")
    target = {
        name: np.bincount(labels.astype(int), minlength=2) * ratio
        for name, ratio in zip(names, ratios)
    }
    assigned: Dict[str, List[str]] = {name: [] for name in names}
    counts = {name: np.zeros(2, dtype=np.float64) for name in names}

    for index, group in enumerate(ordered_groups):
        empty = [name for name in names if not assigned[name]]
        remaining = len(ordered_groups) - index
        choices = empty if remaining <= len(empty) else list(names)
        group_counts = per_group[group]

        def assignment_cost(candidate: str) -> float:
            total = 0.0
            for name in names:
                candidate_counts = counts[name] + (group_counts if name == candidate else 0)
                denominators = np.maximum(target[name], 1.0)
                total += float(np.sum(((candidate_counts - target[name]) / denominators) ** 2))
            return total

        selected = min(choices, key=assignment_cost)
        assigned[selected].append(group)
        counts[selected] += group_counts

    split_indices = {
        name: np.flatnonzero(np.isin(groups, assigned[name]))
        for name in names
    }
    for name, indices in split_indices.items():
        if np.unique(labels[indices]).size != 2:
            raise ValueError(
                f"The {name} split does not contain both classes after grouping. "
                "Collect more independently labeled groups or revise the group definition."
            )
    return split_indices


def _load_labeled_csv(path: Path, group_column: str):
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        required = {group_column, "label", *FEATURE_NAMES}
        missing = required.difference(reader.fieldnames or [])
        if missing:
            raise ValueError(f"CSV is missing required columns: {', '.join(sorted(missing))}")

        rows = []
        for line_number, row in enumerate(reader, start=2):
            try:
                label = int(row["label"])
                features = [float(row[name]) for name in FEATURE_NAMES]
            except (TypeError, ValueError) as exc:
                raise ValueError(f"Invalid label or feature value on CSV line {line_number}.") from exc
            if label not in (0, 1) or not np.isfinite(features).all():
                raise ValueError(f"Label or feature values are out of range on CSV line {line_number}.")
            group_id = (row.get(group_column) or "").strip()
            if not group_id:
                raise ValueError(f"Missing group ID on CSV line {line_number}.")
            rows.append((features, label, group_id))

    if not rows:
        raise ValueError("The labeled dataset is empty.")
    return (
        np.asarray([row[0] for row in rows], dtype=np.float64),
        np.asarray([row[1] for row in rows], dtype=np.int64),
        [row[2] for row in rows],
    )


def evaluate_labeled_csv(
    input_path: Path,
    output_path: Path,
    group_column: str,
    source_name: str,
    license_name: str,
    labeling_method: str,
    random_seed: int = 42,
) -> Dict[str, Any]:
    """Fit on training groups, calibrate on validation groups, and report held-out metrics."""
    if not source_name.strip() or not license_name.strip() or not labeling_method.strip():
        raise ValueError("Source, license, and labeling method must be documented.")
    features, labels, group_ids = _load_labeled_csv(input_path, group_column)
    splits = group_stratified_split(labels, group_ids, random_seed=random_seed)
    train_idx, validation_idx, test_idx = (
        splits["train"],
        splits["validation"],
        splits["test"],
    )

    classifier = BrandGuardTabularClassifier(
        learning_rate=0.08,
        n_iterations=600,
        l2_penalty=0.01,
        class_weight_balanced=True,
        random_seed=random_seed,
    )
    classifier.fit(features[train_idx], labels[train_idx], feature_names=FEATURE_NAMES)

    validation_probabilities = classifier.predict_proba(features[validation_idx])[:, 1]
    calibrator = PlattCalibrator()
    calibrator.fit(validation_probabilities, labels[validation_idx])

    raw_probabilities = classifier.predict_proba(features[test_idx])[:, 1]
    calibrated_probabilities = np.asarray([
        calibrator.calibrate(probability) for probability in raw_probabilities
    ])
    predictions = (calibrated_probabilities >= 0.5).astype(np.int64)
    metrics = compute_evaluation_metrics(labels[test_idx], predictions, calibrated_probabilities)
    raw_metrics = compute_evaluation_metrics(
        labels[test_idx],
        (raw_probabilities >= 0.5).astype(np.int64),
        raw_probabilities,
    )
    cm = metrics["confusion_matrix"]
    metrics["false_positive_rate"] = round(
        cm["fp"] / (cm["fp"] + cm["tn"]), 4
    )
    metrics["raw_model_brier_score"] = raw_metrics["brier_score"]

    split_summary = {
        name: {
            "rows": int(len(indices)),
            "groups": int(len(set(group_ids[index] for index in indices))),
        }
        for name, indices in splits.items()
    }
    report = {
        "dataset": {
            "name": source_name.strip(),
            "license_or_terms": license_name.strip(),
            "labeling_method": labeling_method.strip(),
            "input_file": input_path.name,
            "group_column": group_column,
            "random_seed": random_seed,
            "rows": int(len(labels)),
            "groups": int(len(set(group_ids))),
        },
        "split": split_summary,
        "metrics": metrics,
        "limitations": [
            "Metrics describe this dataset and group split only; they do not establish performance on other populations or platforms.",
            "Dataset source, license, collection permissions, and independent label quality must be verified by the evaluator.",
            "This fits a new model on the provided training groups; it does not evaluate the currently deployed synthetic-trained artifact.",
            "The test groups must remain untouched during feature, model, calibration, and threshold selection.",
        ],
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path, help="Authorized labeled feature CSV.")
    parser.add_argument("--output", required=True, type=Path, help="Path for the JSON evaluation report.")
    parser.add_argument("--group-column", default="group_id", help="Brand/campaign/group ID CSV column.")
    parser.add_argument("--source", required=True, help="Dataset source citation/name.")
    parser.add_argument("--license", required=True, help="Applicable license or terms reference.")
    parser.add_argument("--labeling-method", required=True, help="How labels were independently reviewed.")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    report = evaluate_labeled_csv(
        args.input,
        args.output,
        args.group_column,
        args.source,
        args.license,
        args.labeling_method,
        args.seed,
    )
    print(json.dumps({"report": str(args.output), "metrics": report["metrics"]}, indent=2))


if __name__ == "__main__":
    main()
