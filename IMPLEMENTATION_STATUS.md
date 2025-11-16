# Media Service Implementation Status

**Branch:** `claude/review-media-service-design-01QqVsZL9e1Wnr6EzSzmdPaQ`
**Started:** November 16, 2025
**Status:** Foundation Complete ✅ | Pages In Progress 🚧

---

## ✅ Phase 1: Foundation (COMPLETED)

### Database Schema
**File:** `supabase/migrations/20251116000000_media_service_schema.sql`

Created comprehensive Supabase schema with:

#### Tables
1. **customers** - Customer records (starting fresh)
   - `cust_id`, `name`, `phone`, `email`
   - Indexes on phone and name for fast search

2. **treatments** - Admin-configurable treatment types
   - Pre-populated with: Hydrafacial, Botox, Fillers, Laser, Chemical Peel, Microneedling
   - Tracks `results_timing` (immediate vs delayed)
   - Configurable review delay days

3. **media_encounters** - Treatment sessions with photos
   - Links customer + treatment + consent
   - Approval workflow: `pending_upload` → `pending_approval` → `approved`/`rejected`
   - Stores private notes and custom tags
   - Tracks who approved and when

4. **media_files** - Before/after photos
   - S3 storage references (clinical + marketing buckets)
   - Image metadata (width, height, size)
   - File type: `before`, `after`, `consent_scan`

5. **publications** - Instagram posting tracker
   - Tracks what's been published and where
   - Supports: feed, story, reel, carousel
   - Links to encounter

#### Security
- Row Level Security (RLS) enabled on all tables
- Policies for authenticated staff access
- Service role-only access for treatment management

#### Views
- `v_encounters_full` - Joins customer, treatment, consent info for UI display

---

### Frontend Architecture

Created modular, scalable frontend structure:

#### Core Modules

**1. Router (`web/shared/router.js`)**
- Client-side SPA routing
- Handles navigation without page reloads
- Event-driven route changes
- Click handler for `data-route` links

**2. API Client (`web/shared/api.js`)**
- Unified wrapper for Supabase + AWS calls
- Methods for all database operations
- S3 presigned URL handling
- Integration with AI caption generation (backend Lambda)
- Review request workflow integration

**3. Utilities (`web/shared/utils.js`)**
- Toast notifications
- Date/time formatting (America/Chicago timezone)
- Phone number formatting
- Image processing: EXIF stripping, compression, dimension checking
- File size formatting
- Debouncing, UUID generation
- Clipboard operations

**4. UI Components (`web/shared/components.js`)**
- Modal dialogs
- Loading spinners
- Customer search with autocomplete
- Treatment type selector
- Status badges
- Reusable across all pages

---

## 🚧 Phase 2: Pages & Features (IN PROGRESS)

### Pages to Build

1. **Media Upload Page** 📸
   - Customer search/quick-add
   - Treatment type selection
   - Consent verification (EMR confirmation)
   - Camera capture (native mobile camera)
   - Gallery upload fallback
   - Before/after photo pairing
   - Private notes and tags
   - Submit to approval queue

2. **Approval Queue Page** ✅
   - List pending submissions
   - Filter by treatment type, date
   - Photo preview (secure, no-cache)
   - Approve/reject with reasons
   - Keyboard shortcuts for speed
   - Bulk actions

3. **Approved Media Library Page** 🖼️
   - Grid view of approved photos
   - Filter by treatment, tags, published status
   - Search by custom tags
   - Instagram export formats (feed/story/reel/carousel)
   - AI caption generation
   - Download individual or asset packs
   - Mark as published

4. **Review Request Page** ⭐
   - Send review requests
   - Integration with existing `reviews-nudge-run` function
   - Customer selection
   - Review dashboard
   - Attribution tracking

5. **Analytics Dashboard** 📊
   - Approval rates by treatment type
   - Review conversion rates
   - Top rejection reasons
   - Cross-insights (photos + reviews)
   - Treatment performance

6. **Settings/Admin Page** ⚙️
   - Treatment type management
   - Add/edit/disable treatments
   - Configure review delays
   - System settings

---

## 🎯 Key Design Decisions

### HIPAA Compliance
- ✅ Customer names shown in staff UI (workforce access for TPO)
- ✅ S3 filenames use UUIDs only (no PHI)
- ✅ Separate clinical vs marketing buckets
- ✅ Consent verification workflow
- ✅ Audit logging ready (RLS + created_at timestamps)

### Consent Workflow
- Digital consent lives in EMR (closed system)
- Staff confirms consent was signed → inserts record into Supabase `consents` table
- Fields: `cust_id`, `granted`, `staff_user`, `method: 'digital'`, `source: 'emr'`
- One-time consent (covers all future treatments)

### Customer Management
- Starting fresh (no existing customer data)
- Fast autocomplete search as staff types
- Quick-add: name + phone only
- No pricing/treatment cost tracking

### Instagram Focus
- Single platform optimization (Instagram only)
- Export formats: Feed (1:1), Story (9:16), Reel (9:16), Carousel
- AI caption generation (backend Lambda with Anthropic API)
- Manual posting workflow (Option A: prep content, wife posts manually)
- Can upgrade to auto-posting later (Meta Graph API)

### Treatment History
- Staff can view customer's previous treatments
- Compare before/after across sessions
- See approval status and publication history
- No photo gallery view (focused workflow)

---

## 🔗 Integration Points

### Backend (Other Developer)
**Required Lambda Functions:**

1. **Media Upload** (Existing: `/media/presign`)
   - Generate S3 presigned URLs
   - Handle clinical bucket uploads
   - Return: `{ url, key, headers }`

2. **AI Caption Generation** (New: `/media/generate-captions`)
   ```javascript
   POST /media/generate-captions
   {
     encounter_id: "uuid",
     treatment_type: "Hydrafacial",
     tone: "professional",
     platform: "instagram"
   }

   Returns:
   {
     captions: [
       { style: "educational", text: "...", hashtags: [...] },
       { style: "social_proof", text: "...", hashtags: [...] },
       // 3-5 variations
     ]
   }
   ```

3. **Media Migration Pipeline** (After Approval)
   - DynamoDB Stream trigger on `media_encounters` status change
   - Copy from clinical → marketing bucket
   - Strip PHI from metadata
   - Generate derivatives (1080x1080, 1080x1920, thumbnails)
   - Optional: Sync to Canva (if configured)

### Existing Systems
- **Supabase Edge Functions** (Reviews)
  - `reviews-nudge-run` - Send SMS review requests
  - `reviews-one-tap` - One-click confirmation
  - `reviews-pull` - Ingest external reviews

- **Database Tables** (Existing)
  - `consents` - Already exists, we insert records
  - `reviews` - Already exists, we query for analytics
  - `review_nudges` - Already exists, tracking

---

## 📦 Next Steps

### Immediate (Next Session)
1. Create media upload page module
2. Create approval queue page module
3. Create approved media library page module
4. Build camera capture component
5. Update main `app.js` with navigation
6. Update `index.html` with tab navigation

### Phase 3 (After Core Works)
7. Build Instagram export format generators
8. Create review request interface
9. Build analytics dashboard
10. Add settings/admin page for treatment management

### Testing & Deployment
- Run Supabase migration locally first
- Test upload workflow end-to-end
- Test approval queue
- Deploy to staging (if available)
- Train staff on workflow
- Deploy to production

---

## 🎨 User Experience Flow

### Staff Workflow (Immediate Results - Hydrafacial)
```
1. Treatment completes
2. Staff opens PWA → "Media Upload" tab
3. Search/add customer: "jane" → Jane Doe
4. Select treatment: Hydrafacial
5. Confirm EMR consent: ✓ Signed today
6. 📷 Take Before Photo (camera opens)
7. [Perform treatment]
8. 📷 Take After Photo (camera opens)
9. Optional: Add private note "Customer loves the glow!"
10. Submit → Goes to approval queue
11. Done! (Under 2 minutes)
```

### Manager Approval Workflow
```
1. Open "Approval Queue" tab
2. See pending submissions (newest first)
3. Click photo → Preview opens
4. Review consent, check quality
5. Options:
   - Approve → Moves to marketing library
   - Reject with reason → Staff gets notification
6. Keyboard shortcuts: A (approve), R (reject), → (next)
```

### Marketing Workflow (Wife)
```
1. Open "Media Library" tab
2. Filter: Hydrafacial, Last 7 days, Not published
3. Select photo → Preview
4. Generate AI Captions (5 variations)
5. Select export format: Instagram Feed (1:1)
6. Download image + copy caption
7. Open Instagram app → Paste & post
8. Back to PWA → Mark as published
```

---

## 📊 Technical Metrics

### Database
- 5 new tables
- 1 view
- 8 indexes
- 5 RLS policies
- 3 triggers (updated_at)

### Frontend
- 4 shared modules (router, api, utils, components)
- ~1,500 lines of foundation code
- 0 external dependencies (vanilla JS + Supabase SDK)
- PWA-ready (existing service worker)

### To Build
- 6 page modules (~300 lines each = 1,800 lines)
- Camera capture component (~200 lines)
- Instagram export generators (~400 lines)
- Navigation integration (~100 lines)
- **Total estimate:** ~2,500 more lines

---

## ❓ Open Questions for Backend Developer

1. **Caption Generation Endpoint**
   - Confirm endpoint URL: `/media/generate-captions`?
   - Request/response format OK?
   - Will it return 3-5 caption variations?
   - Include hashtag suggestions?

2. **Media Migration Pipeline**
   - Should frontend trigger, or automatic on approval?
   - How to get marketing bucket URLs after migration?
   - Store marketing S3 key in `media_files.marketing_s3_key`?

3. **Image Derivatives**
   - Backend generates 1080x1080, 1080x1920 automatically?
   - Or frontend requests specific sizes?
   - How to access different sizes (separate S3 keys)?

---

## 🚀 Deployment Checklist

### Supabase
- [ ] Run migration: `20251116000000_media_service_schema.sql`
- [ ] Verify RLS policies active
- [ ] Test customer/treatment CRUD
- [ ] Verify `v_encounters_full` view works

### AWS
- [ ] Backend dev deploys Lambda functions
- [ ] Test presigned URL generation
- [ ] Test AI caption generation
- [ ] Configure S3 buckets (clinical + marketing)
- [ ] Set up KMS encryption (clinical bucket)

### Frontend
- [ ] Complete page modules
- [ ] Test on mobile (iOS/Android)
- [ ] Test camera capture
- [ ] Test offline mode (PWA)
- [ ] Load test with 50+ photos

### Training
- [ ] Create staff training video
- [ ] Document photo quality guidelines
- [ ] Document consent verification process
- [ ] Document approval criteria

---

## 💡 Future Enhancements (Phase 4+)

1. **Auto-Post to Instagram** (Meta Graph API integration)
2. **Content Calendar** (Drag-drop scheduling)
3. **Canva Integration** (Auto-sync approved assets)
4. **Performance Analytics** (Engagement tracking)
5. **AI-Powered Insights** (Which treatments perform best)
6. **Customer Portal** (Send after photos via SMS)
7. **Staff Training Feedback** (Improve approval rates)
8. **Batch Upload Mode** (Queue 10 patients, upload later)

---

**Status:** Foundation complete. Ready to build pages! 🎉
