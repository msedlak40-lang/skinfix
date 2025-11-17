# Development Setup & Testing Guide

**Project:** Med Spa SEO Automation SaaS
**Purpose:** Get up and running for local testing without domains
**Date:** November 17, 2025

---

## Table of Contents

1. [Repository Structure](#repository-structure)
2. [Local Development Setup](#local-development-setup)
3. [Testing Without Domains](#testing-without-domains)
4. [AWS Staging Environment](#aws-staging-environment)
5. [Cost Tracking Setup](#cost-tracking-setup)
6. [Week 1 Implementation Plan](#week-1-implementation-plan)

---

## Repository Structure

### Keep Using Current Repo (`skinfix`)

We'll organize everything with subdirectories:

```
skinfix/
├── docs/                           # ✅ Already exists
│   ├── seo-automation-tool-scope.md
│   ├── phase1-technical-specification.md
│   └── saas-architecture.md
│
├── backend/                        # NEW: FastAPI backend
│   ├── alembic/                   # Database migrations
│   ├── app/
│   │   ├── api/                   # API endpoints
│   │   │   ├── v1/
│   │   │   │   ├── auth.py
│   │   │   │   ├── workspaces.py
│   │   │   │   ├── seo.py
│   │   │   │   ├── content.py
│   │   │   │   └── ab_testing.py
│   │   │   └── deps.py            # Dependencies (auth, DB session)
│   │   ├── core/
│   │   │   ├── config.py          # Settings
│   │   │   ├── security.py        # JWT, password hashing
│   │   │   └── database.py        # DB connection
│   │   ├── models/                # SQLAlchemy models
│   │   │   ├── user.py
│   │   │   ├── workspace.py
│   │   │   ├── seo.py
│   │   │   └── content.py
│   │   ├── services/              # Business logic
│   │   │   ├── auth_service.py
│   │   │   ├── local_seo_service.py
│   │   │   ├── content_service.py
│   │   │   └── ab_testing_service.py
│   │   ├── schemas/               # Pydantic schemas (API contracts)
│   │   │   ├── user.py
│   │   │   ├── workspace.py
│   │   │   └── content.py
│   │   └── main.py                # FastAPI app entry point
│   ├── tests/                     # Pytest tests
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── dashboard/                      # NEW: Next.js dashboard
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/
│   │   │   │   └── register/
│   │   │   ├── (dashboard)/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── content/
│   │   │   │   ├── seo/
│   │   │   │   └── ab-tests/
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── ui/                # shadcn components
│   │   │   ├── metrics/
│   │   │   ├── charts/
│   │   │   └── workspace/
│   │   ├── lib/
│   │   │   ├── api.ts             # API client
│   │   │   └── auth.ts            # Auth helpers
│   │   └── types/
│   ├── public/
│   ├── package.json
│   └── .env.local.example
│
├── wordpress-plugin/               # NEW: WordPress plugin
│   ├── skinfix-seo-automation.php
│   ├── includes/
│   ├── admin/
│   └── public/
│
├── marketing-site/                 # FUTURE: Marketing website (Phase 2)
│   └── (Next.js site for www.domain.com)
│
├── infrastructure/                 # NEW: IaC and deployment
│   ├── terraform/
│   │   ├── staging/
│   │   └── production/
│   ├── docker/
│   │   └── docker-compose.yml     # Local dev environment
│   └── scripts/
│       ├── setup-local.sh
│       └── deploy-staging.sh
│
├── .github/
│   └── workflows/
│       ├── backend-ci.yml
│       └── dashboard-ci.yml
│
└── README.md                       # Update with new structure
```

### Update .gitignore

```bash
# Add to existing .gitignore

# Backend
backend/.env
backend/__pycache__/
backend/*.pyc
backend/venv/
backend/.pytest_cache/

# Dashboard
dashboard/.env.local
dashboard/.next/
dashboard/node_modules/
dashboard/out/

# IDEs
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db

# Secrets
*.pem
*.key
*.cert
secrets/
```

---

## Local Development Setup

### Prerequisites

```bash
# Check you have these installed:
python --version    # Need 3.11+
node --version      # Need 18+
docker --version    # Need 20+
psql --version      # PostgreSQL client
```

### Step 1: Set Up Local Database (Docker)

**Create `infrastructure/docker/docker-compose.yml`:**

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: medspa-seo-db
    environment:
      POSTGRES_USER: medspa_dev
      POSTGRES_PASSWORD: dev_password_123
      POSTGRES_DB: medspa_seo_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U medspa_dev"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: medspa-seo-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Optional: Database admin UI
  adminer:
    image: adminer
    container_name: medspa-seo-adminer
    ports:
      - "8080:8080"
    depends_on:
      - postgres

volumes:
  postgres_data:
  redis_data:
```

**Start services:**

```bash
cd infrastructure/docker
docker-compose up -d

# Verify running:
docker-compose ps

# View logs:
docker-compose logs -f postgres

# Access DB admin UI:
# Open http://localhost:8080
# System: PostgreSQL
# Server: postgres
# Username: medspa_dev
# Password: dev_password_123
# Database: medspa_seo_dev
```

### Step 2: Backend Setup

**Create `backend/.env`:**

```bash
# Database
DATABASE_URL=postgresql://medspa_dev:dev_password_123@localhost:5432/medspa_seo_dev
REDIS_URL=redis://localhost:6379/0

# Security
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# API Keys (get these when ready to test integrations)
ANTHROPIC_API_KEY=sk-ant-your-key-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Environment
ENVIRONMENT=development
DEBUG=True
API_HOST=0.0.0.0
API_PORT=8000

# CORS (allow dashboard to connect)
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# Email (for testing, use mailtrap.io or similar)
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your-mailtrap-user
SMTP_PASSWORD=your-mailtrap-password
EMAIL_FROM=noreply@localhost

# Stripe (can add later)
# STRIPE_SECRET_KEY=sk_test_...
# STRIPE_WEBHOOK_SECRET=whsec_...
```

**Install backend:**

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Seed development data (optional)
python scripts/seed_dev_data.py

# Start development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Backend will be available at:**
- API: http://localhost:8000
- API Docs: http://localhost:8000/docs (Swagger UI)
- Alternative Docs: http://localhost:8000/redoc

### Step 3: Dashboard Setup

**Create `dashboard/.env.local`:**

```bash
# API
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1

# Environment
NEXT_PUBLIC_ENVIRONMENT=development

# Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-change-in-production
```

**Install and run:**

```bash
cd dashboard

# Install dependencies
npm install

# Run development server
npm run dev
```

**Dashboard will be available at:**
- http://localhost:3000

### Step 4: Create First User (Via API)

```bash
# Option 1: Use Swagger UI
# Go to http://localhost:8000/docs
# POST /api/v1/auth/register
# Fill in the form and execute

# Option 2: Use curl
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "you@skinfixkc.com",
    "password": "test123456",
    "first_name": "Your",
    "last_name": "Name",
    "company_name": "SkinFix KC"
  }'

# Response will include:
# - user_id
# - account_id
# - workspace_id
# - JWT tokens

# Option 3: Use the dashboard
# Go to http://localhost:3000/register
# Fill out the form
```

---

## Testing Without Domains

### Local URLs

Everything runs on `localhost`:

```
Dashboard:         http://localhost:3000
API:               http://localhost:8000
API Docs:          http://localhost:8000/docs
Database Admin:    http://localhost:8080
WordPress (local): http://localhost:8888 (if using Local WP)
```

### Testing WordPress Integration Locally

**Option 1: Local by Flywheel (Recommended)**

```bash
# Download: https://localwp.com
# Create new site: "skinfix-test"
# URL will be: http://skinfix-test.local
# Install our plugin
# Point it to: http://localhost:8000
```

**Option 2: Docker WordPress**

```yaml
# Add to docker-compose.yml

  wordpress:
    image: wordpress:latest
    container_name: medspa-seo-wordpress
    ports:
      - "8888:80"
    environment:
      WORDPRESS_DB_HOST: wordpress-db
      WORDPRESS_DB_NAME: wordpress
      WORDPRESS_DB_USER: wordpress
      WORDPRESS_DB_PASSWORD: wordpress
    volumes:
      - ./wordpress-plugin:/var/www/html/wp-content/plugins/skinfix-seo-automation
      - wordpress_data:/var/www/html

  wordpress-db:
    image: mysql:8
    container_name: medspa-seo-wordpress-db
    environment:
      MYSQL_DATABASE: wordpress
      MYSQL_USER: wordpress
      MYSQL_PASSWORD: wordpress
      MYSQL_ROOT_PASSWORD: root
    volumes:
      - wordpress_db_data:/var/lib/mysql

volumes:
  wordpress_data:
  wordpress_db_data:
```

### Mobile Testing (Same Network)

```bash
# Find your local IP
ipconfig getifaddr en0  # Mac
hostname -I              # Linux
ipconfig                 # Windows

# Example: 192.168.1.100

# Access from phone/tablet on same WiFi:
# Dashboard: http://192.168.1.100:3000
# API: http://192.168.1.100:8000

# Update .env to allow:
CORS_ORIGINS=http://localhost:3000,http://192.168.1.100:3000
```

---

## AWS Staging Environment

When you're ready to deploy a staging version for testing:

### Architecture

```
AWS Staging Setup (Low Cost)
├── EC2 t3.small ($15/month)
│   ├── Backend API (Docker)
│   ├── Dashboard (Next.js)
│   └── Nginx reverse proxy
├── RDS PostgreSQL t3.micro ($15/month)
├── ElastiCache Redis t3.micro ($15/month)
├── S3 bucket ($1-5/month)
└── Total: ~$50/month
```

### Temporary URLs for Testing

**Option 1: Use EC2 Public IP**
```
API:       http://54.123.45.67:8000
Dashboard: http://54.123.45.67:3000
```

**Option 2: Use Free Subdomains**
```
# Use services like:
- ngrok.io (free tier)
- localhost.run (free)
- serveo.net (free)

# Or AWS Route 53 with temporary subdomain:
staging-api.yourdomain.com  (if you have any domain)
staging-app.yourdomain.com
```

**Option 3: AWS CloudFront + S3 (Gets you HTTPS)**
```
# CloudFront provides URLs like:
https://d123456789abcd.cloudfront.net

# Point to S3/EC2
```

### One-Command Staging Deploy

**Create `infrastructure/scripts/deploy-staging.sh`:**

```bash
#!/bin/bash
set -e

echo "🚀 Deploying to AWS Staging..."

# Build backend Docker image
cd backend
docker build -t medspa-seo-backend:latest .

# Build dashboard
cd ../dashboard
npm run build

# Push to AWS ECR
# Deploy to EC2
# Update environment variables
# Run migrations
# Restart services

echo "✅ Deployed to staging!"
echo "📊 Dashboard: http://your-ec2-ip:3000"
echo "🔌 API: http://your-ec2-ip:8000"
```

---

## Cost Tracking Setup

### Set Up AWS Cost Monitoring

**1. Enable Cost Explorer**
```
AWS Console → Billing → Cost Explorer → Enable

Tag all resources:
  Project: medspa-seo
  Environment: staging | production
  Component: backend | database | cache
```

**2. Create Budget Alerts**
```
AWS Console → Billing → Budgets → Create Budget

Alert 1: $50/month threshold (staging)
Alert 2: $200/month threshold (production warning)
Alert 3: $500/month threshold (production critical)
```

**3. Track API Costs**

**Create `backend/app/utils/cost_tracker.py`:**

```python
"""
Track operational costs per request/feature
"""

import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

class CostTracker:
    """Track API usage costs"""

    # Cost per 1M tokens (as of Nov 2024)
    CLAUDE_COSTS = {
        "claude-3-5-sonnet-20241022": {
            "input": 3.00,   # $3 per 1M input tokens
            "output": 15.00  # $15 per 1M output tokens
        }
    }

    @classmethod
    def track_llm_usage(
        cls,
        workspace_id: int,
        operation: str,
        model: str,
        input_tokens: int,
        output_tokens: int
    ):
        """Track LLM API usage and cost"""

        costs = cls.CLAUDE_COSTS.get(model, {})
        input_cost = (input_tokens / 1_000_000) * costs.get("input", 0)
        output_cost = (output_tokens / 1_000_000) * costs.get("output", 0)
        total_cost = input_cost + output_cost

        # Log to database
        logger.info(
            f"LLM Usage: workspace={workspace_id}, "
            f"operation={operation}, "
            f"tokens={input_tokens + output_tokens}, "
            f"cost=${total_cost:.4f}"
        )

        # Store in database for reporting
        # db.create_cost_record(...)

        return total_cost

# Usage in content service:
async def generate_blog_post(topic: str, workspace_id: int):
    response = await claude.generate(prompt)

    # Track cost
    CostTracker.track_llm_usage(
        workspace_id=workspace_id,
        operation="blog_post_generation",
        model="claude-3-5-sonnet-20241022",
        input_tokens=response.usage.input_tokens,
        output_tokens=response.usage.output_tokens
    )

    return response.content
```

**Add to database schema:**

```sql
CREATE TABLE cost_tracking (
    id SERIAL PRIMARY KEY,
    workspace_id INTEGER REFERENCES workspaces(id),
    operation VARCHAR(100),  -- 'blog_post_generation', 'keyword_analysis'
    service VARCHAR(50),      -- 'anthropic', 'openai', 'google_apis'
    tokens_used INTEGER,
    cost_usd DECIMAL(10, 6),
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_workspace_date (workspace_id, created_at),
    INDEX idx_operation (operation)
);

-- Query monthly costs:
SELECT
    operation,
    SUM(cost_usd) as total_cost,
    COUNT(*) as operations_count,
    SUM(tokens_used) as total_tokens
FROM cost_tracking
WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY operation
ORDER BY total_cost DESC;
```

### Cost Dashboard

Add to admin dashboard:

```typescript
// Show real operational costs
<CostDashboard
  monthlyBreakdown={{
    anthropic_api: 45.32,
    google_apis: 12.50,
    aws_infrastructure: 52.18,
    total: 110.00
  }}
  perCustomer={{
    avg_monthly_cost: 2.20,  // $110 / 50 customers
    highest: 8.45,
    lowest: 0.32
  }}
/>
```

### Recommended Pricing Buffer

```
Rule of thumb: Price at 10-20x your cost

Example:
- Cost per customer: $2.20/month
- Starter plan: $99/month (45x margin)
- Professional plan: $249/month (113x margin)

This covers:
- Infrastructure
- Support
- Development
- Marketing
- Profit
```

---

## Week 1 Implementation Plan

Let's get the foundation working locally:

### Day 1-2: Infrastructure Setup

```bash
# ✅ Set up repository structure
mkdir -p backend dashboard wordpress-plugin infrastructure/docker

# ✅ Set up local database
cd infrastructure/docker
docker-compose up -d

# ✅ Initialize backend
cd ../../backend
python3 -m venv venv
source venv/bin/activate
pip install fastapi uvicorn sqlalchemy alembic psycopg2-binary python-jose passlib python-multipart

# ✅ Initialize dashboard
cd ../dashboard
npx create-next-app@latest . --typescript --tailwind --app --use-npm

# ✅ Test everything starts
# Terminal 1: Backend
cd backend && uvicorn app.main:app --reload

# Terminal 2: Dashboard
cd dashboard && npm run dev

# Terminal 3: Database
docker-compose logs -f postgres
```

### Day 3-4: Authentication & Database

**Goals:**
- User registration working
- Login working
- JWT tokens working
- Database tables created
- Can create account → workspace → user via API

**Test:**
```bash
# Register user via API
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@skinfixkc.com",
    "password": "test123",
    "first_name": "Test",
    "last_name": "User",
    "company_name": "SkinFix KC"
  }'

# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@skinfixkc.com",
    "password": "test123"
  }'

# Should get back JWT token

# Test protected endpoint
curl http://localhost:8000/api/v1/workspaces/1 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Day 5: Dashboard Login Flow

**Goals:**
- Login page works
- Registration page works
- JWT stored in browser
- Can access dashboard after login
- Workspace selector shows

**Test:**
```
1. Go to http://localhost:3000/register
2. Fill out form
3. See "Check your email" (or auto-login for dev)
4. Go to http://localhost:3000/dashboard
5. See dashboard with workspace name
```

### Week 1 Success Criteria

By end of Week 1, you should have:

- ✅ Local development environment running
- ✅ Database with multi-tenant schema
- ✅ User registration via API
- ✅ User login via API and dashboard
- ✅ JWT authentication working
- ✅ Basic dashboard showing workspace name
- ✅ All services running in Docker
- ✅ Cost tracking infrastructure in place

**Deliverable:**
A working authentication system where you can:
1. Register a SkinFix KC account
2. Log in
3. See a basic dashboard with workspace selector
4. Make authenticated API calls

---

## Quick Start Commands

Save this for easy reference:

```bash
# Start all services
cd infrastructure/docker && docker-compose up -d

# Start backend
cd backend && source venv/bin/activate && uvicorn app.main:app --reload

# Start dashboard
cd dashboard && npm run dev

# View logs
docker-compose logs -f

# Reset database (careful!)
docker-compose down -v && docker-compose up -d

# Run tests
cd backend && pytest
cd dashboard && npm test

# Check costs
psql postgresql://medspa_dev:dev_password_123@localhost:5432/medspa_seo_dev
SELECT SUM(cost_usd) FROM cost_tracking WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE);
```

---

## Troubleshooting

### Database won't connect
```bash
# Check if running
docker-compose ps

# Check logs
docker-compose logs postgres

# Restart
docker-compose restart postgres

# Test connection
psql postgresql://medspa_dev:dev_password_123@localhost:5432/medspa_seo_dev
```

### Backend won't start
```bash
# Check Python version
python --version  # Need 3.11+

# Reinstall dependencies
pip install -r requirements.txt --force-reinstall

# Check .env file exists
cat backend/.env

# Check database migrations
alembic current
alembic upgrade head
```

### Dashboard won't start
```bash
# Clear cache
rm -rf .next node_modules
npm install

# Check .env.local
cat .env.local

# Check API is running
curl http://localhost:8000/health
```

---

## Next Steps

1. **This week:** Set up local environment following this guide
2. **Next week:** Implement first feature (user auth)
3. **Week 3:** Add workspace management
4. **Week 4:** Deploy to AWS staging for remote testing

**Questions? Issues?** Document them as you go and we'll solve them together.

---

**Ready to start? Let's begin with Week 1 setup!**
