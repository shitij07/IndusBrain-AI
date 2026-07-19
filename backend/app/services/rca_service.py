import json
import re
from typing import Optional

from app.config import get_settings
from app.services.chroma_service import query_similar
from app.services.gemini_client import get_gemini_client

settings = get_settings()

RCA_PROMPT = """You are an industrial root cause analysis expert. Given an incident description and relevant context from maintenance documents, perform a thorough RCA.

Incident Description: {incident}

Relevant Document Context:
{context}

Based on the incident and the provided context, generate a structured root cause analysis in JSON format with the following fields:

1. "possible_causes": A list of 3-5 potential root causes, ordered by likelihood. Each cause should be a concise string describing the specific failure mechanism.

2. "similar_historical_incidents": A list of similar incidents found in the provided context (if any). Use the document context to identify any past failures, repairs, or maintenance events that match. Each item should have:
   - "description": Brief description of the similar incident
   - "source": The document name/source if identifiable
   - "relevance": Why it's relevant (e.g., same equipment, similar symptoms)

3. "recommendations": A list of 3-5 actionable recommendations to address the immediate issue. These should be specific, practical corrective actions.

4. "preventive_actions": A list of 3-5 preventive measures to avoid recurrence. Include inspection intervals, monitoring strategies, or process changes.

5. "confidence_score": A float between 0.0 and 1.0 indicating your confidence in this analysis based on the available context.

Return ONLY a valid JSON object. No other text. Example format:
{{
  "possible_causes": ["Cause 1", "Cause 2"],
  "similar_historical_incidents": [
    {{"description": "...", "source": "...", "relevance": "..."}}
  ],
  "recommendations": ["Recommendation 1"],
  "preventive_actions": ["Action 1"],
  "confidence_score": 0.85
}}"""


def perform_rca(incident_description: str, user_id: Optional[int] = None) -> dict:
    if not incident_description or not incident_description.strip():
        return {
            "possible_causes": [],
            "similar_historical_incidents": [],
            "recommendations": [],
            "preventive_actions": [],
            "confidence_score": 0.0,
        }

    client = get_gemini_client()

    where_clause = {"user_id": user_id} if user_id else None
    try:
        similar_docs = query_similar(
            query=incident_description,
            top_k=5,
            where=where_clause,
        )
    except Exception:
        similar_docs = []

    context_parts = []
    for i, chunk in enumerate(similar_docs):
        meta = chunk["metadata"]
        source = meta.get("original_filename", f"Doc {meta['document_id']}")
        context_parts.append(f"[Source {i + 1}] {source}\n{chunk['document']}")

    context_text = "\n\n".join(context_parts) if context_parts else "No relevant documents found. Provide analysis based on general industrial engineering knowledge."

    prompt = RCA_PROMPT.format(
        incident=incident_description,
        context=context_text,
    )

    raw = client.generate_content(prompt)
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        result = {
            "possible_causes": ["Unable to parse analysis results"],
            "similar_historical_incidents": [],
            "recommendations": ["Please try rephrasing the incident description"],
            "preventive_actions": [],
            "confidence_score": 0.0,
        }

    return {
        "possible_causes": result.get("possible_causes", []),
        "similar_historical_incidents": result.get("similar_historical_incidents", []),
        "recommendations": result.get("recommendations", []),
        "preventive_actions": result.get("preventive_actions", []),
        "confidence_score": min(max(result.get("confidence_score", 0.0), 0.0), 1.0),
    }
