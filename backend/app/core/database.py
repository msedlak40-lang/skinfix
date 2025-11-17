"""
Database Configuration
Sets up SQLAlchemy connection to Supabase PostgreSQL
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings

# Create database engine
# The echo=True parameter will print all SQL queries (helpful for debugging)
engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,  # Test connections before using them
)

# Create a SessionLocal class
# This will be used to create database sessions
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for database models
Base = declarative_base()


def get_db():
    """
    Dependency function that provides a database session.
    Use this in FastAPI endpoints with Depends().
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
