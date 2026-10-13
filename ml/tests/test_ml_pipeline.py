import numpy as np
from ml.src.feature_engineering import (
    FEATURE_NAMES,
    extract_features_from_dict,
    to_feature_matrix,
    to_feature_vector,
)
from ml.src.model import BrandGuardTabularClassifier
from ml.src.calibrate import PlattCalibrator
from ml.src.evaluate import compute_evaluation_metrics, generate_evaluation_markdown
from ml.src.evaluate_real_world import evaluate_labeled_csv, group_stratified_split
from ml.src.predict import predict_impersonation_risk
from ml.src.train import generate_synthetic_dataset
import pytest


def test_feature_engineering_vector_dimensions():
    sample = {
        "brand_name_similarity": 0.85,
        "canonical_similarity": 0.90,
        "token_similarity": 0.80,
        "has_homoglyphs": 1,
        "brand_in_handle": 1,
        "added_deceptive_keywords": ["support", "official"],
    }
    feats = extract_features_from_dict(sample)
    vec = to_feature_vector(feats)
    assert len(vec) == len(FEATURE_NAMES)
    assert feats["deceptive_keyword_count"] == 2.0


def test_feature_matrix_has_stable_shape_and_order_without_dataframe_dependency():
    samples = [
        {"brand_name_similarity": 0.85, "has_homoglyphs": True},
        {"brand_name_similarity": 0.25, "uses_https": False},
    ]

    matrix = to_feature_matrix(samples)

    assert matrix.shape == (2, len(FEATURE_NAMES))
    assert matrix.dtype == np.float32
    assert matrix[0, FEATURE_NAMES.index("brand_name_similarity")] == 0.85
    assert matrix[1, FEATURE_NAMES.index("brand_name_similarity")] == 0.25
    assert to_feature_matrix([]).shape == (0, len(FEATURE_NAMES))


def test_synthetic_dataset_returns_reproducible_numpy_arrays():
    features, labels = generate_synthetic_dataset(n_samples=20, random_seed=7)
    repeated_features, repeated_labels = generate_synthetic_dataset(n_samples=20, random_seed=7)

    assert features.shape == (20, len(FEATURE_NAMES))
    assert labels.shape == (20,)
    np.testing.assert_array_equal(features, repeated_features)
    np.testing.assert_array_equal(labels, repeated_labels)


def test_tabular_classifier_fit_predict():
    X = np.array([
        [0.9, 0.9, 0.9, 1, 1, 2, 0.8, 0, 0.9, 0, 0, 1, 1.0],
        [0.85, 0.85, 0.8, 1, 1, 1, 0.7, 0, 0.8, 0, 0, 1, 1.0],
        [0.1, 0.1, 0.1, 0, 0, 0, 0.0, 0, 0.1, 0, 0, 1, 1.0],
        [0.05, 0.05, 0.0, 0, 0, 0, 0.0, 0, 0.05, 0, 0, 1, 1.0],
    ], dtype=np.float64)
    y = np.array([1, 1, 0, 0], dtype=np.int32)

    clf = BrandGuardTabularClassifier(learning_rate=0.1, n_iterations=100)
    clf.fit(X, y)
    preds = clf.predict(X)
    assert len(preds) == 4
    assert preds[0] == 1
    assert preds[2] == 0


def test_platt_calibrator():
    cal = PlattCalibrator()
    scores = np.array([0.8, 0.9, 0.95, 0.99])
    labels = np.array([0, 0, 1, 1])
    cal.fit(scores, labels)
    calibrated = cal.calibrate(scores)
    p_low = cal.calibrate(0.8)
    p_high = cal.calibrate(0.99)
    assert 0.0 <= p_low <= 1.0
    assert 0.0 <= p_high <= 1.0
    assert p_high > p_low
    assert np.mean((calibrated - labels) ** 2) < np.mean((scores - labels) ** 2)

    inverted = PlattCalibrator()
    inverted.fit(scores, 1 - labels)
    assert not np.isclose(cal.a, inverted.a) or not np.isclose(cal.b, inverted.b)


def test_evaluation_metrics_use_exact_rank_thresholds_and_group_ties():
    labels = np.array([0, 1, 1, 0])
    predictions = np.array([0, 1, 0, 1])
    probabilities = np.array([0.1, 0.4, 0.35, 0.8])

    metrics = compute_evaluation_metrics(labels, predictions, probabilities)

    assert metrics["average_precision"] == 0.5833
    assert metrics["pr_auc"] == metrics["average_precision"]
    assert metrics["roc_auc"] == 0.5
    assert metrics["confusion_matrix"] == {"tn": 1, "fp": 1, "fn": 1, "tp": 1}
    assert metrics["brier_score"] == 0.3581

    tied_metrics = compute_evaluation_metrics(
        np.array([1, 0, 1, 0]),
        np.array([1, 0, 1, 0]),
        np.array([0.8, 0.8, 0.2, 0.2]),
    )
    assert tied_metrics["average_precision"] == 0.5
    assert tied_metrics["roc_auc"] == 0.5


@pytest.mark.parametrize(
    ("labels", "predictions", "probabilities"),
    [
        (np.array([]), np.array([]), np.array([])),
        (np.array([0, 1]), np.array([0]), np.array([0.1, 0.9])),
        (np.array([0, 2]), np.array([0, 1]), np.array([0.1, 0.9])),
        (np.array([0, 1]), np.array([0, 1]), np.array([-0.1, 1.1])),
        (np.array([1, 1]), np.array([1, 1]), np.array([0.7, 0.9])),
    ],
)
def test_evaluator_rejects_invalid_inputs(labels, predictions, probabilities):
    with pytest.raises(ValueError):
        compute_evaluation_metrics(labels, predictions, probabilities)


def test_synthetic_report_does_not_claim_performance_thresholds():
    metrics = compute_evaluation_metrics(
        np.array([0, 1]),
        np.array([0, 1]),
        np.array([0.1, 0.9]),
    )
    report = generate_evaluation_markdown(metrics, "Synthetic fixture")

    assert "not real-world validation" in report
    assert "No acceptance thresholds are applied" in report
    assert "Target Threshold" not in report
    assert "PASS" not in report


def test_real_world_group_split_keeps_related_examples_together_and_classes_present():
    labels = np.repeat([0, 1] * 10, 2)
    groups = [f"group-{index}" for index in range(20) for _ in range(2)]
    splits = group_stratified_split(labels, groups, random_seed=17)

    group_splits = {
        name: {groups[index] for index in indices}
        for name, indices in splits.items()
    }
    assert not group_splits["train"] & group_splits["validation"]
    assert not group_splits["train"] & group_splits["test"]
    assert not group_splits["validation"] & group_splits["test"]
    for indices in splits.values():
        assert set(labels[indices]) == {0, 1}


def test_group_split_requires_enough_distinct_groups():
    with pytest.raises(ValueError, match="At least three distinct groups"):
        group_stratified_split(np.array([0, 1, 0, 1]), ["a", "a", "b", "b"])


def test_grouped_real_world_evaluator_writes_metrics_and_provenance(tmp_path):
    csv_path = tmp_path / "labeled.csv"
    output_path = tmp_path / "report.json"
    columns = ["group_id", "label", *FEATURE_NAMES]
    rows = []
    for group_number in range(20):
        label = group_number % 2
        for _ in range(2):
            features = [0.9 if label else 0.1] + [0.0] * (len(FEATURE_NAMES) - 1)
            rows.append([f"campaign-{group_number}", label, *features])

    with csv_path.open("w", encoding="utf-8", newline="") as stream:
        import csv

        writer = csv.writer(stream)
        writer.writerow(columns)
        writer.writerows(rows)

    report = evaluate_labeled_csv(
        csv_path,
        output_path,
        "group_id",
        "Approved labeled test data",
        "CC BY 4.0",
        "Two independent reviewers",
    )

    assert output_path.exists()
    assert report["dataset"]["license_or_terms"] == "CC BY 4.0"
    assert report["metrics"]["false_positive_rate"] >= 0.0
    assert report["split"]["test"]["groups"] > 0
    assert "does not evaluate the currently deployed" in report["limitations"][2]


def test_calibrator_requires_both_classes_and_valid_probabilities():
    with pytest.raises(ValueError, match="both binary classes"):
        PlattCalibrator().fit(np.array([0.1, 0.2]), np.array([0, 0]))
    with pytest.raises(ValueError, match="probabilities"):
        PlattCalibrator().fit(np.array([-0.1, 0.8]), np.array([0, 1]))


def test_predict_impersonation_risk_end_to_end():
    sample = {
        "brand_name_similarity": 0.95,
        "canonical_similarity": 0.95,
        "token_similarity": 0.90,
        "has_homoglyph_substitution": True,
        "brand_in_handle": True,
        "added_deceptive_keywords": ["support"],
        "evidence_completeness": 1.0
    }
    res = predict_impersonation_risk(sample)
    assert res["ml_available"] is True
    assert res["calibrated_probability"] is not None
    assert res["calibrated_probability"] > 0.60
