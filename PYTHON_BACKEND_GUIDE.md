
# Guide: Creating a Python Backend for VoiceForge Studio with coqui-ai/TTS

This guide outlines how to create a Python backend service that integrates with the VoiceForge Studio Next.js application. This service will handle Text-to-Speech (TTS) generation and voice model training using the `coqui-ai/TTS` library.

## 1. Overview

The Next.js application makes API calls to two main endpoints on this Python service:
*   `/api/tts`: For generating speech from text using a specified voice, speed, and variability.
*   `/api/train-voice`: For training a new voice model from a user-provided audio sample.

The Python service will:
*   Receive requests from the Next.js frontend.
*   Use `coqui-ai/TTS` to perform the requested operations.
*   Return results (audio data or training status) in JSON format.

## 2. Technology Stack

*   **Python**: Version 3.8+ recommended.
*   **Web Framework**: We recommend **FastAPI** for its modern features, speed, and automatic data validation with Pydantic (which aligns well with Zod used in the Next.js app). Flask is also a viable option. This guide will use FastAPI examples.
*   **TTS Library**: `TTS` from Coqui AI (`pip install TTS`).
*   **Audio Handling**: You might need libraries like `pydub` for audio format conversion if necessary, though `TTS` handles many common formats.
*   **Base64 Encoding**: Python's built-in `base64` module.

## 3. Setup and Installation

1.  **Create a Python virtual environment:**
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    ```

2.  **Install necessary libraries:**
    ```bash
    pip install fastapi "uvicorn[standard]" TTS pydantic
    # Optional, if you need advanced audio manipulation:
    # pip install pydub
    ```
    *   `fastapi`: The web framework.
    *   `uvicorn`: An ASGI server to run FastAPI.
    *   `TTS`: The Coqui TTS library.
    *   `pydantic`: For data validation (comes with FastAPI).

## 4. API Endpoint Implementation

Create a Python file (e.g., `main.py`).

### 4.1. Boilerplate and Helper Functions

```python
import base64
import io
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field # Field for validation constraints
from typing import Optional, Dict
import os
import uuid
import shutil
from TTS.api import TTS as CoquiTTS # Renamed to avoid conflict if TTS is used as a type hint

# --- Configuration ---
MODEL_STORAGE_PATH = "trained_models" # Directory to save trained models and reference audio
os.makedirs(MODEL_STORAGE_PATH, exist_ok=True)

# --- Pydantic Models (matching Zod schemas in Next.js) ---

class TTSRequest(BaseModel):
    text: str
    voiceId: str
    speed: Optional[float] = Field(1.0, ge=0.5, le=2.0)
    # Variability is not directly supported by XTTS in a simple numeric way.
    # This field is kept for schema consistency but might be ignored or mapped differently.
    variability: Optional[float] = Field(0.5, ge=0.0, le=1.0)

class TTSResponse(BaseModel):
    audioDataUri: str

class TrainVoiceRequest(BaseModel):
    modelName: str
    audioDataUri: str # format: 'data:<mimetype>;base64,<encoded_data>'

class TrainVoiceResponse(BaseModel):
    trainingStatus: str
    modelId: Optional[str] = None

# --- TTS Instance ---
# Initialize Coqui TTS. XTTS-v2 is recommended for its quality and voice cloning.
# Models are usually downloaded on first use.
# Set gpu=True if you have a compatible GPU and CUDA setup for faster inference.
try:
    # Using XTTS V2. Ensure this model_name is current with Coqui's library.
    tts_instance = CoquiTTS(model_name="tts_models/multilingual/multi-dataset/xtts_v2", progress_bar=True, gpu=False)
    print("Coqui TTS (XTTS-v2) model loaded successfully.")
except Exception as e:
    print(f"Error loading Coqui TTS model: {e}")
    print("Please ensure you have the correct Coqui TTS version and model name for XTTS-v2.")
    print("The service will not be able to perform TTS without a loaded model.")
    tts_instance = None # Gracefully handle if model loading fails

def decode_data_uri(data_uri: str) -> tuple[bytes, str]:
    """Decodes a base64 data URI into bytes and detects the MIME type."""
    try:
        header, encoded = data_uri.split(',', 1)
        mime_type = header.split(';')[0].split(':')[1]
        data = base64.b64decode(encoded)
        return data, mime_type
    except Exception as e:
        print(f"Error decoding data URI: {data_uri[:100]}... - {e}")
        raise ValueError(f"Invalid data URI format: {e}")

def encode_audio_to_data_uri(audio_bytes: bytes, mime_type: str = "audio/wav") -> str:
    """Encodes audio bytes into a base64 data URI."""
    encoded_data = base64.b64encode(audio_bytes).decode('utf-8')
    return f"data:{mime_type};base64,{encoded_data}"

app = FastAPI()

# --- CORS (Cross-Origin Resource Sharing) ---
# Important for local development when frontend and backend are on different ports.
origins = [
    "http://localhost:9002", # Your Next.js app's default port
    "http://127.0.0.1:9002",
    # Add other origins if needed for deployment
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods
    allow_headers=["*"], # Allows all headers
)
```

### 4.2. TTS Endpoint (`/api/tts`)

```python
@app.post("/api/tts", response_model=TTSResponse)
async def generate_tts_endpoint(request: TTSRequest):
    if not tts_instance:
        raise HTTPException(status_code=503, detail="TTS model is not available or failed to load.")

    try:
        print(f"TTS Request: VoiceID='{request.voiceId}', Speed={request.speed}, Text='{request.text[:50]}...'")

        speaker_wav_for_tts = None
        # Language setting for XTTS (ISO 639-1 code, e.g., "en", "ru")
        # This should ideally come from the frontend or be detected. Defaulting to "ru".
        language = "ru"

        if request.voiceId.startswith("default-"):
            # For default voices, XTTS might use its internal default speaker if speaker_wav is None.
            # Or, you can provide paths to high-quality generic speaker WAV files here.
            # e.g., if request.voiceId == "default-male": speaker_wav_for_tts = "path/to/your/default_male.wav"
            print(f"Using XTTS default speaker for voiceId: {request.voiceId}")
        else:
            # Custom trained voice: voiceId is the modelId (folder name).
            # XTTS uses a reference audio file from the training for cloning.
            # We assume a `reference.wav` (or mp3 etc.) was saved during training.
            custom_voice_folder = os.path.join(MODEL_STORAGE_PATH, request.voiceId)
            # Look for common audio file extensions
            for ext in ["wav", "mp3", "ogg"]: # Add other supported extensions if needed
                potential_ref_audio = os.path.join(custom_voice_folder, f"reference.{ext}")
                if os.path.exists(potential_ref_audio):
                    speaker_wav_for_tts = potential_ref_audio
                    print(f"Using custom speaker WAV: {speaker_wav_for_tts} for voiceId: {request.voiceId}")
                    break
            if not speaker_wav_for_tts:
                print(f"Warning: Reference audio for custom voice {request.voiceId} not found in {custom_voice_folder}. XTTS may use default voice or fail.")
                # Depending on strictness, you might raise HTTPException here
                # raise HTTPException(status_code=404, detail=f"Reference audio for custom voice {request.voiceId} not found.")


        # Generate speech to an in-memory buffer
        audio_buffer = io.BytesIO()
        tts_instance.tts_to_file(
            text=request.text,
            speaker_wav=speaker_wav_for_tts,
            language=language, # XTTS is multilingual
            file_path=audio_buffer,
            speed=request.speed,
            # Note: `variability` is not a direct parameter in XTTS.
            # Some models might have `emotion` or style parameters.
            # This example passes `speed` and effectively ignores `variability` for XTTS.
        )
        audio_buffer.seek(0)
        audio_bytes = audio_buffer.read()

        if not audio_bytes:
            raise HTTPException(status_code=500, detail="TTS generation failed: No audio data produced.")

        # XTTS typically outputs WAV.
        audio_data_uri = encode_audio_to_data_uri(audio_bytes, mime_type="audio/wav")
        print(f"Generated audio. Data URI approx length: {len(audio_data_uri) // 1024} KB")
        return TTSResponse(audioDataUri=audio_data_uri)

    except ValueError as ve: # From decode_data_uri or other value issues
        print(f"ValueError in TTS: {ve}")
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        print(f"Error during TTS generation: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error during TTS generation: {str(e)}")
```

### 4.3. Train Voice Endpoint (`/api/train-voice`)

```python
@app.post("/api/train-voice", response_model=TrainVoiceResponse)
async def train_voice_endpoint(request: TrainVoiceRequest):
    # Note: Actual XTTS fine-tuning is a complex, potentially long-running process.
    # This endpoint simulates a simpler "training" by saving the reference audio.
    # For real fine-tuning, you'd integrate Coqui's training scripts/APIs.
    # See "Key Considerations" section for more on actual fine-tuning.
    try:
        print(f"Training Request: ModelName='{request.modelName}'")
        audio_bytes, mime_type = decode_data_uri(request.audioDataUri)

        if not mime_type.startswith("audio/"):
            raise HTTPException(status_code=400, detail=f"Invalid audio file type: {mime_type}. Please use WAV or MP3.")

        # Generate a unique ID for the model (folder name)
        # Sanitize modelName to be filesystem-friendly
        sane_model_name = "".join(c if c.isalnum() or c in (' ', '_', '-') else '_' for c in request.modelName).strip()
        sane_model_name = sane_model_name.replace(' ', '_')
        if not sane_model_name: sane_model_name = "unnamed_model"
        
        model_id = f"{sane_model_name}_{uuid.uuid4().hex[:6]}"
        model_output_path = os.path.join(MODEL_STORAGE_PATH, model_id)
        os.makedirs(model_output_path, exist_ok=True)

        # Determine file extension from MIME type
        extension_map = {"audio/wav": "wav", "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/ogg": "ogg"}
        file_extension = extension_map.get(mime_type.lower())

        if not file_extension:
            # Fallback or raise error for unsupported types by this simplified setup
            print(f"Warning: Unsupported MIME type for training reference: {mime_type}. Defaulting to .wav extension.")
            file_extension = "wav"
            # raise HTTPException(status_code=400, detail=f"Unsupported audio type for training: {mime_type}")


        # Save the uploaded audio as `reference.<ext>` in the model's folder.
        # This file will be used by the `/api/tts` endpoint for voice cloning with XTTS.
        reference_audio_path = os.path.join(model_output_path, f"reference.{file_extension}")
        with open(reference_audio_path, "wb") as f:
            f.write(audio_bytes)
        print(f"Saved reference audio for new voice model to: {reference_audio_path}")

        # In a real fine-tuning scenario, this is where you'd trigger the
        # Coqui TTS fine-tuning process, which could be long-running.
        # For this guide, "training" means the reference audio is now available.
        training_status = "completed" # Simulating immediate completion.
        
        print(f"Voice model '{request.modelName}' (ID: {model_id}) 'trained' (reference audio saved).")
        return TrainVoiceResponse(trainingStatus=training_status, modelId=model_id)

    except ValueError as ve: # From decode_data_uri
        print(f"ValueError in training: {ve}")
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        print(f"Error during voice training setup: {e}")
        import traceback
        traceback.print_exc()
        # Optional: Clean up created model directory if setup fails critically
        if 'model_output_path' in locals() and os.path.exists(model_output_path):
            try:
                shutil.rmtree(model_output_path)
                print(f"Cleaned up directory: {model_output_path}")
            except Exception as cleanup_err:
                print(f"Error cleaning up directory {model_output_path}: {cleanup_err}")
        raise HTTPException(status_code=500, detail=f"Internal server error during voice training setup: {str(e)}")
```

### 4.4. Running the Python Service

Add this to the end of your `main.py`:

```python
# --- Main application runner (for uvicorn) ---
if __name__ == "__main__":
    import uvicorn
    # The Next.js app expects this on port 8000 by default
    print(f"Starting Python backend service on http://0.0.0.0:8000")
    print(f"Models will be stored in: {os.path.abspath(MODEL_STORAGE_PATH)}")
    print(f"TTS endpoint: POST /api/tts")
    print(f"Train Voice endpoint: POST /api/train-voice")
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

Save the complete code as `main.py`. Run it from your terminal (with the virtual environment activated):

```bash
uvicorn main:app --reload --port 8000
```
*   `main:app`: Tells uvicorn to find the `app` object in the `main.py` file.
*   `--reload`: Automatically reloads the server on code changes (useful for development).
*   `--port 8000`: Matches the `PYTHON_API_BASE_URL` in your Next.js flows.

## 5. Key Considerations & Coqui TTS Specifics

*   **Coqui TTS Model Management**:
    *   **XTTS-v2 Models**: XTTS-v2 (`tts_models/multilingual/multi-dataset/xtts_v2` or similar latest version) is highly recommended for its voice cloning and multilingual capabilities. Models are usually downloaded automatically on first use.
    *   **GPU Usage**: If you have a compatible GPU and CUDA/cuDNN installed, set `gpu=True` when initializing `CoquiTTS` for significantly faster inference. The example code uses `gpu=False` for broader compatibility.
    *   **Speaker WAVs for TTS**: For the `/api/tts` endpoint, XTTS uses a `speaker_wav` argument pointing to a clean audio sample of the target voice for cloning.
        *   For "default" voices in your app, you can either let XTTS use its internal default or provide paths to your own high-quality generic speaker WAV files.
        *   For custom "trained" voices, the `voiceId` (which is `modelId` from training) maps to a folder (e.g., `trained_models/<model_id>/`). Inside this folder, the service expects a reference audio file (e.g., `reference.wav`, `reference.mp3`).
    *   **Language**: XTTS is multilingual. The `language` parameter in `tts_instance.tts_to_file()` should be set to the ISO 639-1 code of the text's language (e.g., "en", "ru", "es").
    *   **Speed and Variability**: The `speed` parameter is generally supported. "Variability" is not a standard direct numeric parameter in XTTS. If XTTS offers parameters for emotion, style, or prosody that could be mapped from `variability`, you would implement that logic. Otherwise, `variability` might be ignored for XTTS.
*   **Voice Training (`/api/train-voice`) - Simplified vs. Real Fine-tuning**:
    *   **This Guide's Approach (Simplified)**: The `/api/train-voice` endpoint in this guide **simulates training** by saving the user's uploaded audio sample as `reference.<ext>` within a new model-specific folder. This `reference.<ext>` is then used by the `/api/tts` endpoint for XTTS's zero-shot voice cloning. This is **not actual model fine-tuning**.
    *   **Real XTTS Fine-tuning**: True fine-tuning involves training the XTTS model on one or more audio files of the target speaker. This is a more complex process:
        1.  It usually requires more data (several minutes to hours of clean audio).
        2.  It involves running Coqui TTS's specific training scripts (e.g., those found in `TTS/bin/`) or using their Python API for fine-tuning if available for XTTS.
        3.  This process generates new model checkpoint files or speaker embeddings.
        4.  The `/api/tts` endpoint would then need to be modified to load and use these fine-tuned artifacts instead of just a `speaker_wav`.
    *   **Long-running Tasks**: Real fine-tuning can take significant time (minutes to hours). For a production web API, such tasks should be handled asynchronously (e.g., using Celery with a message broker like Redis/RabbitMQ, or FastAPI's `BackgroundTasks` for simpler cases). The frontend would then poll for training status or receive a notification upon completion. The current guide's synchronous "completed" status is due to its simplified nature.
*   **Audio Formats**:
    *   The Next.js frontend sends audio as a base64 data URI. The Python backend decodes this.
    *   Coqui TTS generally prefers WAV files for input, but XTTS is quite flexible. The example tries to save with the original extension.
    *   The backend returns audio as a `data:audio/wav;base64,...` URI, as XTTS typically outputs WAV.
*   **Error Handling**: The FastAPI example includes basic `HTTPException` for errors. Enhance this with more specific error codes and logging for production.
*   **Security**:
    *   **CORS**: Configured for local development. Adjust `origins` for production environments.
    *   **Input Validation**: Pydantic models provide data validation.
    *   **File System Access**: Ensure the application has correct permissions to read/write to `MODEL_STORAGE_PATH`. Be cautious about file paths constructed from user input (though `modelId` is generated based on sanitized `modelName` and UUID).
*   **Coqui TTS Documentation**: The Coqui TTS library is actively developed. **Always refer to the official Coqui TTS documentation (GitHub repository, discussions, examples) for the most up-to-date information on model names, API usage, supported features, and fine-tuning procedures for XTTS-v2.** The examples here are based on common patterns but might need adjustments for the specific Coqui TTS version you use.

## 6. Next Steps for a Production-Ready System

1.  **Implement Real XTTS Fine-tuning (Optional but Recommended for Quality)**: If highest voice quality and distinctiveness are required, replace the simplified reference audio saving in `/api/train-voice` with actual calls to Coqui TTS XTTS fine-tuning scripts or APIs. This is a significant development step.
2.  **Asynchronous Operations**: For real fine-tuning or potentially long TTS requests, implement them asynchronously.
3.  **Robust Model and State Management**: If you implement actual fine-tuning, you'll need a more robust way to manage model files and training states.
4.  **Detailed Logging and Monitoring**.
5.  **Configuration Management**: Use environment variables or configuration files for settings like `MODEL_STORAGE_PATH`, GPU usage, etc.
6.  **Deployment**: Containerize the Python service (e.g., using Docker) for easier and consistent deployment.

This guide provides a functional starting point for your Python backend service. The core TTS functionality with zero-shot cloning using a reference audio should work with this setup. True fine-tuning is a more advanced topic requiring deeper integration with Coqui TTS's training tools.
      