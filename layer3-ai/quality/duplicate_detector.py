# layer3-ai/quality/duplicate_detector.py
# Uses local MiniLM embeddings (or resilient fallback) to detect semantically similar questions.
# Runs entirely on CPU — zero API calls.

import logging
import math
import re
from typing import List
from collections import Counter

import numpy as np

logger = logging.getLogger(__name__)


class DuplicateDetector:
    def __init__(self, threshold: float = 0.85):
        self.threshold = threshold
        self.model = None
        self.use_fallback = False

    def _load_model(self):
        """Lazy-load the MiniLM embedding model."""
        if self.model is None and not self.use_fallback:
            try:
                logger.info("  Loading MiniLM embedding model (first run may take a minute)...")
                from sentence_transformers import SentenceTransformer
                self.model = SentenceTransformer("all-MiniLM-L6-v2")
                logger.info("  ✅ MiniLM embedding model loaded successfully.")
            except Exception as e:
                logger.warning(f"  SentenceTransformer not available ({e}). Using n-gram TF-IDF cosine similarity fallback.")
                self.use_fallback = True

    def _fallback_similarity(self, text1: str, text2: str) -> float:
        """Token & n-gram TF-IDF cosine similarity fallback."""
        def tokenize(text: str) -> list[str]:
            tokens = re.findall(r"\w+", text.lower())
            # Add bigrams for context
            bigrams = [f"{tokens[i]}_{tokens[i+1]}" for i in range(len(tokens) - 1)]
            return tokens + bigrams

        tokens1 = tokenize(text1)
        tokens2 = tokenize(text2)

        c1 = Counter(tokens1)
        c2 = Counter(tokens2)

        all_keys = set(c1.keys()).union(set(c2.keys()))
        if not all_keys:
            return 0.0

        dot_product = sum(c1.get(k, 0) * c2.get(k, 0) for k in all_keys)
        mag1 = math.sqrt(sum(v ** 2 for v in c1.values()))
        mag2 = math.sqrt(sum(v ** 2 for v in c2.values()))

        if mag1 == 0 or mag2 == 0:
            return 0.0

        return dot_product / (mag1 * mag2)

    def find_duplicates(self, questions: list[dict]) -> list[dict]:
        """Find pairs of questions with cosine similarity above the threshold."""
        if len(questions) < 2:
            return []

        self._load_model()
        duplicates = []

        if not self.use_fallback and self.model is not None:
            # Encode all question texts with MiniLM
            texts = [q["question_text"] for q in questions]
            embeddings = self.model.encode(texts, show_progress_bar=False)

            # Compute pairwise cosine similarity
            for i in range(len(questions)):
                for j in range(i + 1, len(questions)):
                    norm_i = np.linalg.norm(embeddings[i])
                    norm_j = np.linalg.norm(embeddings[j])
                    if norm_i == 0 or norm_j == 0:
                        continue
                    sim = float(np.dot(embeddings[i], embeddings[j]) / (norm_i * norm_j))
                    if sim >= self.threshold:
                        duplicates.append({
                            "q1_index": i,
                            "q2_index": j,
                            "q1_text": questions[i]["question_text"],
                            "q2_text": questions[j]["question_text"],
                            "similarity": round(sim, 3),
                        })
        else:
            # Fallback calculation
            for i in range(len(questions)):
                for j in range(i + 1, len(questions)):
                    sim = self._fallback_similarity(
                        questions[i]["question_text"],
                        questions[j]["question_text"]
                    )
                    if sim >= self.threshold:
                        duplicates.append({
                            "q1_index": i,
                            "q2_index": j,
                            "q1_text": questions[i]["question_text"],
                            "q2_text": questions[j]["question_text"],
                            "similarity": round(sim, 3),
                        })

        duplicates.sort(key=lambda d: d["similarity"], reverse=True)
        logger.info(f"  Found {len(duplicates)} duplicate pairs (threshold: {self.threshold})")
        return duplicates
