"""
database.py
------------
This file sets up the connection between our FastAPI app and the SQLite database.
It creates the SQLAlchemy "engine", a session factory, and a Base class that our
models will inherit from.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# SQLite database file will be created in the backend folder as "applytrack.db"
DATABASE_URL = "sqlite:///./applytrack.db"

# The connect_args option is only needed for SQLite. It allows the database
# connection to be used across different threads (FastAPI can use multiple threads).
engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)

# SessionLocal is a factory that creates new database sessions when we need them.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base is the class our SQLAlchemy models (tables) will inherit from.
Base = declarative_base()


def get_db():
    """
    This function creates a new database session for each request,
    and makes sure it is closed afterward, even if an error occurs.

    FastAPI will call this automatically because we use it as a dependency.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
