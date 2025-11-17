# Multi-Tenant SaaS Architecture - SEO Automation Platform

**Project:** Med Spa SEO Automation Tool (Commercial SaaS)
**Architecture Type:** Multi-Tenant with Data Isolation
**Date:** November 17, 2025

---

## Table of Contents

1. [Multi-Tenancy Overview](#multi-tenancy-overview)
2. [Updated System Architecture](#updated-system-architecture)
3. [Database Schema Changes](#database-schema-changes)
4. [User Management & Authentication](#user-management--authentication)
5. [Workspace & Account Model](#workspace--account-model)
6. [Tone Profile Management](#tone-profile-management)
7. [Pricing & Subscription Model](#pricing--subscription-model)
8. [Onboarding Flow](#onboarding-flow)

---

## Multi-Tenancy Overview

### What Changed

**From:** Single-website tool for SkinFix KC
**To:** Multi-tenant SaaS platform serving multiple med spas

### Key Requirements

1. **Data Isolation** - Each med spa's data completely separated
2. **Custom Tone Profiles** - Each account has unique brand voice
3. **Multiple Users per Account** - Owner, managers, staff roles
4. **Flexible Pricing** - Different plans based on usage
5. **White-Label Capability** - Can be branded per customer (future)
6. **Scalable Architecture** - Handle 100s-1000s of accounts

### Tenancy Model: Hybrid Approach

```
Single Database + Tenant ID Isolation
├── Pros: Cost-effective, easier to maintain, simpler backups
├── Cons: Must ensure perfect data isolation
└── Mitigation: Row-level security, careful query design
```

**Why not separate databases per tenant?**
- Unnecessary complexity for this scale
- Much higher hosting costs
- Harder to implement cross-tenant analytics
- Can migrate to DB-per-tenant later if needed

---

## Updated System Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                     Marketing Website                          │
│              (www.medspaseo.ai - Next.js)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │   Landing    │  │   Pricing    │  │  Sign Up/Login   │    │
│  │     Page     │  │     Page     │  │      Forms       │    │
│  └──────────────┘  └──────────────┘  └──────────────────┘    │
└────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────┐
│                    Application Dashboard                        │
│              (app.medspaseo.ai - Next.js)                      │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │              Workspace Selector                          │ │
│  │    [SkinFix KC ▼]  Settings  Billing  Help              │ │
│  └──────────────────────────────────────────────────────────┘ │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   SEO        │  │   Content    │  │   A/B Tests      │   │
│  │  Dashboard   │  │  Generator   │  │   Management     │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└────────────────────────────────────────────────────────────────┘
                               │
                               ▼ (API Gateway with tenant context)
┌────────────────────────────────────────────────────────────────┐
│                    Backend API (FastAPI)                        │
│                   api.medspaseo.ai                             │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │         Tenant Middleware (Extract & Validate)           │ │
│  └──────────────────────────────────────────────────────────┘ │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │
│  │   Auth   │  │Workspace │  │  Content │  │   SEO        │ │
│  │ Service  │  │ Service  │  │ Service  │  │  Service     │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘ │
└────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────┐
│              PostgreSQL with Row-Level Security                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  All queries filtered by: WHERE workspace_id = :current  │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Accounts → Workspaces → Users → Data (Keywords, Content, etc)│
└────────────────────────────────────────────────────────────────┘
```

---

## Database Schema Changes

### New Tables for Multi-Tenancy

```sql
-- ============================================
-- Multi-Tenancy Core Tables
-- ============================================

-- Accounts (Billing Entity)
CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    subscription_plan VARCHAR(50) DEFAULT 'trial',  -- trial, starter, pro, enterprise
    subscription_status VARCHAR(50) DEFAULT 'active',  -- active, cancelled, suspended
    billing_email VARCHAR(255) NOT NULL,
    stripe_customer_id VARCHAR(255),
    trial_ends_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_stripe_customer (stripe_customer_id)
);

-- Workspaces (Med Spa Locations/Brands)
-- One account can have multiple workspaces (multi-location med spas)
CREATE TABLE workspaces (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,  -- "SkinFix KC - Overland Park"
    website_url VARCHAR(512),
    wordpress_url VARCHAR(512),
    wordpress_api_key TEXT,  -- Encrypted

    -- Business Info
    business_name VARCHAR(255),
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),

    -- Google Integration
    google_business_profile_id VARCHAR(255),
    google_analytics_property_id VARCHAR(255),
    google_search_console_property VARCHAR(512),

    -- Settings
    timezone VARCHAR(50) DEFAULT 'America/Chicago',
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_account_id (account_id)
);

-- Users (People who log in)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(255),
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_email (email)
);

-- User Workspace Memberships (Many-to-Many)
CREATE TABLE workspace_members (
    id SERIAL PRIMARY KEY,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,  -- owner, admin, editor, viewer
    invited_by INTEGER REFERENCES users(id),
    invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    joined_at TIMESTAMP,

    UNIQUE(workspace_id, user_id),
    INDEX idx_workspace_id (workspace_id),
    INDEX idx_user_id (user_id)
);

-- ============================================
-- Updated Existing Tables (Add workspace_id)
-- ============================================

-- All existing tables get workspace_id column
ALTER TABLE keyword_rankings ADD COLUMN workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE gbp_metrics ADD COLUMN workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE citations ADD COLUMN workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE tone_profiles ADD COLUMN workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE generated_content ADD COLUMN workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE ab_tests ADD COLUMN workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE;

-- Add indexes for workspace filtering (CRITICAL for performance)
CREATE INDEX idx_keyword_rankings_workspace ON keyword_rankings(workspace_id);
CREATE INDEX idx_gbp_metrics_workspace ON gbp_metrics(workspace_id);
CREATE INDEX idx_citations_workspace ON citations(workspace_id);
CREATE INDEX idx_tone_profiles_workspace ON tone_profiles(workspace_id);
CREATE INDEX idx_generated_content_workspace ON generated_content(workspace_id);
CREATE INDEX idx_ab_tests_workspace ON ab_tests(workspace_id);

-- Update unique constraints to be workspace-scoped
ALTER TABLE gbp_metrics DROP CONSTRAINT IF EXISTS gbp_metrics_date_key;
ALTER TABLE gbp_metrics ADD CONSTRAINT gbp_metrics_workspace_date_unique UNIQUE(workspace_id, date);

-- ============================================
-- Subscription & Billing Tables
-- ============================================

CREATE TABLE subscription_plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,  -- trial, starter, pro, enterprise
    display_name VARCHAR(100),  -- "Professional Plan"
    price_monthly INTEGER,  -- Price in cents (e.g., 9900 = $99)
    price_yearly INTEGER,

    -- Limits
    max_workspaces INTEGER,
    max_keywords INTEGER,
    max_blog_posts_per_month INTEGER,
    max_ab_tests INTEGER,
    includes_google_ads BOOLEAN DEFAULT FALSE,
    includes_review_management BOOLEAN DEFAULT FALSE,

    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    stripe_invoice_id VARCHAR(255),
    amount INTEGER NOT NULL,  -- in cents
    status VARCHAR(50),  -- paid, pending, failed
    billing_period_start DATE,
    billing_period_end DATE,
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_account_id (account_id),
    INDEX idx_stripe_invoice_id (stripe_invoice_id)
);

-- ============================================
-- Usage Tracking (for billing and limits)
-- ============================================

CREATE TABLE usage_metrics (
    id SERIAL PRIMARY KEY,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
    metric_type VARCHAR(100) NOT NULL,  -- blog_posts_generated, keywords_tracked, ab_tests_created
    count INTEGER DEFAULT 0,
    month DATE NOT NULL,  -- First day of month
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(workspace_id, metric_type, month),
    INDEX idx_workspace_month (workspace_id, month)
);
```

---

## User Management & Authentication

### Authentication Flow

```typescript
// 1. User Registration
POST /api/v1/auth/register
{
  "email": "owner@skinfixkc.com",
  "password": "...",
  "first_name": "Jane",
  "last_name": "Doe",
  "company_name": "SkinFix KC"
}

Response:
{
  "user_id": 1,
  "account_id": 1,
  "workspace_id": 1,
  "email_verification_sent": true
}

// 2. Email Verification
GET /api/v1/auth/verify-email?token=abc123

// 3. Login
POST /api/v1/auth/login
{
  "email": "owner@skinfixkc.com",
  "password": "..."
}

Response:
{
  "access_token": "eyJ...",
  "refresh_token": "...",
  "user": {
    "id": 1,
    "email": "owner@skinfixkc.com",
    "workspaces": [
      {
        "id": 1,
        "name": "SkinFix KC",
        "role": "owner"
      }
    ]
  }
}

// 4. All subsequent requests include workspace context
GET /api/v1/seo/rankings
Headers:
  Authorization: Bearer eyJ...
  X-Workspace-ID: 1
```

### JWT Token Structure

```json
{
  "user_id": 1,
  "email": "owner@skinfixkc.com",
  "workspaces": [
    {"id": 1, "role": "owner"},
    {"id": 2, "role": "editor"}
  ],
  "exp": 1700000000
}
```

### Permission Levels

```python
# Role Hierarchy
ROLES = {
    "owner": {
        "can_delete_workspace": True,
        "can_manage_billing": True,
        "can_invite_users": True,
        "can_edit_settings": True,
        "can_create_content": True,
        "can_view_analytics": True
    },
    "admin": {
        "can_delete_workspace": False,
        "can_manage_billing": False,
        "can_invite_users": True,
        "can_edit_settings": True,
        "can_create_content": True,
        "can_view_analytics": True
    },
    "editor": {
        "can_delete_workspace": False,
        "can_manage_billing": False,
        "can_invite_users": False,
        "can_edit_settings": False,
        "can_create_content": True,
        "can_view_analytics": True
    },
    "viewer": {
        "can_delete_workspace": False,
        "can_manage_billing": False,
        "can_invite_users": False,
        "can_edit_settings": False,
        "can_create_content": False,
        "can_view_analytics": True
    }
}
```

---

## Workspace & Account Model

### Account vs Workspace

**Account** = Billing entity (one subscription)
- SkinFix KC Med Spa (company)
- Has credit card on file
- Pays monthly/yearly subscription

**Workspace** = Individual location/brand
- SkinFix KC - Overland Park location
- SkinFix KC - Downtown location (if they expand)
- Each has own website, keywords, content

**Why separate?**
- Multi-location med spas common
- Each location has different SEO needs
- One bill, multiple workspaces (upsell opportunity)

### Workspace Switcher UI

```typescript
// User can switch between workspaces
<WorkspaceSwitcher
  workspaces={[
    { id: 1, name: "SkinFix KC - Overland Park", role: "owner" },
    { id: 2, name: "SkinFix KC - Downtown", role: "editor" }
  ]}
  current={1}
  onChange={(workspaceId) => {
    // Switch context, reload data
    setCurrentWorkspace(workspaceId)
  }}
/>
```

---

## Tone Profile Management

### Onboarding: Tone Training Flow

```
New User Journey:
1. Sign up → Create account
2. Create workspace (enter business info)
3. "Let's learn your brand voice" →
   ├── Upload writing samples
   │   - Paste existing blog posts
   │   - Upload social media posts
   │   - Paste emails/newsletters
   │   - Minimum 3 samples, 300+ words each
   │
   ├── AI analyzes samples →
   │   - Sentence structure
   │   - Vocabulary level
   │   - Tone attributes
   │   - Common phrases
   │
   ├── Generate test content →
   │   - Show sample paragraph
   │   - "Does this sound like you?"
   │
   └── Refine or approve →
       - If approved: Save tone profile
       - If not: Provide more samples or manual adjustment

4. Connect WordPress
5. Connect Google accounts
6. Start generating content!
```

### Tone Profile Structure

```python
# backend/models/tone.py

class ToneProfile(Base):
    __tablename__ = "tone_profiles"

    id = Column(Integer, primary_key=True)
    workspace_id = Column(Integer, ForeignKey('workspaces.id'), nullable=False)

    name = Column(String(255), default="Brand Voice")
    is_active = Column(Boolean, default=True)

    # Analysis Results
    analysis = Column(JSON, default={
        "avg_sentence_length": 15.0,
        "sentence_length_variance": 8.0,
        "vocabulary_level": "intermediate",  # basic, intermediate, advanced
        "lexical_diversity": 0.65,  # 0-1 score
        "formality_score": 0.4,  # 0=very casual, 1=very formal

        "tone_attributes": [
            "conversational",
            "friendly",
            "helpful",
            "uncertain",
            "collaborative"
        ],

        "common_phrases": [
            "I'm thinking",
            "Let me know",
            "Can you help",
            "I want to make sure"
        ],

        "vocabulary_preferences": {
            "contractions": True,  # I'm vs I am
            "first_person": True,  # "I" vs "we" vs avoiding
            "questions": "frequent",  # frequent, occasional, rare
            "industry_jargon": "minimal"
        },

        "structural_patterns": {
            "paragraph_length": "short-medium",  # 2-4 sentences
            "uses_lists": True,
            "uses_subheadings": True,
            "opens_with": ["question", "statement", "anecdote"]
        }
    })

    # Training Data
    writing_samples = Column(JSON)  # Array of sample texts
    training_data_word_count = Column(Integer)

    # Performance
    ai_detection_avg_score = Column(Float)  # Lower is better
    user_satisfaction_score = Column(Float)  # 1-5 stars

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
```

### Analyzing User's Tone (Your Samples)

```python
# Analysis of provided samples:

tone_profile = {
    "avg_sentence_length": 18.2,
    "sentence_length_variance": 11.5,  # High variance = varied rhythm
    "vocabulary_level": "intermediate",
    "formality_score": 0.3,  # Quite casual

    "tone_attributes": [
        "conversational",
        "thoughtfully_uncertain",
        "collaborative",
        "self_aware",
        "practical",
        "friendly"
    ],

    "common_opening_phrases": [
        "I'm thinking about",
        "I'm trying to",
        "I want to make sure",
        "I never really thought about"
    ],

    "common_closing_phrases": [
        "Let me know if",
        "Can you help me",
        "Whatever you suggest is good",
        "Let's come up with"
    ],

    "signature_patterns": {
        "asks_for_input": "very_frequent",
        "admits_uncertainty": "frequent",
        "references_others": "frequent",  # "the guys", "the kids"
        "uses_time_bounds": "frequent",  # "by the end of the month"
        "self_deprecating": "occasional"  # "I keep putting it off"
    },

    "vocabulary": {
        "contractions_rate": 0.95,  # Almost always
        "informal_words": ["stuff", "guys", "sorted", "piling up"],
        "filler_phrases": ["I mean", "you know", "just"],
        "word_choice": "simple_direct"  # Not flowery or academic
    }
}
```

### Content Generation with Tone

```python
# When generating content for this user:

async def generate_content_with_tone(topic: str, workspace_id: int):
    tone = await get_tone_profile(workspace_id)

    prompt = f"""Write a blog post about {topic} for a med spa website.

    CRITICAL: Write in this specific voice:

    Tone: {', '.join(tone['tone_attributes'])}

    Writing style rules:
    - Average sentence length: {tone['avg_sentence_length']} words, but vary it!
    - Use contractions {tone['vocabulary']['contractions_rate']*100}% of the time
    - Formality level: {tone['formality_score']} (0=casual, 1=formal)
    - Ask questions to engage reader (you do this frequently)
    - Admit when things are nuanced or uncertain
    - Use phrases like: {', '.join(tone['common_opening_phrases'][:3])}
    - Use simple, direct words: {', '.join(tone['vocabulary']['informal_words'])}
    - Reference reader's perspective ("you might be thinking...")
    - Keep paragraphs short (2-4 sentences)

    Example of your voice:
    {tone['writing_samples'][0][:200]}...

    Now write about {topic} in this exact style.
    """

    # Generate with Claude
    response = await claude.generate(prompt)

    return response
```

---

## Pricing & Subscription Model

### Suggested Pricing Tiers

```yaml
Trial (14 days):
  price: $0
  limits:
    workspaces: 1
    keywords: 10
    blog_posts_per_month: 2
    ab_tests: 1
  features:
    - Basic SEO tracking
    - Content generation
    - WordPress integration
    - Email support

Starter:
  price_monthly: $99
  price_yearly: $990 (2 months free)
  limits:
    workspaces: 1
    keywords: 50
    blog_posts_per_month: 8
    ab_tests: 3
  features:
    - Everything in Trial
    - Google Business Profile integration
    - Citation monitoring
    - Priority email support
    - Analytics dashboard

Professional:
  price_monthly: $249
  price_yearly: $2490
  limits:
    workspaces: 3
    keywords: 150
    blog_posts_per_month: 20
    ab_tests: 10
  features:
    - Everything in Starter
    - Google Ads automation
    - Review management
    - Multi-location support
    - Phone & chat support
    - Custom tone training

Enterprise:
  price: Custom
  limits:
    workspaces: Unlimited
    keywords: Unlimited
    blog_posts_per_month: Unlimited
    ab_tests: Unlimited
  features:
    - Everything in Professional
    - Dedicated account manager
    - Custom integrations
    - White-label option
    - SLA guarantee
    - Annual contract
```

### Usage Enforcement

```python
# backend/middleware/usage_limits.py

async def check_usage_limit(workspace_id: int, metric_type: str):
    """
    Check if workspace has reached usage limit for the month
    """
    # Get workspace's subscription plan
    workspace = await db.get_workspace(workspace_id)
    account = await db.get_account(workspace.account_id)
    plan = await db.get_subscription_plan(account.subscription_plan)

    # Get current month's usage
    current_month = datetime.now().replace(day=1)
    usage = await db.get_usage_metric(
        workspace_id=workspace_id,
        metric_type=metric_type,
        month=current_month
    )

    # Get limit for this plan
    limit_field = f"max_{metric_type}"
    limit = getattr(plan, limit_field)

    if usage.count >= limit:
        raise UsageLimitExceeded(
            f"You've reached your monthly limit of {limit} {metric_type}. "
            f"Upgrade your plan to increase limits."
        )

    return True

# Usage in endpoint:
@router.post("/content/generate")
async def generate_content(request: ContentRequest, workspace_id: int):
    # Check limit before generating
    await check_usage_limit(workspace_id, "blog_posts_per_month")

    # Generate content...
    content = await content_service.generate(...)

    # Increment usage counter
    await increment_usage(workspace_id, "blog_posts_per_month")

    return content
```

---

## Onboarding Flow

### Step-by-Step New User Experience

```
┌─────────────────────────────────────────────┐
│  Step 1: Sign Up                            │
│  ├── Email, password, name                  │
│  ├── Company name                           │
│  └── Auto-create: Account + Workspace + User│
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  Step 2: Verify Email                       │
│  "Check your email to verify your account"  │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  Step 3: Business Info (Workspace Setup)    │
│  ├── Med spa name                           │
│  ├── Website URL                            │
│  ├── Address, phone                         │
│  └── Timezone                               │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  Step 4: Brand Voice Training ⭐            │
│  "Let's learn how you communicate"          │
│  ├── Paste 3+ writing samples               │
│  │   - Blog posts                           │
│  │   - Social media                         │
│  │   - Emails to clients                    │
│  │   - Website copy                         │
│  ├── AI analyzes (30 sec)                   │
│  ├── Shows test paragraph                   │
│  │   "We're thinking about adding a new     │
│  │    treatment to our lineup. Botox is...  │
│  │    Let us know if you have questions!"   │
│  └── User approves or refines               │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  Step 5: WordPress Connection               │
│  ├── WordPress URL                          │
│  ├── Install plugin (guided)                │
│  ├── Generate API key                       │
│  └── Test connection                        │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  Step 6: Google Integrations                │
│  ├── Connect Google Search Console          │
│  ├── Connect Google Analytics               │
│  ├── Connect Google Business Profile        │
│  └── "We can help you set these up"         │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  Step 7: Keyword Setup                      │
│  ├── Suggest 20 keywords based on:          │
│  │   - Google Search Console data           │
│  │   - Competitor analysis                  │
│  │   - Industry best practices              │
│  ├── User reviews and adds more             │
│  └── Start tracking                         │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  Step 8: First Content Generation           │
│  "Let's create your first blog post!"       │
│  ├── Suggest topic based on keywords        │
│  ├── Generate draft (2 min)                 │
│  ├── Show preview                           │
│  ├── User edits if needed                   │
│  └── Publish or schedule                    │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  Step 9: Dashboard Tour                     │
│  Interactive walkthrough of features        │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  Step 10: Set Up Billing (Day 12 of trial)  │
│  "Your trial ends in 2 days. Choose a plan" │
└─────────────────────────────────────────────┘
```

### Onboarding Checklist Component

```typescript
// Show progress during onboarding
<OnboardingChecklist
  steps={[
    { id: 1, title: "Create account", completed: true },
    { id: 2, title: "Verify email", completed: true },
    { id: 3, title: "Business info", completed: true },
    { id: 4, title: "Train brand voice", completed: false, current: true },
    { id: 5, title: "Connect WordPress", completed: false },
    { id: 6, title: "Connect Google", completed: false },
    { id: 7, title: "Set up keywords", completed: false },
    { id: 8, title: "Generate first post", completed: false }
  ]}
/>
```

---

## Updated Phase 1 Scope

### What's Added for SaaS

**Week 1-2: Foundation (expanded)**
- Multi-tenant database schema
- Account/workspace models
- User authentication system
- JWT implementation
- Role-based access control

**Week 3: User Management**
- Registration flow
- Email verification
- Workspace creation
- Invitation system

**Week 4: Onboarding Flow**
- Step-by-step wizard
- Brand voice training UI
- Integration setup
- Checklist component

**Week 5: Subscription & Billing**
- Stripe integration
- Subscription plans
- Usage tracking
- Limit enforcement

**Weeks 6-16: Continue as planned**
- SEO engine
- Content generation
- A/B testing
- Analytics dashboard

### Updated Timeline: 18-20 weeks (SaaS adds 2-4 weeks)

---

## Key Implementation Details

### Tenant Context Middleware

```python
# backend/middleware/tenant.py

from fastapi import Request, HTTPException
from typing import Optional

async def get_workspace_context(request: Request) -> int:
    """
    Extract workspace ID from request headers
    Validate user has access to this workspace
    """
    workspace_id = request.headers.get('X-Workspace-ID')

    if not workspace_id:
        raise HTTPException(400, "Workspace ID required")

    # Get user from JWT token
    user = request.state.user

    # Verify user has access to this workspace
    membership = await db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == user.id
    ).first()

    if not membership:
        raise HTTPException(403, "Access denied to this workspace")

    # Store in request state for easy access
    request.state.workspace_id = int(workspace_id)
    request.state.workspace_role = membership.role

    return int(workspace_id)

# Apply to all protected routes
@app.middleware("http")
async def tenant_middleware(request: Request, call_next):
    if request.url.path.startswith("/api/v1/") and \
       request.url.path not in ["/api/v1/auth/login", "/api/v1/auth/register"]:
        await get_workspace_context(request)

    response = await call_next(request)
    return response
```

### Data Isolation Helper

```python
# backend/db/base.py

class TenantScopedQuery:
    """
    Automatically filter all queries by workspace_id
    """

    @staticmethod
    def filter_by_workspace(query, workspace_id: int):
        """Add workspace filter to query"""
        return query.filter(workspace_id=workspace_id)

# Usage in services:
async def get_keywords(workspace_id: int):
    query = db.query(KeywordRanking)
    query = TenantScopedQuery.filter_by_workspace(query, workspace_id)
    return await query.all()

# NEVER allow queries without workspace filter in application code!
```

---

## Security Considerations

### Critical Security Rules

1. **ALWAYS filter by workspace_id** - Never query without it
2. **Validate workspace access** - Check JWT permissions
3. **Encrypt sensitive data** - API keys, passwords
4. **Rate limiting per workspace** - Prevent abuse
5. **Audit logging** - Who did what, when
6. **Input validation** - Never trust user input
7. **SQL injection prevention** - Use parameterized queries
8. **XSS prevention** - Sanitize outputs

### Audit Log

```python
# Track all important actions
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    workspace_id INTEGER REFERENCES workspaces(id),
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100),  -- 'content.generated', 'ab_test.created'
    resource_type VARCHAR(50),
    resource_id INTEGER,
    metadata JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_workspace_id (workspace_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at)
);
```

---

## Next Steps

1. **Review this SaaS architecture**
2. **Approve domain strategy** (med spa specific vs general)
3. **Approve pricing model**
4. **Refine onboarding flow**
5. **Begin implementation**

---

**Document Version:** 2.0 (Multi-Tenant SaaS)
**Last Updated:** November 17, 2025
