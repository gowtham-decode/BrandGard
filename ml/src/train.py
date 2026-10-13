import os
import json
import numpy as np

from ml.src.feature_engineering import FEATURE_NAMES
from ml.src.evaluate import compute_evaluation_metrics, generate_evaluation_markdown
from ml.src.calibrate import PlattCalibrator
from ml.src.model import BrandGuardTabularClassifier


def generate_synthetic_dataset(
    n_samples: int = 1200,
    random_seed: int = 42,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Generates a synthetic benchmark with manually specified feature distributions.
    Class 1: Impersonation attacks (homoglyphs, added keywords, typosquats, subdomain spoofing).
    Class 0: Legitimate accounts and official assets.
    """
    rng = np.random.default_rng(random_seed)
    data = []

    for _ in range(n_samples):
        # Set a fixed synthetic class balance; it does not represent deployment prevalence.
        is_impersonation = 1 if rng.random() < 0.30 else 0

        if is_impersonation:
            # Impersonator characteristics
            sim = rng.uniform(0.65, 0.98)
            has_homo = 1 if rng.random() < 0.40 else 0
            brand_in_handle = 1 if rng.random() < 0.70 else 0
            deceptive_kw = rng.integers(1, 4) if rng.random() < 0.65 else 0
            is_exact = 0
            dom_sim = rng.uniform(0.70, 0.99) if rng.random() < 0.35 else rng.uniform(0.1, 0.4)
            subdomain_spoof = 1 if rng.random() < 0.25 else 0
            punycode = 1 if rng.random() < 0.20 else 0
        else:
            # Legitimate characteristics
            is_exact = 1 if rng.random() < 0.25 else 0
            sim = 1.0 if is_exact else rng.uniform(0.05, 0.45)
            has_homo = 0
            brand_in_handle = 0 if not is_exact else 1
            deceptive_kw = 0
            dom_sim = 1.0 if is_exact else rng.uniform(0.05, 0.30)
            subdomain_spoof = 0
            punycode = 0

        data.append({
            "brand_name_similarity": round(float(sim), 4),
            "canonical_similarity": round(float(min(1.0, sim + (0.15 if has_homo else 0.0))), 4),
            "token_similarity": round(float(sim * rng.uniform(0.8, 1.0)), 4),
            "has_homoglyphs": has_homo,
            "brand_in_handle": brand_in_handle,
            "deceptive_keyword_count": int(deceptive_kw),
            "max_official_handle_similarity": round(float(sim * 0.9), 4),
            "is_exact_official_match": is_exact,
            "domain_similarity": round(float(dom_sim), 4),
            "is_punycode_domain": punycode,
            "subdomain_spoof_flag": subdomain_spoof,
            "uses_https": 1 if rng.random() < 0.85 else 0,
            "evidence_completeness": round(float(rng.uniform(0.75, 1.0)), 2),
            "label": is_impersonation
        })

    features = np.asarray(
        [[sample[name] for name in FEATURE_NAMES] for sample in data],
        dtype=np.float64,
    )
    labels = np.asarray([sample["label"] for sample in data], dtype=np.int32)
    return features, labels


def stratified_split(X: np.ndarray, y: np.ndarray, test_ratio: float = 0.30, random_seed: int = 42):
    """Performs stratified train/test split without external dependencies."""
    rng = np.random.default_rng(random_seed)
    pos_indices = np.where(y == 1)[0]
    neg_indices = np.where(y == 0)[0]

    rng.shuffle(pos_indices)
    rng.shuffle(neg_indices)

    n_pos_test = int(len(pos_indices) * test_ratio)
    n_neg_test = int(len(neg_indices) * test_ratio)

    test_idx = np.concatenate([pos_indices[:n_pos_test], neg_indices[:n_neg_test]])
    train_idx = np.concatenate([pos_indices[n_pos_test:], neg_indices[n_neg_test:]])

    rng.shuffle(test_idx)
    rng.shuffle(train_idx)

    return X[train_idx], X[test_idx], y[train_idx], y[test_idx]


def train_baseline_model(
    output_dir: str = "ml/models",
    random_seed: int = 42
):
    """Trains, calibrates, evaluates, and persists the baseline tabular model."""
    os.makedirs(output_dir, exist_ok=True)
    X, y = generate_synthetic_dataset(n_samples=1200, random_seed=random_seed)

    # Train (70%), Temp (30%) -> Val (15%), Test (15%)
    X_train, X_temp, y_train, y_temp = stratified_split(X, y, test_ratio=0.30, random_seed=random_seed)
    X_val, X_test, y_val, y_test = stratified_split(X_temp, y_temp, test_ratio=0.50, random_seed=random_seed)

    print(f"Dataset split: Train={len(X_train)}, Val={len(X_val)}, Test={len(X_test)}")

    # Train regularized model
    classifier = BrandGuardTabularClassifier(
        learning_rate=0.08,
        n_iterations=600,
        l2_penalty=0.01,
        class_weight_balanced=True,
        random_seed=random_seed
    )
    classifier.fit(X_train, y_train, feature_names=FEATURE_NAMES)

    # Calibration on validation set
    val_probs = classifier.predict_proba(X_val)[:, 1]
    calibrator = PlattCalibrator()
    calibrator.fit(val_probs, y_val)

    # Evaluate on held-out test split
    test_raw_probs = classifier.predict_proba(X_test)[:, 1]
    test_cal_probs = np.array([calibrator.calibrate(p) for p in test_raw_probs])
    test_preds = (test_cal_probs >= 0.50).astype(int)

    metrics = compute_evaluation_metrics(y_test, test_preds, test_cal_probs)
    raw_metrics = compute_evaluation_metrics(
        y_test,
        (test_raw_probs >= 0.50).astype(int),
        test_raw_probs,
    )
    metrics["raw_model_brier_score"] = raw_metrics["brier_score"]
    print("Held-out Test Evaluation Metrics:")
    print(json.dumps(metrics, indent=2))

    # Save model artifact as JSON
    model_artifact = {
        "model_data": classifier.to_dict(),
        "calibrator": {"a": calibrator.a, "b": calibrator.b},
        "feature_names": FEATURE_NAMES,
        "version": "1.1.0-numpy-logistic",
        "random_seed": random_seed
    }
    artifact_json_path = os.path.join(output_dir, "baseline_rf_v1.json")
    with open(artifact_json_path, "w") as f:
        json.dump(model_artifact, f, indent=2)
    print(f"Model saved as JSON to {artifact_json_path}")

    # Save metrics and markdown report
    metrics_path = os.path.join(output_dir, "evaluation_report.json")
    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=2)

    report_md = generate_evaluation_markdown(
        metrics,
        dataset_name="Synthetic Impersonation Benchmark (N=1200, seed=42)",
    )
    report_md_path = os.path.join(output_dir, "EVALUATION_REPORT.md")
    with open(report_md_path, "w") as f:
        f.write(report_md)
    print(f"Evaluation report written to {report_md_path}")

    return metrics


if __name__ == "__main__":
    train_baseline_model()
