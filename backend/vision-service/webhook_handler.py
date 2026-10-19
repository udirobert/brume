"""
GitHub Webhook Handler for Brume
Handles automatic deployments and notifications
"""

import hmac
import hashlib
import json
import subprocess
import logging
from fastapi import Request, HTTPException, BackgroundTasks
from typing import Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

import os

# Webhook secret (set in environment)
WEBHOOK_SECRET = os.getenv("GITHUB_WEBHOOK_SECRET", "default-dev-secret-change-in-production")

def verify_signature(payload: bytes, signature: str) -> bool:
    """Verify GitHub webhook signature"""
    if not signature.startswith('sha256='):
        return False
    
    expected_signature = hmac.new(
        WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(f"sha256={expected_signature}", signature)

async def handle_push_event(payload: Dict[str, Any]) -> Dict[str, str]:
    """Handle push events for automatic deployment"""
    ref = payload.get('ref', '')
    repository = payload.get('repository', {}).get('name', '')
    
    # Only deploy on main/master branch
    if ref not in ['refs/heads/main', 'refs/heads/master']:
        return {"status": "ignored", "reason": "Not main branch"}
    
    logger.info(f"Push to {ref} in {repository} - triggering deployment")
    
    try:
        # Trigger deployment script
        result = subprocess.run(
            ['./deploy-hetzner.sh'],
            cwd='/opt/vision-service',
            capture_output=True,
            text=True,
            timeout=300
        )
        
        if result.returncode == 0:
            logger.info("Deployment successful")
            return {"status": "deployed", "message": "Deployment completed successfully"}
        else:
            logger.error(f"Deployment failed: {result.stderr}")
            return {"status": "failed", "error": result.stderr}
            
    except subprocess.TimeoutExpired:
        logger.error("Deployment timed out")
        return {"status": "failed", "error": "Deployment timed out"}
    except Exception as e:
        logger.error(f"Deployment error: {str(e)}")
        return {"status": "failed", "error": str(e)}

async def handle_pull_request_event(payload: Dict[str, Any]) -> Dict[str, str]:
    """Handle pull request events"""
    action = payload.get('action', '')
    pr_number = payload.get('number', '')
    
    logger.info(f"Pull request #{pr_number} {action}")
    
    # You can add PR-specific logic here
    # For example, running tests, creating preview deployments, etc.
    
    return {"status": "acknowledged", "action": action, "pr": pr_number}

async def process_webhook(request: Request, background_tasks: BackgroundTasks) -> Dict[str, Any]:
    """Main webhook processor"""
    try:
        # Get headers
        signature = request.headers.get('X-Hub-Signature-256', '')
        event_type = request.headers.get('X-GitHub-Event', '')
        
        # Get payload
        payload_bytes = await request.body()
        
        # Verify signature
        if not verify_signature(payload_bytes, signature):
            raise HTTPException(status_code=401, detail="Invalid signature")
        
        # Parse payload
        payload = json.loads(payload_bytes.decode())
        
        logger.info(f"Received {event_type} event")
        
        # Route to appropriate handler
        if event_type == 'push':
            result = await handle_push_event(payload)
        elif event_type == 'pull_request':
            result = await handle_pull_request_event(payload)
        else:
            result = {"status": "ignored", "event": event_type}
        
        return {
            "event": event_type,
            "timestamp": payload.get('head_commit', {}).get('timestamp', ''),
            "repository": payload.get('repository', {}).get('full_name', ''),
            "result": result
        }
        
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
    except Exception as e:
        logger.error(f"Webhook processing error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")