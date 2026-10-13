"""
BrandGuard Backend Application Package
"""
from pathlib import Path
import sys

__version__ = "1.0.0"

# The ML model is a sibling package in this repository and Docker image.
project_root = str(Path(__file__).resolve().parents[2])
if project_root not in sys.path:
    sys.path.insert(0, project_root)
