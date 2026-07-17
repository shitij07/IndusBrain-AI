from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class AssetRegisterRow(BaseModel):
    asset_id: str
    name: str = ""
    category: str = ""
    plant: str = ""
    location: str = ""
    status: str = ""
    criticality: str = ""
    last_maintenance_date: str = ""
    technician: str = ""
    manufacturer: str = ""
    model: str = ""
    commission_year: str = ""


class AssetClaimResponse(BaseModel):
    id: str
    attribute: str
    value: str
    canonical_value: Optional[str] = None
    conflicts_with_canonical: bool = False
    confidence: float = 0.0
    source_document_id: int
    source_document_filename: str
    source_document_type: str = "Document"
    created_at: Optional[str] = None


class AssetSummary(BaseModel):
    asset_id: str
    name: Optional[str] = None
    category: Optional[str] = None
    plant: Optional[str] = None
    status: Optional[str] = None
    criticality: Optional[str] = None
    conflict_count: int = 0


class AssetDetailResponse(BaseModel):
    asset_id: str
    canonical_name: Optional[str] = None
    canonical_category: Optional[str] = None
    canonical_plant: Optional[str] = None
    canonical_location: Optional[str] = None
    canonical_status: Optional[str] = None
    canonical_criticality: Optional[str] = None
    canonical_last_maintenance_date: Optional[str] = None
    canonical_technician: Optional[str] = None
    canonical_manufacturer: Optional[str] = None
    canonical_model: Optional[str] = None
    canonical_commission_year: Optional[str] = None
    claims: list[AssetClaimResponse] = []


class AssetConflictResponse(BaseModel):
    asset_id: str
    claim_id: str
    attribute: str
    claimed_value: str
    canonical_value: Optional[str] = None
    confidence: float
    source_document_id: int
    source_document_filename: str
    source_document_type: str
    created_at: Optional[str] = None


class IngestRegisterResponse(BaseModel):
    rows_parsed: int
    assets_created: int
    asset_ids: list[str]
