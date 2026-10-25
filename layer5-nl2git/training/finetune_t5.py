"""
Fine-tune t5-small on NL→Git task.
Designed to run on Google Colab (T4 GPU) or Kaggle (P100/T4).

Colab setup:
  !pip install transformers datasets torch accelerate sentencepiece protobuf

Usage:
  python finetune_t5.py \
      --train_data ../data/validated.jsonl \
      --test_data ../data/handwritten_test.jsonl \
      --model_name t5-small \
      --epochs 5 \
      --batch_size 16 \
      --lr 5e-5 \
      --output_dir ./nl2git-t5-small
"""
import argparse
import json
import os
import sys
from pathlib import Path
import torch
from torch.utils.data import DataLoader, random_split

# Add current dir to path
sys.path.insert(0, str(Path(__file__).parent))
from dataset import NL2GitDataset, INPUT_PREFIX, SEP_TOKEN

def parse_output(text: str) -> dict:
    """Parse model output into command, risk, explanation."""
    parts = text.split("[SEP]")
    return {
        "command": parts[0].strip() if len(parts) > 0 else "",
        "risk_level": parts[1].strip() if len(parts) > 1 else "UNKNOWN",
        "explanation": parts[2].strip() if len(parts) > 2 else "",
    }

def evaluate_model(model, tokenizer, dataloader, device):
    """Run evaluation and compute exact-match and risk accuracy."""
    model.eval()
    exact_match = 0
    risk_match = 0
    total = 0
    predictions = []

    with torch.no_grad():
        for batch in dataloader:
            input_ids = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            labels = batch["labels"].to(device)

            outputs = model.generate(
                input_ids=input_ids,
                attention_mask=attention_mask,
                max_length=256,
                num_beams=4,
                early_stopping=True,
            )

            for pred_ids, label_ids in zip(outputs, labels):
                pred_text = tokenizer.decode(pred_ids, skip_special_tokens=True)
                # Recover label text (replace -100 with pad for decoding)
                label_clean = label_ids.clone()
                label_clean[label_clean == -100] = tokenizer.pad_token_id
                label_text = tokenizer.decode(label_clean, skip_special_tokens=True)

                pred_parsed = parse_output(pred_text)
                label_parsed = parse_output(label_text)

                if pred_parsed["command"] == label_parsed["command"]:
                    exact_match += 1
                if pred_parsed["risk_level"] == label_parsed["risk_level"]:
                    risk_match += 1
                total += 1

                predictions.append({
                    "predicted": pred_parsed,
                    "expected": label_parsed,
                })

    model.train()
    return {
        "exact_match": exact_match / max(total, 1),
        "risk_accuracy": risk_match / max(total, 1),
        "total": total,
        "predictions": predictions,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--train_data", default=str(Path(__file__).parent.parent / "data" / "validated.jsonl"))
    parser.add_argument("--test_data", default=str(Path(__file__).parent.parent / "data" / "handwritten_test.jsonl"))
    parser.add_argument("--model_name", default="t5-small")
    parser.add_argument("--epochs", type=int, default=5)
    parser.add_argument("--batch_size", type=int, default=16)
    parser.add_argument("--lr", type=float, default=5e-5)
    parser.add_argument("--output_dir", default="./nl2git-t5-small")
    parser.add_argument("--val_split", type=float, default=0.1)
    args = parser.parse_args()

    try:
        from transformers import (
            T5ForConditionalGeneration,
            T5Tokenizer,
            get_linear_schedule_with_warmup,
        )
    except ImportError:
        print("Please install transformers and sentencepiece: pip install transformers sentencepiece")
        return

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    # Load tokenizer and model
    print(f"Loading {args.model_name}...")
    tokenizer = T5Tokenizer.from_pretrained(args.model_name, legacy=False)
    model = T5ForConditionalGeneration.from_pretrained(args.model_name).to(device)

    # Load datasets
    full_dataset = NL2GitDataset(args.train_data, tokenizer)
    val_size = int(len(full_dataset) * args.val_split)
    train_size = len(full_dataset) - val_size
    train_dataset, val_dataset = random_split(full_dataset, [train_size, val_size], generator=torch.Generator().manual_seed(42))

    test_dataset = NL2GitDataset(args.test_data, tokenizer)

    train_loader = DataLoader(train_dataset, batch_size=args.batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=args.batch_size)
    test_loader = DataLoader(test_dataset, batch_size=args.batch_size)

    print(f"Dataset: {train_size} train, {val_size} val, {len(test_dataset)} test")

    # Optimizer and scheduler
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr)
    total_steps = len(train_loader) * args.epochs
    scheduler = get_linear_schedule_with_warmup(
        optimizer, num_warmup_steps=int(0.1 * total_steps), num_training_steps=total_steps
    )

    # Training loop
    best_val_em = 0.0
    for epoch in range(args.epochs):
        model.train()
        total_loss = 0
        for step, batch in enumerate(train_loader):
            input_ids = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            labels = batch["labels"].to(device)

            outputs = model(
                input_ids=input_ids,
                attention_mask=attention_mask,
                labels=labels,
            )
            loss = outputs.loss
            loss.backward()

            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            scheduler.step()
            optimizer.zero_grad()
            total_loss += loss.item()

        avg_loss = total_loss / len(train_loader)
        val_metrics = evaluate_model(model, tokenizer, val_loader, device)
        print(
            f"Epoch {epoch+1}/{args.epochs} | "
            f"Loss: {avg_loss:.4f} | "
            f"Val EM: {val_metrics['exact_match']:.3f} | "
            f"Val Risk: {val_metrics['risk_accuracy']:.3f}"
        )

        if val_metrics["exact_match"] >= best_val_em:
            best_val_em = val_metrics["exact_match"]
            os.makedirs(args.output_dir, exist_ok=True)
            model.save_pretrained(args.output_dir)
            tokenizer.save_pretrained(args.output_dir)
            print(f"  → Saved best model to {args.output_dir} (EM={best_val_em:.3f})")

    # Final evaluation on handwritten test set
    print("\n=== Hand-Written Test Set Evaluation ===")
    test_metrics = evaluate_model(model, tokenizer, test_loader, device)
    print(f"  Exact Match:    {test_metrics['exact_match']:.3f}")
    print(f"  Risk Accuracy:  {test_metrics['risk_accuracy']:.3f}")
    print(f"  Total examples: {test_metrics['total']}")

    with open(os.path.join(args.output_dir, "test_predictions.json"), "w") as f:
        json.dump(test_metrics["predictions"], f, indent=2)

    print(f"\nModel and predictions saved to {args.output_dir}")


if __name__ == "__main__":
    main()
