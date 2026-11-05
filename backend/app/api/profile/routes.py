"""Phone ownership verification for profile and booklet contact numbers."""

import re

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.dependencies import get_current_user
from app.core.exceptions import BadRequestException, ForbiddenException, ServiceUnavailableException
from app.firebase.client import db, firebase_auth
from app.utils.helpers import get_timestamp

router = APIRouter(prefix="/profile", tags=["Profile"])

PHONE_FIELDS = {
    "fatherPhoneO", "fatherPhoneR", "fatherPhoneM",
    "motherPhoneO", "motherPhoneR", "motherPhoneM", "guardianPhone",
}


class PhoneVerificationRequest(BaseModel):
    scope: str = Field(max_length=20)
    field: str = Field(max_length=40)
    phone: str = Field(max_length=20)
    phoneProofToken: str = Field(default="", max_length=10_000)


@router.post("/phone/verify")
def verify_phone(data: PhoneVerificationRequest, user=Depends(get_current_user)):
    """Verify a Firebase phone-auth proof, then save the number to its allowed field."""
    if not firebase_auth or not db:
        raise ServiceUnavailableException("Phone verification is not configured")

    phone = data.phone.strip()
    if phone:
        if not re.fullmatch(r"\+[1-9]\d{7,14}", phone):
            raise BadRequestException("Enter the phone number in international format, for example +919876543210")
        try:
            proof = firebase_auth.verify_id_token(data.phoneProofToken, check_revoked=True)
        except Exception:
            raise BadRequestException("Phone verification expired. Request a new code and try again")
        if (proof.get("firebase") or {}).get("sign_in_provider") != "phone":
            raise ForbiddenException("Complete SMS verification before saving this number")
        if proof.get("phone_number") != phone:
            raise ForbiddenException("The verified number does not match the number entered")

    uid = user["uid"]
    role = str(user.get("role") or "").upper()
    now = get_timestamp()
    if data.scope == "profile" and data.field in {"phone", "parentPhone"}:
        if data.field == "parentPhone" and role != "STUDENT":
            raise ForbiddenException("Only students can save a parent or guardian number")
        collection = "students" if role == "STUDENT" else "faculty"
        updates = {data.field: phone}
        if data.field == "parentPhone":
            updates.update({"parentPhoneVerified": bool(phone), "parentPhoneVerifiedAt": now if phone else None})
        else:
            updates.update({"contactNumber": phone, "phoneVerified": bool(phone), "phoneVerifiedAt": now if phone else None})
        db.collection(collection).document(uid).set({**updates, "updatedAt": now}, merge=True)
    elif data.scope == "booklet" and role == "STUDENT" and data.field in PHONE_FIELDS:
        db.collection("booklets").document(uid).set({
            "personal": {data.field: phone},
            "phoneVerifiedFields": {data.field: bool(phone)},
        }, merge=True)
    else:
        raise ForbiddenException("This phone field cannot be changed from this account")

    # Firestore rules use this server-written receipt to reject unverified
    # phone changes made directly from a client.
    receipt_id = f"{uid}_{data.scope}_{data.field}"
    receipt = db.collection("verified_phone_numbers").document(receipt_id)
    if phone:
        receipt.set({
            "userId": uid,
            "scope": data.scope,
            "field": data.field,
            "phone": phone,
            "verifiedAt": now,
        })
    else:
        receipt.delete()
    return {"field": data.field, "phone": phone, "verified": bool(phone)}
