# Med Spa SEO Automation Platform

AI-powered SEO automation and testing tool designed specifically for med spas. Generates brand-aligned content, tracks local SEO performance, runs A/B tests, and manages Google Ads campaigns.

**Status:** Phase 1 Development (Weeks 1-20)
**Beta Customer:** SkinFix KC

---

## 📁 Repository Structure

```
skinfix/
├── docs/                           # Project documentation
│   ├── seo-automation-tool-scope.md
│   ├── phase1-technical-specification.md
│   ├── saas-architecture.md
│   └── development-setup-guide.md
│
├── backend/                        # FastAPI backend service
├── dashboard/                      # Next.js admin dashboard
├── wordpress-plugin/               # WordPress integration plugin
├── infrastructure/                 # Docker, Terraform, deployment scripts
└── README.md                       # This file
```

---

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL client (psql)

### Local Development Setup

```bash
# 1. Start database and services
cd infrastructure/docker
docker-compose up -d

# 2. Set up backend
cd ../../backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
cp .env.example .env      # Edit with your values
pip install -r requirements.txt

# 3. Run database migrations (once implemented)
# alembic upgrade head

# 4. Start backend server
uvicorn app.main:app --reload

# Backend runs on: http://localhost:8000
# API docs: http://localhost:8000/docs
```

```bash
# 5. Set up dashboard (in new terminal)
cd dashboard
npm install
cp .env.local.example .env.local  # Edit with your values
npm run dev

# Dashboard runs on: http://localhost:3000
```

### Access Services

- **Dashboard:** http://localhost:3000
- **API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs
- **Database Admin:** http://localhost:8080

---

## 📚 Documentation

Comprehensive documentation is in the `docs/` directory:

1. **[Project Scope](docs/seo-automation-tool-scope.md)** - Complete feature list and 3-phase roadmap
2. **[Phase 1 Technical Spec](docs/phase1-technical-specification.md)** - Detailed implementation blueprint
3. **[SaaS Architecture](docs/saas-architecture.md)** - Multi-tenant design and database schema
4. **[Development Setup Guide](docs/development-setup-guide.md)** - Full setup instructions and troubleshooting

---

## 🎯 Phase 1 Features (Current)

**Timeline:** 18-20 weeks

### Core Modules

1. **Local SEO Engine**
   - Google Business Profile integration
   - Keyword ranking tracker (20-50 keywords)
   - Citation monitoring

2. **Content Generation**
   - AI-powered blog post generator
   - Brand voice matching system
   - WordPress auto-publishing

3. **A/B Testing Framework**
   - Page variant creation
   - Statistical significance testing
   - Elementor integration

4. **Analytics Dashboard**
   - Real-time SEO metrics
   - Conversion tracking
   - Test results visualization

5. **Multi-Tenant SaaS**
   - User authentication & workspace management
   - Subscription billing (Stripe)
   - Usage tracking and limits

---

## 💰 Pricing Model (Planned)

- **Trial:** FREE (14 days)
- **Starter:** $99/month
- **Professional:** $249/month
- **Enterprise:** Custom pricing

---

## 🏗️ Technology Stack

### Backend
- **Framework:** FastAPI (Python 3.11+)
- **Database:** PostgreSQL 15
- **Cache:** Redis 7
- **Task Queue:** Celery
- **AI:** Anthropic Claude API

### Frontend
- **Framework:** Next.js 14 (React 18)
- **UI:** Tailwind CSS + shadcn/ui
- **Charts:** Recharts
- **State:** React Query

### Infrastructure
- **Hosting:** AWS (EC2, RDS, ElastiCache)
- **Storage:** S3
- **Deployment:** Docker + Terraform

---

## 🔐 Environment Variables

Copy `.env.example` files and update with your values:

```bash
# Backend
cp backend/.env.example backend/.env

# Dashboard
cp dashboard/.env.local.example dashboard/.env.local
```

Required API keys:
- Anthropic API key (for content generation)
- Google OAuth credentials (for Search Console, Analytics, GBP)
- Stripe keys (for billing, when implemented)

---

## 🧪 Testing

```bash
# Backend tests
cd backend
pytest

# Dashboard tests
cd dashboard
npm test

# E2E tests (when implemented)
npm run test:e2e
```

---

## 📊 Cost Tracking

Track operational costs per customer:

```sql
-- Query monthly costs
SELECT
    operation,
    SUM(cost_usd) as total_cost,
    COUNT(*) as operations_count
FROM cost_tracking
WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY operation
ORDER BY total_cost DESC;
```

---

## 📝 Development Progress

**Current Week:** Week 1 - Foundation Setup
- [x] Project scoping and architecture
- [x] Repository structure
- [ ] Database schema implementation
- [ ] Authentication system
- [ ] Basic dashboard

See [Phase 1 Technical Spec](docs/phase1-technical-specification.md) for detailed timeline.

---

## 📞 Support

For development questions, see the [Development Setup Guide](docs/development-setup-guide.md).

---

## 📄 License

Proprietary - All rights reserved
