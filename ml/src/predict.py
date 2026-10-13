import os
import json
from typing import Dict, Any, Optional
import numpy as np

from ml.src.feature_engineering import extract_features_from_dict, to_feature_vector, FEATURE_NAMES
from ml.src.model import BrandGuardTabularClassifier
from ml.src.calibrate import PlattCalibrator

_MODEL_CACHE = None


def load_model(model_path: str = "ml/models/baseline_rf_v1.json") -> Optional[Dict[str, Any]]:
    global _MODEL_CACHE
    if _MODEL_CACHE is not None:
        return _MODEL_CACHE
    
    if not os.path.exists(model_path):
        # Check fallback
        alt_path = os.path.join(os.path.dirname(__file__), "..", "models", "baseline_rf_v1.json")
        if os.path.exists(alt_path):
            model_path = alt_path
        else:
            return None

    try:
        with open(model_path, "r") as f:
            data = json.load(f)

        classifier = BrandGuardTabularClassifier.from_dict(data["model_data"])
        cal_data = data.get("calibrator", {})
        calibrator = PlattCalibrator(a=cal_data.get("a", 1.0), b=cal_data.get("b", 0.0))

        _MODEL_CACHE = {
            "model": classifier,
            "calibrator": calibrator,
            "version": data.get("version", "1.1.0-numpy-logistic")
        }
        return _MODEL_CACHE
    except Exception as exc:
        print(f"Warning: Could not load model from {model_path}: {exc}")
        return None


def predict_impersonation_risk(
    features_dict: Dict[str, Any],
    model_path: str = "ml/models/baseline_rf_v1.json"
) -> Dict[str, Any]:
    """
    Inference endpoint returning calibrated probability of impersonation.
    """
    artifact = load_model(model_path)
    if artifact is None:
        return {
            "ml_available": False,
            "calibrated_probability": None,
            "predicted_class": None,
            "model_version": "none"
        }

    classifier = artifact["model"]
    calibrator = artifact["calibrator"]

    extracted = extract_features_from_dict(features_dict)
    vec = to_feature_vector(extracted).reshape(1, -1)

    raw_prob = float(classifier.predict_proba(vec)[0, 1])
    cal_prob = calibrator.calibrate(raw_prob) if calibrator else raw_prob
    pred_class = int(cal_prob >= 0.50)

    return {
        "ml_available": True,
        "raw_probability": round(raw_prob, 4),
        "calibrated_probability": round(float(cal_prob), 4),
        "predicted_class": pred_class,
        "model_version": artifact.get("version", "1.1.0-numpy-logistic")
    }
