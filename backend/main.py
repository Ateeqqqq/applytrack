"""
main.py
-------
This is the entry point of the FastAPI backend for ApplyTrack.

It defines:
- Pydantic schemas (used to validate incoming/outgoing data)
- API endpoints (routes) for CRUD operations on job applications
- A /stats endpoint that returns dashboard statistics

Flow reminder:
Frontend (Fetch API) --> FastAPI route --> SQLAlchemy --> SQLite --> JSON response --> Frontend
"""

from datetime import date
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from backend import models
from backend.database import engine, get_db

# This line tells SQLAlchemy to create all tables (if they don't already exist)
# based on the models we defined in models.py. This runs once when the app starts.
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="ApplyTrack API", description="A simple Job Application Tracker API")

# ---------------------------------------------------------------------------
# CORS Configuration
# ---------------------------------------------------------------------------
# This allows our frontend (served from a different origin, e.g. a local file
# or a live-server on a different port) to make requests to this API during
# local development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local dev only. In production you'd restrict this.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------
# These define the "shape" of data we accept (requests) and return (responses).
# FastAPI uses these to automatically validate incoming JSON and to generate
# the interactive docs at /docs.

VALID_STATUSES = ["Applied", "Interview", "Rejected", "Offer"]


class ApplicationCreate(BaseModel):
    """Schema used when creating or updating a job application."""
    company_name: str
    job_role: str
    job_url: Optional[str] = None
    status: str = "Applied"
    date_applied: str  # expected format: "YYYY-MM-DD"


class ApplicationResponse(BaseModel):
    """Schema used when returning a job application to the frontend."""
    id: int
    company_name: str
    job_role: str
    job_url: Optional[str] = None
    status: str
    date_applied: str

    # Allows Pydantic to read data directly from SQLAlchemy model objects
    model_config = ConfigDict(from_attributes=True)


class StatsResponse(BaseModel):
    """Schema for the dashboard statistics endpoint."""
    total: int
    applied: int
    interview: int
    offer: int
    rejected: int


# ---------------------------------------------------------------------------
# Helper function
# ---------------------------------------------------------------------------
def validate_status(status: str):
    """Raise an error if the status is not one of our allowed values."""
    if status not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{status}'. Must be one of {VALID_STATUSES}",
        )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/")
def read_root():
    """Simple health-check route so visiting the root URL shows something useful."""
    return {"message": "ApplyTrack API is running. Visit /docs for the API documentation."}


@app.get("/applications", response_model=List[ApplicationResponse])
def get_applications(
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Return all job applications.

    Optional query parameters:
    - status: filter by exact status (e.g. /applications?status=Applied)
    - search: search company_name or job_role (e.g. /applications?search=google)
    """
    query = db.query(models.Application)

    if status:
        query = query.filter(models.Application.status == status)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (models.Application.company_name.ilike(search_pattern))
            | (models.Application.job_role.ilike(search_pattern))
        )

    # Newest applications first
    return query.order_by(models.Application.id.desc()).all()


@app.get("/applications/{application_id}", response_model=ApplicationResponse)
def get_application(application_id: int, db: Session = Depends(get_db)):
    """Return a single job application by its id."""
    application = db.query(models.Application).filter(
        models.Application.id == application_id
    ).first()

    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    return application


@app.post("/applications", response_model=ApplicationResponse, status_code=201)
def create_application(application: ApplicationCreate, db: Session = Depends(get_db)):
    """Create a new job application."""
    validate_status(application.status)

    new_application = models.Application(
        company_name=application.company_name,
        job_role=application.job_role,
        job_url=application.job_url,
        status=application.status,
        date_applied=application.date_applied,
    )

    db.add(new_application)
    db.commit()
    db.refresh(new_application)  # refresh so new_application.id is populated

    return new_application


@app.put("/applications/{application_id}", response_model=ApplicationResponse)
def update_application(
    application_id: int,
    application: ApplicationCreate,
    db: Session = Depends(get_db),
):
    """Update an existing job application (also used to update just the status)."""
    validate_status(application.status)

    existing = db.query(models.Application).filter(
        models.Application.id == application_id
    ).first()

    if not existing:
        raise HTTPException(status_code=404, detail="Application not found")

    existing.company_name = application.company_name
    existing.job_role = application.job_role
    existing.job_url = application.job_url
    existing.status = application.status
    existing.date_applied = application.date_applied

    db.commit()
    db.refresh(existing)

    return existing


@app.delete("/applications/{application_id}", status_code=200)
def delete_application(application_id: int, db: Session = Depends(get_db)):
    """Delete a job application by its id."""
    existing = db.query(models.Application).filter(
        models.Application.id == application_id
    ).first()

    if not existing:
        raise HTTPException(status_code=404, detail="Application not found")

    db.delete(existing)
    db.commit()

    return {"message": f"Application {application_id} deleted successfully"}


@app.get("/stats", response_model=StatsResponse)
def get_stats(db: Session = Depends(get_db)):
    """Return dashboard statistics calculated live from the database."""
    all_applications = db.query(models.Application).all()

    total = len(all_applications)
    applied = sum(1 for a in all_applications if a.status == "Applied")
    interview = sum(1 for a in all_applications if a.status == "Interview")
    offer = sum(1 for a in all_applications if a.status == "Offer")
    rejected = sum(1 for a in all_applications if a.status == "Rejected")

    return StatsResponse(
        total=total,
        applied=applied,
        interview=interview,
        offer=offer,
        rejected=rejected,
    )
