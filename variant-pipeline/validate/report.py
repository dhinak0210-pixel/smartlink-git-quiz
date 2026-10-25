# variant-pipeline/validate/report.py
"""
Generate human-readable and machine-readable validation reports.
"""

import json
from pathlib import Path
from datetime import datetime, timezone

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
import config


def generate_summary_report(all_reports: dict, output_dir: Path = None) -> str:
    """
    Generate a summary report for all templates and variants.
    """
    output_dir = output_dir or config.REPORTS_DIR
    output_dir.mkdir(parents=True, exist_ok=True)

    lines = []
    lines.append("# SmartLink Git Quiz — Variant Validation Report\n")
    lines.append(f"Generated: {datetime.now(timezone.utc).isoformat()}\n")
    lines.append(f"Git Engine: {config.get_git_version()}\n")

    total_templates = len(all_reports)
    total_variants = sum(len(r.get('variants', [])) for r in all_reports.values())
    verified_variants = sum(
        sum(1 for v in r.get('variants', []) if v['status'] == 'verified')
        for r in all_reports.values()
    )

    lines.append("## Executive Summary\n")
    lines.append(f"- **Total Question Templates:** {total_templates}")
    lines.append(f"- **Total Variants Tested:** {total_variants}")
    lines.append(f"- **Verified Variants (100% Proven Keys):** {verified_variants} / {total_variants}")
    lines.append("")

    lines.append("## Template Breakdown\n")
    lines.append("| Template ID | Variants Verified | Quality Gates | Cross-Variant Leaks |")
    lines.append("|---|---|---|---|")

    json_summary = {
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'git_version': config.get_git_version(),
        'total_templates': total_templates,
        'total_variants': total_variants,
        'verified_variants': verified_variants,
        'templates': {}
    }

    for tid, r in all_reports.items():
        v_list = r.get('variants', [])
        verified_count = sum(1 for v in v_list if v['status'] == 'verified')
        q_gates = r.get('quality', [])
        q_passed = all(g.get('passed', False) for g in q_gates)
        leaks = r.get('leaks', [])
        leak_detected = any(l.get('leaks', False) for l in leaks)

        v_badge = f"{verified_count}/{len(v_list)} ✅" if verified_count == len(v_list) else f"{verified_count}/{len(v_list)} ⚠️"
        q_badge = "PASSED ✅" if q_passed else "FAILED ❌"
        l_badge = "CLEAN (0) ✅" if not leak_detected else "LEAK DETECTED ❌"

        lines.append(f"| `{tid}` | {v_badge} | {q_badge} | {l_badge} |")

        json_summary['templates'][tid] = {
            'variants_verified': verified_count,
            'total_variants': len(v_list),
            'quality_passed': q_passed,
            'has_leaks': leak_detected,
            'variant_details': [v for v in v_list]
        }

    lines.append("\n## Detailed Variant Inspection\n")
    for tid, r in all_reports.items():
        lines.append(f"### `{tid}`\n")
        for i, v in enumerate(r.get('variants', [])):
            lines.append(f"- **Variant {i+1}** ({v['params']}): Status = `{v['status']}`")
            if v.get('errors'):
                for err in v['errors']:
                    lines.append(f"  - ⚠️ Error: {err}")
        lines.append("")

    report_content = "\n".join(lines)

    # Save outputs
    md_file = output_dir / 'validation_report.md'
    with open(md_file, 'w', encoding='utf-8') as f:
        f.write(report_content)

    json_file = output_dir / 'summary.json'
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(json_summary, f, indent=2)

    return report_content
