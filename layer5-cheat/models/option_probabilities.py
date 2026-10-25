# layer5-cheat/models/option_probabilities.py
"""
Estimate ability-conditioned option choice probabilities.

For each variant and ability band, estimate the probability that a student
picks each option. Uses a Dirichlet prior to avoid zeros.

This automatically handles shared misconceptions: if many students pick
a tempting wrong option, a match on it carries little weight.
"""

import numpy as np
import pandas as pd

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
import config


def estimate_option_probabilities(
    responses_df: pd.DataFrame,
    irt_abilities: dict,
    n_bands: int = None,
) -> dict:
    """
    Estimate P(option | ability_band, variant) for all options.

    Returns:
        {variant_id: {band_idx: {option_tag: probability}}}
    """
    n_bands = n_bands or config.PAIR_ABILITY_BANDS
    alpha = config.PAIR_DIRICHLET_ALPHA

    df = responses_df.copy()
    df['ability'] = df['student_anon'].map(irt_abilities).fillna(0)

    # Create ability bands (quantile-based)
    band_edges = np.quantile(df['ability'], np.linspace(0, 1, n_bands + 1))
    band_edges[0] = -np.inf
    band_edges[-1] = np.inf

    def assign_band(ability):
        for i in range(n_bands):
            if band_edges[i] <= ability < band_edges[i + 1]:
                return i
        return n_bands - 1

    df['ability_band'] = df['ability'].apply(assign_band)

    # Estimate probabilities per variant, per band, per option
    option_probs = {}

    for vid, vgroup in df.groupby('variant_id'):
        option_probs[vid] = {}
        all_options = vgroup['chosen_option_tag'].unique()

        for band in range(n_bands):
            band_data = vgroup[vgroup['ability_band'] == band]
            option_counts = band_data['chosen_option_tag'].value_counts()

            total = len(band_data)
            n_opts = max(len(all_options), 1)

            probs = {}
            for opt in all_options:
                count = option_counts.get(opt, 0)
                probs[opt] = (count + alpha) / (total + alpha * n_opts)

            option_probs[vid][band] = probs

    return option_probs
