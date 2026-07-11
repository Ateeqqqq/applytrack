"""
models.py
---------
This file defines the database table structure using SQLAlchemy's ORM.

Each class attribute becomes a column in the "applications" table.
"""

from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from backend.database import Base


class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String, nullable=False)
    job_role = Column(String, nullable=False)
    job_url = Column(String, nullable=True)
    status = Column(String, nullable=False, default="Applied")
    date_applied = Column(String, nullable=False)  # stored as "YYYY-MM-DD" text for simplicity

    # created_at is set automatically by the database when a row is inserted
    created_at = Column(DateTime(timezone=True), server_default=func.now())
