"""Authenticated, rate-limited proxy for AI providers.

Provider credentials are read only from backend environment settings and are
never returned to the browser.
"""

import base64
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.config import settings
from app.core.dependencies import get_current_user
from app.core.rate_limit import enforce_rate_limit

router = APIRouter(prefix="/ai", tags=["AI"])

GROQ_MODELS = {"qwen/qwen3.8-27b", "openai/gpt-oss-20b", "openai/gpt-oss-120b"}
GEMINI_MODELS = {"gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.8-flash"}
MAX_AUDIO_BYTES = 25 * 1024 * 1024


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(max_length=12_000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=40)
    groqModel: str | None = None
    geminiModel: str | None = None
    temperature: float = Field(default=0.25, ge=0, le=1)
    maxTokens: int = Field(default=1500, ge=1, le=4096)


def _rate_limit(user_id: str, action: str, maximum: int, seconds: int) -> None:
    enforce_rate_limit(
        "ai", user_id, action, maximum, seconds,
        "AI request limit reached. Try again shortly.",
    )


def _model_or_default(candidate: str | None, allowed: set[str], default: str) -> str:
    return candidate if candidate in allowed else default


@router.post("/chat")
async def chat(data: ChatRequest, user=Depends(get_current_user)):
    _rate_limit(user["uid"], "chat", maximum=20, seconds=60)
    messages = [message.model_dump() if hasattr(message, "model_dump") else message.dict() for message in data.messages]
    if sum(len(message["content"]) for message in messages) > 40_000:
        raise HTTPException(status_code=413, detail="AI conversation exceeds the size limit")

    async with httpx.AsyncClient(timeout=45.0) as client:
        groq_key = settings.GROQ_API_KEY.strip()
        if groq_key:
            selected = _model_or_default(data.groqModel, GROQ_MODELS, "qwen/qwen3.8-27b")
            models = list(dict.fromkeys([selected, "openai/gpt-oss-20b", "openai/gpt-oss-120b"]))
            for model in models:
                try:
                    response = await client.post(
                        "https://api.groq.com/openai/v1/chat/completions",
                        headers={"Authorization": f"Bearer {groq_key}"},
                        json={
                            "model": model,
                            "messages": messages,
                            "temperature": data.temperature,
                            "max_tokens": data.maxTokens,
                        },
                    )
                    if response.is_success:
                        result = response.json()
                        choice = (result.get("choices") or [{}])[0]
                        content = (choice.get("message") or {}).get("content") or (choice.get("message") or {}).get("reasoning")
                        if content and content.strip():
                            return {"content": content.strip(), "model": model, "usage": result.get("usage")}
                except httpx.HTTPError:
                    continue

        gemini_key = settings.GEMINI_API_KEY.strip()
        if gemini_key:
            selected = _model_or_default(data.geminiModel, GEMINI_MODELS, "gemini-3.8-flash")
            system_text = "\n\n".join(message["content"] for message in messages if message["role"] == "system")
            contents = []
            for message in messages:
                if message["role"] == "system" or not message["content"].strip():
                    continue
                role = "user" if message["role"] == "user" else "model"
                if contents and contents[-1]["role"] == role:
                    contents[-1]["parts"][0]["text"] += "\n\n" + message["content"]
                else:
                    contents.append({"role": role, "parts": [{"text": message["content"]}]})
            if contents and contents[0]["role"] != "user":
                contents[0]["role"] = "user"
            if contents:
                try:
                    gemini_body = {
                        "contents": contents,
                        "generationConfig": {
                            "temperature": data.temperature,
                            "maxOutputTokens": max(data.maxTokens, 2048),
                        },
                    }
                    if system_text:
                        gemini_body["systemInstruction"] = {"parts": [{"text": system_text}]}
                    response = await client.post(
                        f"https://generativelanguage.googleapis.com/v1beta/models/{selected}:generateContent",
                        headers={"x-goog-api-key": gemini_key},
                        json=gemini_body,
                    )
                    if response.is_success:
                        result = response.json()
                        content = "".join(
                            part.get("text", "")
                            for part in ((result.get("candidates") or [{}])[0].get("content") or {}).get("parts", [])
                        ).strip()
                        if content:
                            return {"content": content, "model": selected, "usage": result.get("usageMetadata")}
                except httpx.HTTPError:
                    pass

    raise HTTPException(status_code=503, detail="AI provider is unavailable or not configured on the server")


@router.post("/transcribe")
async def transcribe(file: UploadFile = File(...), user=Depends(get_current_user)):
    _rate_limit(user["uid"], "transcribe", maximum=4, seconds=60)
    allowed_types = {"audio/webm", "audio/ogg", "audio/mp4", "audio/wav", "audio/mpeg"}
    mime_type = (file.content_type or "audio/webm").split(";")[0].lower()
    if mime_type not in allowed_types:
        raise HTTPException(status_code=415, detail="Unsupported audio recording type")
    audio = await file.read(MAX_AUDIO_BYTES + 1)
    if not audio:
        raise HTTPException(status_code=400, detail="Empty audio recording")
    if len(audio) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio recording exceeds the 25 MB limit")

    async with httpx.AsyncClient(timeout=90.0) as client:
        groq_key = settings.GROQ_API_KEY.strip()
        if groq_key:
            try:
                response = await client.post(
                    "https://api.groq.com/openai/v1/audio/transcriptions",
                    headers={"Authorization": f"Bearer {groq_key}"},
                    data={"model": "whisper-large-v3-turbo", "temperature": "0.0"},
                    files={"file": (file.filename or "meeting_recording.webm", audio, mime_type)},
                )
                if response.is_success and response.json().get("text", "").strip():
                    return {"text": response.json()["text"].strip(), "model": "whisper-large-v3-turbo"}
            except httpx.HTTPError:
                pass

        gemini_key = settings.GEMINI_API_KEY.strip()
        if gemini_key:
            try:
                response = await client.post(
                    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
                    headers={"x-goog-api-key": gemini_key},
                    json={
                        "contents": [{"parts": [
                            {"inlineData": {"mimeType": mime_type, "data": base64.b64encode(audio).decode("ascii")}},
                            {"text": "Transcribe this university mentorship meeting audio verbatim, separating speakers as [Mentor] and [Student]. Capture academic, attendance, and career concerns accurately."},
                        ]}],
                        "generationConfig": {"temperature": 0.1, "maxOutputTokens": 4096},
                    },
                )
                if response.is_success:
                    result = response.json()
                    text = "".join(
                        part.get("text", "")
                        for part in ((result.get("candidates") or [{}])[0].get("content") or {}).get("parts", [])
                    ).strip()
                    if text:
                        return {"text": text, "model": "gemini-3.8-flash"}
            except httpx.HTTPError:
                pass

    raise HTTPException(status_code=503, detail="Audio transcription service is unavailable or not configured on the server")
