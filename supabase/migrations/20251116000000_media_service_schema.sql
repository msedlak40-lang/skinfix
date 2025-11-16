-- Media Service Schema Migration
-- Created: 2025-11-16
-- Purpose: Support media upload, approval, and marketing workflow

-- ============================================================================
-- 1. CUSTOMERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS customers (
  cust_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast phone lookup
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

-- Index for name search (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_customers_name_lower ON customers(LOWER(name));

-- ============================================================================
-- 2. TREATMENTS TABLE (Admin-configurable)
-- ============================================================================
CREATE TABLE IF NOT EXISTS treatments (
  treatment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  results_timing TEXT DEFAULT 'immediate' CHECK (results_timing IN ('immediate', 'delayed')),
  results_delay_days INTEGER, -- e.g., 14 for Botox
  review_delay_days INTEGER DEFAULT 1,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default treatments
INSERT INTO treatments (name, results_timing, results_delay_days, review_delay_days) VALUES
  ('Hydrafacial', 'immediate', 0, 1),
  ('Botox', 'delayed', 14, 14),
  ('Fillers - Lips', 'delayed', 7, 7),
  ('Fillers - Cheeks', 'delayed', 7, 7),
  ('Laser Hair Removal', 'delayed', 3, 3),
  ('Chemical Peel', 'immediate', 0, 3),
  ('Microneedling', 'delayed', 7, 7)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- 3. MEDIA ENCOUNTERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS media_encounters (
  encounter_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cust_id UUID NOT NULL REFERENCES customers(cust_id) ON DELETE CASCADE,
  treatment_id UUID NOT NULL REFERENCES treatments(treatment_id),
  encounter_date TIMESTAMPTZ DEFAULT now(),

  -- Approval workflow
  status TEXT DEFAULT 'pending_upload' CHECK (status IN (
    'pending_upload',
    'pending_approval',
    'approved',
    'rejected'
  )),
  approved_by UUID, -- references auth.users, but not enforced for flexibility
  approved_at TIMESTAMPTZ,
  rejected_reason TEXT,

  -- Consent verification (links to existing consents table)
  consent_id UUID REFERENCES consents(consent_id),
  consent_verified_by UUID,
  consent_verified_at TIMESTAMPTZ,

  -- Private notes (staff only, never shown in marketing)
  private_notes TEXT,

  -- Marketing metadata
  custom_tags TEXT[],

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_media_encounters_cust_id ON media_encounters(cust_id);
CREATE INDEX IF NOT EXISTS idx_media_encounters_status ON media_encounters(status);
CREATE INDEX IF NOT EXISTS idx_media_encounters_treatment_id ON media_encounters(treatment_id);
CREATE INDEX IF NOT EXISTS idx_media_encounters_date ON media_encounters(encounter_date DESC);

-- GSI for approval queue
CREATE INDEX IF NOT EXISTS idx_media_encounters_pending_approval ON media_encounters(status, encounter_date DESC)
  WHERE status = 'pending_approval';

-- ============================================================================
-- 4. MEDIA FILES TABLE (Before/After Photos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS media_files (
  file_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES media_encounters(encounter_id) ON DELETE CASCADE,
  file_type TEXT NOT NULL CHECK (file_type IN ('before', 'after', 'consent_scan')),

  -- S3 storage (clinical bucket for originals)
  s3_bucket TEXT NOT NULL,
  s3_key TEXT NOT NULL, -- UUID filename, no PHI
  file_size BIGINT,
  mime_type TEXT,

  -- Image metadata
  width INTEGER,
  height INTEGER,

  -- Marketing bucket (only populated after approval)
  marketing_s3_bucket TEXT,
  marketing_s3_key TEXT,

  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_media_files_encounter_id ON media_files(encounter_id);
CREATE INDEX IF NOT EXISTS idx_media_files_type ON media_files(file_type);

-- ============================================================================
-- 5. PUBLICATIONS TABLE (Track what's been posted to Instagram)
-- ============================================================================
CREATE TABLE IF NOT EXISTS publications (
  publication_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES media_encounters(encounter_id),

  platform TEXT DEFAULT 'instagram',
  post_type TEXT CHECK (post_type IN ('feed', 'story', 'reel', 'carousel')),
  post_url TEXT,
  caption TEXT,

  published_at TIMESTAMPTZ DEFAULT now(),
  published_by UUID -- staff user who posted
);

-- Index for finding published content
CREATE INDEX IF NOT EXISTS idx_publications_encounter_id ON publications(encounter_id);
CREATE INDEX IF NOT EXISTS idx_publications_date ON publications(published_at DESC);

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_encounters ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE publications ENABLE ROW LEVEL SECURITY;

-- Customers: Authenticated users can read/write (staff only)
DROP POLICY IF EXISTS "Authenticated users can view customers" ON customers;
CREATE POLICY "Authenticated users can view customers"
  ON customers FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert customers" ON customers;
CREATE POLICY "Authenticated users can insert customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update customers" ON customers;
CREATE POLICY "Authenticated users can update customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (true);

-- Treatments: Anyone can read, only service_role can write
DROP POLICY IF EXISTS "Anyone can view active treatments" ON treatments;
CREATE POLICY "Anyone can view active treatments"
  ON treatments FOR SELECT
  TO authenticated
  USING (active = true);

DROP POLICY IF EXISTS "Service role can manage treatments" ON treatments;
CREATE POLICY "Service role can manage treatments"
  ON treatments FOR ALL
  TO service_role
  USING (true);

-- Media Encounters: Authenticated users full access
DROP POLICY IF EXISTS "Authenticated users can view encounters" ON media_encounters;
CREATE POLICY "Authenticated users can view encounters"
  ON media_encounters FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert encounters" ON media_encounters;
CREATE POLICY "Authenticated users can insert encounters"
  ON media_encounters FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update encounters" ON media_encounters;
CREATE POLICY "Authenticated users can update encounters"
  ON media_encounters FOR UPDATE
  TO authenticated
  USING (true);

-- Media Files: Authenticated users full access
DROP POLICY IF EXISTS "Authenticated users can view media files" ON media_files;
CREATE POLICY "Authenticated users can view media files"
  ON media_files FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert media files" ON media_files;
CREATE POLICY "Authenticated users can insert media files"
  ON media_files FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update media files" ON media_files;
CREATE POLICY "Authenticated users can update media files"
  ON media_files FOR UPDATE
  TO authenticated
  USING (true);

-- Publications: Authenticated users full access
DROP POLICY IF EXISTS "Authenticated users can view publications" ON publications;
CREATE POLICY "Authenticated users can view publications"
  ON publications FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert publications" ON publications;
CREATE POLICY "Authenticated users can insert publications"
  ON publications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- 7. HELPER FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_treatments_updated_at ON treatments;
CREATE TRIGGER update_treatments_updated_at BEFORE UPDATE ON treatments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_media_encounters_updated_at ON media_encounters;
CREATE TRIGGER update_media_encounters_updated_at BEFORE UPDATE ON media_encounters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 8. USEFUL VIEWS
-- ============================================================================

-- View: Encounters with full context (for UI display)
CREATE OR REPLACE VIEW v_encounters_full AS
SELECT
  e.encounter_id,
  e.encounter_date,
  e.status,
  e.approved_at,
  e.rejected_reason,
  e.private_notes,
  e.custom_tags,

  -- Customer info
  c.cust_id,
  c.name as customer_name,
  c.phone as customer_phone,

  -- Treatment info
  t.treatment_id,
  t.name as treatment_name,
  t.results_timing,

  -- Consent info
  con.granted as consent_granted,
  con.created_at as consent_date,

  -- File counts
  (SELECT COUNT(*) FROM media_files WHERE encounter_id = e.encounter_id AND file_type = 'before') as before_count,
  (SELECT COUNT(*) FROM media_files WHERE encounter_id = e.encounter_id AND file_type = 'after') as after_count,

  -- Publication status
  (SELECT COUNT(*) FROM publications WHERE encounter_id = e.encounter_id) > 0 as is_published

FROM media_encounters e
LEFT JOIN customers c ON e.cust_id = c.cust_id
LEFT JOIN treatments t ON e.treatment_id = t.treatment_id
LEFT JOIN consents con ON e.consent_id = con.consent_id
ORDER BY e.encounter_date DESC;

-- Grant access to view
GRANT SELECT ON v_encounters_full TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
