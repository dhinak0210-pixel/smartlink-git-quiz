# layer5-analysis/scripts/generate_notebooks.py
"""
Generates the 6 production Jupyter Notebooks for Layer 5.
"""

import json
from pathlib import Path

NOTEBOOK_DIR = Path(__file__).parent.parent / 'notebooks'
NOTEBOOK_DIR.mkdir(parents=True, exist_ok=True)

def make_notebook(cells: list) -> dict:
    return {
        "cells": cells,
        "metadata": {
            "language_info": {"name": "python", "version": "3.11"},
            "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"}
        },
        "nbformat": 4,
        "nbformat_minor": 5
    }

def md_cell(source: str) -> dict:
    return {"cell_type": "markdown", "metadata": {}, "source": [source]}

def code_cell(source: str) -> dict:
    return {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [source]
    }

# 1. 01_eda.ipynb
nb_01 = make_notebook([
    md_cell("# SmartLink Git Quiz — Exploratory Data Analysis\n\nAnalyzes student score distributions, response time dynamics, and question completion rates."),
    code_cell("""import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path

data_dir = Path('../data/anonymized')
answers = pd.read_csv(data_dir / 'answers.csv')
questions = pd.read_csv(data_dir / 'questions.csv')

print(f"Total Answers: {len(answers)}")
print(f"Unique Students: {answers['anon_student_id'].nunique()}")
print(f"Unique Questions: {answers['question_id'].nunique()}")
answers.head()"""),
    code_cell("""# Score Distribution
scores = answers.groupby('anon_student_id')['points'].sum()
plt.figure(figsize=(10, 5))
sns.histplot(scores, kde=True, bins=15, color='#4F46E5')
plt.title('Final Points Distribution Across Students')
plt.xlabel('Total Points')
plt.ylabel('Student Count')
plt.grid(True, alpha=0.3)
plt.show()

print(f"Mean Score: {scores.mean():.1f} | Median: {scores.median():.1f} | Std: {scores.std():.1f}")"""),
    code_cell("""# Response Time Distribution
times = answers['response_ms_rounded'] / 1000.0
plt.figure(figsize=(10, 5))
sns.histplot(times, bins=20, color='#059669', kde=True)
plt.title('Response Time Distribution (Seconds)')
plt.xlabel('Time (s)')
plt.ylabel('Count')
plt.grid(True, alpha=0.3)
plt.show()"""),
    code_cell("""# Accuracy by Question Position
pos_acc = answers.groupby('position')['is_correct'].mean()
plt.figure(figsize=(10, 4))
plt.plot(pos_acc.index, pos_acc.values, marker='o', color='#D97706', linewidth=2.5)
plt.title('Accuracy Progression Across Quiz Positions (1 = Easy, 15 = Hard)')
plt.xlabel('Question Sequence Number')
plt.ylabel('Mean Accuracy')
plt.ylim(0, 1)
plt.grid(True, alpha=0.3)
plt.show()""")
])

# 2. 02_question_stats.ipynb
nb_02 = make_notebook([
    md_cell("# SmartLink Git Quiz — Classical Item Analysis\n\nExamines item difficulty (p-value), point-biserial discrimination, distractor efficiency, and psychometric flaws."),
    code_cell("""import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path

public_dir = Path('../data/public')
q_stats = pd.read_csv(public_dir / 'question_statistics.csv')
q_stats.head()"""),
    code_cell("""# Difficulty vs Discrimination Plot
plt.figure(figsize=(9, 6))
sns.scatterplot(
    data=q_stats,
    x='p_value',
    y='discrimination',
    hue='difficulty',
    style='is_flawed',
    s=90,
    palette={'easy': '#10B981', 'medium': '#F59E0B', 'hard': '#EF4444'}
)
plt.axhline(0.2, color='red', linestyle='--', label='Discrimination Floor (0.2)')
plt.title('Item Difficulty vs Discrimination Index')
plt.xlabel('Item Difficulty (p-value, fraction correct)')
plt.ylabel('Point-Biserial Discrimination')
plt.grid(True, alpha=0.3)
plt.legend()
plt.show()"""),
    code_cell("""# Distractor Analysis Inspection
dist_path = public_dir / 'distractor_analysis.csv'
if dist_path.exists():
    dist = pd.read_csv(dist_path)
    print(f"Total Distractor records: {len(dist)}")
    print(dist.head(10))""")
])

# 3. 03_irt.ipynb
nb_03 = make_notebook([
    md_cell("# SmartLink Git Quiz — Item Response Theory (IRT)\n\nEvaluates 1PL/2PL Item Characteristic Curves and verifies calibrated difficulty against hand-assigned labels."),
    code_cell("""import json
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path

models_dir = Path('../models')
with open(models_dir / 'irt_params.json') as f:
    irt_data = json.load(f)

print(f"IRT Model: {irt_data['model']}")
print(f"Calibrated Items: {len(irt_data['item_params'])}")"""),
    code_cell("""# Item Characteristic Curves (ICC)
theta = np.linspace(-3, 3, 100)
plt.figure(figsize=(10, 6))

for i, p in enumerate(irt_data['item_params'][:10]):
    b = p.get('difficulty', 0)
    a = p.get('discrimination', 1)
    prob = 1 / (1 + np.exp(-a * (theta - b)))
    plt.plot(theta, prob, label=f"Item {i+1} (b={b:.2f})")

plt.title('Sample Item Characteristic Curves (ICCs)')
plt.xlabel('Student Latent Ability (θ)')
plt.ylabel('Probability of Correct Response P(θ)')
plt.grid(True, alpha=0.3)
plt.legend(bbox_to_anchor=(1.05, 1), loc='upper left')
plt.tight_layout()
plt.show()"""),
    code_cell("""# IRT vs Labels
comp_path = Path('../data/public/irt_vs_labels.csv')
if comp_path.exists():
    comp = pd.read_csv(comp_path)
    plt.figure(figsize=(8, 5))
    sns.boxplot(data=comp, x='label', y='irt_difficulty', order=['easy', 'medium', 'hard'], palette='Blues')
    plt.title('Calibrated IRT Difficulty by Hand-Assigned Category')
    plt.ylabel('IRT Difficulty parameter (b)')
    plt.grid(True, alpha=0.3)
    plt.show()""")
])

# 4. 04_skill_prediction.ipynb
nb_04 = make_notebook([
    md_cell("# SmartLink Git Quiz — Skill Prediction from Early Responses\n\nPredicts student final exam score from their first 5 answers using Student-Level Cross Validation."),
    code_cell("""import json
import pandas as pd
import matplotlib.pyplot as plt
from pathlib import Path

res_path = Path('../data/public/skill_prediction_results.json')
with open(res_path) as f:
    results = json.load(f)

print("Skill Prediction Summary:")
for model, data in results['results'].items():
    print(f"  {model:<25}: MAE = {data['mae']:.2f} (95% CI: {data['ci']})")"""),
    code_cell("""# Comparison Chart
models = list(results['results'].keys())
maes = [results['results'][m]['mae'] for m in models]

plt.figure(figsize=(8, 4.5))
bars = plt.bar(models, maes, color=['#94A3B8', '#3B82F6', '#10B981'])
plt.title('Final Score Prediction Error (MAE, lower is better)')
plt.ylabel('Mean Absolute Error (Points)')
for bar in bars:
    yval = bar.get_height()
    plt.text(bar.get_x() + bar.get_width()/2.0, yval - 150, f"{yval:.1f}", ha='center', va='bottom', color='white', fontweight='bold')
plt.grid(True, alpha=0.3, axis='y')
plt.show()""")
])

# 5. 05_cheat_detection.ipynb
nb_05 = make_notebook([
    md_cell("# SmartLink Git Quiz — Anti-Cheat Method Comparison\n\nCompares heuristic rule-based flags (Layer 2) against Isolation Forest and DBSCAN unsupervised anomaly detectors."),
    code_cell("""import json
import pandas as pd
import matplotlib.pyplot as plt
from pathlib import Path

res_path = Path('../data/public/cheat_detection_comparison.json')
with open(res_path) as f:
    comp = json.load(f)

print(json.dumps(comp, indent=2))"""),
    code_cell("""# Detection Count Comparison
counts = {
    'Rule-Based Flags': comp['rule_flagged_count'],
    'Isolation Forest': comp['iso_forest_flagged_count'],
    'DBSCAN': comp['dbscan_flagged_count'],
    'Admin Penalized': comp['admin_penalized_count']
}

plt.figure(figsize=(9, 4.5))
plt.bar(counts.keys(), counts.values(), color=['#EF4444', '#F59E0B', '#8B5CF6', '#DC2626'])
plt.title('Outliers / Flags Identified by Method')
plt.ylabel('Student Count')
plt.grid(True, alpha=0.3, axis='y')
plt.show()""")
])

# 6. 06_elo_practice.ipynb
nb_06 = make_notebook([
    md_cell("# SmartLink Git Quiz — Adaptive Elo Rating System Design\n\nSimulates and evaluates question selection and rating updates for Version 2 Practice Mode."),
    code_cell("""import numpy as np
import matplotlib.pyplot as plt

def expected_score(r_player, r_item):
    return 1.0 / (1.0 + 10.0 ** ((r_item - r_player) / 400.0))

def update_elo(r_player, r_item, score, k=32):
    e_p = expected_score(r_player, r_item)
    r_player_new = r_player + k * (score - e_p)
    r_item_new = r_item + k * ((1 - score) - (1 - e_p))
    return r_player_new, r_item_new

# Probability curve
rating_diff = np.linspace(-500, 500, 100)
p_correct = 1.0 / (1.0 + 10.0 ** (-rating_diff / 400.0))

plt.figure(figsize=(8, 4.5))
plt.plot(rating_diff, p_correct, color='#2563EB', linewidth=2.5)
plt.title('Win/Correct Probability vs Rating Difference (Player - Question)')
plt.xlabel('Rating Difference (Player Elo - Question Elo)')
plt.ylabel('Expected Probability P(Win)')
plt.grid(True, alpha=0.3)
plt.show()"""),
    code_cell("""# Rating Convergence Simulation
np.random.seed(42)
true_ability = 1750
player_elo = 1500
item_elos = np.random.normal(1500, 200, 30)

elo_history = [player_elo]
for item_elo in item_elos:
    prob = expected_score(true_ability, item_elo)
    correct = 1 if np.random.rand() < prob else 0
    player_elo, _ = update_elo(player_elo, item_elo, correct)
    elo_history.append(player_elo)

plt.figure(figsize=(10, 5))
plt.plot(elo_history, marker='o', color='#059669', label='Estimated Elo')
plt.axhline(true_ability, color='red', linestyle='--', label=f'True Ability ({true_ability})')
plt.title('Adaptive Elo Rating Convergence Across 30 Drills')
plt.xlabel('Question Number')
plt.ylabel('Player Elo Rating')
plt.legend()
plt.grid(True, alpha=0.3)
plt.show()""")
])

with open(NOTEBOOK_DIR / '01_eda.ipynb', 'w') as f:
    json.dump(nb_01, f, indent=2)

with open(NOTEBOOK_DIR / '02_question_stats.ipynb', 'w') as f:
    json.dump(nb_02, f, indent=2)

with open(NOTEBOOK_DIR / '03_irt.ipynb', 'w') as f:
    json.dump(nb_03, f, indent=2)

with open(NOTEBOOK_DIR / '04_skill_prediction.ipynb', 'w') as f:
    json.dump(nb_04, f, indent=2)

with open(NOTEBOOK_DIR / '05_cheat_detection.ipynb', 'w') as f:
    json.dump(nb_05, f, indent=2)

with open(NOTEBOOK_DIR / '06_elo_practice.ipynb', 'w') as f:
    json.dump(nb_06, f, indent=2)

print("Generated all 6 Jupyter notebooks in layer5-analysis/notebooks/")
