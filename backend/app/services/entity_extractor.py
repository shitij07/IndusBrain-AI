import json
import os
import re
from typing import Optional

import google.generativeai as genai

from app.config import get_settings

settings = get_settings()

ENTITY_TYPES = [
    "Equipment",
    "Plant",
    "Asset ID",
    "Pressure",
    "Temperature",
    "Technician",
    "SOP Number",
    "Failure Type",
    "Maintenance Date",
    "Manufacturer",
    "Model",
    "Category",
    "Location",
    "Criticality",
    "Status",
]

EXTRACTION_PROMPT = """You are an industrial document analyst. Extract the following entities from the given document text and return them as a JSON array of objects.

Entity types to extract:
- Equipment (e.g., Pump P-102, Compressor C-201, Valve V-301)
- Plant (e.g., Plant A, Refinery Unit 1, Manufacturing Site)
- Asset ID (e.g., AST-0042, EQ-1023, ASM-101)
- Pressure (e.g., 18 bar, 150 psi, 2.5 MPa) — include the numeric value and unit
- Temperature (e.g., 120°C, 250°F, 80°C) — include the numeric value and unit
- Technician (e.g., John Smith, R. Kumar, Technician Name)
- SOP Number (e.g., SOP-1023, WI-0042, MNT-STD-005)
- Failure Type (e.g., Seal leakage, Bearing failure, Motor overheating, Corrosion)
- Maintenance Date (e.g., 20 June 2026, 2026-06-20, 06/20/2026)
- Manufacturer (e.g., Grundfos, Siemens, ABB, Emerson)
- Model (e.g., CR-45-3, 7SJ64, XRS-200)
- Category (e.g., Pump, Compressor, Valve, Motor, Transformer, Conveyor)
- Location (e.g., Section 3, Bay 2, Rack A12, North Wall)
- Criticality (e.g., High, Medium, Low, Critical)
- Status (e.g., Active, Inactive, Under maintenance, Decommissioned)

For each entity found, provide:
- "type": the entity type (exactly as listed above)
- "value": the extracted text value
- "page": the page number if identifiable (use null if unknown)
- "confidence": a confidence score between 0.0 and 1.0

Return ONLY a valid JSON array. No other text. Example format:
[
  {{"type": "Equipment", "value": "Pump P-102", "page": 3, "confidence": 0.95}},
  {{"type": "Pressure", "value": "18 bar", "page": 3, "confidence": 0.98}}
]

Document text:
{text}"""


def _api_key() -> str:
    key = settings.GEMINI_API_KEY or os.getenv("GOOGLE_API_KEY") or ""
    return key


def extract_entities_from_text(text: str) -> list[dict]:
    if not text or not text.strip():
        return []

    key = _api_key()
    if not key:
        return []

    genai.configure(api_key=key)
    model = genai.GenerativeModel(settings.GEMINI_CHAT_MODEL)

    prompt = EXTRACTION_PROMPT.format(text=text[:30000])

    try:
        response = model.generate_content(prompt)
        raw = response.text.strip()
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        entities = json.loads(raw)
        if isinstance(entities, list):
            return entities
        return []
    except Exception:
        return []
