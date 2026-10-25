# variant-pipeline/run_pipeline.py
"""
SmartLink Git Quiz — Full Variant Generation & Execution Validation Pipeline.
One-command orchestrator that:
1. Samples parameters deterministically for all templates
2. Renders variants and verifies structural equality via quality gates
3. Validates each variant in the Git sandbox (correct=TRUE, distractors=FALSE)
4. Executes cross-variant leak tests
5. Computes canonical SHA-256 bank hash
6. Generates markdown and JSON validation reports in reports/
7. Exports bank to SQL and Supabase
"""

import sys
import time
from pathlib import Path

BASE_DIR = Path(__file__).parent
sys.path.insert(0, str(BASE_DIR))

import config
from instantiate.sampler import load_template, sample_variants
from instantiate.renderer import render_variant, variant_stats
from validate.variant_checker import validate_variant
from validate.cross_variant import cross_variant_leak_test
from validate.quality_gates import check_quality_gates
from validate.report import generate_summary_report
from freeze.bank_hash import compute_bank_hash
from export.supabase_import import export_bank_to_sql_and_payload, sync_to_supabase


def run_full_pipeline(templates_dir: Path = None, reports_dir: Path = None, seed: int = None) -> bool:
    start_time = time.time()
    templates_dir = templates_dir or config.TEMPLATES_DIR
    reports_dir = reports_dir or config.REPORTS_DIR
    seed = seed or config.SEED

    print("=" * 70)
    print("🚀 SMARTLINK GIT QUIZ — QUESTION VARIANT & VALIDATION PIPELINE")
    print(f"   Deterministic Seed: {seed}")
    print(f"   Git Version Engine: {config.get_git_version()}")
    print("=" * 70)

    template_files = sorted(templates_dir.glob('q*.yaml'))
    if not template_files:
        print(f"❌ No question templates found in {templates_dir}")
        return False

    print(f"\n📂 Discovered {len(template_files)} question templates in {templates_dir.name}/")

    all_reports = {}
    total_variants_count = 0
    total_verified_count = 0
    all_quality_passed = True
    any_leaks_found = False

    for tpath in template_files:
        template = load_template(tpath)
        tid = template['id']
        print(f"\n▶️ Processing Template [{tid}] ({template['topic']} - {template['difficulty']})")

        # 1. Deterministic Sampling
        sampled_params = sample_variants(template, seed=seed)
        n_vars = len(sampled_params)
        total_variants_count += n_vars
        print(f"   • Sampled {n_vars} variants")

        # 2. Rendering & Quality Gate Stats
        rendered_variants = []
        stats_list = []
        for params in sampled_params:
            var = render_variant(template, params)
            rendered_variants.append(var)
            stats_list.append(variant_stats(var))

        q_gates = check_quality_gates(tid, stats_list)
        q_passed = all(g['passed'] for g in q_gates)
        if not q_passed:
            all_quality_passed = False
            failed_gates = [g['gate'] for g in q_gates if not g['passed']]
            print(f"   ⚠️ Quality Gates Warning: {failed_gates}")
        else:
            print("   ✅ Quality Gates: Structural parity verified across siblings")

        # 3. Cross-Variant Leak Test
        leak_results = cross_variant_leak_test(template, rendered_variants)
        has_leaks = any(l.get('leaks', False) for l in leak_results)
        if has_leaks:
            any_leaks_found = True
            print("   ❌ Sibling Leak Test: Leaks detected across variants!")
        else:
            print("   ✅ Sibling Leak Test: Zero cross-variant answer leakage")

        # 4. Per-Variant Execution Validation in Sandbox
        sibling_answers = [v['correct'] for v in rendered_variants]
        variant_reports = []

        for v_idx, params in enumerate(sampled_params):
            v_rep = validate_variant(template, params, sibling_correct_answers=sibling_answers)
            variant_reports.append(v_rep.to_dict())

            if v_rep.status == 'verified':
                total_verified_count += 1
                print(f"     [Var {v_idx+1}] Verified ✅ (Correct proven, distractors rejected in {v_rep.duration_seconds:.2f}s)")
            else:
                print(f"     [Var {v_idx+1}] FAILED ❌ (Status: {v_rep.status})")
                for err in v_rep.errors:
                    print(f"        • {err}")

        all_reports[tid] = {
            'variants': variant_reports,
            'quality': q_gates,
            'leaks': leak_results
        }

    # 5. Report Generation
    print("\n" + "-" * 70)
    print("📊 Generating Validation Reports...")
    generate_summary_report(all_reports, reports_dir)
    print(f"   • Markdown Report: {reports_dir / 'validation_report.md'}")
    print(f"   • JSON Summary:    {reports_dir / 'summary.json'}")

    # 6. Bank Freeze Hash
    print("\n🔒 Computing Canonical Bank Freeze Hash...")
    bank_hash_res = compute_bank_hash(templates_dir)
    bank_hash = bank_hash_res['hash']
    print(f"   • Bank SHA-256: {bank_hash}")

    # 7. Export Bank to SQL & Supabase
    print("\n💾 Exporting Bank...")
    payload = export_bank_to_sql_and_payload(templates_dir, reports_dir)
    sync_to_supabase(payload)

    duration = time.time() - start_time
    print("\n" + "=" * 70)
    print("🏁 PIPELINE EXECUTION SUMMARY")
    print(f"   Total Duration:       {duration:.2f}s")
    print(f"   Templates Tested:     {len(template_files)}")
    print(f"   Variants Generated:   {total_variants_count}")
    print(f"   Variants Verified:    {total_verified_count} / {total_variants_count}")
    print(f"   Quality Gates Status: {'PASSED ✅' if all_quality_passed else 'FAILED ❌'}")
    print(f"   Cross-Variant Leaks:  {'CLEAN (0) ✅' if not any_leaks_found else 'LEAKS DETECTED ❌'}")
    print(f"   Bank Frozen Hash:     {bank_hash}")
    print("=" * 70)

    success = (total_verified_count == total_variants_count) and all_quality_passed and not any_leaks_found
    return success


if __name__ == '__main__':
    ok = run_full_pipeline()
    sys.exit(0 if ok else 1)
