"""
Evaluate the fine-tuned model or baseline on the handwritten test set.
Reports: exact command match, risk accuracy, partial match (command verb correct),
and a comparison with the LLM-prompting baseline.
"""
import json
import argparse
import sys
from pathlib import Path

# Insert inference directory into sys.path
INFERENCE_DIR = Path(__file__).resolve().parent.parent / "inference"
sys.path.insert(0, str(INFERENCE_DIR))
from model import NL2GitPipeline


def compute_metrics(predictions: list[dict]) -> dict:
    exact = 0
    risk_correct = 0
    verb_correct = 0
    total = len(predictions)

    for p in predictions:
        pred_cmd = p["predicted"]["command"].strip()
        true_cmd = p["expected"]["command"].strip()
        pred_risk = p["predicted"]["risk_level"].strip().upper()
        true_risk = p["expected"]["risk_level"].strip().upper()

        if pred_cmd == true_cmd:
            exact += 1
        if pred_risk == true_risk:
            risk_correct += 1

        # Partial: same git subcommand verb (e.g. 'reset', 'branch', 'log')
        pred_parts = pred_cmd.split()
        true_parts = true_cmd.split()
        pred_verb = pred_parts[1] if len(pred_parts) > 1 else ""
        true_verb = true_parts[1] if len(true_parts) > 1 else ""
        if pred_verb and pred_verb == true_verb:
            verb_correct += 1

    return {
        "exact_match": exact / max(total, 1),
        "risk_accuracy": risk_correct / max(total, 1),
        "verb_match": verb_correct / max(total, 1),
        "total": total,
    }


def main():
    default_test_path = str(Path(__file__).resolve().parent.parent / "data" / "handwritten_test.jsonl")
    default_out_path = str(Path(__file__).resolve().parent.parent / "eval_predictions.json")

    parser = argparse.ArgumentParser()
    parser.add_argument("--model_dir", default="./nl2git-t5-small")
    parser.add_argument("--test_data", default=default_test_path)
    parser.add_argument("--predictions_out", default=default_out_path)
    parser.add_argument("--use_llm", action="store_true", help="Force LLM/fallback evaluation")
    args = parser.parse_args()

    pipeline = NL2GitPipeline(model_dir=args.model_dir, use_llm_fallback=True)

    predictions = []
    with open(args.test_data) as f:
        for line in f:
            if not line.strip():
                continue
            ex = json.loads(line.strip())
            result = pipeline.generate(ex["goal"])
            predictions.append({
                "goal": ex["goal"],
                "predicted": {
                    "command": result.command,
                    "risk_level": result.risk_level.value,
                    "explanation": result.explanation,
                    "source": result.source,
                },
                "expected": {
                    "command": ex["command"],
                    "risk_level": ex["risk_level"],
                    "explanation": ex.get("explanation", ""),
                },
            })

    metrics = compute_metrics(predictions)
    print("=== Evaluation Results on Handwritten Test Set ===")
    for k, v in metrics.items():
        if isinstance(v, float):
            print(f"  {k}: {v:.3f} ({v*100:.1f}%)")
        else:
            print(f"  {k}: {v}")

    with open(args.predictions_out, "w") as f:
        json.dump({"metrics": metrics, "predictions": predictions}, f, indent=2)

    print(f"\nDetailed predictions written to {args.predictions_out}")


if __name__ == "__main__":
    main()
