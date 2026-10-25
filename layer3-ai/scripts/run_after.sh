#!/usr/bin/env bash
# =============================================================================
# SmartLink Git Quiz — Layer 3: Post-Event Analytics, Feedback & Certificates
# Run: bash scripts/run_after.sh [--mock]
# =============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAYER3_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${LAYER3_DIR}"

echo "========================================================================="
echo "📊 SmartLink Git Quiz — Layer 3: Post-Event Analytics & Minting Pipeline"
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
for arg in "$@"; do
    case $arg in
        --mock)
            MOCK_FLAG="--mock"
            shift
            ;;
    esac
done

# 2. Export & Anonymize
echo -e "\n[Step 1/6] Exporting quiz data and stripping PII for AI safety..."
${PYTHON_EXEC} export/exporter.py ${MOCK_FLAG}

# 3. Organizer Analytics & PDF Report
echo -e "\n[Step 2/6] Running pandas analysis & compiling organizer report..."
${PYTHON_EXEC} after/analysis.py

# 4. Student Feedback Reports
echo -e "\n[Step 3/6] Generating personalized student feedback reports..."
${PYTHON_EXEC} after/report_builder.py

# 5. Certificate Generation
echo -e "\n[Step 4/6] Minting PDF certificates with verification hashes..."
${PYTHON_EXEC} after/certificate_generator.py

# 6. Winner Announcements
echo -e "\n[Step 5/6] Drafting social media & email winner announcements..."
${PYTHON_EXEC} after/announcement_drafter.py

# 7. Dispute Evidence Summaries
echo -e "\n[Step 6/6] Generating dispute & appeal dossiers..."
${PYTHON_EXEC} after/dispute_summarizer.py

echo -e "\n========================================================================="
echo "🎉 Post-Event Pipeline Complete!"
echo "   - Organizer Report:   after/output/organizer_report.pdf"
echo "   - Analytics Charts:   after/output/analysis_charts.png"
echo "   - Student Reports:    after/output/student_reports/"
echo "   - Certificates:       after/output/certificates/"
echo "   - Announcements:      after/output/announcements/"
echo "   - Dispute Summaries:  after/output/disputes/"
echo "   - Confidential Key:   after/output/_id_mapping_LOCAL.json (Admin Only)"
echo "========================================================================="
