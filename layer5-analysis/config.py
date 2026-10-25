# layer5-analysis/config.py

from pathlib import Path

# Paths
BASE_DIR = Path(__file__).parent
RAW_DIR = BASE_DIR / 'data' / 'raw'
ANON_DIR = BASE_DIR / 'data' / 'anonymized'
PUBLIC_DIR = BASE_DIR / 'data' / 'public'
MODEL_DIR = BASE_DIR / 'models'
NOTEBOOK_DIR = BASE_DIR / 'notebooks'

# Ensure directories exist
for d in [RAW_DIR, ANON_DIR, PUBLIC_DIR, MODEL_DIR, NOTEBOOK_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# Reproducibility
RANDOM_SEED = 42

# IRT
IRT_MODEL = '2PL'  # '1PL' (Rasch) or '2PL'
IRT_ITERATIONS = 100

# Evaluation
CV_FOLDS = 5  # Cross-validation folds (small dataset)
TEST_FRACTION = 0.2  # Student-level split

# Elo
ELO_INITIAL = 1500
ELO_K_FACTOR = 32
ELO_QUESTION_INITIAL = 1500

# Anonymization
TIMING_ROUND_MS = 500  # Round response times to nearest 500ms
MIN_GROUP_SIZE = 5  # Suppress groups smaller than this
