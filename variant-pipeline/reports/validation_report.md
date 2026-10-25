# SmartLink Git Quiz — Variant Validation Report

Generated: 2026-10-22T05:33:13.362032+00:00

Git Engine: git version 2.43.0 (pure-python-sandbox)

## Executive Summary

- **Total Question Templates:** 10
- **Total Variants Tested:** 30
- **Verified Variants (100% Proven Keys):** 30 / 30

## Template Breakdown

| Template ID | Variants Verified | Quality Gates | Cross-Variant Leaks |
|---|---|---|---|
| `q01_reset_soft` | 3/3 ✅ | PASSED ✅ | CLEAN (0) ✅ |
| `q02_branch_rename` | 3/3 ✅ | PASSED ✅ | CLEAN (0) ✅ |
| `q03_rebase_count` | 3/3 ✅ | PASSED ✅ | CLEAN (0) ✅ |
| `q04_stash_apply` | 3/3 ✅ | PASSED ✅ | CLEAN (0) ✅ |
| `q05_cherry_pick` | 3/3 ✅ | PASSED ✅ | CLEAN (0) ✅ |
| `q06_merge_conflict` | 3/3 ✅ | PASSED ✅ | CLEAN (0) ✅ |
| `q07_restore_staged` | 3/3 ✅ | PASSED ✅ | CLEAN (0) ✅ |
| `q08_revert_count` | 3/3 ✅ | PASSED ✅ | CLEAN (0) ✅ |
| `q09_tag_annotate` | 3/3 ✅ | PASSED ✅ | CLEAN (0) ✅ |
| `q10_log_format` | 3/3 ✅ | PASSED ✅ | CLEAN (0) ✅ |

## Detailed Variant Inspection

### `q01_reset_soft`

- **Variant 1** ({'N': 3, 'total_commits': 6}): Status = `verified`
- **Variant 2** ({'N': 2, 'total_commits': 6}): Status = `verified`
- **Variant 3** ({'N': 4, 'total_commits': 6}): Status = `verified`

### `q02_branch_rename`

- **Variant 1** ({'old_name': 'search', 'new_name': 'search-v2'}): Status = `verified`
- **Variant 2** ({'old_name': 'auth01', 'new_name': 'auth01-v2'}): Status = `verified`
- **Variant 3** ({'old_name': 'navbar', 'new_name': 'navbar-v2'}): Status = `verified`

### `q03_rebase_count`

- **Variant 1** ({'main_commits': 7, 'feature_commits': 6}): Status = `verified`
- **Variant 2** ({'main_commits': 5, 'feature_commits': 4}): Status = `verified`
- **Variant 3** ({'main_commits': 6, 'feature_commits': 5}): Status = `verified`

### `q04_stash_apply`

- **Variant 1** ({'stash_idx': 0}): Status = `verified`
- **Variant 2** ({'stash_idx': 1}): Status = `verified`
- **Variant 3** ({'stash_idx': 2}): Status = `verified`

### `q05_cherry_pick`

- **Variant 1** ({'feat_branch': 'feat-nav', 'fix_file': 'nav_patch.py'}): Status = `verified`
- **Variant 2** ({'feat_branch': 'feat-cart', 'fix_file': 'cart_patch.py'}): Status = `verified`
- **Variant 3** ({'feat_branch': 'feat-auth', 'fix_file': 'auth_patch.py'}): Status = `verified`

### `q06_merge_conflict`

- **Variant 1** ({'target_file': 'router.json'}): Status = `verified`
- **Variant 2** ({'target_file': 'client.json'}): Status = `verified`
- **Variant 3** ({'target_file': 'config.json'}): Status = `verified`

### `q07_restore_staged`

- **Variant 1** ({'target_file': 'server.json'}): Status = `verified`
- **Variant 2** ({'target_file': 'schema.json'}): Status = `verified`
- **Variant 3** ({'target_file': 'config.json'}): Status = `verified`

### `q08_revert_count`

- **Variant 1** ({'N': 1}): Status = `verified`
- **Variant 2** ({'N': 3}): Status = `verified`
- **Variant 3** ({'N': 2}): Status = `verified`

### `q09_tag_annotate`

- **Variant 1** ({'tag_name': 'v2.1.0', 'release_note': 'stable-candidate'}): Status = `verified`
- **Variant 2** ({'tag_name': 'v1.1.0', 'release_note': 'sprint-deliverable'}): Status = `verified`
- **Variant 3** ({'tag_name': 'v3.0.0', 'release_note': 'beta-release'}): Status = `verified`

### `q10_log_format`

- **Variant 1** ({'max_count': 3}): Status = `verified`
- **Variant 2** ({'max_count': 5}): Status = `verified`
- **Variant 3** ({'max_count': 8}): Status = `verified`
