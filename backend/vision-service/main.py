"""
Unified Backend Service
A reliable, server-grade service using FastAPI and MediaPipe.
Handles vision processing, face detection, landmark analysis, breathing pattern detection,
and AI-powered session analysis.
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks, Request, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from webhook_handler import process_webhook
from revenuecat_config import router as revenuecat_router
import cv2
import mediapipe as mp
import numpy as np
import base64
import io
from PIL import Image
import asyncio
import time
import logging
from dataclasses import dataclass
from collections import deque
import uuid
from datetime import datetime, timezone

# AI Analysis imports
import os
import json
import hashlib
import httpx
from pathlib import Path
import urllib.request
from contextlib import asynccontextmanager
from siwe_endpoints import router as siwe_router
from eth_account import Account
from eth_account.messages import encode_defunct

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Sentry initialization for production error tracking
SENTRY_DSN = os.getenv("SENTRY_DSN")
if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[FastApiIntegration()],
        traces_sample_rate=1.0,
        profiles_sample_rate=1.0,
        environment=os.getenv("APP_ENV", "production")
    )

logger = logging.getLogger(__name__)

# ENHANCEMENT FIRST: Environment-aware configuration
def get_models_dir() -> Path:
    """Get models directory based on environment - CLEAN separation of local vs production"""
    # Check if we're in Docker/production environment
    if (os.getenv("ENV") == "production" or 
        os.path.exists("/app") or 
        os.getenv("DOCKER_ENV") == "true"):
        return Path("/app/models")  # Docker/Hetzner production
    else:
        return Path("./models")     # Local development

# Production Configuration - ENHANCEMENT FIRST: Centralized config with environment support
CONFIG = {
    "models_dir": get_models_dir(),  # DRY: Single source of truth for models path
    "max_concurrent_sessions": int(os.getenv("MAX_CONCURRENT_SESSIONS", "10")),
    "model_download_on_start": os.getenv("MODEL_DOWNLOAD_ON_START", "true").lower() == "true",
    "session_timeout": 300,  # 5 minutes
    "max_image_size": 1920,
    "jpeg_quality": 85,
    # PERFORMANT: Dynamic port configuration
    "port": int(os.getenv("PORT", "8001")),  # Default to 8001 to match Docker
    "host": os.getenv("HOST", "0.0.0.0"),
    "lens_signer_key": os.getenv("LENS_SIGNER_KEY")
}

# MediaPipe model URLs for production deployment
MODEL_URLS = {
    "face_detection": "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
    "face_landmarks": "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
    "pose_estimation": "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task"
}

# Production Model Manager
class ModelManager:
    """Manages MediaPipe models with efficient loading and caching"""
    
    def __init__(self):
        self.face_detector = None
        self.face_landmarker = None
        self.pose_landmarker = None
        self.models_loaded = False
        
    async def download_models(self):
        """Download models to local storage"""
        CONFIG["models_dir"].mkdir(exist_ok=True)
        
        for model_name, url in MODEL_URLS.items():
            model_path = CONFIG["models_dir"] / f"{model_name}.tflite"
            if not model_path.exists():
                logger.info(f"Downloading {model_name} model...")
                try:
                    urllib.request.urlretrieve(url, model_path)
                    logger.info(f"Downloaded {model_name} to {model_path}")
                except Exception as e:
                    logger.error(f"Failed to download {model_name}: {e}")
                    raise
                    
    def load_models(self):
        """Load MediaPipe models"""
        try:
            # Face Detection
            face_detection_path = CONFIG["models_dir"] / "face_detection.tflite"
            if face_detection_path.exists():
                self.face_detector = mp.solutions.face_detection.FaceDetection(
                    model_selection=0,  # Short range model
                    min_detection_confidence=0.5
                )
            
            # Face Landmarks
            face_landmarks_path = CONFIG["models_dir"] / "face_landmarks.task"
            if face_landmarks_path.exists():
                base_options = mp.tasks.BaseOptions(
                    model_asset_path=str(face_landmarks_path)
                )
                options = mp.tasks.vision.FaceLandmarkerOptions(
                    base_options=base_options,
                    output_face_blendshapes=False,
                    output_facial_transformation_matrixes=False,
                    num_faces=1
                )
                self.face_landmarker = mp.tasks.vision.FaceLandmarker.create_from_options(options)
            
            # Pose Estimation  
            pose_path = CONFIG["models_dir"] / "pose_estimation.task"
            if pose_path.exists():
                base_options = mp.tasks.BaseOptions(
                    model_asset_path=str(pose_path)
                )
                options = mp.tasks.vision.PoseLandmarkerOptions(
                    base_options=base_options,
                    output_segmentation_masks=False,
                    num_poses=1
                )
                self.pose_landmarker = mp.tasks.vision.PoseLandmarker.create_from_options(options)
            
            self.models_loaded = True
            logger.info("All MediaPipe models loaded successfully")
            
        except Exception as e:
            logger.error(f"Failed to load models: {e}")
            raise

# Global model manager
model_manager: Optional[ModelManager] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management"""
    global model_manager
    
    # Startup
    logger.info("Starting Unified Backend Service...")
    model_manager = ModelManager()
    
    if CONFIG["model_download_on_start"]:
        try:
            await model_manager.download_models()
            model_manager.load_models()
        except Exception as e:
            logger.error(f"Failed to initialize models: {e}")
    
    # Start background tasks
    asyncio.create_task(cleanup_inactive_sessions())
    
    yield
    
    # Shutdown
    logger.info("Shutting down Unified Backend Service...")

app = FastAPI(
    title="Unified Backend Service",
    description="Server-grade vision processing and AI analysis for breathing sessions",
    version="2.0.0",
    lifespan=lifespan
)

# Include RevenueCat configuration router
app.include_router(revenuecat_router)
# Include SIWE authentication router
app.include_router(siwe_router)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4556",                    # Local development frontend
        "http://localhost:4567",                    # Alternative local port
        "https://brumeapp.netlify.app",      # Netlify mirror
        "https://brume.trustfall.xyz",       # Production domain
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)

# Request/Response Models
class VisionProcessingRequest(BaseModel):
    image_data: str  # base64 encoded image
    session_id: str
    timestamp: int
    breathing_phase: Optional[str] = None  # ENHANCEMENT: Track breathing phase
    options: Dict[str, bool] = {
        "detect_face": True,
        "analyze_posture": True,
        "track_breathing": True
    }

class FaceLandmark(BaseModel):
    x: float
    y: float
    z: float = 0.0

class VisionMetrics(BaseModel):
    confidence: float
    face_detected: bool
    posture_score: float
    movement_level: float
    breathing_rate: Optional[float] = None
    landmarks: List[FaceLandmark] = []
    processing_time_ms: float

class VisionProcessingResponse(BaseModel):
    success: bool
    metrics: Optional[VisionMetrics] = None
    error: Optional[str] = None
    session_id: str

# AI Analysis Models
class AIAnalysisRequest(BaseModel):
    provider: str
    session_data: Dict[str, Any]
    analysis_type: str = "session"

# Lens Session Signing Models
class SessionRecord(BaseModel):
    user_address: str
    pattern_name: str
    duration: int
    score: int
    timestamp: str

class SignedSessionResponse(BaseModel):
    payload: Dict[str, Any]
    signature: str

@app.post("/lens/sign-session", response_model=SignedSessionResponse)
async def sign_lens_session(record: SessionRecord):
    """
    Signs a breathing session record for Lens V3 Open Action.
    Verifiable proof that the session was completed in Brume.
    """
    if not CONFIG["lens_signer_key"]:
        # Fallback to a development key if not configured
        logger.warning("LENS_SIGNER_KEY not configured, using development fallback")
        dev_key = "0x" + "1" * 64
        signer_key = dev_key
    else:
        signer_key = CONFIG["lens_signer_key"]
    
    try:
        # Construct the payload
        payload = {
            "appId": "brume",
            "user": record.user_address,
            "pattern": record.pattern_name,
            "duration": record.duration,
            "score": record.score,
            "timestamp": record.timestamp,
            "nonce": uuid.uuid4().hex
        }
        
        # Serialize payload to string for signing
        message_str = json.dumps(payload, sort_keys=True)
        
        # Sign the message
        signer_account = Account.from_key(signer_key)
        message = encode_defunct(text=message_str)
        signed_message = Account.sign_message(message, private_key=signer_account.key)
        
        logger.info(f"Successfully signed session for user {record.user_address}")
        
        return SignedSessionResponse(
            payload=payload,
            signature=signed_message.signature.hex()
        )
    except Exception as e:
        logger.error(f"Failed to sign lens session: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Signing failure: {str(e)}")

class AIAnalysisResponse(BaseModel):
    success: bool
    provider: str
    analysis_type: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    cached: bool = False

# Core Vision Processor
@dataclass
class SessionState:
    """Track state for each session"""
    session_id: str
    last_landmarks: Optional[List[FaceLandmark]] = None
    landmark_history: deque = None
    breathing_history: deque = None
    movement_history: deque = None
    # Enhanced tracking for AI integration
    confidence_history: deque = None
    posture_history: deque = None
    created_at: float = 0.0

    def __post_init__(self):
        if self.landmark_history is None:
            self.landmark_history = deque(maxlen=30)  # 30 frames of history
        if self.breathing_history is None:
            self.breathing_history = deque(maxlen=100)  # breathing pattern history
        if self.movement_history is None:
            self.movement_history = deque(maxlen=50)  # movement history
        if self.confidence_history is None:
            self.confidence_history = deque(maxlen=50)  # confidence tracking
        if self.posture_history is None:
            self.posture_history = deque(maxlen=50)  # posture tracking
        if self.created_at == 0.0:
            self.created_at = time.time()
        
        # ENHANCEMENT: Phase correlation tracking for AI analysis
        self.phase_movement_map = {}  # breathing_phase -> [movement_values]
        self.temporal_snapshots = []  # minute-by-minute progression

    def add_frame_metrics(self, confidence: float, posture: float, movement: float, breathing: Optional[float] = None, phase: str = None):
        """Add metrics from a processed frame with phase correlation"""
        self.confidence_history.append(confidence)
        self.posture_history.append(posture)
        self.movement_history.append(movement)
        if breathing is not None:
            self.breathing_history.append(breathing)
        
        # ENHANCEMENT: Track movement by breathing phase
        if phase:
            if phase not in self.phase_movement_map:
                self.phase_movement_map[phase] = []
            self.phase_movement_map[phase].append(movement)
        
        # ENHANCEMENT: Temporal snapshots every 30 frames (~30 seconds at 1fps)
        if len(self.movement_history) % 30 == 0:
            self.temporal_snapshots.append({
                'timestamp': time.time() - self.created_at,
                'stillness': 100 - (movement * 100),
                'confidence': confidence
            })

    def get_enhanced_summary(self) -> Dict[str, Any]:
        """ENHANCEMENT: Rich session data for AI analysis"""
        base_summary = self.get_session_summary()
        
        # Phase-specific analysis
        phase_analysis = {}
        for phase, movements in self.phase_movement_map.items():
            if movements:
                phase_analysis[phase] = {
                    'avg_stillness': 100 - (sum(movements) / len(movements) * 100),
                    'consistency': max(0, 1 - (np.std(movements) if len(movements) > 1 else 0)),
                    'sample_count': len(movements)
                }
        
        return {
            **base_summary,
            'phase_analysis': phase_analysis,
            'temporal_progression': self.temporal_snapshots,
            'movement_pattern': {
                'peak_movement': max(self.movement_history) if self.movement_history else 0,
                'stability_trend': self._calculate_stability_trend()
            }
        }
    
    def _calculate_stability_trend(self) -> str:
        """Calculate if user is getting more or less stable over time"""
        if len(self.temporal_snapshots) < 2:
            return 'insufficient_data'
        
        first_half = self.temporal_snapshots[:len(self.temporal_snapshots)//2]
        second_half = self.temporal_snapshots[len(self.temporal_snapshots)//2:]
        
        first_avg = sum(s['stillness'] for s in first_half) / len(first_half)
        second_avg = sum(s['stillness'] for s in second_half) / len(second_half)
        
        if second_avg > first_avg + 5:
            return 'improving'
        elif second_avg < first_avg - 5:
            return 'declining'
        else:
            return 'stable'
    
    def get_session_summary(self) -> Dict[str, Any]:
        """Get aggregated session metrics for AI analysis"""
        duration = time.time() - self.created_at

        return {
            "session_id": self.session_id,
            "duration": duration,
            "total_frames": len(self.landmark_history),
            "avg_confidence": sum(self.confidence_history) / len(self.confidence_history) if self.confidence_history else 0,
            "avg_posture_score": sum(self.posture_history) / len(self.posture_history) if self.posture_history else 0,
            "avg_movement_level": sum(self.movement_history) / len(self.movement_history) if self.movement_history else 0,
            "avg_breathing_rate": sum(self.breathing_history) / len(self.breathing_history) if self.breathing_history else None,
            "stillness_percentage": sum(1 for m in self.movement_history if m < 0.2) / len(self.movement_history) * 100 if self.movement_history else 0,
            "consistency_score": self._calculate_consistency(),
        }

    def _calculate_consistency(self) -> float:
        """Calculate breathing consistency score"""
        if len(self.breathing_history) < 5:
            return 0.0

        # Calculate variance in breathing rate
        rates = list(self.breathing_history)
        mean_rate = sum(rates) / len(rates)
        variance = sum((r - mean_rate) ** 2 for r in rates) / len(rates)

        # Convert to consistency score (lower variance = higher consistency)
        consistency = max(0, 100 - (variance * 10))
        return min(100, consistency)

class VisionProcessor:
    """Core vision processing engine"""
    
    def __init__(self):
        """Initialize MediaPipe components"""
        self.face_mesh = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.6,
            min_tracking_confidence=0.5
        )
        
        self.face_detection = mp.solutions.face_detection.FaceDetection(
            model_selection=0,  # Use model optimized for faces within 2 meters
            min_detection_confidence=0.5
        )
        
        # Session management
        self.sessions: Dict[str, SessionState] = {}
        
        # Cleanup old sessions periodically
        self._cleanup_interval = 300  # 5 minutes
        self._last_cleanup = time.time()
        
    def _cleanup_old_sessions(self):
        """Remove sessions older than 1 hour"""
        current_time = time.time()
        if current_time - self._last_cleanup < self._cleanup_interval:
            return
            
        hour_ago = current_time - 3600
        old_sessions = [
            session_id for session_id, session in self.sessions.items()
            if session.created_at < hour_ago
        ]
        
        for session_id in old_sessions:
            del self.sessions[session_id]
            logger.info(f"Cleaned up old session: {session_id}")
            
        self._last_cleanup = current_time
    
    def _get_or_create_session(self, session_id: str) -> SessionState:
        """Get existing session or create new one"""
        self._cleanup_old_sessions()
        
        if session_id not in self.sessions:
            self.sessions[session_id] = SessionState(session_id=session_id)
            logger.info(f"Created new session: {session_id}")
            
        return self.sessions[session_id]
    
    def _decode_image(self, image_data: str) -> np.ndarray:
        """Decode base64 image to numpy array"""
        try:
            # Remove data:image/jpeg;base64, prefix if present
            if ',' in image_data:
                image_data = image_data.split(',')[1]
                
            # Decode base64
            image_bytes = base64.b64decode(image_data)
            
            # Convert to PIL Image then to numpy
            image = Image.open(io.BytesIO(image_bytes))
            
            # Convert to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')
                
            # Convert to numpy array
            return np.array(image)
            
        except Exception as e:
            logger.error(f"Failed to decode image: {e}")
            raise HTTPException(status_code=400, detail=f"Invalid image data: {e}")
    
    def _extract_landmarks(self, results) -> List[FaceLandmark]:
        """Extract landmarks from MediaPipe results"""
        if not results.multi_face_landmarks:
            return []
            
        landmarks = []
        face_landmarks = results.multi_face_landmarks[0]
        
        for landmark in face_landmarks.landmark:
            landmarks.append(FaceLandmark(
                x=landmark.x,
                y=landmark.y,
                z=landmark.z
            ))
            
        return landmarks
    
    def _calculate_movement_level(self, current_landmarks: List[FaceLandmark], 
                                session: SessionState) -> float:
        """Calculate movement level based on landmark displacement"""
        if not session.last_landmarks or not current_landmarks:
            return 0.0
            
        if len(current_landmarks) != len(session.last_landmarks):
            return 0.0
            
        # Calculate average displacement of key facial points
        # Use nose tip (index 1), chin (index 18), and forehead (index 10)
        key_indices = [1, 10, 18] if len(current_landmarks) > 18 else [0]
        
        total_displacement = 0.0
        valid_points = 0
        
        for idx in key_indices:
            if idx < len(current_landmarks) and idx < len(session.last_landmarks):
                current = current_landmarks[idx]
                previous = session.last_landmarks[idx]
                
                # Calculate 2D displacement (x, y)
                dx = current.x - previous.x
                dy = current.y - previous.y
                displacement = np.sqrt(dx**2 + dy**2)
                
                total_displacement += displacement
                valid_points += 1
        
        if valid_points == 0:
            return 0.0
            
        # Normalize movement level (scale to 0-1 range)
        avg_displacement = total_displacement / valid_points
        movement_level = min(avg_displacement * 100, 1.0)  # Scale and cap at 1.0
        
        # Store in history for trend analysis
        session.movement_history.append(movement_level)
        
        return movement_level
    
    def _calculate_posture_score(self, landmarks: List[FaceLandmark]) -> float:
        """Calculate posture score based on facial orientation"""
        if len(landmarks) < 20:
            return 0.0
            
        try:
            # Use key facial points to determine head pose
            # Nose tip, chin, forehead, left/right eye corners
            nose_tip = landmarks[1] if len(landmarks) > 1 else landmarks[0]
            
            # For now, use a simple metric based on nose position
            # In production, you'd use proper 3D pose estimation
            
            # Check if face is roughly centered and upright
            face_center_x = 0.5  # Expected center
            face_center_y = 0.4  # Expected Y position for good posture
            
            x_deviation = abs(nose_tip.x - face_center_x)
            y_deviation = abs(nose_tip.y - face_center_y)
            
            # Calculate posture score (1.0 = perfect, 0.0 = poor)
            posture_score = max(0.0, 1.0 - (x_deviation * 2 + y_deviation * 1.5))
            
            return min(posture_score, 1.0)
            
        except Exception as e:
            logger.error(f"Posture calculation error: {e}")
            return 0.0
    
    def _estimate_breathing_rate(self, landmarks: List[FaceLandmark], 
                               session: SessionState) -> Optional[float]:
        """Estimate breathing rate from nostril area changes"""
        if len(landmarks) < 30:
            return None
            
        try:
            # Use nostril landmarks to estimate breathing
            # This is a simplified approach - in production you'd use more sophisticated methods
            
            # Store current nostril area approximation
            nostril_area = self._calculate_nostril_area(landmarks)
            session.breathing_history.append(nostril_area)
            
            # Need at least 20 samples to estimate breathing rate
            if len(session.breathing_history) < 20:
                return None
                
            # Simple breathing rate estimation using variance in nostril area
            recent_history = list(session.breathing_history)[-20:]
            variance = np.var(recent_history)
            
            # Estimate breathing rate based on variance (this is simplified)
            # In production, you'd use proper signal processing
            estimated_rate = max(8.0, min(20.0, 12.0 + variance * 100))
            
            return estimated_rate
            
        except Exception as e:
            logger.error(f"Breathing rate estimation error: {e}")
            return None
    
    def _calculate_nostril_area(self, landmarks: List[FaceLandmark]) -> float:
        """Calculate approximate nostril area"""
        try:
            # This is a simplified calculation
            # In production, you'd use proper nostril landmark detection
            nose_tip = landmarks[1] if len(landmarks) > 1 else landmarks[0]
            return nose_tip.y  # Simplified metric
        except:
            return 0.0
    
    async def process_frame(self, request: VisionProcessingRequest) -> VisionProcessingResponse:
        """Process a single frame and return vision metrics"""
        start_time = time.time()
        
        try:
            # Get or create session
            session = self._get_or_create_session(request.session_id)
            
            # Decode image
            image = self._decode_image(request.image_data)
            
            # Convert BGR to RGB for MediaPipe
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # Process with MediaPipe
            results = self.face_mesh.process(rgb_image)
            
            # Initialize metrics
            metrics = VisionMetrics(
                confidence=0.0,
                face_detected=False,
                posture_score=0.0,
                movement_level=0.0,
                processing_time_ms=0.0
            )
            
            if results.multi_face_landmarks and len(results.multi_face_landmarks) > 0:
                # Extract landmarks
                landmarks = self._extract_landmarks(results)
                
                if landmarks:
                    metrics.face_detected = True
                    metrics.confidence = 0.9  # MediaPipe doesn't provide confidence
                    metrics.landmarks = landmarks
                    
                    # Calculate movement level
                    if request.options.get("detect_face", True):
                        metrics.movement_level = self._calculate_movement_level(landmarks, session)
                    
                    # Calculate posture score
                    if request.options.get("analyze_posture", True):
                        metrics.posture_score = self._calculate_posture_score(landmarks)
                    
                    # Estimate breathing rate
                    if request.options.get("track_breathing", True):
                        metrics.breathing_rate = self._estimate_breathing_rate(landmarks, session)
                    
                    # Update session state
                    session.last_landmarks = landmarks
                    session.landmark_history.append(landmarks)

                    # Track metrics for session summary (ENHANCEMENT FIRST)
                    session.add_frame_metrics(
                        confidence=metrics.confidence,
                        posture=metrics.posture_score,
                        movement=metrics.movement_level,
                        breathing=metrics.breathing_rate,
                        phase=request.breathing_phase  # ENHANCEMENT: Phase correlation
                    )

            # Calculate processing time
            processing_time = (time.time() - start_time) * 1000  # Convert to milliseconds
            metrics.processing_time_ms = processing_time
            
            return VisionProcessingResponse(
                success=True,
                metrics=metrics,
                session_id=request.session_id
            )
            
        except Exception as e:
            logger.error(f"Frame processing error: {e}")
            return VisionProcessingResponse(
                success=False,
                error=str(e),
                session_id=request.session_id
            )

# Global processor instance
vision_processor = VisionProcessor()

# Background task for session cleanup
async def cleanup_inactive_sessions():
    """Background task to clean up inactive sessions"""
    while True:
        try:
            current_time = time.time()
            inactive_sessions = []
            
            # Check VisionProcessor sessions
            if 'vision_processor' in globals() and hasattr(vision_processor, 'sessions'):
                for session_id, session in vision_processor.sessions.items():
                    if current_time - session.created_at > CONFIG["session_timeout"]:
                        inactive_sessions.append(session_id)
                
                for session_id in inactive_sessions:
                    if session_id in vision_processor.sessions:
                        logger.info(f"Cleaning up inactive session: {session_id}")
                        del vision_processor.sessions[session_id]
            
            # Clean up every 60 seconds
            await asyncio.sleep(60)
            
        except Exception as e:
            logger.error(f"Error in cleanup task: {e}")
            await asyncio.sleep(60)

# PERFORMANT: Enhanced caching for AI responses
ai_response_cache = {}

# AGGRESSIVE CONSOLIDATION: Removed redundant AI_CONFIG and create_session_prompt
# All AI configuration is now handled in cerebras_client.py

async def process_ai_analysis(request: AIAnalysisRequest) -> AIAnalysisResponse:
    """ENHANCEMENT FIRST: Unified AI analysis with multiple provider integration"""
    try:
        # Get enhanced session data if available
        session_id = request.session_data.get('visionSessionId')
        enhanced_data = None
        
        if session_id and session_id in vision_processor.sessions:
            session = vision_processor.sessions[session_id]
            enhanced_data = session.get_enhanced_summary()
            logger.info(f"Enhanced session data for {session_id}: {len(enhanced_data.get('phase_analysis', {}))} phases")
        
        # Route to appropriate provider
        provider = request.provider.lower()
        result = None
        used_provider = provider

        try:
            if provider == "google":
                from gemini_client import analyze_breathing_session as analyze_gemini, is_available as gemini_available
                if gemini_available():
                    result = await analyze_gemini(enhanced_data or request.session_data, request.session_data)
                else:
                    logger.warning("Google Gemini requested but not available, falling back")
            
            elif provider == "openai":
                from openai_client import analyze_breathing_session as analyze_openai, is_available as openai_available
                if openai_available():
                    result = await analyze_openai(enhanced_data or request.session_data, request.session_data)
                else:
                    logger.warning("OpenAI requested but not available, falling back")

            # Default/Fallback to Cerebras or first available
            if result is None:
                from cerebras_client import analyze_breathing_session as analyze_cerebras, is_available as cerebras_available
                if cerebras_available():
                    result = await analyze_cerebras(enhanced_data or request.session_data, request.session_data)
                    used_provider = "cerebras"
                else:
                    logger.warning("Cerebras not available")

            # If still None, we'll fall through to mock
            if result:
                # ENHANCEMENT FIRST: Transform response to match frontend expectations
                # Note: The mapping here may need adjustment based on each provider's output
                transformed_result = {
                    "analysis": result.get("analysis") or result.get("encouragement") or "Analysis complete.",
                    "suggestions": result.get("suggestions") or [
                        result.get("phaseInsights", {}).get("inhale", "Focus on smooth inhalation"),
                        result.get("phaseInsights", {}).get("exhale", "Practice controlled exhalation"),
                        result.get("phaseInsights", {}).get("hold", "Maintain comfortable breath holds")
                    ],
                    "score": result.get("score") or {
                        "overall": result.get("overallScore", 85),
                        "focus": result.get("phaseInsights", {}).get("inhaleScore", result.get("overallScore", 75)),
                        "consistency": result.get("consistencyScore", result.get("overallScore", 75)), 
                        "progress": result.get("progressScore", result.get("overallScore", 75))
                    },
                    "nextSteps": result.get("nextSteps") or [
                        "Continue regular practice",
                        "Try longer sessions gradually",
                        "Focus on consistency"
                    ]
                }
                
                return AIAnalysisResponse(
                    success=True,
                    provider=used_provider,
                    analysis_type=request.analysis_type,
                    result=transformed_result,
                    cached=False
                )

        except Exception as e:
            logger.warning(f"AI Provider {provider} failed: {e}")
            # Fall through to fallback
        
        # PERFORMANT: Fallback to mock response with actual session data
        session_data = request.session_data
        pattern_name = session_data.get('patternName', 'Breathing Session')
        session_duration = session_data.get('sessionDuration', 0)
        restlessness_score = session_data.get('restlessnessScore')
        cycle_count = session_data.get('cycleCount', 0)
        target_cycles = session_data.get('targetCycles', 10)
        
        # Calculate stillness score correctly
        stillness_score = 100 - restlessness_score if restlessness_score is not None else 70
        
        # Calculate completion rate
        completion_rate = (cycle_count / target_cycles * 100) if target_cycles > 0 else 0
        
        # Generate personalized analysis based on actual session data
        if completion_rate >= 80:
            performance_comment = "Excellent cycle completion shows strong focus and endurance."
        elif completion_rate >= 60:
            performance_comment = "Good cycle completion rate with room for building endurance."
        else:
            performance_comment = "Developing cycle completion - consider setting more achievable targets."
        
        if stillness_score >= 80:
            stillness_comment = "Exceptional stillness demonstrates advanced body awareness."
        elif stillness_score >= 70:
            stillness_comment = "Good stillness control shows developing mind-body connection."
        else:
            stillness_comment = "Focus on finding a comfortable, stable position to improve stillness."
        
        result = {
            "analysis": f"Excellent session analysis! Your {pattern_name} shows good control and focus. {performance_comment} {stillness_comment}",
            "encouragement": f"Great job on your {pattern_name} practice! Based on your actual data: {stillness_score}% stillness and {cycle_count} cycles completed.",
            "suggestions": [
                "Great breathing consistency!" if stillness_score >= 70 else "Try to minimize movement for better focus",
                "Try extending your session duration" if session_duration < 300 else "Maintain your good session length",
                "Focus on relaxing your shoulders" if stillness_score < 75 else "Keep up the good posture work"
            ],
            "score": {
                "overall": min(100, max(30, int((stillness_score + completion_rate + (session_duration/600*100 if session_duration else 50))/3))),
                "focus": min(100, max(30, stillness_score)),
                "consistency": min(100, max(30, completion_rate)),
                "progress": min(100, max(30, cycle_count * 10))  # Simple progression based on cycles
            },
            "nextSteps": [
                "Practice daily for 10 minutes" if session_duration < 600 else "Maintain your consistent practice",
                f"Try to complete {min(target_cycles + 2, 20)} cycles next time" if completion_rate < 80 else "Increase cycle targets gradually",
                "Focus on posture and stillness" if stillness_score < 70 else "Continue developing your stillness"
            ]
        }

        return AIAnalysisResponse(
            success=True,
            provider="fallback",
            analysis_type=request.analysis_type,
            result=result,
            cached=False
        )

    except Exception as e:
        logger.error(f"AI analysis failed: {e}")
        return AIAnalysisResponse(
            success=False,
            provider=request.provider,
            analysis_type=request.analysis_type,
            error=str(e)
        )

# API Endpoints
@app.post("/api/vision/process", response_model=VisionProcessingResponse)
async def process_vision(request: VisionProcessingRequest):
    """Process a single frame for vision analysis"""
    return await vision_processor.process_frame(request)

@app.get("/api/vision/sessions/{session_id}/summary")
async def get_session_summary(session_id: str):
    """Get aggregated vision metrics for AI analysis (ENHANCEMENT FIRST + PERFORMANT)"""
    session = vision_processor.sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # PERFORMANT: Cache session summaries to avoid redundant calculations
    cache_key = f"session_summary_{session_id}"
    if cache_key in ai_response_cache:
        cached_data = ai_response_cache[cache_key]
        if time.time() - cached_data["timestamp"] < 60:  # 1 minute cache
            logger.info(f"Returning cached session summary for {session_id}")
            return cached_data["result"]

    summary = session.get_session_summary()

    # Cache the summary
    ai_response_cache[cache_key] = {
        "result": summary,
        "timestamp": time.time()
    }

    logger.info(f"Session summary for {session_id}: {summary}")
    return summary

# AGGRESSIVE CONSOLIDATION: Single session management endpoint
@app.delete("/api/vision/session/{session_id}")
@app.post("/api/vision/session/{session_id}/stop")
async def manage_session(session_id: str):
    """CLEAN: Unified session management - stop/cleanup session"""
    if session_id in vision_processor.sessions:
        del vision_processor.sessions[session_id]
        logger.info(f"Session {session_id} stopped and cleaned up")
        return {"success": True, "message": f"Session {session_id} cleaned up", "session_id": session_id}
    else:
        raise HTTPException(status_code=404, detail="Session not found")

@app.get("/api/vision/sessions")
async def list_sessions():
    """ORGANIZED: Single endpoint for session listing"""
    current_time = time.time()
    sessions_info = []
    
    for session_id, session in vision_processor.sessions.items():
        sessions_info.append({
            "session_id": session_id,
            "created_at": session.created_at,
            "duration": current_time - session.created_at,
            "frame_count": len(session.landmark_history),
            "is_active": (current_time - session.created_at) < CONFIG["session_timeout"]
        })
    
    return {
        "sessions": sessions_info,
        "active_sessions": list(vision_processor.sessions.keys()),
        "session_count": len(vision_processor.sessions),
        "active_count": len([s for s in sessions_info if s["is_active"]])
    }

# AGGRESSIVE CONSOLIDATION: Single unified AI analysis endpoint
@app.post("/api/ai-analysis", response_model=AIAnalysisResponse)
async def ai_analysis(request: AIAnalysisRequest):
    """DRY: Unified AI analysis endpoint with automatic Cerebras integration"""
    logger.info(f"AI analysis request: {request.provider} {request.analysis_type}")
    return await process_ai_analysis(request)

# ADD STREAMING ENDPOINT
@app.post("/api/ai-analysis-stream")
async def ai_analysis_streaming(request: AIAnalysisRequest):
    """Streaming AI analysis endpoint with automatic Cerebras integration"""
    logger.info(f"Streaming AI analysis request: {request.provider} {request.analysis_type}")
    
    # Import streaming function
    try:
        from cerebras_client import analyze_breathing_session_streaming, is_available as cerebras_available
        
        # Get enhanced session data if available
        session_id = request.session_data.get('visionSessionId')
        enhanced_data = None
        
        if session_id and session_id in vision_processor.sessions:
            session = vision_processor.sessions[session_id]
            enhanced_data = session.get_enhanced_summary()
            logger.info(f"Enhanced session data for {session_id}: {len(enhanced_data.get('phase_analysis', {}))} phases")
        
        # Use streaming if Cerebras is available
        if cerebras_available() and enhanced_data:
            return StreamingResponse(
                stream_analysis_response(enhanced_data, request.session_data),
                media_type="text/event-stream"
            )
        else:
            # Fallback to regular response if streaming not available
            result = await process_ai_analysis(request)
            return result
            
    except Exception as e:
        logger.error(f"Streaming AI analysis failed: {e}")
        # Fallback to regular response on error
        return await process_ai_analysis(request)

async def stream_analysis_response(enhanced_data: dict, session_data: dict):
    """Stream the AI analysis response"""
    try:
        from cerebras_client import analyze_breathing_session_streaming
        
        # Stream the response
        async for chunk in analyze_breathing_session_streaming(enhanced_data, session_data):
            yield f"data: {chunk}\n\n"
            
        # Send completion message
        yield "data: [DONE]\n\n"
        
    except Exception as e:
        logger.error(f"Error in streaming response: {e}")
        yield f"data: {{\"error\": \"{str(e)}\"}}\n\n"

# Proof-of-Practice Attestation Models
class AttestationRequest(BaseModel):
    session_id: str
    wallet_address: str
    breath_rate: Optional[float] = None
    session_score: Optional[float] = None
    duration_seconds: Optional[int] = None
    # NOTE: the `verified` field was removed — verification is established
    # server-side from the vision processor's session store, not trusted
    # from the client. See attest_practice() below.
    #
    # NOTE: `session_score` is likewise IGNORED — the score is computed
    # server-side from the session's own breathing data, and `wallet_address`
    # must be the Flow address that will submit the on-chain transaction
    # (the contract binds it into the co-signature payload).

class PracticeMetrics(BaseModel):
    breath_rate: Optional[float] = None
    session_score: Optional[float] = None
    duration_seconds: Optional[int] = None

class ProofOfPracticeCredential(BaseModel):
    type: str = "ProofOfPractice"
    sessionId: str
    subject: str  # wallet address of the practitioner
    issuedAt: str  # ISO8601 UTC
    metrics: PracticeMetrics

class ChainAttestation(BaseModel):
    status: str  # "pending_chain" | "issued"
    txId: Optional[str] = None
    network: str = "flow-testnet"

class VerifierCoSignature(BaseModel):
    """Backend co-signature proving the session was server-verified.
    The client passes these to the Flow transaction; the contract checks
    the signature against the authorized verifier account's public key."""
    verifier_address: str
    verifier_signature_hex: str
    signed_data_hex: str

class AttestationResponse(BaseModel):
    success: bool
    credential: ProofOfPracticeCredential
    attestation: ChainAttestation
    verifier_signature: Optional[VerifierCoSignature] = None

async def mint_flow_attestation(credential: ProofOfPracticeCredential) -> Optional[str]:
    """
    Server-side minting is intentionally unsupported.

    Architecture: the backend verifies and records the attestation; the CHAIN
    WRITE is user-initiated from the client (src/lib/flow/attest-practice.ts →
    cadence/contracts/PracticeCredential.cdc), because keys never leave the
    user's device (see PrivacyPolicy). This service therefore always reports
    "pending_chain" — the client resolves on-chain status after self-issuing.

    Returns None by design; kept as a named seam in case a future verifier
    co-signing flow needs it.
    """
    logger.info(f"Flow minting stub: credential for session {credential.sessionId} not yet submitted to chain")
    return None

# --- Verifier co-signature (Flow-compatible) ---------------------------------
#
# The PracticeCredential contract verifies this signature on-chain with
# Cadence `PublicKey.verify(signature:, signedData:, domainSeparationTag:,
# hashAlgorithm:)`. Flow's tagged hashing (flow-go `NewPrefixedHashing`) is
#
#     digest = SHA3_256( pad32(tag) || signedData )
#
# where the tag is ZERO-PADDED to 32 bytes (flow.DomainTagLength) — verified
# end-to-end against a Flow emulator. The signature is raw r||s (64 bytes)
# over ECDSA/secp256k1, and the verifier's public key must be registered on
# the Flow account at BRUME_VERIFIER_ADDRESS (see docs/RUNBOOK.md).
# EIP-191/Ethereum personal-message signing does NOT verify on Flow and was
# removed. The tag must stay <= 32 chars or Flow rejects it.
VERIFIER_DOMAIN_TAG = "Brume-PracticeCredential-v1"
_FLOW_DOMAIN_TAG_LENGTH = 32


def _normalize_flow_address(address: str) -> str:
    """Canonicalize a Flow address to 0x + 16 lowercase hex chars.

    The canonical form matters: the contract reconstructs the signed payload
    using `subject.toString()`, which renders the full 16-hex form.
    """
    a = address.strip().lower()
    if a.startswith("0x"):
        a = a[2:]
    if not a or len(a) > 16 or any(c not in "0123456789abcdef" for c in a):
        raise HTTPException(
            status_code=400,
            detail="wallet_address must be a Flow address (0x + up to 16 hex chars); "
                   "it must be the address that submits the on-chain transaction.",
        )
    return "0x" + a.rjust(16, "0")


def _ufix64_str(value: float) -> str:
    """Render a score the way Cadence `UFix64.toString()` does: ALWAYS eight
    decimal places (verified on emulator: 87.5 -> "87.50000000"). Scores are
    rounded to one decimal first; the fixed rendering keeps the backend's
    signed bytes and the contract's reconstructed payload byte-identical."""
    return f"{round(value, 1):.8f}"


def _flow_verifier_sign(private_key_hex: str, payload: bytes) -> str:
    """ECDSA/secp256k1 signature over SHA3-256(pad32(tag) || payload), raw r||s."""
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives.asymmetric import utils as ec_utils

    if len(VERIFIER_DOMAIN_TAG) > _FLOW_DOMAIN_TAG_LENGTH:
        raise ValueError("verifier domain tag exceeds Flow's 32-byte domain tag limit")
    padded_tag = VERIFIER_DOMAIN_TAG.encode("utf-8").ljust(_FLOW_DOMAIN_TAG_LENGTH, b"\x00")

    key_int = int(private_key_hex.removeprefix("0x"), 16)
    priv = ec.derive_private_key(key_int, ec.SECP256K1())
    der = priv.sign(padded_tag + payload, ec.ECDSA(hashes.SHA3_256()))
    r, s = ec_utils.decode_dss_signature(der)
    return (r.to_bytes(32, "big") + s.to_bytes(32, "big")).hex()

@app.post("/api/attest", response_model=AttestationResponse)
async def attest_practice(request: AttestationRequest):
    """Issue a ProofOfPractice attestation for a camera-verified breathwork session.

    Security: the `verified` flag in the request body is IGNORED. Verification
    is established server-side by checking that the session accumulated real
    camera data in the vision processor's session store (breathing history +
    confidence frames). An attestation cannot be minted by a bare curl call.
    The score is likewise computed server-side, and the co-signature binds the
    submitter's Flow address, so neither can be forged by the client.
    """
    # Server-side verification: the session must exist and have real camera data.
    # The client's `verified` flag is deliberately not trusted.
    session = vision_processor.sessions.get(request.session_id)
    if session is None:
        raise HTTPException(
            status_code=400,
            detail="Cannot attest: session not found in vision processor. "
                   "Camera verification must have occurred for this session_id.",
        )

    breathing_frames = len(session.breathing_history) if session.breathing_history else 0
    confidence_frames = len(session.confidence_history) if session.confidence_history else 0
    min_required_frames = 10  # enough frames to constitute a real session

    if breathing_frames < min_required_frames and confidence_frames < min_required_frames:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot attest unverified practice: session {request.session_id} "
                   f"has only {breathing_frames} breathing frames / {confidence_frames} "
                   f"confidence frames (minimum {min_required_frames} required).",
        )

    # Pull measured metrics from the session store when the client didn't supply them
    breath_rate = request.breath_rate
    if breath_rate is None and session.breathing_history:
        breath_rate = round(
            sum(session.breathing_history) / len(session.breathing_history), 2
        )

    # Score integrity: computed server-side from the session's own breathing
    # data (same formula the vision pipeline reports live). The client's
    # `session_score` is deliberately ignored — a verified session must not
    # be able to claim an arbitrary score.
    session_score = round(session._calculate_consistency(), 1)

    # The co-signature binds the submitter's Flow address — normalize it so
    # the signed bytes match the contract's `subject.toString()` rendering.
    subject_address = _normalize_flow_address(request.wallet_address)

    credential = ProofOfPracticeCredential(
        sessionId=request.session_id,
        subject=subject_address,
        issuedAt=datetime.now(timezone.utc).isoformat(),
        metrics=PracticeMetrics(
            breath_rate=breath_rate,
            session_score=session_score,
            duration_seconds=request.duration_seconds
        )
    )

    # Chain minting is best-effort: attestation issuance must not fail if the chain is unavailable
    try:
        tx_id = await mint_flow_attestation(credential)
    except Exception as e:
        logger.error(f"Flow attestation minting failed for session {request.session_id}: {e}")
        tx_id = None

    logger.info(f"ProofOfPractice attestation issued for session {request.session_id} (subject {request.wallet_address})")

    # Produce a verifier co-signature over the attestation payload. The contract
    # checks this signature on-chain to prove the backend (an authorized verifier)
    # attested the session — preventing self-issuance.
    verifier_cosig = None
    verifier_key = os.environ.get("BRUME_VERIFIER_KEY")
    verifier_address = os.environ.get("BRUME_VERIFIER_ADDRESS", "")
    if verifier_key and verifier_address:
        try:
            # Canonical payload — must match byte-for-byte what the contract
            # reconstructs: sessionId || subject.toString() || score.toString()
            # (see PracticeCredential.attest). Score uses the server-computed
            # value, rendered as Cadence UFix64.toString() would.
            signed_data_str = (
                f"{request.session_id}{subject_address}{_ufix64_str(session_score)}"
            )
            signed_data_bytes = signed_data_str.encode("utf-8")
            signature_hex = _flow_verifier_sign(verifier_key, signed_data_bytes)
            verifier_cosig = VerifierCoSignature(
                verifier_address=_normalize_flow_address(verifier_address),
                verifier_signature_hex=signature_hex,
                signed_data_hex=signed_data_bytes.hex(),
            )
            logger.info(f"Verifier co-signature produced for session {request.session_id}")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to produce verifier co-signature: {e}")
    else:
        logger.warning(
            "BRUME_VERIFIER_KEY / BRUME_VERIFIER_ADDRESS not set — "
            "attestation issued without on-chain co-signature (contract will reject)"
        )

    return AttestationResponse(
        success=True,
        credential=credential,
        attestation=ChainAttestation(
            status="issued" if tx_id else "pending_chain",
            txId=tx_id
        ),
        verifier_signature=verifier_cosig
    )


# Session verification status — lets the MCP server (and other clients) query
# whether a session accumulated real camera data, without trusting a client flag.
class SessionVerifyResponse(BaseModel):
    session_id: str
    verified: bool
    breathing_frames: int
    confidence_frames: int
    breath_rate: Optional[float] = None

@app.get("/api/session/{session_id}/verify-status", response_model=SessionVerifyResponse)
async def get_session_verify_status(session_id: str):
    """Return whether a session has enough camera data to be considered verified."""
    session = vision_processor.sessions.get(session_id)
    breathing_frames = len(session.breathing_history) if session and session.breathing_history else 0
    confidence_frames = len(session.confidence_history) if session and session.confidence_history else 0
    min_required = 10
    breath_rate = None
    if session and session.breathing_history:
        breath_rate = round(sum(session.breathing_history) / len(session.breathing_history), 2)
    return SessionVerifyResponse(
        session_id=session_id,
        verified=breathing_frames >= min_required or confidence_frames >= min_required,
        breathing_frames=breathing_frames,
        confidence_frames=confidence_frames,
        breath_rate=breath_rate,
    )


# AGGRESSIVE CONSOLIDATION: Single health check endpoint
@app.get("/health")
async def health_check():
    """ENHANCED: Health check with Cerebras status"""
    # CLEAN: Import Cerebras status
    try:
        from cerebras_client import get_status as cerebras_status
        ai_status = cerebras_status()
    except ImportError:
        ai_status = {"available": False, "error": "cerebras_client not found"}
    
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "port": CONFIG["port"],
        "services": {
            "vision": "active",
            "ai_analysis": "active" if ai_status.get("available") else "fallback",
            "webhook": "active"
        },
        "ai_integration": ai_status,
        "active_sessions": len(vision_processor.sessions)
    }

@app.post("/webhook/github")
async def github_webhook(request: Request, background_tasks: BackgroundTasks):
    """GitHub webhook endpoint for automatic deployments"""
    return await process_webhook(request, background_tasks)

if __name__ == "__main__":
    import uvicorn
    # ENHANCEMENT FIRST: Use centralized config for consistency
    uvicorn.run(app, host=CONFIG["host"], port=CONFIG["port"])
