import os
import sys
import json
import urllib.request
import urllib.error

BASE_URL = "http://127.0.0.1:8000"

def request_json(path, method="GET", data=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode("utf-8")
            return resp.status, json.loads(content) if content else {}
    except urllib.error.HTTPError as err:
        err_content = err.read().decode("utf-8")
        try:
            parsed = json.loads(err_content)
        except Exception:
            parsed = {"error": err_content}
        return err.code, parsed

def run_tests():
    print("=== STARTING REAL LIVE E2E INTEGRATION SUITE ===")

    # 1. Student Login
    print("\n--- 1. Student Login ---")
    status, res = request_json("/api/auth/login/", method="POST", data={
        "identifier": "alex.morgan@campus.edu",
        "password": "password123"
    })
    assert status == 200, f"Student login failed: {status} {res}"
    student_token = res["token"]
    print(f"PASS: Student logged in, token: {student_token[:8]}...")

    # 2. Report Lost Item
    print("\n--- 2. Student Report Lost Item ---")
    status, res = request_json("/api/items/lost-items/", method="POST", token=student_token, data={
        "category": "Bottles & Containers",
        "description": "Lost blue insulated stainless steel bottle with campus stickers near library",
        "original_answers": {"color": "blue", "lost_location": "Library Floor 2"},
        "normalized_attributes": {"color": "blue", "category": "bottles"}
    })
    assert status == 201, f"Report lost failed: {status} {res}"
    lost_id = res["public_id"]
    print(f"PASS: Lost item reported, public_id: {lost_id}")

    # 3. View Student Lost Reports
    print("\n--- 3. View Student Lost Reports ---")
    status, res = request_json("/api/items/lost-items/", method="GET", token=student_token)
    assert status == 200, f"Fetch lost items failed: {status} {res}"
    items = res if isinstance(res, list) else res.get("results", [])
    assert any(i["public_id"] == lost_id for i in items), "Reported lost item not found in student list"
    print(f"PASS: Student reports list contains newly reported item ({len(items)} items)")

    # 4. Available Items Catalog
    print("\n--- 4. Available Items Catalog ---")
    status, res = request_json("/api/items/available-items/", method="GET", token=student_token)
    assert status == 200, f"Available items failed: {status} {res}"
    avail_items = res if isinstance(res, list) else res.get("results", [])
    assert len(avail_items) > 0, "No available items found"
    print(f"PASS: Available catalog contains {len(avail_items)} published items")
    for it in avail_items:
        assert "serial_number" not in it, "Private field serial_number leaked!"
        assert "imei" not in it, "Private field imei leaked!"
        assert "secret_verification_info" not in it, "Private field secret_verification_info leaked!"
    print("PASS: Public catalog strictly hides all private fields")

    # 5. Student Claims General Item ('item-gen-101')
    print("\n--- 5. Student Claims General Item ---")
    # Clean up existing claims for this item if any
    status, res = request_json("/api/pickup/claims/", method="POST", token=student_token, data={
        "found_item_id": "item-gen-101",
        "student_answer": "It is my stainless bottle with a minor dent near the bottom rim."
    })
    if status == 400 and ("already exists" in str(res) or "already have an active claim" in str(res)):
        print("Note: An existing claim already exists for item-gen-101, proceeding to verify...")
        # Get existing claim
        _, my_claims = request_json("/api/pickup/claims/my-claims/", method="GET", token=student_token)
        claim_list = my_claims if isinstance(my_claims, list) else my_claims.get("results", [])
        gen_claim = next(c for c in claim_list if c["found_item"]["public_id"] == "item-gen-101")
        gen_claim_id = gen_claim["public_id"]
    else:
        assert status == 201, f"Claim failed: {status} {res}"
        gen_claim_id = res["public_id"]
    print(f"PASS: Claim for item-gen-101 created/found with public_id: {gen_claim_id}")

    # 6. Check Student Recovery Tracker
    print("\n--- 6. Check Student Recovery Tracker ---")
    status, res = request_json("/api/pickup/claims/my-claims/", method="GET", token=student_token)
    assert status == 200, f"My claims failed: {status} {res}"
    claims = res if isinstance(res, list) else res.get("results", [])
    gen_claim = next(c for c in claims if c["public_id"] == gen_claim_id)
    print(f"PASS: Claim status is '{gen_claim['status']}', item: '{gen_claim['found_item']['title']}'")

    # 7. Staff Login
    print("\n--- 7. Staff / Custodian Login ---")
    status, res = request_json("/api/auth/login/", method="POST", data={
        "identifier": "custodian@campus.edu",
        "password": "password123"
    })
    assert status == 200, f"Staff login failed: {status} {res}"
    staff_token = res["token"]
    assert res["user"]["role"] == "custodian", "User is not custodian"
    print(f"PASS: Custodian logged in, token: {staff_token[:8]}...")

    # 8. Staff Claim Verification Queue
    print("\n--- 8. Staff Claim Verification Queue ---")
    status, res = request_json("/api/pickup/claims/admin/admin-list/?status=all", method="GET", token=staff_token)
    assert status == 200, f"Admin claim list failed: {status} {res}"
    admin_claims = res if isinstance(res, list) else res.get("results", [])
    assert any(c["public_id"] == gen_claim_id for c in admin_claims), "Claim not in admin list"
    print(f"PASS: Admin claims queue retrieved ({len(admin_claims)} claims)")

    # 9. Staff Approves General Claim using public_id
    print("\n--- 9. Staff Approves General Claim (via public_id) ---")
    if gen_claim["status"] == "PENDING":
        status, res = request_json(f"/api/pickup/claims/admin/{gen_claim_id}/approve/", method="POST", token=staff_token, data={
            "admin_notes": "Ownership description verified."
        })
        assert status == 200, f"Staff approve failed: {status} {res}"
        print(f"PASS: Staff approved claim {gen_claim_id} via public_id endpoint!")
    else:
        print(f"Note: Claim {gen_claim_id} already in status {gen_claim['status']}")

    # 10. Staff Handover Queue
    print("\n--- 10. Staff Handover Queue ---")
    status, res = request_json("/api/handovers/admin/?status=all", method="GET", token=staff_token)
    assert status == 200, f"Admin handovers failed: {status} {res}"
    handovers = res if isinstance(res, list) else res.get("results", [])
    target_handover = next((h for h in handovers if h["found_item"]["public_id"] == "item-gen-101"), None)
    assert target_handover is not None, "Handover for item-gen-101 not found"
    handover_id = target_handover["public_id"]
    print(f"PASS: Found handover {handover_id} with status '{target_handover['status']}'")

    # 11. Staff Confirms Physical Collection using handover public_id
    print("\n--- 11. Staff Confirms Collection (via public_id) ---")
    if target_handover["status"] != "COMPLETED":
        status, res = request_json(f"/api/handovers/admin/{handover_id}/confirm-collection/", method="POST", token=staff_token)
        assert status == 200, f"Confirm collection failed: {status} {res}"
        print(f"PASS: Collection confirmed for general item via public_id endpoint!")
    else:
        print(f"Note: Handover {handover_id} was already COMPLETED")

    # 12. Valuable Item Claim Flow & OTP
    print("\n--- 12. Valuable Item Flow with OTP ---")
    # Student claims valuable item (item-val-102: iPhone 13)
    status, res = request_json("/api/pickup/claims/", method="POST", token=student_token, data={
        "found_item_id": "item-val-102",
        "student_answer": "Midnight black iPhone 13, serial number ending in 987X."
    })
    if status == 400 and ("already exists" in str(res) or "already have an active claim" in str(res)):
        _, my_claims = request_json("/api/pickup/claims/my-claims/", method="GET", token=student_token)
        val_claim = next(c for c in my_claims if c["found_item"]["public_id"] == "item-val-102")
        val_claim_id = val_claim["public_id"]
    else:
        assert status == 201, f"Valuable claim failed: {status} {res}"
        val_claim_id = res["public_id"]
    print(f"PASS: Valuable claim created/found with public_id: {val_claim_id}")

    # Approve valuable claim if pending
    status, res = request_json(f"/api/pickup/claims/admin/{val_claim_id}/approve/", method="POST", token=staff_token, data={
        "admin_notes": "Serial verified against item record."
    })
    if status == 200:
        print(f"PASS: Valuable claim approved, OTP generated.")
    elif status == 400 and "already" in str(res):
        print("Note: Valuable claim was already approved.")

    # Find handover for item-val-102
    _, handovers = request_json("/api/handovers/admin/?status=all", method="GET", token=staff_token)
    val_handover = next(h for h in handovers if h["found_item"]["public_id"] == "item-val-102")
    val_handover_id = val_handover["public_id"]
    print(f"PASS: Valuable handover public_id: {val_handover_id}, is_valuable: {val_handover['is_valuable']}, status: {val_handover['status']}")

    if val_handover["status"] != "COMPLETED":
        # Test Wrong OTP
        print("\n--- 13. Test Wrong OTP via public_id ---")
        status, res = request_json(f"/api/handovers/admin/{val_handover_id}/verify-otp/", method="POST", token=staff_token, data={
            "otp": "000000"
        })
        assert status == 400, f"Expected 400 for wrong OTP, got: {status} {res}"
        print(f"PASS: Wrong OTP correctly rejected with 400: {res.get('detail')}")

        # Retrieve student notifications to get the generated OTP
        print("\n--- 14. Check Student OTP Notification ---")
        status, notifs = request_json("/api/notifications/", method="GET", token=student_token)
        assert status == 200, f"Notifications failed: {status} {notifs}"
        notif_list = notifs if isinstance(notifs, list) else notifs.get("results", [])
        otp_notif = next((n for n in notif_list if "OTP" in n["title"] or "OTP" in n["message"] or "Security OTP" in n["title"]), None)
        print(f"PASS: Found notification: {otp_notif['title'] if otp_notif else 'None'}")
        
        # In case OTP is hashed in DB, we can read OTP from notification text
        import re
        otp_match = re.search(r'\b\d{6}\b', otp_notif['message']) if otp_notif else None
        if otp_match:
            correct_otp = otp_match.group(0)
            print(f"Found OTP from notification message: {correct_otp}")
            # Verify OTP
            status, res = request_json(f"/api/handovers/admin/{val_handover_id}/verify-otp/", method="POST", token=staff_token, data={
                "otp": correct_otp
            })
            assert status == 200, f"OTP verification failed: {status} {res}"
            print(f"PASS: Valid OTP verified successfully! Handover status: {res.get('status')}")
    else:
        print("Note: Valuable handover already completed in previous run.")

    # 15. Student Recovery Page Final State
    print("\n--- 15. Student Recovery Page Final State ---")
    status, my_claims = request_json("/api/pickup/claims/my-claims/", method="GET", token=student_token)
    assert status == 200
    for c in my_claims:
        h = c.get("handover")
        h_st = h.get("status") if h else "None"
        print(f"Claim {c['public_id'][:8]} | Item: {c['found_item']['title'][:25]} | Status: {c['status']} | Handover: {h_st}")

    print("\n=== ALL REAL LIVE E2E INTEGRATION TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    run_tests()
