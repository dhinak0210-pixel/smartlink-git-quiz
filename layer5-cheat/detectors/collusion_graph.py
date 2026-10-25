# layer5-cheat/detectors/collusion_graph.py
"""
Build a collusion graph from pair similarity results.
Detect communities of 3+ students with unusually high similarity.

Usage:
    python collusion_graph.py
"""

from pathlib import Path

import networkx as nx
import pandas as pd

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
import config


def build_collusion_graph(
    pair_df: pd.DataFrame,
    review_threshold: float,
) -> dict:
    """
    Build a graph where edges connect pairs above the review threshold.
    Detect communities (groups of 3+).

    Args:
        pair_df: Output from pair_similarity.py
        review_threshold: Weighted match score threshold for an edge

    Returns:
        {
            'graph': NetworkX Graph,
            'groups': list of sets of student IDs,
            'group_details': list of dicts with group info,
        }
    """
    G = nx.Graph()

    if len(pair_df) == 0:
        return {'graph': G, 'groups': [], 'group_details': []}

    flagged_pairs = pair_df[pair_df['weighted_match_score'] >= review_threshold]

    for _, row in flagged_pairs.iterrows():
        G.add_edge(
            row['student_a'],
            row['student_b'],
            weight=row['weighted_match_score'],
            incorrect_matches=row['incorrect_matches'],
            timing_sync=row['timing_sync_count'],
        )

    groups = []
    group_details = []

    for component in nx.connected_components(G):
        if len(component) >= config.GRAPH_MIN_GROUP_SIZE:
            groups.append(set(component))

            subgraph = G.subgraph(component)
            edges = list(subgraph.edges(data=True))

            group_details.append({
                'members': sorted(list(component)),
                'size': len(component),
                'n_edges': len(edges),
                'max_weight': max(d['weight'] for _, _, d in edges) if edges else 0.0,
                'avg_matches': sum(d['incorrect_matches'] for _, _, d in edges) / max(len(edges), 1),
            })

    if len(G.nodes) > 10:
        try:
            communities = nx.community.louvain_communities(G, seed=config.RANDOM_SEED)
            for comm in communities:
                comm_set = set(comm)
                if len(comm_set) >= config.GRAPH_MIN_GROUP_SIZE and comm_set not in groups:
                    groups.append(comm_set)
                    group_details.append({
                        'members': sorted(list(comm_set)),
                        'size': len(comm_set),
                        'method': 'louvain',
                    })
        except Exception:
            pass

    return {
        'graph': G,
        'groups': groups,
        'group_details': group_details,
    }
