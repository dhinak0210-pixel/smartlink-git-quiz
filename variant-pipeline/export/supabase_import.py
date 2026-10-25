# variant-pipeline/export/supabase_import.py
"""
Export validated question variants and options to Supabase and SQL migration script.
Supports direct Supabase API sync when credentials exist, and generates a standalone SQL file.
"""

import json
import os
import uuid
from pathlib import Path
from typing import Optional

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
import config
from instantiate.sampler import load_template, sample_variants
from instantiate.renderer import render_variant
from freeze.bank_hash import compute_bank_hash


def export_bank_to_sql_and_payload(templates_dir: Path = None, output_dir: Path = None) -> dict:
    """
    Generate JSON payload and SQL insert script for all verified question variants.
    """
    templates_dir = templates_dir or config.TEMPLATES_DIR
    output_dir = output_dir or config.REPORTS_DIR
    output_dir.mkdir(parents=True, exist_ok=True)

    template_files = sorted(templates_dir.glob('q*.yaml'))

    payload = {
        'templates': [],
        'variants': [],
        'options': [],
        'bank_freeze': None
    }

    sql_statements = []
    sql_statements.append("-- Automated Question Variants Export\n")
    sql_statements.append("BEGIN;\n")

    total_variants_count = 0

    for tpath in template_files:
        template = load_template(tpath)
        tid = template['id']

        # Template record
        t_record = {
            'id': tid,
            'topic': template['topic'],
            'difficulty': template['difficulty'],
            'type': template.get('type', 'variant'),
            'stem_template': template['stem'],
            'setup_commands': json.dumps(template.get('setup', [])),
            'goal_predicate': template['goal'],
            'explanation_template': template.get('explanation', '')
        }
        payload['templates'].append(t_record)

        # SQL for template
        stem_escaped = t_record['stem_template'].replace("'", "''")
        goal_escaped = t_record['goal_predicate'].replace("'", "''")
        expl_escaped = t_record['explanation_template'].replace("'", "''")
        setup_json = json.dumps(template.get('setup', [])).replace("'", "''")

        sql_statements.append(
            f"INSERT INTO templates (id, topic, difficulty, type, stem_template, setup_commands, goal_predicate, explanation_template) "
            f"VALUES ('{tid}', '{t_record['topic']}', '{t_record['difficulty']}', '{t_record['type']}', "
            f"'{stem_escaped}', '{setup_json}'::jsonb, '{goal_escaped}', '{expl_escaped}') "
            f"ON CONFLICT (id) DO UPDATE SET stem_template = EXCLUDED.stem_template, goal_predicate = EXCLUDED.goal_predicate;"
        )

        # Sample and instantiate variants
        sampled = sample_variants(template, seed=config.SEED)
        for v_idx, params in enumerate(sampled):
            variant_dict = render_variant(template, params)
            v_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{tid}_v{v_idx}_{config.SEED}"))
            total_variants_count += 1

            v_record = {
                'id': v_id,
                'template_id': tid,
                'variant_index': v_idx + 1,
                'stem': variant_dict['stem'],
                'params': params,
                'explanation': variant_dict['explanation'],
                'status': 'verified'
            }
            payload['variants'].append(v_record)

            v_stem_esc = v_record['stem'].replace("'", "''")
            v_params_esc = json.dumps(params).replace("'", "''")
            v_expl_esc = v_record['explanation'].replace("'", "''")

            sql_statements.append(
                f"INSERT INTO variants (id, template_id, variant_index, stem, params, explanation, status) "
                f"VALUES ('{v_id}', '{tid}', {v_idx + 1}, '{v_stem_esc}', '{v_params_esc}'::jsonb, '{v_expl_esc}', 'verified') "
                f"ON CONFLICT (template_id, variant_index) DO UPDATE SET stem = EXCLUDED.stem, params = EXCLUDED.params;"
            )

            # Options
            labels = ['A', 'B', 'C', 'D']
            # Correct answer is option A in raw variant, then distractors B, C, D
            raw_options = [
                {'text': variant_dict['correct'], 'is_correct': True, 'reason': None}
            ]
            for d in variant_dict['distractors']:
                raw_options.append({'text': d['text'], 'is_correct': False, 'reason': d['reason']})

            for opt_idx, opt in enumerate(raw_options[:4]):
                lbl = labels[opt_idx]
                opt_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{v_id}_opt_{lbl}"))
                opt_text_esc = opt['text'].replace("'", "''")
                opt_reason_esc = (opt['reason'] or '').replace("'", "''")

                opt_record = {
                    'id': opt_id,
                    'variant_id': v_id,
                    'text': opt['text'],
                    'is_correct': opt['is_correct'],
                    'label': lbl,
                    'distractor_reason': opt['reason']
                }
                payload['options'].append(opt_record)

                sql_statements.append(
                    f"INSERT INTO variant_options (id, variant_id, text, is_correct, label, distractor_reason) "
                    f"VALUES ('{opt_id}', '{v_id}', '{opt_text_esc}', {str(opt['is_correct']).lower()}, '{lbl}', '{opt_reason_esc}') "
                    f"ON CONFLICT (variant_id, label) DO UPDATE SET text = EXCLUDED.text, is_correct = EXCLUDED.is_correct;"
                )

    # Freeze record
    hash_result = compute_bank_hash(templates_dir)
    bank_hash = hash_result['hash']
    payload['bank_freeze'] = {
        'bank_hash': bank_hash,
        'git_version': config.get_git_version(),
        'total_templates': len(template_files),
        'total_variants': total_variants_count
    }

    sql_statements.append(
        f"INSERT INTO bank_freeze (bank_hash, git_version, total_templates, total_variants) "
        f"VALUES ('{bank_hash}', '{config.get_git_version()}', {len(template_files)}, {total_variants_count}) "
        f"ON CONFLICT (bank_hash) DO NOTHING;\n"
    )

    sql_statements.append("COMMIT;\n")

    # Write files
    sql_file = output_dir / 'variants_export.sql'
    sql_file.write_text("\n".join(sql_statements), encoding='utf-8')

    json_file = output_dir / 'variants_export.json'
    json_file.write_text(json.dumps(payload, indent=2), encoding='utf-8')

    print(f"Exported {len(payload['templates'])} templates and {total_variants_count} variants:")
    print(f"  SQL script:  {sql_file}")
    print(f"  JSON payload: {json_file}")
    print(f"  Bank Hash:   {bank_hash}")

    return payload


def sync_to_supabase(payload: dict) -> bool:
    """
    Sync payload directly to Supabase if credentials are present.
    """
    if not config.SUPABASE_URL or not config.SUPABASE_SERVICE_KEY:
        print("ℹ️  SUPABASE_URL or SUPABASE_SERVICE_KEY not set. Skipping live DB push.")
        return False

    try:
        from supabase import create_client
        client = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)

        # Upsert templates
        for t in payload['templates']:
            client.table('templates').upsert(t).execute()

        # Upsert variants
        for v in payload['variants']:
            client.table('variants').upsert(v).execute()

        # Upsert options
        for o in payload['options']:
            client.table('variant_options').upsert(o).execute()

        # Upsert bank freeze
        if payload.get('bank_freeze'):
            client.table('bank_freeze').upsert(payload['bank_freeze']).execute()

        print("✅ Successfully pushed question variants bank to Supabase!")
        return True
    except Exception as e:
        print(f"⚠️  Supabase live sync error: {e}")
        return False


if __name__ == '__main__':
    payload = export_bank_to_sql_and_payload()
    sync_to_supabase(payload)
