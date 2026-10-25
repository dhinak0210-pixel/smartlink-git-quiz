# layer5-cheat/pipeline/precompute.py
"""
Pre-event simulation orchestrator:
Pre-computes honest-class distributions and calibrates thresholds prior to event day.
"""

from pathlib import Path
import sys

BASE_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BASE_DIR))

import config
from sim.honest_simulator import main as run_honest_sim


def precompute_thresholds(runs: int = None):
    runs = runs or config.SIM_HONEST_RUNS_FAST
    print(f"Precomputing thresholds with {runs} honest class simulations...")
    sys.argv = ['honest_simulator.py', '--runs', str(runs), '--output', 'thresholds.json']
    run_honest_sim()


if __name__ == '__main__':
    precompute_thresholds()
