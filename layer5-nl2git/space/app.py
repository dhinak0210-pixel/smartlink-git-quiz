"""
Hugging Face Space: NL→Git Command Translator
Free tier: 2 vCPU, 16 GB RAM, no GPU.
t5-small (~240 MB) runs on CPU with ~200-500ms latency.
"""
import os
import sys
from pathlib import Path

# Add paths for local repo and standalone Space deployments
current_dir = Path(__file__).resolve().parent
parent_inference = current_dir.parent / "inference"
if parent_inference.exists():
    sys.path.insert(0, str(parent_inference))
sys.path.insert(0, str(current_dir))

try:
    import gradio as gr
except ImportError:
    gr = None

from model import NL2GitPipeline
from postprocess import validate_output

# Load model once at startup
pipeline = NL2GitPipeline(
    model_dir=os.environ.get("MODEL_DIR", str(current_dir.parent / "nl2git-t5-small")),
    use_llm_fallback=True,
)

RISK_COLORS = {
    "SAFE": "#22c55e",
    "CAUTION": "#f59e0b",
    "DANGEROUS": "#ef4444",
    "CRITICAL": "#7f1d1d",
}

RISK_EMOJI = {
    "SAFE": "✅",
    "CAUTION": "⚠️",
    "DANGEROUS": "🔶",
    "CRITICAL": "🚨",
}


def translate(goal: str) -> tuple[str, str, str, str]:
    """Main inference function for Gradio."""
    if not goal or not goal.strip():
        return "", "", "", "Enter a goal to get started."

    result = pipeline.generate(goal.strip())
    result = validate_output(result)

    risk_label = f"{RISK_EMOJI.get(result.risk_level.value, '')} {result.risk_level.value}"
    command_display = f"```bash\n{result.command}\n```"
    explanation_display = f"**What it does:** {result.explanation}\n\n**Warning:** {result.warning}"
    meta = f"Engine: {result.source} | Reversible: {'Yes' if result.reversible else 'No'}"

    return command_display, risk_label, explanation_display, meta


def create_app():
    if gr is None:
        raise RuntimeError("Gradio is not installed. Run `pip install gradio`.")

    with gr.Blocks(
        title="NL → Git Command",
        theme=gr.themes.Soft(),
    ) as demo:
        gr.Markdown("""
        # 🔧 Natural Language → Git Command
        Describe what you want to do in plain English, and get the Git command with a safety assessment.

        **⚠️ Always review commands before running them, especially DANGEROUS or CRITICAL operations.**
        """)

        with gr.Row():
            with gr.Column(scale=2):
                goal_input = gr.Textbox(
                    label="What do you want to do?",
                    placeholder="e.g., undo my last commit but keep the changes",
                    lines=2,
                )
                translate_btn = gr.Button("Translate to Git", variant="primary")

            with gr.Column(scale=1):
                risk_output = gr.Textbox(label="Risk Level", interactive=False)

        command_output = gr.Markdown(label="Command")
        explanation_output = gr.Markdown(label="Details")
        meta_output = gr.Textbox(label="Meta", interactive=False)

        gr.Markdown("""
        ### Common Examples
        - `undo my last commit but keep the changes`
        - `create a new branch called hotfix and switch to it`
        - `show me who changed each line of main.py`
        - `force push my rebased branch to origin`
        - `delete all untracked files and folders`
        - `temporarily save my uncommitted changes`
        - `combine my last 3 commits into one`
        """)

        translate_btn.click(
            fn=translate,
            inputs=[goal_input],
            outputs=[command_output, risk_output, explanation_output, meta_output],
        )
        goal_input.submit(
            fn=translate,
            inputs=[goal_input],
            outputs=[command_output, risk_output, explanation_output, meta_output],
        )

    return demo


if __name__ == "__main__":
    if gr is not None:
        demo = create_app()
        demo.launch()
    else:
        print("Install gradio to launch web app.")
