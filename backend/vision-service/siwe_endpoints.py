"""
SIWE (Sign-In with Ethereum) Endpoints

Provides a backend challenge-and-verify flow following EIP-4361.
- POST /api/siwe/challenge: issue a nonce and canonical SIWE message
- POST /api/siwe/verify: verify signature, consume nonce, optionally mint third-party JWT

Notes:
- Uses in-memory nonce store with TTL; production should use Redis or DB.
- Optionally signs a JWT using SUPABASE_JWT_SECRET env for third-party acceptance.
"""

import os
import time
import uuid
import logging
from typing import Dict, Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from eth_account import Account
from eth_account.messages import encode_defunct
from jose import jwt

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/siwe", tags=["siwe"])

# Simple in-memory nonce store; replace with Redis for production
NONCE_TTL_SECONDS = 300  # 5 minutes
nonce_store: Dict[str, Dict[str, Any]] = {}

class ChallengeRequest(BaseModel):
    address: str = Field(..., description="Ethereum address requesting SIWE challenge")
    chainId: Optional[int] = Field(default=1, description="EVM chain id, default 1")
    domain: Optional[str] = Field(default="brumeapp.netlify.app", description="Expected domain")
    uri: Optional[str] = Field(default="https://brumeapp.netlify.app", description="Login URI")
    statement: Optional[str] = Field(default="Sign-In with Ethereum to Brume", description="Optional statement")

class ChallengeResponse(BaseModel):
    message: str
    nonce: str
    issuedAt: str
    chainId: int
    domain: str
    uri: str

class VerifyRequest(BaseModel):
    message: str
    signature: str

class VerifyResponse(BaseModel):
    ok: bool
    address: str
    nonce: str
    siweVerified: bool
    thirdPartyJwt: Optional[str] = None


def build_siwe_message(domain: str, address: str, uri: str, chain_id: int, nonce: str, issued_at: str, statement: Optional[str]) -> str:
    """Construct canonical SIWE message (EIP-4361)."""
    # Minimal canonical format; additional fields like Expiration, Resources can be added later
    header = f"{domain} wants you to sign in with your Ethereum account:\n{address}\n\n"
    body = []
    if statement:
        body.append(f"{statement}\n")
    body.append(f"URI: {uri}\n")
    body.append("Version: 1\n")
    body.append(f"Chain ID: {chain_id}\n")
    body.append(f"Nonce: {nonce}\n")
    body.append(f"Issued At: {issued_at}")
    return header + "".join(body)


def parse_address_and_nonce_from_message(message: str) -> Dict[str, str]:
    """Extract address and nonce from SIWE message lines.
    This parser expects the canonical layout emitted by build_siwe_message.
    """
    lines = message.splitlines()
    if len(lines) < 6:
        raise HTTPException(status_code=400, detail="Malformed SIWE message")
    # Address is line 1 after header line
    # [0]: "<domain> wants you to sign..."
    # [1]: "<address>"
    address = lines[1].strip()
    nonce_line = next((l for l in lines if l.startswith("Nonce:")), None)
    if not nonce_line:
        raise HTTPException(status_code=400, detail="Nonce not found in message")
    nonce = nonce_line.split(":", 1)[1].strip()
    return {"address": address, "nonce": nonce}


@router.post("/challenge", response_model=ChallengeResponse)
async def issue_challenge(req: ChallengeRequest) -> ChallengeResponse:
    """Issue a SIWE challenge with nonce and canonical message."""
    # Basic address validation
    if not req.address or not req.address.startswith("0x") or len(req.address) != 42:
        raise HTTPException(status_code=400, detail="Invalid Ethereum address")

    nonce = uuid.uuid4().hex
    issued_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    message = build_siwe_message(
        domain=req.domain,
        address=req.address,
        uri=req.uri,
        chain_id=req.chainId or 1,
        nonce=nonce,
        issued_at=issued_at,
        statement=req.statement,
    )

    # Store nonce metadata for verification
    nonce_store[nonce] = {
        "address": req.address.lower(),
        "domain": req.domain,
        "uri": req.uri,
        "chainId": req.chainId or 1,
        "issuedAt": issued_at,
        "expiresAt": time.time() + NONCE_TTL_SECONDS,
        "used": False,
    }

    logger.info(f"SIWE challenge issued for {req.address} with nonce {nonce}")
    return ChallengeResponse(
        message=message,
        nonce=nonce,
        issuedAt=issued_at,
        chainId=req.chainId or 1,
        domain=req.domain,
        uri=req.uri,
    )


@router.post("/verify", response_model=VerifyResponse)
async def verify_signature(req: VerifyRequest) -> VerifyResponse:
    """Verify SIWE signature against stored nonce and message content."""
    try:
        parsed = parse_address_and_nonce_from_message(req.message)
        address = parsed["address"].lower()
        nonce = parsed["nonce"]

        # Check nonce exists and is unused and not expired
        meta = nonce_store.get(nonce)
        if not meta:
            raise HTTPException(status_code=400, detail="Unknown nonce")
        if meta["used"]:
            raise HTTPException(status_code=400, detail="Nonce already used")
        if time.time() > meta["expiresAt"]:
            # Cleanup
            nonce_store.pop(nonce, None)
            raise HTTPException(status_code=400, detail="Nonce expired")

        # Verify signature by recovering signer
        encoded = encode_defunct(text=req.message)
        recovered = Account.recover_message(encoded, signature=req.signature).lower()
        if recovered != address or recovered != meta["address"]:
            raise HTTPException(status_code=401, detail="Signature verification failed")

        # Consume nonce
        meta["used"] = True

        # Optionally mint a third-party JWT for Supabase acceptance
        third_party_jwt = None
        jwt_secret = os.getenv("SUPABASE_JWT_SECRET", "")
        if jwt_secret:
            # Minimal claims; adjust per Supabase third-party JWT config
            now = int(time.time())
            claims = {
                "sub": address,
                "role": "authenticated",
                "aud": "authenticated",
                "iss": "siwe",
                "iat": now,
                "exp": now + 3600,
            }
            third_party_jwt = jwt.encode(claims, jwt_secret, algorithm="HS256")

        logger.info(f"SIWE verified for {address} (nonce {nonce})")
        return VerifyResponse(
            ok=True,
            address=address,
            nonce=nonce,
            siweVerified=True,
            thirdPartyJwt=third_party_jwt,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"SIWE verify error: {e}")
        raise HTTPException(status_code=500, detail="Verification error")