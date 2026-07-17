from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.user import User
from app.config import get_settings
from app.services.asset_resolver import (
    parse_asset_register_csv,
    ingest_asset_register_rows,
    get_canonical_asset,
    get_asset_with_claims,
    get_asset_conflicts,
    list_all_assets,
    add_asset_claim,
)
from app.schemas.asset import (
    AssetDetailResponse,
    AssetConflictResponse,
    AssetSummary,
    AssetClaimResponse,
    IngestRegisterResponse,
)

router = APIRouter(prefix="/assets", tags=["assets"])
settings = get_settings()


@router.post("/ingest-register", response_model=IngestRegisterResponse)
def ingest_asset_register(
    file: UploadFile = File(...),
    current_user: User = Depends(require_role("admin")),
):
    if file.content_type not in ("text/csv", "application/csv", "text/plain"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Asset register must be a CSV file",
        )

    try:
        csv_text = file.file.read().decode("utf-8-sig")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read CSV file. Ensure it is UTF-8 encoded.")

    rows = parse_asset_register_csv(csv_text)
    if not rows:
        raise HTTPException(status_code=400, detail="No valid asset register rows found. Expected columns: Asset ID, Equipment Name, Category, Plant, Location, Status, Criticality, etc.")

    created = ingest_asset_register_rows(rows)
    asset_ids = [r["asset_id"] for r in rows if r.get("asset_id")]

    return IngestRegisterResponse(
        rows_parsed=len(rows),
        assets_created=created,
        asset_ids=asset_ids,
    )


@router.get("", response_model=list[AssetSummary])
def list_assets(
    current_user: User = Depends(get_current_user),
):
    return list_all_assets()


@router.get("/{asset_id}", response_model=AssetDetailResponse)
def get_asset(
    asset_id: str,
    current_user: User = Depends(get_current_user),
):
    data = get_asset_with_claims(asset_id)
    if not data:
        raise HTTPException(status_code=404, detail=f"Asset '{asset_id}' not found")

    canonical = {k: data.get(k) for k in [
        "canonical_name", "canonical_category", "canonical_plant",
        "canonical_location", "canonical_status", "canonical_criticality",
        "canonical_last_maintenance_date", "canonical_technician",
        "canonical_manufacturer", "canonical_model", "canonical_commission_year",
    ]}

    claims = []
    for c in data.get("claims", []):
        claims.append(AssetClaimResponse(
            id=c.get("id", ""),
            attribute=c.get("attribute", ""),
            value=c.get("value", ""),
            canonical_value=c.get("canonical_value"),
            conflicts_with_canonical=c.get("conflicts_with_canonical", False),
            confidence=c.get("confidence", 0.0),
            source_document_id=c.get("source_document_id", 0),
            source_document_filename=c.get("source_document_filename", ""),
            source_document_type=c.get("source_document_type", "Document"),
            created_at=c.get("created_at"),
        ))

    return AssetDetailResponse(
        asset_id=data.get("asset_id", asset_id),
        **canonical,
        claims=claims,
    )


@router.get("/{asset_id}/conflicts", response_model=list[AssetConflictResponse])
def get_asset_conflicts_endpoint(
    asset_id: str,
    current_user: User = Depends(get_current_user),
):
    asset = get_canonical_asset(asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail=f"Asset '{asset_id}' not found")

    conflicts = get_asset_conflicts(asset_id)
    return [
        AssetConflictResponse(
            asset_id=asset_id,
            claim_id=c.get("id", ""),
            attribute=c.get("attribute", ""),
            claimed_value=c.get("value", ""),
            canonical_value=c.get("canonical_value"),
            confidence=c.get("confidence", 0.0),
            source_document_id=c.get("source_document_id", 0),
            source_document_filename=c.get("source_document_filename", ""),
            source_document_type=c.get("source_document_type", "Document"),
            created_at=c.get("created_at"),
        )
        for c in conflicts
    ]
