# layer5-analysis/scripts/topic_clustering.py
"""
Phase B: Topic-level error clustering.

Clusters students based on their profile of topic accuracy to identify
distinct weakness archetypes (e.g., strong overall but weak on rebasing;
strong on basics but struggling with merge conflicts).

Provides faculty with actionable pedagogical insights.

Usage:
    python topic_clustering.py
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
import config


def build_student_topic_matrix(answers: pd.DataFrame, questions: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    """Build a student x topic accuracy matrix."""
    merged = answers.merge(
        questions[['id', 'topic']],
        left_on='question_id',
        right_on='id'
    )

    pivot = merged.pivot_table(
        index='anon_student_id',
        columns='topic',
        values='is_correct',
        aggfunc='mean'
    ).fillna(0.5)

    return pivot, list(pivot.columns)


def cluster_students(pivot: pd.DataFrame, k: int = 3) -> tuple[KMeans, np.ndarray, float]:
    """Fit KMeans on the topic accuracy matrix."""
    kmeans = KMeans(n_clusters=k, random_state=config.RANDOM_SEED, n_init=10)
    labels = kmeans.fit_predict(pivot.values)
    sil = float(silhouette_score(pivot.values, labels)) if len(np.unique(labels)) > 1 else 0.0
    return kmeans, labels, sil


def analyze_clusters(pivot: pd.DataFrame, labels: np.ndarray, topics: list[str]) -> list[dict]:
    """Analyze cluster profiles and assign actionable pedagogy archetypes."""
    profiles = []
    df = pivot.copy()
    df['cluster'] = labels

    global_means = pivot.mean()

    archetype_names = [
        "Rebase & Advanced Internals Gap",
        "Merge & Conflict Resolution Struggles",
        "Foundational Command Set Consolidation",
        "High-Fluency Git Practitioners"
    ]

    for c in sorted(df['cluster'].unique()):
        c_data = df[df['cluster'] == c]
        c_means = c_data[topics].mean()
        diff_from_global = (c_means - global_means).to_dict()

        # Find largest negative deficit relative to average
        weakest_topic = min(diff_from_global.items(), key=lambda x: x[1])
        strongest_topic = max(diff_from_global.items(), key=lambda x: x[1])

        name = archetype_names[c % len(archetype_names)]

        profiles.append({
            'cluster_id': int(c),
            'student_count': int(len(c_data)),
            'percentage_of_cohort': round(float(len(c_data) / len(df) * 100), 1),
            'archetype_name': name,
            'mean_overall_accuracy': round(float(c_means.mean()), 3),
            'weakest_topic': weakest_topic[0],
            'weakest_topic_deficit': round(float(weakest_topic[1]), 3),
            'strongest_topic': strongest_topic[0],
            'topic_accuracies': {t: round(float(c_means[t]), 3) for t in topics},
            'recommended_remediation': (
                f"Targeted workshop on {weakest_topic[0].replace('-', ' ')} exercises and visual interactive drills."
            )
        })

    return profiles


def main():
    print(f"{'=' * 60}")
    print(f"SmartLink Git Quiz — Topic Weakness Clustering")
    print(f"{'=' * 60}\n")

    answers = pd.read_csv(config.ANON_DIR / 'answers.csv')
    questions = pd.read_csv(config.ANON_DIR / 'questions.csv')

    print(f"Students: {answers['anon_student_id'].nunique()}")
    print("Constructing student x topic accuracy matrix...")
    pivot, topics = build_student_topic_matrix(answers, questions)
    print(f"  Matrix shape: {pivot.shape} across topics: {', '.join(topics)}\n")

    # Evaluate k=2 to 4
    best_k = 3
    best_sil = -1
    for k in [2, 3, 4]:
        _, _, s = cluster_students(pivot, k=k)
        print(f"  k={k}: Silhouette score = {s:.3f}")
        if s > best_sil:
            best_sil = s
            best_k = k

    print(f"\nSelecting k={best_k} for pedagogical cluster segmentation...")
    kmeans, labels, sil = cluster_students(pivot, k=best_k)

    cluster_profiles = analyze_clusters(pivot, labels, topics)

    print("\n" + "=" * 60)
    print("CLUSTER PROFILES & REMEDIATION RECOMMENDATIONS")
    print("=" * 60)
    for p in cluster_profiles:
        print(f"\nCohort Cluster #{p['cluster_id']}: {p['archetype_name']}")
        print(f"  Size: {p['student_count']} students ({p['percentage_of_cohort']}%)")
        print(f"  Overall Accuracy: {p['mean_overall_accuracy']:.1%}")
        print(f"  Primary Bottleneck: {p['weakest_topic']} ({p['weakest_topic_deficit']:+.1%} vs cohort mean)")
        print(f"  Remediation: {p['recommended_remediation']}")

    # Save output
    output_data = {
        'n_students': len(pivot),
        'n_topics': len(topics),
        'topics': topics,
        'k_clusters': best_k,
        'silhouette_score': round(sil, 4),
        'clusters': cluster_profiles
    }

    out_file = config.PUBLIC_DIR / 'topic_clusters.json'
    with open(out_file, 'w') as f:
        json.dump(output_data, f, indent=2)
    print(f"\n✅ Topic clusters saved to {out_file}")


if __name__ == '__main__':
    main()
