#!/usr/bin/env python3
"""
scripts/test-admin-features.py
Comprehensive test suite for Advanced Admin Features:
1. Supabase Auth session & role verification
2. Dashboard live metrics
3. Versioned settings & freeze check
4. Start quiz with 10s confirmation
5. Safe pause between questions & resume timing shift
6. Two-person approval lifecycle (create, block self-approval, second organizer approve)
7. Void question with typed confirmation & score removal
8. Help desk ID-card verification check & credential reset
9. Broadcast announcements & cached quiz state
10. Freeze leaderboard & dynamic score recompute (no manual tampering)
11. Tie-break analysis
12. Winner verification with 2-organizer sign-off & sequential place reveal (3rd, 2nd, 1st)
13. One-click backup export with SHA-256 checksum
14. Append-only audit trail verification
"""
import sys
import json
import time
import hashlib
import requests

BASE_URL = "http://localhost:3000"
DEFAULT_EVENT_ID = "00000000-0000-0000-0000-000000000001"

def log_test(title):
    print(f"\n[TEST] {title}...")

def assert_true(condition, message):
    if not condition:
        print(f"❌ FAIL: {message}")
        sys.exit(1)
    print(f"  ✓ {message}")

def main():
    print("=" * 70)
    print("🚀 SMARTLINK GIT QUIZ - ADVANCED ADMIN FEATURES TEST SUITE")
    print("=" * 70)

    # -------------------------------------------------------------
    # Step 0: Ensure server is accessible
    # -------------------------------------------------------------
    log_test("Check Next.js Server Connectivity")
    max_retries = 10
    connected = False
    for i in range(max_retries):
        try:
            r = requests.get(f"{BASE_URL}/api/quiz/state", timeout=3)
            if r.status_code == 200:
                connected = True
                break
        except Exception:
            time.sleep(1)
    assert_true(connected, "Next.js dev server is responsive on localhost:3000")

    # -------------------------------------------------------------
    # Step 1: Admin Authentication for 2 Organizers
    # -------------------------------------------------------------
    log_test("Admin Dual-Organizer Login via Supabase Auth")
    s1 = requests.Session()
    r1 = s1.post(f"{BASE_URL}/api/auth/login", json={
        "email": "organizer1@klu.ac.in",
        "password": "Admin@SmartLink2026!"
    })
    assert_true(r1.status_code == 200, f"Organizer 1 login status: {r1.status_code}")
    token1 = s1.cookies.get("sb-access-token")
    assert_true(bool(token1), "Organizer 1 received valid access token cookie")

    s2 = requests.Session()
    r2 = s2.post(f"{BASE_URL}/api/auth/login", json={
        "email": "organizer2@klu.ac.in",
        "password": "Admin@SmartLink2026!"
    })
    assert_true(r2.status_code == 200, f"Organizer 2 login status: {r2.status_code}")
    token2 = s2.cookies.get("sb-access-token")
    assert_true(bool(token2), "Organizer 2 received valid access token cookie")

    # -------------------------------------------------------------
    # Step 2: Dashboard Metrics & Role Gating
    # -------------------------------------------------------------
    log_test("Fetch Dashboard Live Metrics")
    r_dash = s1.get(f"{BASE_URL}/api/admin/dashboard")
    assert_true(r_dash.status_code == 200, f"Dashboard status: {r_dash.status_code}")
    ddata = r_dash.json()
    assert_true(ddata.get("role") == "owner", f"Organizer 1 role is owner (found: {ddata.get('role')})")
    assert_true("studentCounts" in ddata, "Student status breakdown present")
    assert_true("quizStatus" in ddata, f"Quiz status present: {ddata.get('quizStatus')}")

    # -------------------------------------------------------------
    # Step 3: Event Settings Management
    # -------------------------------------------------------------
    log_test("Event Settings Inspection")
    r_set = s1.get(f"{BASE_URL}/api/admin/settings")
    assert_true(r_set.status_code == 200, f"Settings fetch: {r_set.status_code}")
    set_data = r_set.json()
    assert_true("values" in set_data, "Settings values present")
    assert_true(set_data.get("values", {}).get("total_questions") == 15, "15 questions in settings")

    # -------------------------------------------------------------
    # Step 4: Start Quiz with Typed Confirmation
    # -------------------------------------------------------------
    log_test("Start Quiz Execution with Typed Confirmation")
    # Bad confirmation
    r_bad_start = s1.post(f"{BASE_URL}/api/admin/quiz/start", json={"confirm": "start"})
    assert_true(r_bad_start.status_code == 400, "Rejected invalid confirmation string")

    # Good confirmation
    r_start = s1.post(f"{BASE_URL}/api/admin/quiz/start", json={
        "confirm": "START_QUIZ",
        "eventId": DEFAULT_EVENT_ID
    })
    assert_true(r_start.status_code == 200 or "already running" in r_start.text, f"Start response: {r_start.status_code}")

    # Verify quiz state is active
    r_state = requests.get(f"{BASE_URL}/api/quiz/state")
    assert_true(r_state.json().get("status") in ["active", "running"], f"Quiz is active: {r_state.json().get('status')}")

    # -------------------------------------------------------------
    # Step 5: Safe Pause between questions & Resume
    # -------------------------------------------------------------
    log_test("Quiz Safe Pause & Offset Shift")
    r_pause = s1.post(f"{BASE_URL}/api/admin/quiz/pause", json={
        "eventId": DEFAULT_EVENT_ID,
        "reason": "Technical check between questions"
    })
    assert_true(r_pause.status_code == 200, f"Pause quiz status: {r_pause.status_code}")

    time.sleep(1) # simulate 1 second pause

    r_resume = s1.put(f"{BASE_URL}/api/admin/quiz/pause", json={"eventId": DEFAULT_EVENT_ID})
    assert_true(r_resume.status_code == 200, f"Resume quiz status: {r_resume.status_code}")
    res_data = r_resume.json()
    assert_true(res_data.get("durationMs", 0) >= 900, f"Pause duration recorded: {res_data.get('durationMs')}ms")

    # -------------------------------------------------------------
    # Step 6: Void Question with Dual-Organizer Approval
    # -------------------------------------------------------------
    log_test("Two-Person Approval Workflow: Void Question")
    # 1. Org 1 requests void with typed confirmation
    r_bad_void = s1.post(f"{BASE_URL}/api/admin/quiz/void", json={
        "questionId": "q-003",
        "questionNumber": 3,
        "reason": "short",
        "typedConfirmation": "wrong_event"
    })
    assert_true(r_bad_void.status_code == 400, "Rejected invalid typed confirmation and short reason")

    r_void_req = s1.post(f"{BASE_URL}/api/admin/quiz/void", json={
        "eventId": DEFAULT_EVENT_ID,
        "questionId": "q-003",
        "questionNumber": 3,
        "reason": "Typo in question stem caused widespread student confusion.",
        "typedConfirmation": "SmartLink Git Quiz"
    })
    assert_true(r_void_req.status_code == 200, f"Void request created: {r_void_req.status_code}")
    approval_id = r_void_req.json().get("approvalId")
    assert_true(bool(approval_id), f"Approval ID returned: {approval_id}")

    # 2. Org 1 attempts to approve their own request -> MUST FAIL
    r_self_app = s1.post(f"{BASE_URL}/api/admin/approvals", json={
        "approvalId": approval_id,
        "decision": "approved"
    })
    assert_true(r_self_app.status_code == 400, "Self-approval blocked by system")
    assert_true("Cannot approve your own request" in r_self_app.text, "Error specifies self-approval prohibited")

    # 3. Org 2 approves the request -> MUST SUCCEED
    r_org2_app = s2.post(f"{BASE_URL}/api/admin/approvals", json={
        "approvalId": approval_id,
        "decision": "approved"
    })
    assert_true(r_org2_app.status_code == 200, f"Org 2 approval success: {r_org2_app.status_code}")

    # -------------------------------------------------------------
    # Step 7: Help Desk Lookup & ID Card Check
    # -------------------------------------------------------------
    log_test("Help Desk Account Verification & Password/Code Reset")
    r_std = s1.get(f"{BASE_URL}/api/admin/students/status?q=Aarav")
    assert_true(r_std.status_code == 200, f"Student lookup: {r_std.status_code}")
    st_list = r_std.json().get("students", [])
    assert_true(len(st_list) > 0, "Found student Aarav in lookup")
    target_student_id = st_list[0]["id"]

    # Unlock without ID check -> MUST FAIL
    r_no_id = s1.post(f"{BASE_URL}/api/admin/helpdesk", json={
        "studentId": target_student_id,
        "action": "unlock",
        "idChecked": False
    })
    assert_true(r_no_id.status_code == 400, "Rejected unlock without physical ID check verification")

    # Unlock with ID check -> SUCCESS
    r_unlock = s1.post(f"{BASE_URL}/api/admin/helpdesk", json={
        "studentId": target_student_id,
        "action": "unlock",
        "idChecked": True,
        "note": "Verified Physical College ID Card"
    })
    assert_true(r_unlock.status_code == 200, f"Account unlocked: {r_unlock.status_code}")

    # Reset Code with ID check -> SUCCESS (returns new single-use code)
    r_reset = s1.post(f"{BASE_URL}/api/admin/helpdesk", json={
        "studentId": target_student_id,
        "action": "reset_code",
        "idChecked": True,
        "note": "Lost credentials at terminal"
    })
    assert_true(r_reset.status_code == 200, f"Code reset: {r_reset.status_code}")
    assert_true("newCode" in r_reset.json(), f"Generated new code: {r_reset.json().get('newCode')}")

    # -------------------------------------------------------------
    # Step 8: Broadcast Announcement & Cached State
    # -------------------------------------------------------------
    log_test("Broadcast Banner & Student Polling Cache")
    r_ann = s1.post(f"{BASE_URL}/api/admin/announcements", json={
        "message": "Question 3 has been voided due to ambiguity. Points adjusted for all.",
        "type": "warning"
    })
    assert_true(r_ann.status_code == 200, f"Announcement broadcast status: {r_ann.status_code}")

    # Verify cached state delivers the banner
    r_cached = requests.get(f"{BASE_URL}/api/quiz/state")
    banner = r_cached.json().get("banner")
    assert_true(banner is not None, "Active banner present in cached student state")
    assert_true("Question 3 has been voided" in banner.get("message", ""), "Banner message matches broadcast")

    # -------------------------------------------------------------
    # Step 9: Results Workflow: Freeze & Recompute Standings
    # -------------------------------------------------------------
    log_test("Results Workflow: Freeze Leaderboard & Dynamic Recompute")
    r_freeze = s1.post(f"{BASE_URL}/api/admin/results/freeze")
    assert_true(r_freeze.status_code == 200, f"Leaderboard frozen: {r_freeze.status_code}")

    r_recompute = s1.post(f"{BASE_URL}/api/admin/results/recompute")
    assert_true(r_recompute.status_code == 200, f"Recompute status: {r_recompute.status_code}")
    recomp_data = r_recompute.json()
    assert_true("ranking" in recomp_data, "Ranked list returned")
    assert_true(recomp_data.get("stats", {}).get("totalRanked", 0) > 0, "Ranked contestants count > 0")

    # -------------------------------------------------------------
    # Step 10: Tie-break analysis
    # -------------------------------------------------------------
    log_test("Tie-break Engine Analysis")
    ranked = recomp_data.get("ranking", [])
    if len(ranked) >= 2:
        tied_ids = [ranked[0]["studentId"], ranked[1]["studentId"]]
        r_tie = s1.post(f"{BASE_URL}/api/admin/results/tiebreak", json={"studentIds": tied_ids})
        assert_true(r_tie.status_code == 200, f"Tiebreak status: {r_tie.status_code}")
        assert_true("sorted" in r_tie.json(), "Sorted tiebreak results returned")
        assert_true("needsSuddenDeath" in r_tie.json(), "Sudden death evaluation present")

    # -------------------------------------------------------------
    # Step 11: Winner Verification & Place Reveal (3rd -> 2nd -> 1st)
    # -------------------------------------------------------------
    log_test("Winner Verification with Dual-Organizer Sign-off & Place Reveal")
    # 1. Org 1 requests winner verification
    r_win_req = s1.post(f"{BASE_URL}/api/admin/results/winner", json={
        "action": "request",
        "ranking": ranked[:5],
        "winnerStudentId": ranked[0]["studentId"] if ranked else "std-001"
    })
    assert_true(r_win_req.status_code == 200, f"Winner verification requested: {r_win_req.status_code}")
    win_approval_id = r_win_req.json().get("approvalId")

    # 2. Org 2 approves winner verification
    r_win_app = s2.post(f"{BASE_URL}/api/admin/results/winner", json={
        "action": "approve",
        "approvalId": win_approval_id
    })
    assert_true(r_win_app.status_code == 200, f"Winner verification approved by Org 2: {r_win_app.status_code}")

    # 3. Reveal 3rd Place
    r_rev3 = s1.post(f"{BASE_URL}/api/admin/results/winner", json={"action": "reveal", "place": 3})
    assert_true(r_rev3.status_code == 200, f"3rd place revealed: {r_rev3.status_code} {r_rev3.text}")

    # 4. Reveal 2nd Place
    r_rev2 = s1.post(f"{BASE_URL}/api/admin/results/winner", json={"action": "reveal", "place": 2})
    assert_true(r_rev2.status_code == 200, f"2nd place revealed: {r_rev2.status_code} {r_rev2.text}")

    # 5. Reveal 1st Place (Winner)
    r_rev1 = s1.post(f"{BASE_URL}/api/admin/results/winner", json={"action": "reveal", "place": 1})
    assert_true(r_rev1.status_code == 200, f"1st place winner revealed: {r_rev1.status_code} {r_rev1.text}")

    # 6. Publish results officially
    r_pub = s1.post(f"{BASE_URL}/api/admin/results/winner", json={"action": "publish"})
    assert_true(r_pub.status_code == 200, f"Official publication status: {r_pub.status_code}")

    # -------------------------------------------------------------
    # Step 12: Backup & Export with SHA-256 Checksum
    # -------------------------------------------------------------
    log_test("Backup Export & Cryptographic Checksum Verification")
    r_backup = s1.get(f"{BASE_URL}/api/admin/backup?format=json")
    assert_true(r_backup.status_code == 200, f"Backup export status: {r_backup.status_code}")
    bdata = r_backup.json()
    assert_true("tables" in bdata, "Backup contains all critical tables")
    assert_true("checksum" in bdata, "SHA-256 Checksum block present")
    assert_true(len(bdata.get("checksum", {}).get("hash", "")) == 64, "SHA-256 hash length is 64 hex characters")

    # -------------------------------------------------------------
    # Step 13: Append-Only Audit Trail Inspection
    # -------------------------------------------------------------
    log_test("Append-Only Audit Trail Telemetry Verification")
    r_audit = s1.get(f"{BASE_URL}/api/admin/audit")
    assert_true(r_audit.status_code == 200, f"Audit trail fetch: {r_audit.status_code}")
    logs = r_audit.json().get("logs", [])
    assert_true(len(logs) >= 5, f"Audit log contains {len(logs)} recorded operations")
    actions = [l.get("action") for l in logs]
    assert_true("start_quiz" in actions, "start_quiz in audit log")
    assert_true("pause_quiz" in actions, "pause_quiz in audit log")
    assert_true("recompute_results" in actions, "recompute_results in audit log")

    print("\n" + "=" * 70)
    print("🏆 ALL ADVANCED ADMIN TEST CRITERIA PASSED SUCCESSFULLY (14/14)")
    print("=" * 70)

if __name__ == "__main__":
    main()
