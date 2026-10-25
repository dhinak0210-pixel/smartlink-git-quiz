#!/usr/bin/env bash
# =============================================================================
# SmartLink Git Quiz — Layer 3: Pre-Event Question Generation & Validation Pipeline
# Run: bash scripts/run_before.sh [--mock] [--skip-import]
# =============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAYER3_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${LAYER3_DIR}"

echo "========================================================================="
echo "🚀 SmartLink Git Quiz — Layer 3: Before-the-Event Pipeline"
echo "========================================================================="

# 1. Activate Virtual Environment
if [ -d ".venv" ]; then
    source ".venv/bin/activate"
    PYTHON_EXEC="python"
elif command -v python3 &> /dev/null; then
    PYTHON_EXEC="python3"
else
    echo "❌ Python runtime not found!"
    exit 1
fi

MOCK_FLAG=""
SKIP_IMPORT=""
for arg in "$@"; do
    case $arg in
        --mock)
            MOCK_FLAG="--mock"
            shift
            ;;
        --skip-import)
            SKIP_IMPORT="true"
            shift
            ;;
    esac
done

# 2. Check Limits & Diagnostics
echo -e "\n[Step 1/5] Checking environment and API limits..."
${PYTHON_EXEC} scripts/check_limits.py

# 3. Question Candidate Generation
echo -e "\n[Step 2/5] Generating candidate questions from blueprint..."
${PYTHON_EXEC} generate/generator.py ${MOCK_FLAG}

# 4. Ephemeral Git Repo & Blind LLM Validation
echo -e "\n[Step 3/5] Validating candidates via ephemeral Git repos & blind checks..."
${PYTHON_EXEC} validate/validator.py

# 5. Quality Gates & Bank Construction
echo -e "\n[Step 4/5] Executing quality gates & compiling final question bank..."
${PYTHON_EXEC} quality/quality_gates.py

# 6. Review & Supabase Import
if [ "$SKIP_IMPORT" != "true" ]; then
    echo -e "\n[Step 5/5] Importing approved questions to Supabase..."
    ${PYTHON_EXEC} export/importer.py
else
    echo -e "\n[Step 5/5] Skipped Supabase import (--skip-import specified)."
fi

echo -e "\n========================================================================="
echo "🎉 Pre-Event Pipeline Finished Successfully!"
echo "   - Final Questions:  bank/final_questions.json (15 main + 5 reserve)"
echo "   - Supabase SQL:     bank/import.sql"
echo "   - Quality Report:   quality/output/quality_report.json"
echo "   - Validation Log:   validate/output/validation_results.json"
echo "========================================================================="
