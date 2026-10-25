"""
PyTorch Dataset for fine-tuning t5-small on NL→Git.
Input format:  "translate goal to git: <natural language goal>"
Output format: "<command> [SEP] <risk_level> [SEP] <explanation>"
"""
import json
import torch
from torch.utils.data import Dataset

INPUT_PREFIX = "translate goal to git: "
SEP_TOKEN = " [SEP] "

class NL2GitDataset(Dataset):
    def __init__(self, jsonl_path: str, tokenizer, max_input_len: int = 128, max_output_len: int = 256):
        self.tokenizer = tokenizer
        self.max_input_len = max_input_len
        self.max_output_len = max_output_len
        self.examples = []

        with open(jsonl_path, "r", encoding="utf-8") as f:
            for line in f:
                line_str = line.strip()
                if not line_str:
                    continue
                ex = json.loads(line_str)
                self.examples.append(ex)

    def __len__(self):
        return len(self.examples)

    def __getitem__(self, idx):
        ex = self.examples[idx]
        input_text = INPUT_PREFIX + ex["goal"]
        output_text = SEP_TOKEN.join([
            ex["command"],
            ex["risk_level"],
            ex.get("explanation", ""),
        ])

        input_enc = self.tokenizer(
            input_text,
            max_length=self.max_input_len,
            padding="max_length",
            truncation=True,
            return_tensors="pt",
        )
        output_enc = self.tokenizer(
            output_text,
            max_length=self.max_output_len,
            padding="max_length",
            truncation=True,
            return_tensors="pt",
        )

        labels = output_enc.input_ids.squeeze()
        labels[labels == self.tokenizer.pad_token_id] = -100

        return {
            "input_ids": input_enc.input_ids.squeeze(),
            "attention_mask": input_enc.attention_mask.squeeze(),
            "labels": labels,
        }
