from pydantic import BaseModel
from typing import Optional, List


class AINotesRequest(BaseModel):
    """
    Schema for AI-generated meeting notes saved automatically
    when the mentor ends a meeting. Produced by Lumina AI.
    """
    topic: Optional[str] = ''
    issuesDiscussed: Optional[str] = ''
    actionItems: Optional[str] = ''
    tasks: Optional[List[str]] = []
    confidentialObservations: Optional[str] = ''
    remarks: Optional[str] = ''
    # Risk intelligence fields
    riskSignals: Optional[List[str]] = []
    riskLevel: Optional[str] = 'LOW'          # LOW | MEDIUM | HIGH
    riskRecommendations: Optional[List[str]] = []
    requiresEscalation: Optional[bool] = False
    # Metadata
    transcriptSource: Optional[str] = 'live-only'   # 'live-only' | 'gemini+live'
    transcriptLength: Optional[int] = 0
    generatedAt: Optional[str] = None
    generatedBy: Optional[str] = 'lumina-ai-auto'
