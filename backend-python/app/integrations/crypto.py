"""Symmetric encryption for secrets stored at rest (Google refresh tokens).

Uses Fernet (AES-128-CBC + HMAC) with the key from ``INTEGRATION_ENC_KEY``.
The key must be a urlsafe-base64 32-byte Fernet key; generate one with::

    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
"""

from functools import lru_cache

from cryptography.fernet import Fernet

from app.config import settings


@lru_cache(maxsize=1)
def _fernet() -> Fernet:
    key = settings.integration_enc_key
    if not key:
        raise RuntimeError(
            "INTEGRATION_ENC_KEY is not set. Generate one with: "
            'python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"'
        )
    return Fernet(key.encode())


def encrypt(plaintext: str) -> str:
    """Encrypt a string, returning urlsafe-base64 ciphertext."""
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    """Decrypt ciphertext produced by :func:`encrypt`."""
    return _fernet().decrypt(ciphertext.encode()).decode()
