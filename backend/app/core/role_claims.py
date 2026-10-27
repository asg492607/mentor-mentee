"""Trusted Firebase custom claims for account roles."""


def claims_for_role(role: str) -> dict:
    normalized = str(role or "").upper()
    claims = {"role": normalized}
    if normalized == "ADMIN":
        claims["admin"] = True
    elif normalized in {"DEAN", "HOD", "SECTION_HEAD", "CLASS_TEACHER"}:
        claims["platform_role"] = normalized
    return claims


def claims_for_account(role: str, approved: bool) -> dict:
    claims = claims_for_role(role)
    claims["platform_approved"] = approved is True
    return claims
