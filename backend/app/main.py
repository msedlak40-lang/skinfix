"""
Main FastAPI Application
Entry point for the Med Spa SEO Automation API
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    docs_url="/docs",  # Swagger UI at http://localhost:8000/docs
    redoc_url="/redoc",  # ReDoc at http://localhost:8000/redoc
)

# Add CORS middleware (allows dashboard to connect from different port)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Run when the application starts"""
    logger.info("🚀 Starting Med Spa SEO Automation API")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"API Docs: http://{settings.API_HOST}:{settings.API_PORT}/docs")


@app.on_event("shutdown")
async def shutdown_event():
    """Run when the application shuts down"""
    logger.info("👋 Shutting down Med Spa SEO Automation API")


# Health check endpoint
@app.get("/")
async def root():
    """
    Simple health check endpoint
    Returns basic info about the API
    """
    return {
        "message": "Med Spa SEO Automation API",
        "version": settings.VERSION,
        "status": "running",
        "environment": settings.ENVIRONMENT,
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """
    Detailed health check
    Checks database connection
    """
    try:
        # Try to connect to database
        with engine.connect() as connection:
            connection.execute("SELECT 1")

        return {
            "status": "healthy",
            "database": "connected",
            "version": settings.VERSION
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e)
        }


# API v1 endpoints will go here later
# @app.include_router(auth_router, prefix=settings.API_V1_STR)
# @app.include_router(workspaces_router, prefix=settings.API_V1_STR)
