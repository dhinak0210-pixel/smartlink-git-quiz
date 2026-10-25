#!/usr/bin/env python3
"""
Comprehensive automated test suite for Participant Login Features
(Email + Password via Supabase Auth)
"""

import urllib.request
import urllib.parse
import http.cookiejar
import json
import sys

BASE_URL = "http://localhost:3000"

def make_session():
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    return opener, cj

def post_json(opener, url, data, headers=None):
    req_headers = {"Content-Type": "application/json"}
    if headers:
        req_headers.update(headers)
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode("utf-8"),
        headers=req_headers,
        method="POST"
    )
    try:
        with opener.open(req) as resp:
            body = resp.read().decode("utf-8")
            return resp.getcode(), json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            parsed = json.loads(body)
        except:
            parsed = {"raw": body}
        return e.code, parsed

def get_json(opener, url, headers=None):
    req_headers = {}
    if headers:
        req_headers.update(headers)
    req = urllib.request.Request(url, headers=req_headers, method="GET")
    try:
        with opener.open(req) as resp:
            body = resp.read().decode("utf-8")
            return resp.getcode(), json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            parsed = json.loads(body)
        except:
            parsed = {"raw": body}
        return e.code, parsed

def run_tests():
    print("=" * 60)
    print("Starting Participant Login Features Test Suite")
    print("=" * 60)

    # 1. Test validation on Signup
    opener, cj = make_session()

    print("\n--- Test 1: Signup Validation (Disallowed Domain) ---")
    code, data = post_json(opener, f"{BASE_URL}/api/auth/signup", {
        "name": "Test User",
        "email": "test@gmail.com",
        "registerNo": "CS2024001",
        "password": "ValidPassword123!",
        "confirmPassword": "ValidPassword123!",
        "joinCode": "baf4jc",
        "consent": True
    })
    print(f"Status: {code}, Error: {data.get('error')}")
    assert code == 400
    assert "college email" in data.get("error", "").lower()

    print("\n--- Test 2: Signup Validation (Common Password) ---")
    code, data = post_json(opener, f"{BASE_URL}/api/auth/signup", {
        "name": "Test User",
        "email": "cs2024001@klu.ac.in",
        "registerNo": "CS2024001",
        "password": "password",
        "confirmPassword": "password",
        "joinCode": "baf4jc",
        "consent": True
    })
    print(f"Status: {code}, Error: {data.get('error')}")
    assert code == 400
    assert "too common" in data.get("error", "").lower()

    print("\n--- Test 3: Signup Validation (Wrong Join Code) ---")
    code, data = post_json(opener, f"{BASE_URL}/api/auth/signup", {
        "name": "Test User",
        "email": "cs2024001@klu.ac.in",
        "registerNo": "CS2024001",
        "password": "StrongPassword2026!",
        "confirmPassword": "StrongPassword2026!",
        "joinCode": "WRONG1",
        "consent": True
    })
    print(f"Status: {code}, Error: {data.get('error')}")
    assert code == 401
    assert "attempts remaining" in data.get("error", "").lower()

    print("\n--- Test 4: Successful Student Signup ---")
    # Student CS2024001 has join code "baf4jc" in scripts/data-students.json
    code, data = post_json(opener, f"{BASE_URL}/api/auth/signup", {
        "name": "Aarav Sharma",
        "email": "cs2024001@klu.ac.in",
        "registerNo": "CS2024001",
        "password": "StrongPassword2026!",
        "confirmPassword": "StrongPassword2026!",
        "joinCode": "baf4jc",
        "consent": True
    })
    print(f"Status: {code}, Response: {data}")
    assert code == 200
    assert data.get("success") is True
    # Verify cookies
    cookies = {c.name: c.value for c in cj}
    print(f"Set cookies: {list(cookies.keys())}")
    assert "sb-access-token" in cookies
    assert "quiz_session_id" in cookies

    print("\n--- Test 5: Verify Student Profile with Active Session ---")
    code, profile = get_json(opener, f"{BASE_URL}/api/student/profile")
    print(f"Status: {code}, Profile: {profile}")
    assert code == 200
    assert profile.get("email") == "cs2024001@klu.ac.in"
    assert profile.get("name") == "Aarav Sharma"

    print("\n--- Test 6: Duplicate Signup Prevention ---")
    code, data = post_json(opener, f"{BASE_URL}/api/auth/signup", {
        "name": "Aarav Sharma",
        "email": "cs2024001@klu.ac.in",
        "registerNo": "CS2024001",
        "password": "AnotherPassword2026!",
        "confirmPassword": "AnotherPassword2026!",
        "joinCode": "baf4jc",
        "consent": True
    })
    print(f"Status: {code}, Error: {data.get('error')}")
    assert code in (401, 409)

    print("\n--- Test 7: Student Login with Password ---")
    opener2, cj2 = make_session()
    code, data = post_json(opener2, f"{BASE_URL}/api/auth/login", {
        "email": "cs2024001@klu.ac.in",
        "password": "StrongPassword2026!"
    })
    print(f"Status: {code}, Response: {data}")
    assert code == 200
    assert data.get("success") is True
    cookies2 = {c.name: c.value for c in cj2}
    assert "sb-access-token" in cookies2
    assert "quiz_session_id" in cookies2
    # Verify session kicking happened
    assert cookies2["quiz_session_id"] != cookies["quiz_session_id"]

    print("\n--- Test 8: Login Failure with Wrong Password & Lockout Counting ---")
    opener3, cj3 = make_session()
    for attempt in range(1, 4):
        code, data = post_json(opener3, f"{BASE_URL}/api/auth/login", {
            "email": "cs2024002@klu.ac.in",
            "password": "WrongPassword!"
        })
        print(f"Attempt {attempt}: Status {code}, Error: {data.get('error')}")
        assert code == 401

    print("\n--- Test 9: Password Reset via Join Code ---")
    # Reset password for cs2024001 using joinCode "baf4jc"
    code, data = post_json(opener, f"{BASE_URL}/api/auth/reset-password", {
        "email": "cs2024001@klu.ac.in",
        "joinCode": "baf4jc",
        "newPassword": "NewStrongPassword2026!",
        "confirmPassword": "NewStrongPassword2026!"
    })
    print(f"Reset status: {code}, Response: {data}")
    assert code == 200
    assert data.get("success") is True

    # Try login with new password
    opener4, cj4 = make_session()
    code, data = post_json(opener4, f"{BASE_URL}/api/auth/login", {
        "email": "cs2024001@klu.ac.in",
        "password": "NewStrongPassword2026!"
    })
    print(f"Login with new password: {code}, Response: {data}")
    assert code == 200
    assert data.get("success") is True

    print("\n--- Test 10: Organizer / Admin Login ---")
    opener_admin, cj_admin = make_session()
    code, data = post_json(opener_admin, f"{BASE_URL}/api/auth/login", {
        "email": "organizer1@klu.ac.in",
        "password": "Admin@SmartLink2026!"
    })
    print(f"Admin Login: {code}, Role: {data.get('role')}")
    assert code == 200
    assert data.get("role") == "admin"

    print("\n--- Test 11: Admin Student Status Board ---")
    code, data = get_json(opener_admin, f"{BASE_URL}/api/admin/students")
    print(f"Admin students query: {code}, Total: {data.get('total')}, Counts: {data.get('counts')}")
    assert code == 200
    assert data.get("total") > 0
    assert "counts" in data

    print("\n--- Test 12: Admin Action - Reset Join Code ---")
    student_id = profile.get("id")
    code, data = post_json(opener_admin, f"{BASE_URL}/api/admin/students/reset-code", {
        "studentId": student_id
    })
    print(f"Reset code action: {code}, New Code: {data.get('newCode')}")
    assert code == 200
    assert len(data.get("newCode", "")) == 6

    print("\n--- Test 13: Admin Action - Force Logout ---")
    code, data = post_json(opener_admin, f"{BASE_URL}/api/admin/students/force-logout", {
        "studentId": student_id
    })
    print(f"Force logout action: {code}, Message: {data.get('message')}")
    assert code == 200
    assert data.get("success") is True

    print("\n--- Test 14: Admin Login Log Audit Trail ---")
    code, data = get_json(opener_admin, f"{BASE_URL}/api/admin/login-log?limit=20")
    print(f"Login log audit: {code}, Events recorded: {data.get('count')}")
    assert code == 200
    assert data.get("count") > 0
    # Audit for privacy: ensure no password fields in any log event
    for event in data.get("events", []):
        event_str = json.dumps(event).lower()
        assert "password" not in event.get("details", {})
        assert "newpassword" not in event.get("details", {})
        assert "strongpassword" not in event_str
    print("Privacy verification passed: No passwords in audit events!")

    print("\n--- Test 15: Student Logout ---")
    code, data = post_json(opener4, f"{BASE_URL}/api/auth/logout", {})
    print(f"Logout status: {code}")
    assert code == 200

    print("\n" + "=" * 60)
    print("ALL 15 TESTS PASSED SUCCESSFULLY! 🚀")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
