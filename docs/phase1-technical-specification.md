# Phase 1: Technical Specification - SEO Automation Tool MVP

**Project:** SkinFix KC SEO Automation Tool
**Phase:** 1 - MVP Foundation
**Timeline:** 3-4 months
**Date:** November 17, 2025

---

## Table of Contents

1. [Phase 1 Overview](#phase-1-overview)
2. [System Architecture](#system-architecture)
3. [Component Specifications](#component-specifications)
4. [Database Schema](#database-schema)
5. [API Specifications](#api-specifications)
6. [WordPress Plugin Architecture](#wordpress-plugin-architecture)
7. [Development Roadmap](#development-roadmap)
8. [Testing Strategy](#testing-strategy)
9. [Deployment Plan](#deployment-plan)

---

## Phase 1 Overview

### Goals
Build the foundational system that can:
1. Analyze local SEO performance and provide actionable insights
2. Generate brand-aligned blog content automatically
3. Run A/B tests on landing pages
4. Track and visualize key SEO metrics
5. Integrate seamlessly with WordPress/Elementor

### Success Metrics
- Generate 2-4 quality blog posts per month
- Run at least 2 concurrent A/B tests
- Achieve 20% improvement in local search visibility
- Dashboard tracking 10+ key metrics with real-time updates

### Out of Scope for Phase 1
- Google Ads integration (Phase 2)
- Review management (Phase 2)
- Advanced competitor analysis (Phase 3)
- Predictive analytics (Phase 3)
- Email marketing integration (Phase 3)

---

## System Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Layer                              │
│  ┌──────────────────┐         ┌──────────────────────────┐     │
│  │  WordPress Admin │         │   Analytics Dashboard    │     │
│  │   (Plugin UI)    │         │    (React SPA)           │     │
│  └────────┬─────────┘         └──────────┬───────────────┘     │
└───────────┼────────────────────────────────┼───────────────────┘
            │                                │
            │ WordPress                      │ HTTPS/REST
            │ REST API                       │
            │                                │
┌───────────┼────────────────────────────────┼───────────────────┐
│           │         API Gateway            │                   │
│           ▼                                ▼                   │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              Backend Service (FastAPI/Python)           │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │  │
│  │  │   SEO    │  │ Content  │  │  A/B     │  │Analytics│ │  │
│  │  │ Analysis │  │Generator │  │ Testing  │  │ Service │ │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                │                               │
│                                ▼                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                    Task Queue (Celery)                  │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │  │
│  │  │  SEO Crawler │  │Content Writer│  │  Data Sync   │  │  │
│  │  │    Worker    │  │   Worker     │  │   Worker     │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────┬───────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
            ▼               ▼               ▼
┌─────────────────┐  ┌──────────┐  ┌──────────────────┐
│   PostgreSQL    │  │  Redis   │  │  S3/Object Store │
│  (Primary DB)   │  │ (Cache)  │  │  (Content/Media) │
└─────────────────┘  └──────────┘  └──────────────────┘
            │
            │ External APIs
            │
┌───────────┼──────────────────────────────────────────────────┐
│           ▼                                                   │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │    Google      │  │   Google     │  │  Google         │  │
│  │ Search Console │  │  Analytics   │  │  Business       │  │
│  │      API       │  │     API      │  │  Profile API    │  │
│  └────────────────┘  └──────────────┘  └─────────────────┘  │
│                                                               │
│  ┌────────────────┐  ┌──────────────┐                        │
│  │   Anthropic    │  │   WordPress  │                        │
│  │  Claude API    │  │   REST API   │                        │
│  └────────────────┘  └──────────────┘                        │
└───────────────────────────────────────────────────────────────┘
```

### Technology Stack

#### Backend Service
- **Framework:** FastAPI (Python 3.11+)
- **Why:** Fast, modern, excellent API docs, async support, type hints
- **Task Queue:** Celery with Redis broker
- **Why:** Robust async job processing, retry logic, scheduling

#### Database Layer
- **Primary Database:** PostgreSQL 15+
- **Why:** Excellent JSON support, full-text search, reliability
- **Cache:** Redis 7+
- **Why:** Fast caching, session storage, Celery broker
- **Object Storage:** AWS S3 or DigitalOcean Spaces
- **Why:** Scalable media/content storage

#### Frontend Dashboard
- **Framework:** Next.js 14 (React 18)
- **Why:** Server-side rendering, excellent performance, API routes
- **UI Library:** Tailwind CSS + shadcn/ui
- **Why:** Modern, customizable, accessible components
- **Charts:** Recharts
- **Why:** React-native charts, easy to customize
- **State Management:** React Query (TanStack Query)
- **Why:** Server state management, caching, optimistic updates

#### WordPress Plugin
- **Admin UI:** React (built with wp-scripts)
- **Why:** Modern UI, consistent with WP admin trends
- **Backend:** PHP 8.0+ with WordPress REST API
- **Why:** Native WordPress integration
- **Elementor Integration:** Elementor PHP SDK
- **Why:** Create custom widgets for A/B testing

#### AI/ML
- **Primary LLM:** Anthropic Claude 3.5 Sonnet
- **Why:** Best at maintaining tone/style, following complex instructions
- **Backup LLM:** OpenAI GPT-4
- **Why:** Fallback option, potentially better for some SEO analysis tasks

---

## Component Specifications

### 1. Local SEO Engine

#### Responsibilities
- Track local search rankings for target keywords
- Monitor Google Business Profile performance
- Analyze local citations and NAP consistency
- Provide actionable recommendations

#### Key Features

**1.1 Keyword Rank Tracking**
```python
# Core functionality
- Track rankings for 20-50 local keywords
- Check positions daily for priority keywords
- Weekly checks for secondary keywords
- Store historical data for trend analysis
- Alert on significant ranking changes (>3 positions)

# Example keywords to track:
- "med spa Kansas City"
- "botox Kansas City"
- "dermal fillers near me"
- "laser hair removal KC"
- etc.
```

**1.2 Google Business Profile Monitoring**
```python
# Metrics to track:
- Profile views (search vs. maps)
- Customer actions (calls, website clicks, direction requests)
- Photo views and counts
- Search queries that found the profile
- Competitor comparisons in local pack
```

**1.3 Citation Tracking**
```python
# Monitor NAP across:
- Major directories (Yelp, Yellow Pages, BBB)
- Healthcare directories (Healthgrades, RealSelf)
- Social platforms (Facebook, Instagram)
- Local business directories

# Alert on:
- Inconsistent NAP data
- Duplicate listings
- Missing citations
```

#### Technical Implementation

**Service Class:**
```python
# backend/services/local_seo_service.py

from typing import List, Dict
from datetime import datetime, timedelta
import asyncio

class LocalSEOService:
    """
    Manages all local SEO tracking and analysis
    """

    async def track_keyword_rankings(
        self,
        keywords: List[str],
        location: str = "Kansas City, MO"
    ) -> Dict:
        """
        Track rankings for specified keywords in local area

        Returns:
            {
                "keyword": {
                    "position": int,
                    "url": str,
                    "change": int,  # vs previous check
                    "map_pack": bool,
                    "featured_snippet": bool
                }
            }
        """
        pass

    async def analyze_gbp_performance(
        self,
        date_range: int = 30
    ) -> Dict:
        """
        Fetch and analyze Google Business Profile metrics

        Returns:
            {
                "views": {"search": int, "maps": int},
                "actions": {
                    "website": int,
                    "calls": int,
                    "directions": int
                },
                "queries": List[str],
                "photos": {"count": int, "views": int}
            }
        """
        pass

    async def check_citations(self) -> Dict:
        """
        Verify NAP consistency across directories

        Returns:
            {
                "consistent": List[Dict],
                "inconsistent": List[Dict],
                "missing": List[str]
            }
        """
        pass
```

**Database Models:**
```python
# backend/models/seo.py

from sqlalchemy import Column, Integer, String, DateTime, Float, Boolean, JSON
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class KeywordRanking(Base):
    __tablename__ = "keyword_rankings"

    id = Column(Integer, primary_key=True)
    keyword = Column(String(255), nullable=False, index=True)
    position = Column(Integer)
    url = Column(String(512))
    location = Column(String(255), default="Kansas City, MO")
    in_map_pack = Column(Boolean, default=False)
    has_featured_snippet = Column(Boolean, default=False)
    search_volume = Column(Integer)
    checked_at = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class GBPMetric(Base):
    __tablename__ = "gbp_metrics"

    id = Column(Integer, primary_key=True)
    date = Column(DateTime, nullable=False, index=True)
    views_search = Column(Integer, default=0)
    views_maps = Column(Integer, default=0)
    actions_website = Column(Integer, default=0)
    actions_calls = Column(Integer, default=0)
    actions_directions = Column(Integer, default=0)
    photo_views = Column(Integer, default=0)
    photo_count = Column(Integer, default=0)
    queries = Column(JSON)  # List of search queries
    created_at = Column(DateTime, default=datetime.utcnow)

class Citation(Base):
    __tablename__ = "citations"

    id = Column(Integer, primary_key=True)
    source = Column(String(255), nullable=False)
    url = Column(String(512))
    business_name = Column(String(255))
    address = Column(String(512))
    phone = Column(String(50))
    is_consistent = Column(Boolean, default=True)
    last_checked = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
```

#### API Endpoints

```python
# POST /api/v1/seo/track-keywords
# Body: {"keywords": ["keyword1", "keyword2"], "location": "Kansas City, MO"}
# Response: {"job_id": "uuid", "status": "queued"}

# GET /api/v1/seo/rankings?keyword=botox+kansas+city&days=30
# Response: [{"date": "2025-11-17", "position": 5, "url": "..."}]

# GET /api/v1/seo/gbp/metrics?days=30
# Response: {"views": {...}, "actions": {...}, "queries": [...]}

# GET /api/v1/seo/citations
# Response: {"consistent": [...], "inconsistent": [...], "missing": [...]}
```

---

### 2. Content Generation with Tone Matching

#### Responsibilities
- Generate SEO-optimized blog posts
- Match owner's personal writing tone
- Reduce AI-detection scores
- Optimize for target keywords
- Generate meta descriptions and titles

#### Key Features

**2.1 Tone Analysis & Training**
```python
# Initial setup phase:
1. Collect existing content samples (emails, social posts, website copy)
2. Analyze writing patterns:
   - Sentence length distribution
   - Vocabulary level
   - Common phrases/expressions
   - Tone (professional, friendly, educational, etc.)
   - Use of humor, analogies, stories
3. Create tone profile
4. Test and refine with owner feedback
```

**2.2 Content Generation Pipeline**
```python
# Generation flow:
1. Keyword Research → Target keyword selection
2. Outline Generation → Create blog structure
3. Content Writing → Generate full article
4. Tone Matching → Adjust to owner's voice
5. SEO Optimization → Add keywords, headers, links
6. AI Detection Check → Reduce AI fingerprint
7. Quality Review → Grammar, facts, readability
8. Draft Creation → Save to WordPress as draft
```

**2.3 Content Types**
```python
# Supported content types:
- Educational blog posts (e.g., "What is Botox?")
- Service-focused articles (e.g., "Benefits of Chemical Peels")
- Seasonal content (e.g., "Summer Skin Prep Tips")
- FAQ articles
- Treatment comparison posts
- Before/after story formats
```

#### Technical Implementation

**Service Class:**
```python
# backend/services/content_service.py

from typing import Dict, List, Optional
from anthropic import Anthropic

class ContentService:
    """
    Handles AI content generation with tone matching
    """

    def __init__(self):
        self.client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        self.tone_profile = self._load_tone_profile()

    async def generate_blog_post(
        self,
        topic: str,
        target_keyword: str,
        word_count: int = 1500,
        tone_profile_id: Optional[int] = None
    ) -> Dict:
        """
        Generate a complete blog post

        Returns:
            {
                "title": str,
                "content": str,  # HTML formatted
                "meta_description": str,
                "excerpt": str,
                "keywords": List[str],
                "suggested_images": List[str],
                "internal_links": List[Dict],
                "ai_score": float,  # 0-1, lower is better
                "readability_score": float
            }
        """
        # Step 1: Research and outline
        outline = await self._generate_outline(topic, target_keyword)

        # Step 2: Generate content
        content = await self._generate_content(outline, word_count)

        # Step 3: Apply tone matching
        content = await self._apply_tone_profile(content, tone_profile_id)

        # Step 4: SEO optimization
        content = await self._optimize_for_seo(content, target_keyword)

        # Step 5: Reduce AI detection
        content = await self._humanize_content(content)

        # Step 6: Quality checks
        quality_metrics = await self._analyze_quality(content)

        return {
            "title": self._extract_title(content),
            "content": content,
            "meta_description": await self._generate_meta_description(content),
            "excerpt": self._extract_excerpt(content),
            **quality_metrics
        }

    async def _generate_outline(self, topic: str, keyword: str) -> Dict:
        """Generate article outline with Claude"""
        prompt = f"""Create a detailed outline for a blog post about {topic}.

        Target keyword: {keyword}
        Target audience: People interested in med spa treatments (ages 30-60)
        Tone: {self.tone_profile['description']}

        Include:
        - Attention-grabbing title with keyword
        - Introduction hook
        - 4-6 main sections with H2 headers
        - Key points under each section
        - Conclusion with CTA
        - Suggested internal links to services
        """

        response = self.client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}]
        )

        return self._parse_outline(response.content[0].text)

    async def _apply_tone_profile(self, content: str, profile_id: Optional[int]) -> str:
        """Apply owner's writing tone to content"""
        profile = self.tone_profile if not profile_id else self._load_tone_profile(profile_id)

        prompt = f"""Rewrite the following content to match this writing style:

{profile['description']}

Example writing samples:
{profile['examples']}

Key characteristics:
- Sentence length: {profile['avg_sentence_length']} words
- Vocabulary level: {profile['vocabulary_level']}
- Common phrases: {', '.join(profile['common_phrases'])}
- Tone: {profile['tone_attributes']}

Content to rewrite:
{content}

Important: Maintain all facts, SEO keywords, and structure. Only adjust the voice/tone.
"""

        response = self.client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=4000,
            messages=[{"role": "user", "content": prompt}]
        )

        return response.content[0].text

    async def _humanize_content(self, content: str) -> str:
        """Reduce AI detection score"""
        prompt = f"""Rewrite this content to sound more natural and human-written.

Techniques to use:
- Vary sentence length and structure
- Add conversational elements
- Include personal touches (without making specific claims)
- Use contractions naturally
- Add minor imperfections (but keep professional)
- Break up overly perfect parallel structures

Content:
{content}

Important: Keep all facts, keywords, and SEO optimization intact.
"""

        response = self.client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=4000,
            messages=[{"role": "user", "content": prompt}]
        )

        return response.content[0].text
```

**Database Models:**
```python
# backend/models/content.py

class ToneProfile(Base):
    __tablename__ = "tone_profiles"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(String(1000))
    avg_sentence_length = Column(Float)
    vocabulary_level = Column(String(50))  # basic, intermediate, advanced
    tone_attributes = Column(JSON)  # ["friendly", "professional", "educational"]
    common_phrases = Column(JSON)  # List of frequently used phrases
    writing_samples = Column(JSON)  # Sample texts for reference
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class GeneratedContent(Base):
    __tablename__ = "generated_content"

    id = Column(Integer, primary_key=True)
    content_type = Column(String(50))  # blog_post, page_content, meta_description
    topic = Column(String(512))
    target_keyword = Column(String(255))
    title = Column(String(512))
    content = Column(String)  # Full HTML content
    meta_description = Column(String(255))
    excerpt = Column(String(500))
    tone_profile_id = Column(Integer)
    ai_detection_score = Column(Float)
    readability_score = Column(Float)
    word_count = Column(Integer)
    status = Column(String(50))  # draft, published, archived
    wordpress_post_id = Column(Integer)
    published_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
```

#### API Endpoints

```python
# POST /api/v1/content/generate
# Body: {
#   "topic": "Benefits of Botox for Wrinkle Prevention",
#   "target_keyword": "botox kansas city",
#   "content_type": "blog_post",
#   "word_count": 1500
# }
# Response: {"job_id": "uuid", "status": "processing"}

# GET /api/v1/content/job/{job_id}
# Response: {"status": "completed", "content": {...}}

# POST /api/v1/content/publish/{content_id}
# Body: {"publish_now": true, "scheduled_time": "2025-11-20T10:00:00Z"}
# Response: {"wordpress_post_id": 123, "url": "..."}

# GET /api/v1/content/tone-profiles
# Response: [{"id": 1, "name": "Owner Voice", "is_active": true}]

# POST /api/v1/content/tone-profiles
# Body: {"name": "...", "writing_samples": [...]}
# Response: {"id": 1, "status": "analyzing"}
```

---

### 3. A/B Testing Framework

#### Responsibilities
- Create and manage page variants
- Split traffic between variants
- Track conversion metrics
- Calculate statistical significance
- Auto-declare winners

#### Key Features

**3.1 Variant Management**
```python
# Capabilities:
- Create variants of existing pages
- Test different elements:
  - Headlines
  - CTAs (button text, color, placement)
  - Images
  - Page copy
  - Layout (Elementor sections)
  - Forms
- Version control for variants
- Easy rollback
```

**3.2 Traffic Splitting**
```python
# Traffic distribution:
- 50/50 split (default)
- Custom ratios (e.g., 80/20 for cautious testing)
- Cookie-based consistency (same user sees same variant)
- Exclude bots and crawlers
- Geographic targeting options
```

**3.3 Metrics Tracking**
```python
# Track per variant:
- Page views
- Time on page
- Bounce rate
- Scroll depth
- Form submissions
- Button clicks
- Phone calls (if call tracking integrated)
- Conversions (consultation bookings)
```

**3.4 Statistical Analysis**
```python
# Auto-calculate:
- Conversion rate per variant
- Confidence level (95% standard)
- Statistical significance
- Expected improvement
- Minimum sample size
- Test duration estimate
```

#### Technical Implementation

**Service Class:**
```python
# backend/services/ab_testing_service.py

from typing import Dict, List
from scipy import stats
import numpy as np

class ABTestingService:
    """
    Manages A/B test creation, tracking, and analysis
    """

    async def create_test(
        self,
        page_id: int,
        test_name: str,
        variant_changes: Dict,
        traffic_split: float = 0.5,
        goal_metric: str = "form_submission"
    ) -> Dict:
        """
        Create new A/B test

        Args:
            page_id: WordPress page ID
            test_name: Descriptive name
            variant_changes: Elements to change in variant B
            traffic_split: % of traffic to variant B (0.0-1.0)
            goal_metric: Primary conversion metric

        Returns:
            {
                "test_id": int,
                "status": "active",
                "variant_a_url": str,
                "variant_b_url": str,
                "estimated_duration_days": int
            }
        """
        # Create variant B page
        variant_b = await self._create_variant(page_id, variant_changes)

        # Set up tracking
        test = ABTest(
            page_id=page_id,
            name=test_name,
            variant_a_url=f"/page-{page_id}",
            variant_b_url=f"/page-{variant_b['id']}",
            traffic_split=traffic_split,
            goal_metric=goal_metric,
            status="active"
        )

        db.add(test)
        await db.commit()

        return test.to_dict()

    async def track_event(
        self,
        test_id: int,
        variant: str,  # 'a' or 'b'
        event_type: str,
        session_id: str,
        metadata: Optional[Dict] = None
    ):
        """Track user interaction with variant"""
        event = ABTestEvent(
            test_id=test_id,
            variant=variant,
            event_type=event_type,
            session_id=session_id,
            metadata=metadata
        )

        db.add(event)
        await db.commit()

    async def analyze_test(self, test_id: int) -> Dict:
        """
        Perform statistical analysis on test results

        Returns:
            {
                "variant_a": {
                    "visitors": int,
                    "conversions": int,
                    "conversion_rate": float
                },
                "variant_b": {
                    "visitors": int,
                    "conversions": int,
                    "conversion_rate": float
                },
                "improvement": float,  # % improvement
                "confidence": float,  # 0-1
                "is_significant": bool,
                "winner": str,  # 'a', 'b', or 'inconclusive'
                "recommendation": str
            }
        """
        # Get test data
        test = await db.query(ABTest).filter_by(id=test_id).first()

        # Get conversion data
        data_a = await self._get_variant_data(test_id, 'a')
        data_b = await self._get_variant_data(test_id, 'b')

        # Statistical analysis using two-proportion z-test
        conversions_a = data_a['conversions']
        visitors_a = data_a['visitors']
        conversions_b = data_b['conversions']
        visitors_b = data_b['visitors']

        # Calculate conversion rates
        rate_a = conversions_a / visitors_a if visitors_a > 0 else 0
        rate_b = conversions_b / visitors_b if visitors_b > 0 else 0

        # Calculate statistical significance
        z_score, p_value = stats.proportions_ztest(
            [conversions_a, conversions_b],
            [visitors_a, visitors_b]
        )

        confidence = 1 - p_value
        is_significant = p_value < 0.05  # 95% confidence

        # Determine winner
        if not is_significant:
            winner = 'inconclusive'
            recommendation = f"Continue test. Need {self._calculate_additional_samples(data_a, data_b)} more visitors."
        elif rate_b > rate_a:
            winner = 'b'
            improvement = ((rate_b - rate_a) / rate_a) * 100
            recommendation = f"Variant B wins with {improvement:.1f}% improvement. Consider making it permanent."
        else:
            winner = 'a'
            improvement = ((rate_a - rate_b) / rate_b) * 100
            recommendation = f"Original (A) performs better by {improvement:.1f}%. Stop test and keep original."

        return {
            "variant_a": {
                "visitors": visitors_a,
                "conversions": conversions_a,
                "conversion_rate": rate_a
            },
            "variant_b": {
                "visitors": visitors_b,
                "conversions": conversions_b,
                "conversion_rate": rate_b
            },
            "improvement": improvement if winner != 'inconclusive' else 0,
            "confidence": confidence,
            "p_value": p_value,
            "is_significant": is_significant,
            "winner": winner,
            "recommendation": recommendation
        }

    def _calculate_additional_samples(self, data_a: Dict, data_b: Dict) -> int:
        """Calculate how many more samples needed for significance"""
        # Using simplified power analysis
        # Assumes 80% power, 95% confidence, minimum detectable effect of 10%
        baseline_rate = data_a['conversions'] / data_a['visitors']

        # Sample size formula for two proportions
        p1 = baseline_rate
        p2 = baseline_rate * 1.1  # 10% improvement
        p_avg = (p1 + p2) / 2

        z_alpha = 1.96  # 95% confidence
        z_beta = 0.84   # 80% power

        n = (2 * p_avg * (1 - p_avg) * (z_alpha + z_beta)**2) / (p2 - p1)**2

        current_samples = data_a['visitors'] + data_b['visitors']
        needed_per_variant = int(n)
        total_needed = needed_per_variant * 2

        return max(0, total_needed - current_samples)
```

**Database Models:**
```python
# backend/models/ab_testing.py

class ABTest(Base):
    __tablename__ = "ab_tests"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    page_id = Column(Integer, nullable=False)  # WordPress page ID
    variant_a_url = Column(String(512))  # Original
    variant_b_url = Column(String(512))  # Variant
    variant_a_content = Column(JSON)  # Snapshot of original
    variant_b_content = Column(JSON)  # Snapshot of variant
    traffic_split = Column(Float, default=0.5)
    goal_metric = Column(String(100))  # form_submission, button_click, etc.
    status = Column(String(50))  # active, paused, completed, cancelled
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime)
    winner = Column(String(1))  # 'a', 'b', or null
    created_at = Column(DateTime, default=datetime.utcnow)

class ABTestEvent(Base):
    __tablename__ = "ab_test_events"

    id = Column(Integer, primary_key=True)
    test_id = Column(Integer, nullable=False, index=True)
    variant = Column(String(1), nullable=False)  # 'a' or 'b'
    session_id = Column(String(255), nullable=False, index=True)
    event_type = Column(String(100), nullable=False)  # pageview, conversion, click, etc.
    metadata = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    __table_args__ = (
        Index('idx_test_variant_event', 'test_id', 'variant', 'event_type'),
    )
```

#### WordPress Integration

**Traffic Splitting (PHP Plugin):**
```php
// wordpress-plugin/includes/class-ab-testing.php

class SkinFix_AB_Testing {

    public function init() {
        add_filter('template_redirect', array($this, 'handle_ab_test'));
        add_action('wp_footer', array($this, 'inject_tracking_script'));
    }

    public function handle_ab_test() {
        global $post;

        // Check if page has active A/B test
        $test = $this->get_active_test($post->ID);

        if (!$test) {
            return;
        }

        // Get or assign variant for this session
        $variant = $this->get_user_variant($test);

        // Store in session/cookie
        setcookie(
            "skinfix_test_{$test['id']}",
            $variant,
            time() + (30 * 24 * 60 * 60), // 30 days
            '/'
        );

        // If variant B, redirect or modify content
        if ($variant === 'b') {
            $this->load_variant_b($test);
        }

        // Track pageview
        $this->track_event($test['id'], $variant, 'pageview');
    }

    private function get_user_variant($test) {
        // Check if user already assigned
        $cookie_name = "skinfix_test_{$test['id']}";

        if (isset($_COOKIE[$cookie_name])) {
            return $_COOKIE[$cookie_name];
        }

        // Assign based on traffic split
        $rand = mt_rand(1, 100) / 100;
        return $rand <= $test['traffic_split'] ? 'b' : 'a';
    }

    private function track_event($test_id, $variant, $event_type) {
        // Send tracking beacon to backend API
        $session_id = $this->get_session_id();

        wp_remote_post(get_option('skinfix_api_url') . '/api/v1/ab-tests/track', array(
            'body' => json_encode(array(
                'test_id' => $test_id,
                'variant' => $variant,
                'event_type' => $event_type,
                'session_id' => $session_id,
                'page_url' => $_SERVER['REQUEST_URI']
            )),
            'headers' => array(
                'Content-Type' => 'application/json',
                'Authorization' => 'Bearer ' . get_option('skinfix_api_token')
            )
        ));
    }
}
```

#### API Endpoints

```python
# POST /api/v1/ab-tests
# Body: {
#   "page_id": 123,
#   "name": "Homepage CTA Test",
#   "variant_changes": {"cta_text": "Book Now", "cta_color": "#FF6B6B"},
#   "traffic_split": 0.5,
#   "goal_metric": "form_submission"
# }
# Response: {"test_id": 1, "status": "active"}

# POST /api/v1/ab-tests/track
# Body: {
#   "test_id": 1,
#   "variant": "b",
#   "event_type": "conversion",
#   "session_id": "abc123"
# }
# Response: {"status": "tracked"}

# GET /api/v1/ab-tests/{test_id}/results
# Response: {
#   "variant_a": {...},
#   "variant_b": {...},
#   "winner": "b",
#   "is_significant": true
# }

# POST /api/v1/ab-tests/{test_id}/complete
# Body: {"apply_winner": true}
# Response: {"status": "completed", "winner_applied": true}
```

---

### 4. Analytics Dashboard

#### Responsibilities
- Display SEO metrics in real-time
- Show A/B test results
- Track conversion funnel
- Generate executive reports
- Alert on anomalies

#### Key Features

**4.1 Dashboard Sections**
```
1. Overview
   - Key metrics at a glance
   - Week-over-week changes
   - Active alerts

2. Local SEO
   - Keyword rankings chart
   - GBP performance
   - Citation status
   - Local pack position

3. Content Performance
   - Top performing pages
   - Recent blog posts
   - Traffic by content type
   - Engagement metrics

4. A/B Tests
   - Active tests status
   - Recent test results
   - Recommendations

5. Conversions
   - Funnel visualization
   - Conversion rate trends
   - Attribution data
```

**4.2 Key Metrics to Display**
```
Local SEO:
- Average keyword position
- # of keywords in top 3
- # of keywords in top 10
- GBP views and actions
- Citation consistency score

Traffic:
- Organic sessions
- Pageviews
- Bounce rate
- Avg. session duration
- Pages per session

Conversions:
- Consultation form submissions
- Phone calls
- Email inquiries
- Conversion rate

Content:
- Blog posts published
- Total indexed pages
- Avg. time on page
- Social shares
```

#### Technical Implementation

**Frontend Structure:**
```typescript
// dashboard/src/app/dashboard/page.tsx

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { MetricCard } from '@/components/metrics/MetricCard'
import { RankingsChart } from '@/components/charts/RankingsChart'
import { ABTestResults } from '@/components/ab-testing/ABTestResults'

export default async function DashboardPage() {
  const metrics = await fetchMetrics()
  const rankings = await fetchRankings()
  const activeTests = await fetchActiveTests()

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">SEO Dashboard</h1>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Avg. Keyword Position"
          value={metrics.avgPosition}
          change={metrics.positionChange}
          trend="down-is-good"
        />
        <MetricCard
          title="Organic Sessions"
          value={metrics.organicSessions}
          change={metrics.sessionsChange}
        />
        <MetricCard
          title="Conversion Rate"
          value={`${metrics.conversionRate}%`}
          change={metrics.conversionRateChange}
        />
        <MetricCard
          title="GBP Actions"
          value={metrics.gbpActions}
          change={metrics.gbpActionsChange}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Keyword Rankings (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <RankingsChart data={rankings} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active A/B Tests</CardTitle>
          </CardHeader>
          <CardContent>
            <ABTestResults tests={activeTests} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

**API Endpoints:**
```python
# GET /api/v1/dashboard/metrics?period=30
# Response: {
#   "avgPosition": 8.5,
#   "positionChange": -1.2,
#   "organicSessions": 1250,
#   "sessionsChange": 15.3,
#   ...
# }

# GET /api/v1/dashboard/rankings?days=30
# Response: [
#   {"date": "2025-11-17", "avgPosition": 8.5, "top3": 5, "top10": 15},
#   ...
# ]

# GET /api/v1/dashboard/conversions?days=30
# Response: {
#   "funnel": [
#     {"step": "Landing", "visitors": 1000},
#     {"step": "Service Page", "visitors": 600},
#     {"step": "Form View", "visitors": 200},
#     {"step": "Submission", "visitors": 50}
#   ]
# }
```

---

## Database Schema

### Complete Schema Overview

```sql
-- ============================================
-- Local SEO Tables
-- ============================================

CREATE TABLE keyword_rankings (
    id SERIAL PRIMARY KEY,
    keyword VARCHAR(255) NOT NULL,
    position INTEGER,
    url VARCHAR(512),
    location VARCHAR(255) DEFAULT 'Kansas City, MO',
    in_map_pack BOOLEAN DEFAULT FALSE,
    has_featured_snippet BOOLEAN DEFAULT FALSE,
    search_volume INTEGER,
    checked_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_keyword (keyword),
    INDEX idx_checked_at (checked_at)
);

CREATE TABLE gbp_metrics (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    views_search INTEGER DEFAULT 0,
    views_maps INTEGER DEFAULT 0,
    actions_website INTEGER DEFAULT 0,
    actions_calls INTEGER DEFAULT 0,
    actions_directions INTEGER DEFAULT 0,
    photo_views INTEGER DEFAULT 0,
    photo_count INTEGER DEFAULT 0,
    queries JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_date (date),
    UNIQUE(date)
);

CREATE TABLE citations (
    id SERIAL PRIMARY KEY,
    source VARCHAR(255) NOT NULL,
    url VARCHAR(512),
    business_name VARCHAR(255),
    address VARCHAR(512),
    phone VARCHAR(50),
    is_consistent BOOLEAN DEFAULT TRUE,
    last_checked TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_source (source)
);

-- ============================================
-- Content Generation Tables
-- ============================================

CREATE TABLE tone_profiles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    avg_sentence_length FLOAT,
    vocabulary_level VARCHAR(50),
    tone_attributes JSONB,
    common_phrases JSONB,
    writing_samples JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE generated_content (
    id SERIAL PRIMARY KEY,
    content_type VARCHAR(50) NOT NULL,
    topic VARCHAR(512),
    target_keyword VARCHAR(255),
    title VARCHAR(512),
    content TEXT,
    meta_description VARCHAR(255),
    excerpt VARCHAR(500),
    tone_profile_id INTEGER REFERENCES tone_profiles(id),
    ai_detection_score FLOAT,
    readability_score FLOAT,
    word_count INTEGER,
    status VARCHAR(50) DEFAULT 'draft',
    wordpress_post_id INTEGER,
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- ============================================
-- A/B Testing Tables
-- ============================================

CREATE TABLE ab_tests (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    page_id INTEGER NOT NULL,
    variant_a_url VARCHAR(512),
    variant_b_url VARCHAR(512),
    variant_a_content JSONB,
    variant_b_content JSONB,
    traffic_split FLOAT DEFAULT 0.5,
    goal_metric VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    winner CHAR(1),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_page_id (page_id),
    INDEX idx_status (status)
);

CREATE TABLE ab_test_events (
    id SERIAL PRIMARY KEY,
    test_id INTEGER NOT NULL REFERENCES ab_tests(id),
    variant CHAR(1) NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_test_id (test_id),
    INDEX idx_session_id (session_id),
    INDEX idx_test_variant_event (test_id, variant, event_type),
    INDEX idx_created_at (created_at)
);

-- ============================================
-- Analytics Tables
-- ============================================

CREATE TABLE page_metrics (
    id SERIAL PRIMARY KEY,
    page_url VARCHAR(512) NOT NULL,
    date DATE NOT NULL,
    pageviews INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    avg_time_on_page INTEGER,  -- seconds
    bounce_rate FLOAT,
    conversions INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(page_url, date),
    INDEX idx_page_url (page_url),
    INDEX idx_date (date)
);

CREATE TABLE conversion_events (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    page_url VARCHAR(512),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_session_id (session_id),
    INDEX idx_event_type (event_type),
    INDEX idx_created_at (created_at)
);

-- ============================================
-- Configuration Tables
-- ============================================

CREATE TABLE settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) NOT NULL UNIQUE,
    value JSONB,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE api_keys (
    id SERIAL PRIMARY KEY,
    service VARCHAR(100) NOT NULL,
    key_name VARCHAR(255) NOT NULL,
    encrypted_key TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_service (service)
);

-- ============================================
-- Job Queue Tables (for Celery)
-- ============================================

CREATE TABLE celery_taskmeta (
    id SERIAL PRIMARY KEY,
    task_id VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50),
    result JSONB,
    date_done TIMESTAMP,
    traceback TEXT,

    INDEX idx_task_id (task_id),
    INDEX idx_status (status)
);
```

---

## API Specifications

### API Structure

**Base URL:** `https://api.skinfixseo.com/api/v1`

**Authentication:** Bearer token (JWT)

**Common Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

### Endpoint Categories

#### 1. SEO Endpoints

```yaml
POST /seo/track-keywords:
  description: Queue keyword ranking check
  body:
    keywords: string[]
    location: string (optional)
  response:
    job_id: string
    status: "queued"

GET /seo/rankings:
  description: Get keyword ranking history
  params:
    keyword: string (optional)
    days: integer (default: 30)
  response:
    - date: string
      keyword: string
      position: integer
      url: string
      in_map_pack: boolean

GET /seo/gbp/metrics:
  description: Get Google Business Profile metrics
  params:
    days: integer (default: 30)
  response:
    views: {search: int, maps: int}
    actions: {website: int, calls: int, directions: int}
    queries: string[]

GET /seo/citations:
  description: Get citation status
  response:
    consistent: Citation[]
    inconsistent: Citation[]
    missing: string[]
```

#### 2. Content Endpoints

```yaml
POST /content/generate:
  description: Generate blog post or page content
  body:
    topic: string
    target_keyword: string
    content_type: "blog_post" | "page_content"
    word_count: integer (optional)
    tone_profile_id: integer (optional)
  response:
    job_id: string
    status: "processing"

GET /content/job/{job_id}:
  description: Get content generation job status
  response:
    status: "processing" | "completed" | "failed"
    content: Content (if completed)
    error: string (if failed)

POST /content/publish/{content_id}:
  description: Publish content to WordPress
  body:
    publish_now: boolean
    scheduled_time: string (ISO 8601)
  response:
    wordpress_post_id: integer
    url: string

GET /content/tone-profiles:
  description: List tone profiles
  response:
    - id: integer
      name: string
      is_active: boolean
```

#### 3. A/B Testing Endpoints

```yaml
POST /ab-tests:
  description: Create new A/B test
  body:
    page_id: integer
    name: string
    variant_changes: object
    traffic_split: float (0.0-1.0)
    goal_metric: string
  response:
    test_id: integer
    status: "active"
    variant_a_url: string
    variant_b_url: string

POST /ab-tests/track:
  description: Track A/B test event
  body:
    test_id: integer
    variant: "a" | "b"
    event_type: string
    session_id: string
    metadata: object (optional)
  response:
    status: "tracked"

GET /ab-tests/{test_id}/results:
  description: Get test results and analysis
  response:
    variant_a: {visitors: int, conversions: int, conversion_rate: float}
    variant_b: {visitors: int, conversions: int, conversion_rate: float}
    improvement: float
    confidence: float
    is_significant: boolean
    winner: "a" | "b" | "inconclusive"
    recommendation: string

POST /ab-tests/{test_id}/complete:
  description: End test and optionally apply winner
  body:
    apply_winner: boolean
  response:
    status: "completed"
    winner_applied: boolean
```

#### 4. Dashboard/Analytics Endpoints

```yaml
GET /dashboard/metrics:
  description: Get key metrics overview
  params:
    period: integer (days, default: 30)
  response:
    avgPosition: float
    positionChange: float
    organicSessions: integer
    sessionsChange: float
    conversionRate: float
    conversionRateChange: float
    gbpActions: integer
    gbpActionsChange: float

GET /dashboard/rankings:
  description: Get ranking trends
  params:
    days: integer (default: 30)
  response:
    - date: string
      avgPosition: float
      top3: integer
      top10: integer

GET /dashboard/conversions:
  description: Get conversion funnel data
  params:
    days: integer (default: 30)
  response:
    funnel:
      - step: string
        visitors: integer
```

---

## WordPress Plugin Architecture

### Plugin Structure

```
skinfix-seo-automation/
├── skinfix-seo-automation.php          # Main plugin file
├── includes/
│   ├── class-core.php                  # Core plugin class
│   ├── class-api-client.php            # Backend API client
│   ├── class-ab-testing.php            # A/B test handler
│   ├── class-content-sync.php          # Content sync with backend
│   └── class-elementor-integration.php # Elementor widgets
├── admin/
│   ├── class-admin.php                 # Admin interface
│   ├── views/
│   │   ├── dashboard.php               # Main dashboard view
│   │   ├── content-generator.php       # Content generation UI
│   │   └── ab-tests.php                # A/B test management
│   └── assets/
│       ├── js/
│       │   └── admin-app.js            # React admin app
│       └── css/
│           └── admin-styles.css
├── public/
│   ├── class-public.php                # Frontend functionality
│   └── assets/
│       └── js/
│           └── tracking.js             # Event tracking script
└── elementor/
    └── widgets/
        └── ab-test-section.php         # Custom Elementor widget
```

### Key Plugin Files

**Main Plugin File:**
```php
<?php
/**
 * Plugin Name: SkinFix SEO Automation
 * Description: AI-powered SEO automation and A/B testing for SkinFix KC
 * Version: 1.0.0
 * Author: SkinFix Team
 */

if (!defined('ABSPATH')) {
    exit;
}

define('SKINFIX_SEO_VERSION', '1.0.0');
define('SKINFIX_SEO_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('SKINFIX_SEO_PLUGIN_URL', plugin_dir_url(__FILE__));

// Autoloader
spl_autoload_register(function ($class) {
    $prefix = 'SkinFix_SEO_';
    $len = strlen($prefix);

    if (strncmp($prefix, $class, $len) !== 0) {
        return;
    }

    $relative_class = substr($class, $len);
    $file = SKINFIX_SEO_PLUGIN_DIR . 'includes/class-' .
            str_replace('_', '-', strtolower($relative_class)) . '.php';

    if (file_exists($file)) {
        require $file;
    }
});

// Initialize plugin
function skinfix_seo_init() {
    $plugin = new SkinFix_SEO_Core();
    $plugin->init();
}
add_action('plugins_loaded', 'skinfix_seo_init');
```

**API Client:**
```php
<?php
// includes/class-api-client.php

class SkinFix_SEO_API_Client {

    private $api_url;
    private $api_token;

    public function __construct() {
        $this->api_url = get_option('skinfix_api_url');
        $this->api_token = get_option('skinfix_api_token');
    }

    public function request($method, $endpoint, $data = null) {
        $url = trailingslashit($this->api_url) . ltrim($endpoint, '/');

        $args = array(
            'method' => $method,
            'headers' => array(
                'Authorization' => 'Bearer ' . $this->api_token,
                'Content-Type' => 'application/json'
            ),
            'timeout' => 30
        );

        if ($data) {
            $args['body'] = json_encode($data);
        }

        $response = wp_remote_request($url, $args);

        if (is_wp_error($response)) {
            return array(
                'success' => false,
                'error' => $response->get_error_message()
            );
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);
        $code = wp_remote_retrieve_response_code($response);

        return array(
            'success' => $code >= 200 && $code < 300,
            'data' => $body,
            'code' => $code
        );
    }

    // Convenience methods
    public function get($endpoint) {
        return $this->request('GET', $endpoint);
    }

    public function post($endpoint, $data) {
        return $this->request('POST', $endpoint, $data);
    }

    public function put($endpoint, $data) {
        return $this->request('PUT', $endpoint, $data);
    }

    public function delete($endpoint) {
        return $this->request('DELETE', $endpoint);
    }
}
```

---

## Development Roadmap

### Week-by-Week Breakdown (16 weeks total)

#### Weeks 1-2: Foundation & Setup
**Goals:** Development environment, database, basic APIs

- [ ] Set up development environment (Python, PostgreSQL, Redis)
- [ ] Initialize FastAPI backend project structure
- [ ] Create database schema and migrations
- [ ] Implement authentication system (JWT)
- [ ] Set up Celery task queue
- [ ] Create basic API scaffolding
- [ ] Set up WordPress local development environment

**Deliverables:**
- Backend running locally with database
- Basic API docs (FastAPI auto-generated)
- WordPress dev environment

---

#### Weeks 3-4: Local SEO Engine
**Goals:** Keyword tracking and GBP integration

- [ ] Implement keyword ranking tracker
  - [ ] Google Search Console API integration
  - [ ] Scraping fallback for positions
  - [ ] Database storage and history tracking
- [ ] Google Business Profile API integration
  - [ ] OAuth setup
  - [ ] Metrics fetching
  - [ ] Data storage
- [ ] Citation checker (initial version)
- [ ] API endpoints for SEO data
- [ ] Basic testing

**Deliverables:**
- Working keyword rank tracker
- GBP metrics dashboard API
- 20+ keywords being tracked
- Historical data collection started

---

#### Weeks 5-7: Content Generation System
**Goals:** AI content generation with tone matching

- [ ] Tone profile system
  - [ ] Database models
  - [ ] Analysis tools for writing samples
  - [ ] Profile management API
- [ ] Claude API integration
  - [ ] Content generation pipeline
  - [ ] Outline generation
  - [ ] Full article writing
- [ ] Tone matching implementation
  - [ ] Profile application
  - [ ] Humanization layer
- [ ] Content quality checks
  - [ ] Readability scoring
  - [ ] AI detection check
  - [ ] SEO optimization
- [ ] WordPress publishing integration
  - [ ] Draft creation via WP REST API
  - [ ] Media handling
- [ ] Testing with real content

**Deliverables:**
- Working content generator
- First tone profile created and trained
- 3-5 test blog posts generated
- WordPress publishing functional

---

#### Weeks 8-10: A/B Testing Framework
**Goals:** Create and track A/B tests

- [ ] A/B test data models
- [ ] Test creation API
- [ ] WordPress plugin development
  - [ ] Traffic splitting logic
  - [ ] Cookie/session management
  - [ ] Variant loading
- [ ] Event tracking system
  - [ ] JavaScript tracking library
  - [ ] Event ingestion API
  - [ ] Data storage
- [ ] Statistical analysis
  - [ ] Conversion rate calculations
  - [ ] Significance testing
  - [ ] Winner determination
- [ ] Elementor integration (basic)
- [ ] Testing with 2 live tests

**Deliverables:**
- WordPress plugin (beta)
- Working A/B test on 1-2 pages
- Event tracking collecting data
- Statistical analysis working

---

#### Weeks 11-13: Analytics Dashboard
**Goals:** Beautiful, functional dashboard

- [ ] Next.js project setup
- [ ] Authentication and API integration
- [ ] Dashboard layout and navigation
- [ ] Metric cards and KPIs
- [ ] Charts implementation
  - [ ] Ranking trends
  - [ ] Traffic charts
  - [ ] Conversion funnel
- [ ] A/B test results UI
- [ ] Real-time data updates
- [ ] Mobile responsive design
- [ ] Testing and refinement

**Deliverables:**
- Fully functional dashboard
- All Phase 1 metrics displayed
- Real-time updates working
- Mobile-friendly

---

#### Weeks 14-15: Integration & Testing
**Goals:** Connect all pieces, end-to-end testing

- [ ] Full system integration testing
- [ ] WordPress plugin refinement
- [ ] API performance optimization
- [ ] Database indexing and optimization
- [ ] Security audit
- [ ] Load testing
- [ ] Bug fixes
- [ ] Documentation updates

**Deliverables:**
- Stable, integrated system
- Performance benchmarks met
- Security review completed
- Bug tracker cleared

---

#### Week 16: Deployment & Launch
**Goals:** Production deployment

- [ ] Set up production infrastructure
  - [ ] AWS/DigitalOcean server
  - [ ] PostgreSQL database
  - [ ] Redis instance
  - [ ] S3 bucket
- [ ] Deploy backend API
- [ ] Deploy dashboard
- [ ] Install WordPress plugin on live site
- [ ] Configure API keys and integrations
- [ ] Final testing on production
- [ ] Training/handoff documentation
- [ ] Launch!

**Deliverables:**
- Live production system
- All integrations working
- Monitoring in place
- Documentation complete

---

## Testing Strategy

### Unit Testing

**Backend (Python):**
```python
# Use pytest
# tests/test_local_seo_service.py

import pytest
from services.local_seo_service import LocalSEOService

@pytest.fixture
def seo_service():
    return LocalSEOService()

def test_track_keyword_rankings(seo_service):
    result = await seo_service.track_keyword_rankings(
        keywords=["botox kansas city"],
        location="Kansas City, MO"
    )

    assert "botox kansas city" in result
    assert "position" in result["botox kansas city"]
    assert result["botox kansas city"]["position"] > 0
```

**Frontend (TypeScript):**
```typescript
// Use Jest + React Testing Library
// __tests__/components/MetricCard.test.tsx

import { render, screen } from '@testing-library/react'
import { MetricCard } from '@/components/metrics/MetricCard'

describe('MetricCard', () => {
  it('renders metric value correctly', () => {
    render(
      <MetricCard
        title="Avg. Position"
        value={8.5}
        change={-1.2}
      />
    )

    expect(screen.getByText('8.5')).toBeInTheDocument()
    expect(screen.getByText('-1.2')).toBeInTheDocument()
  })
})
```

### Integration Testing

```python
# Test full workflows
# tests/integration/test_content_generation.py

async def test_content_generation_workflow():
    # 1. Generate content
    job = await content_service.generate_blog_post(
        topic="Benefits of Botox",
        target_keyword="botox kansas city"
    )

    assert job["status"] == "processing"

    # 2. Wait for completion
    result = await wait_for_job(job["job_id"])

    assert result["status"] == "completed"
    assert "title" in result["content"]
    assert "botox kansas city" in result["content"]["content"].lower()

    # 3. Publish to WordPress
    published = await content_service.publish(
        result["content"]["id"],
        publish_now=False
    )

    assert published["wordpress_post_id"] > 0
```

### End-to-End Testing

```typescript
// Use Playwright
// e2e/dashboard.spec.ts

import { test, expect } from '@playwright/test'

test('dashboard loads and displays metrics', async ({ page }) => {
  await page.goto('http://localhost:3000/dashboard')

  // Wait for metrics to load
  await page.waitForSelector('[data-testid="metric-card"]')

  // Check that all 4 key metrics are displayed
  const metricCards = await page.locator('[data-testid="metric-card"]').count()
  expect(metricCards).toBe(4)

  // Check rankings chart is visible
  await expect(page.locator('[data-testid="rankings-chart"]')).toBeVisible()
})
```

---

## Deployment Plan

### Infrastructure

**Option 1: AWS (Recommended for scalability)**
```
- EC2 instance (t3.medium) for backend
- RDS PostgreSQL (db.t3.small)
- ElastiCache Redis (cache.t3.micro)
- S3 for media storage
- CloudFront for CDN
- Route 53 for DNS
- Estimated cost: $150-250/month
```

**Option 2: DigitalOcean (Recommended for simplicity)**
```
- Droplet ($24/month, 2GB RAM)
- Managed PostgreSQL ($15/month)
- Managed Redis ($15/month)
- Spaces for object storage ($5/month)
- Estimated cost: $60-80/month
```

### Deployment Steps

```bash
# 1. Provision infrastructure
terraform apply

# 2. Deploy database
# - Create database
# - Run migrations
# - Seed initial data

# 3. Deploy backend
# - Build Docker image
# - Push to registry
# - Deploy to server
# - Configure environment variables
# - Start Celery workers

# 4. Deploy dashboard
# - Build Next.js app
# - Deploy to Vercel or server
# - Configure API endpoint

# 5. Install WordPress plugin
# - Upload plugin to WordPress
# - Activate
# - Configure API connection

# 6. Configure monitoring
# - Set up Sentry for error tracking
# - Configure uptime monitoring
# - Set up log aggregation
```

### Environment Variables

```bash
# Backend .env
DATABASE_URL=postgresql://user:pass@host:5432/skinfix_seo
REDIS_URL=redis://host:6379/0
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
JWT_SECRET=...
ENVIRONMENT=production

# Dashboard .env
NEXT_PUBLIC_API_URL=https://api.skinfixseo.com
NEXT_PUBLIC_ENVIRONMENT=production
```

---

## Next Steps

1. **Review and approve this specification**
2. **Set up development environment**
3. **Begin Week 1-2 tasks**
4. **Schedule weekly check-ins**
5. **Create project management board (GitHub Projects/Jira)**

---

## Questions for Stakeholder

1. **Hosting preference:** AWS or DigitalOcean?
2. **Domain:** Do you want a subdomain (dashboard.skinfixkc.com) or separate domain?
3. **Google API access:** Do you have admin access to Google Search Console and Analytics?
4. **Budget confirmation:** Are the estimated costs ($60-250/month) acceptable?
5. **Timeline:** Is 16 weeks realistic for your needs, or do you need faster MVP?
6. **Content samples:** Can you provide 5-10 writing samples for tone training?

---

**Document Version:** 1.0
**Last Updated:** November 17, 2025
**Next Review:** After stakeholder feedback
