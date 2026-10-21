"""Password hashing.

Passwords were previously stored as plain text in users.json. They are now
stored as salted PBKDF2-SHA256 digests. Legacy plain-text records are verified
once against the raw value and transparently re-hashed on the next successful
sign-in, so existing accounts keep working.
"""

import hashlib
import hmac
import os

ALGORITHM = "pbkdf2_sha256"
ITERATIONS = 240_000
SALT_BYTES = 16


def hash_password(password: str) -> str:
    salt = os.urandom(SALT_BYTES)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, ITERATIONS)
    return f"{ALGORITHM}${ITERATIONS}${salt.hex()}${digest.hex()}"


def is_hashed(stored: str) -> bool:
    return isinstance(stored, str) and stored.startswith(ALGORITHM + "$")


def verify_password(password: str, stored: str) -> bool:
    if not stored:
        return False
    if not is_hashed(stored):
        # Legacy plain-text record.
        return hmac.compare_digest(password, stored)
    try:
        _algo, iterations, salt_hex, digest_hex = stored.split("$", 3)
        expected = bytes.fromhex(digest_hex)
        candidate = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            bytes.fromhex(salt_hex),
            int(iterations),
        )
        return hmac.compare_digest(candidate, expected)
    except Exception:
        return False
