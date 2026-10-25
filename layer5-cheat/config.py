# layer5-cheat/config.py

from pathlib import Path
import numpy as np

# --- Paths ---
BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / 'data'
MODELS_DIR = BASE_DIR / 'models'
DETECTORS_DIR = BASE_DIR / 'detectors'
SIM_DIR = BASE_DIR / 'sim'
COMBINE_DIR = BASE_DIR / 'combine'
REPORT_DIR = BASE_DIR / 'report'
PIPELINE_DIR = BASE_DIR / 'pipeline'
OUTPUT_DIR = REPORT_DIR / 'output'

for d in [DATA_DIR, MODELS_DIR, DETECTORS_DIR, SIM_DIR, COMBINE_DIR, REPORT_DIR, PIPELINE_DIR, OUTPUT_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# --- Reproducibility ---
RANDOM_SEED = 42
np.random.seed(RANDOM_SEED)

# --- Data Dimensions ---
N_STUDENTS = 200
N_QUESTIONS = 15
N_OPTIONS = 4
MIN_RESPONSES_FOR_PERSON_FIT = 8
MIN_RESPONSES_FOR_TIMING = 8

# --- Person-Fit (Detector A) ---
PERSON_FIT_N_SIM = 5000          # Simulations per student for p-value
PERSON_FIT_ABILITY_BANDS = 5     # Ability bands for option probability estimation
PERSON_FIT_HARD_THRESHOLD = 0.67 # Top third of items by difficulty
PERSON_FIT_EASY_THRESHOLD = 0.33 # Bottom third

# --- Response Time (Detector B) ---
RT_LOGNORMAL = True               # Use lognormal model
RT_FAST_RESIDUAL_CUTOFF = -2.5    # Standardized residual below this = "fast"
RT_SLOW_RESIDUAL_CUTOFF = 2.0     # Above this = "slow"
RT_MIN_MS = 500                   # Floor: anything below is suspicious
RT_NETWORK_FLOOR_MS = 200         # Estimated network round-trip floor

# --- Pair Similarity (Detector C) ---
PAIR_ABILITY_BANDS = 5            # Bands for ability-conditioned option probs
PAIR_DIRICHLET_ALPHA = 0.5        # Prior for option probability estimation
PAIR_TIMING_SYNC_THRESHOLD_MS = 1500  # "Within ~1 second" for timing synchrony
PAIR_MIN_SHARED_ITEMS = 5         # Minimum shared-variant items for pair analysis

# --- Collusion Graph ---
GRAPH_COMMUNITY_ALGORITHM = 'louvain'  # NetworkX community detection
GRAPH_MIN_GROUP_SIZE = 3               # Minimum students for a group flag

# --- Simulation Thresholds ---
SIM_HONEST_RUNS = 1000            # Full simulation runs (post-event)
SIM_HONEST_RUNS_FAST = 300        # Lean simulation for event day
SIM_CHEATER_SCENARIOS = {
    'copier_weak_source':   {'copy_fraction': [0.15, 0.30, 0.50, 0.70], 'source_ability': -1.0},
    'copier_medium_source': {'copy_fraction': [0.15, 0.30, 0.50, 0.70], 'source_ability': 0.0},
    'copier_strong_source': {'copy_fraction': [0.15, 0.30, 0.50, 0.70], 'source_ability': 1.0},
    'lookup_helper':        {'n_beyond_ability': [2, 4, 6], 'rt_multiplier': 1.8},
    'pre_knowledge':        {'n_fast_correct': [3, 5, 8]},
    'group_ring':           {'group_size': [3, 4], 'copy_fraction': 0.50},
}

# --- Tier Thresholds (from simulation) ---
# These are placeholders — real values come from honest_simulator.py
TIER_STRONG_PERCENTILE = 0.99     # 1% family-wise false alarm
TIER_REVIEW_PERCENTILE = 0.90     # 10% family-wise
TIER_STRONG_MIN_FAMILIES = 1      # Single detector exceeding 1% threshold
TIER_REVIEW_MULTI_FAMILIES = 2    # Two families exceeding 10% threshold

# --- Review Budget ---
REVIEW_BUDGET = 10                # Max students to review in 5 minutes
ALWAYS_REVIEW_TOP_N = 10          # Always review top N by score regardless of tier

# --- Trust Score Mapping (Layer 2) ---
TRUST_SCORE_STRONG = 30           # Below 40 = held
TRUST_SCORE_REVIEW = 55           # 40-69 = review
TRUST_SCORE_CLEAR = 85            # 70+ = clear

# --- Event Day Timing ---
EVENT_DAY_TARGET_MINUTES = 30
FAST_RASCH_MAX_SECONDS = 120

# --- Fairness Audit Groups ---
FAIRNESS_GROUPS = ['device_type', 'network_quality', 'section', 'accommodation']
