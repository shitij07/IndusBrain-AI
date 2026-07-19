import json
import re

from app.config import get_settings
from app.services.gemini_client import get_gemini_client

settings = get_settings()


COMPLIANCE_PROMPT = """You are a compliance auditing expert for industrial maintenance operations. You will compare a Standard Operating Procedure (SOP) against an Inspection Report and identify compliance gaps.

SOP Document:
{sop_text}

Inspection Report:
{report_text}

Analyze the compliance of the inspection report against the SOP. Return ONLY a valid JSON object with the following fields:

1. "violations": A list of specific violations found in the inspection report where the actual practice deviated from the SOP. Each item should describe the non-compliance clearly.

2. "missing_steps": A list of SOP steps that were not followed or were completely omitted during the inspection. Each item should reference the specific step number or description from the SOP.

3. "risk_level": One of "Low", "Medium", "High", or "Critical" indicating the overall risk severity of the identified issues.

4. "compliance_percentage": A float between 0.0 and 100.0 indicating the overall compliance rate.

Example format:
{{
  "violations": ["Violation 1: ...", "Violation 2: ..."],
  "missing_steps": ["Step 3: ... was not performed", "Step 7: ... missing"],
  "risk_level": "High",
  "compliance_percentage": 72.5
}}

If a section has no items, return an empty list for that field."""


def check_compliance(sop_text: str, report_text: str) -> dict:
    if not sop_text or not sop_text.strip():
        raise ValueError("SOP text is empty")
    if not report_text or not report_text.strip():
        raise ValueError("Inspection Report text is empty")

    client = get_gemini_client()

    prompt = COMPLIANCE_PROMPT.format(
        sop_text=sop_text[:40000],
        report_text=report_text[:40000],
    )

    raw = client.generate_content(prompt)
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        result = {
            "violations": ["Unable to parse compliance analysis"],
            "missing_steps": [],
            "risk_level": "Unknown",
            "compliance_percentage": 0.0,
        }

    compliance_pct = result.get("compliance_percentage", 0.0)
    if isinstance(compliance_pct, (int, float)):
        compliance_pct = min(max(float(compliance_pct), 0.0), 100.0)
    else:
        compliance_pct = 0.0

    return {
        "violations": result.get("violations", []),
        "missing_steps": result.get("missing_steps", []),
        "risk_level": result.get("risk_level", "Unknown"),
        "compliance_percentage": compliance_pct,
    }
