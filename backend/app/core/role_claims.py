"""Trusted Firebase custom claims for account roles."""

VALID_ROLES = frozenset({
    "STUDENT", "FACULTY", "MENTOR", "CLASS_TEACHER",
    "SECTION_HEAD", "HOD", "DEAN", "ADMIN",
})
SELF_SERVICE_ROLES = frozenset({"STUDENT"})
PLATFORM_CLAIM_VERSION = 2


def claims_for_role(role: str) -> dict:
    normalized = str(role or "").upper()
    claims = {"role": normalized}
    if normalized == "ADMIN":
        claims["admin"] = True
    elif normalized in {"DEAN", "HOD", "SECTION_HEAD", "CLASS_TEACHER", "MENTOR"}:
        claims["platform_role"] = normalized
    return claims


def claims_for_account(role: str, approved: bool) -> dict:
    claims = claims_for_role(role)
    claims["platform_approved"] = approved is True
    claims["platform_claim_version"] = PLATFORM_CLAIM_VERSION
    return claims


def account_claims_match(decoded: dict, role: str, approved: bool = True) -> bool:
    """Check that a verified Firebase token already has trusted account claims."""
    return all(
        decoded.get(key) == value
        for key, value in claims_for_account(role, approved).items()
    )
