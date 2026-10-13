from typing import Union

import numpy as np


class PlattCalibrator:
    """Fits a sigmoid calibration mapping to held-out binary labels.

    Inputs are probabilities; the sigmoid is fitted to their log-odds.
    """

    def __init__(self, a: float = 1.0, b: float = 0.0, max_iterations: int = 100):
        self.a = a
        self.b = b
        self.max_iterations = max_iterations

    def fit(self, scores: np.ndarray, labels: np.ndarray):
        """Fit sigmoid parameters by minimizing validation-set log loss."""
        scores = np.asarray(scores, dtype=np.float64)
        labels = np.asarray(labels, dtype=np.float64)

        if scores.ndim != 1 or labels.ndim != 1 or scores.shape != labels.shape:
            raise ValueError("Scores and labels must be one-dimensional arrays of equal length.")
        if scores.size == 0 or not np.isfinite(scores).all() or not np.isfinite(labels).all():
            raise ValueError("Scores and labels must be non-empty and finite.")
        if ((scores < 0.0) | (scores > 1.0)).any():
            raise ValueError("Calibration scores must be probabilities in [0, 1].")
        if not np.isin(labels, (0.0, 1.0)).all() or np.unique(labels).size != 2:
            raise ValueError("Calibration labels must contain both binary classes, 0 and 1.")

        eps = 1e-7
        clipped = np.clip(scores, eps, 1.0 - eps)
        logits = np.log(clipped) - np.log1p(-clipped)
        design = np.column_stack((logits, np.ones_like(logits)))
        parameters = np.array([1.0, 0.0], dtype=np.float64)
        ridge = 1e-8

        def objective(candidate):
            linear = design @ candidate
            return float(
                np.sum(np.logaddexp(0.0, linear) - labels * linear)
                + 0.5 * ridge * candidate[0] ** 2
            )

        current_loss = objective(parameters)
        for _ in range(self.max_iterations):
            linear = design @ parameters
            probabilities = 1.0 / (1.0 + np.exp(-np.clip(linear, -40.0, 40.0)))
            gradient = design.T @ (probabilities - labels)
            gradient[0] += ridge * parameters[0]
            weights = probabilities * (1.0 - probabilities)
            hessian = (design.T * weights) @ design
            hessian[0, 0] += ridge
            hessian += np.eye(2) * 1e-12

            try:
                step = np.linalg.solve(hessian, gradient)
            except np.linalg.LinAlgError as exc:
                raise ValueError("Could not fit sigmoid calibration parameters.") from exc

            if np.linalg.norm(step, ord=np.inf) < 1e-8:
                break

            scale = 1.0
            while scale >= 1e-8:
                candidate = parameters - scale * step
                candidate_loss = objective(candidate)
                if candidate_loss < current_loss:
                    parameters = candidate
                    current_loss = candidate_loss
                    break
                scale *= 0.5
            else:
                break

        self.a = float(parameters[0])
        self.b = float(parameters[1])

    def calibrate(self, score: Union[float, np.ndarray]) -> Union[float, np.ndarray]:
        """Map model probabilities to calibrated probabilities in [0, 1]."""
        values = np.asarray(score, dtype=np.float64)
        if not np.isfinite(values).all() or ((values < 0.0) | (values > 1.0)).any():
            raise ValueError("Scores to calibrate must be finite probabilities in [0, 1].")
        eps = 1e-7
        clipped = np.clip(values, eps, 1.0 - eps)
        logits = np.log(clipped) - np.log1p(-clipped)
        z = np.clip(self.a * logits + self.b, -40.0, 40.0)
        probability = 1.0 / (1.0 + np.exp(-z))
        return float(probability) if values.ndim == 0 else probability
