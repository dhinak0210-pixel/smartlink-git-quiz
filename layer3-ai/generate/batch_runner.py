# layer3-ai/generate/batch_runner.py
# Rate-limited batch execution with resume-from-checkpoint capability.
# Run: python generate/batch_runner.py [--resume] [--mock]

import json
import logging
import argparse
import sys
from pathlib import Path
from datetime import datetime

# Add layer3-ai to path if run as script
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import (
    GENERATE_DIR, BLUEPRINT_DIR, TOTAL_CANDIDATES
)
from generate.generator import QuestionGenerator

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(GENERATE_DIR / "output" / "batch_runner.log"),
    ],
)
logger = logging.getLogger(__name__)

CHECKPOINT_PATH = GENERATE_DIR / "output" / "checkpoint.json"
CANDIDATES_RAW_PATH = GENERATE_DIR / "output" / "candidates_raw.json"


class BatchRunner:
    def __init__(self, use_mock: bool = False, resume: bool = False):
        self.generator = QuestionGenerator(use_mock=use_mock)
        self.resume = resume
        self.completed_tasks = set()
        self.accumulated_results = []

    def load_checkpoint(self) -> bool:
        """Load state from checkpoint file if it exists."""
        if not CHECKPOINT_PATH.exists():
            logger.info("ℹ️  No existing checkpoint found. Starting fresh.")
            return False

        try:
            with open(CHECKPOINT_PATH, "r") as f:
                data = json.load(f)
                self.completed_tasks = set(data.get("completed_task_keys", []))
                self.accumulated_results = data.get("results", [])
                logger.info(
                    f"🔄 Resumed from checkpoint: {len(self.completed_tasks)} tasks completed, "
                    f"{len(self.accumulated_results)} questions accumulated."
                )
                return True
        except Exception as e:
            logger.warning(f"Failed to read checkpoint: {e}. Starting fresh.")
            return False

    def save_checkpoint(self, task_key: str, new_questions: list[dict]):
        """Persist state after each completed batch."""
        self.completed_tasks.add(task_key)
        self.accumulated_results.extend(new_questions)

        data = {
            "completed_task_keys": list(self.completed_tasks),
            "results": self.accumulated_results,
            "total_questions": len(self.accumulated_results),
            "last_updated": datetime.now().isoformat(),
        }

        # Write atomic checkpoint
        temp_path = CHECKPOINT_PATH.with_suffix(".tmp")
        with open(temp_path, "w") as f:
            json.dump(data, f, indent=2)
        temp_path.replace(CHECKPOINT_PATH)

        # Also keep raw candidates up to date
        with open(CANDIDATES_RAW_PATH, "w") as f:
            json.dump(self.accumulated_results, f, indent=2)

    def run(self):
        logger.info("🚀 Starting batch runner...")
        if self.resume:
            self.load_checkpoint()

        blueprint = self.generator.load_blueprint()
        plan = self.generator.build_generation_plan(blueprint)
        logger.info(f"📋 Generation plan contains {len(plan)} tasks")

        for idx, task in enumerate(plan):
            task_key = f"{task['topic']}::{task['difficulty']}"

            if task_key in self.completed_tasks:
                logger.info(f"⏩ Skipping completed task {idx + 1}/{len(plan)}: {task_key}")
                continue

            logger.info(f"▶️  Running task {idx + 1}/{len(plan)}: {task_key} (Count: {task['count']})")
            questions = self.generator.generate_batch(task)
            self.save_checkpoint(task_key, questions)
            logger.info(f"💾 Checkpoint saved for {task_key}. Total so far: {len(self.accumulated_results)}")

        logger.info(f"\n🎉 All tasks complete! Final candidates count: {len(self.accumulated_results)}")
        logger.info(f"   Saved to: {CANDIDATES_RAW_PATH}")
        return self.accumulated_results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Rate-limited batch generation runner with checkpointing")
    parser.add_argument("--resume", action="store_true", help="Resume from last checkpoint")
    parser.add_argument("--mock", action="store_true", help="Run with mock questions without calling external APIs")
    args = parser.parse_args()

    runner = BatchRunner(use_mock=args.mock, resume=args.resume)
    runner.run()
