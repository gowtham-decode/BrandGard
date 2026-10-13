import json
import numpy as np
from typing import Dict, Any, List


class BrandGuardTabularClassifier:
    """
    Explainable regularized logistic classifier implemented with NumPy.
    """
    def __init__(
        self,
        learning_rate: float = 0.05,
        n_iterations: int = 500,
        l2_penalty: float = 0.01,
        class_weight_balanced: bool = True,
        random_seed: int = 42
    ):
        self.learning_rate = learning_rate
        self.n_iterations = n_iterations
        self.l2_penalty = l2_penalty
        self.class_weight_balanced = class_weight_balanced
        self.random_seed = random_seed
        self.weights = None
        self.bias = 0.0
        self.feature_names = []

    def _sigmoid(self, z: np.ndarray) -> np.ndarray:
        z = np.clip(z, -25.0, 25.0)
        return 1.0 / (1.0 + np.exp(-z))

    def fit(self, X: np.ndarray, y: np.ndarray, feature_names: List[str] = None):
        np.random.seed(self.random_seed)
        n_samples, n_features = X.shape
        self.feature_names = feature_names or [f"f_{i}" for i in range(n_features)]

        self.weights = np.zeros(n_features, dtype=np.float64)
        self.bias = 0.0

        # Class balancing weights
        if self.class_weight_balanced:
            n_pos = np.sum(y == 1)
            n_neg = np.sum(y == 0)
            w_pos = n_samples / (2.0 * max(1, n_pos))
            w_neg = n_samples / (2.0 * max(1, n_neg))
            sample_weights = np.where(y == 1, w_pos, w_neg)
        else:
            sample_weights = np.ones(n_samples, dtype=np.float64)

        # Gradient Descent with L2 Regularization
        for _ in range(self.n_iterations):
            linear_model = np.dot(X, self.weights) + self.bias
            y_pred = self._sigmoid(linear_model)

            errors = (y_pred - y) * sample_weights
            dw = (1.0 / n_samples) * (np.dot(X.T, errors) + self.l2_penalty * self.weights)
            db = (1.0 / n_samples) * np.sum(errors)

            self.weights -= self.learning_rate * dw
            self.bias -= self.learning_rate * db

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        linear_model = np.dot(X, self.weights) + self.bias
        probs_pos = self._sigmoid(linear_model)
        probs_neg = 1.0 - probs_pos
        return np.column_stack((probs_neg, probs_pos))

    def predict(self, X: np.ndarray, threshold: float = 0.50) -> np.ndarray:
        probs = self.predict_proba(X)[:, 1]
        return (probs >= threshold).astype(int)

    def get_feature_importances(self) -> Dict[str, float]:
        """Returns normalized absolute weight importance per feature."""
        abs_w = np.abs(self.weights)
        total = np.sum(abs_w) if np.sum(abs_w) > 0 else 1.0
        normalized = abs_w / total
        return {
            name: round(float(normalized[i]), 4)
            for i, name in enumerate(self.feature_names)
        }

    def to_dict(self) -> Dict[str, Any]:
        return {
            "model_type": "BrandGuardTabularClassifier",
            "weights": self.weights.tolist() if self.weights is not None else [],
            "bias": float(self.bias),
            "feature_names": self.feature_names,
            "feature_importances": self.get_feature_importances() if self.weights is not None else {},
            "learning_rate": self.learning_rate,
            "l2_penalty": self.l2_penalty,
            "random_seed": self.random_seed
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "BrandGuardTabularClassifier":
        inst = cls(
            learning_rate=data.get("learning_rate", 0.05),
            l2_penalty=data.get("l2_penalty", 0.01),
            random_seed=data.get("random_seed", 42)
        )
        inst.weights = np.array(data["weights"], dtype=np.float64)
        inst.bias = float(data["bias"])
        inst.feature_names = data.get("feature_names", [])
        return inst
