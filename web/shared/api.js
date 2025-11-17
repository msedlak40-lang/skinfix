// ============================
// Unified API Client
// Handles Supabase + AWS API Gateway calls
// ============================

const SUPABASE_URL = "https://wbykdswgvfgcfcumcbvn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndieWtkc3dndmZnY2ZjdW1jYnZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwMDU0OTMsImV4cCI6MjA3NTU4MTQ5M30.KYYsoglzxXurA-bQeOHcONeogFZtm86i3GWMQu_tHpY";
const API_BASE = "https://ku3gfs7548.execute-api.us-east-2.amazonaws.com";

// Initialize Supabase client (singleton from app.js)
const supa = window.supa;

class API {
  constructor() {
    this.supabase = supa;
    this.awsBase = API_BASE;
  }

  // ============================================================================
  // AUTH
  // ============================================================================

  async getSession() {
    const { data: { session }, error } = await this.supabase.auth.getSession();
    if (error) throw error;
    return session;
  }

  async getUser() {
    const session = await this.getSession();
    return session?.user || null;
  }

  async getAuthToken() {
    const session = await this.getSession();
    return session?.access_token || null;
  }

  // ============================================================================
  // CUSTOMERS
  // ============================================================================

  async searchCustomers(query) {
    const { data, error } = await this.supabase
      .from('customers')
      .select('*')
      .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;
    return data;
  }

  async getCustomer(cust_id) {
    const { data, error } = await this.supabase
      .from('customers')
      .select('*')
      .eq('cust_id', cust_id)
      .single();

    if (error) throw error;
    return data;
  }

  async createCustomer({ name, phone, email }) {
    const { data, error} = await this.supabase
      .from('customers')
      .insert({ name, phone, email })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateCustomer(cust_id, updates) {
    const { data, error } = await this.supabase
      .from('customers')
      .update(updates)
      .eq('cust_id', cust_id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ============================================================================
  // TREATMENTS
  // ============================================================================

  async getTreatments() {
    const { data, error } = await this.supabase
      .from('treatments')
      .select('*')
      .eq('active', true)
      .order('name');

    if (error) throw error;
    return data;
  }

  async createTreatment(treatment) {
    const { data, error } = await this.supabase
      .from('treatments')
      .insert(treatment)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateTreatment(treatment_id, updates) {
    const { data, error } = await this.supabase
      .from('treatments')
      .update(updates)
      .eq('treatment_id', treatment_id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ============================================================================
  // CONSENTS
  // ============================================================================

  async createConsent({ cust_id, staff_user, method = 'digital', consent_type = 'media_release', source = 'emr', channel = 'in_person' }) {
    const { data, error } = await this.supabase
      .from('consents')
      .insert({
        cust_id,
        granted: true,
        staff_user,
        method,
        consent_type,
        source,
        channel
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getCustomerConsent(cust_id, consent_type = 'media_release') {
    const { data, error } = await this.supabase
      .from('consents')
      .select('*')
      .eq('cust_id', cust_id)
      .eq('consent_type', consent_type)
      .eq('granted', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  // ============================================================================
  // MEDIA ENCOUNTERS
  // ============================================================================

  async createEncounter({ cust_id, treatment_id, consent_id, private_notes, custom_tags }) {
    const { data, error } = await this.supabase
      .from('media_encounters')
      .insert({
        cust_id,
        treatment_id,
        consent_id,
        private_notes,
        custom_tags,
        status: 'pending_upload',
        consent_verified_by: (await this.getUser())?.id,
        consent_verified_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getEncounter(encounter_id) {
    const { data, error } = await this.supabase
      .from('v_encounters_full')
      .select('*')
      .eq('encounter_id', encounter_id)
      .single();

    if (error) throw error;
    return data;
  }

  async getEncounters({ status, treatment_id, limit = 50 } = {}) {
    let query = this.supabase
      .from('v_encounters_full')
      .select('*')
      .order('encounter_date', { ascending: false })
      .limit(limit);

    if (status) query = query.eq('status', status);
    if (treatment_id) query = query.eq('treatment_id', treatment_id);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async getCustomerEncounters(cust_id) {
    const { data, error } = await this.supabase
      .from('v_encounters_full')
      .select('*')
      .eq('cust_id', cust_id)
      .order('encounter_date', { ascending: false });

    if (error) throw error;
    return data;
  }

  async updateEncounter(encounter_id, updates) {
    const { data, error } = await this.supabase
      .from('media_encounters')
      .update(updates)
      .eq('encounter_id', encounter_id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async approveEncounter(encounter_id) {
    const user = await this.getUser();
    const { data, error } = await this.supabase
      .from('media_encounters')
      .update({
        status: 'approved',
        approved_by: user?.id,
        approved_at: new Date().toISOString()
      })
      .eq('encounter_id', encounter_id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async rejectEncounter(encounter_id, reason) {
    const { data, error } = await this.supabase
      .from('media_encounters')
      .update({
        status: 'rejected',
        rejected_reason: reason
      })
      .eq('encounter_id', encounter_id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ============================================================================
  // MEDIA FILES
  // ============================================================================

  async getEncounterFiles(encounter_id) {
    const { data, error } = await this.supabase
      .from('media_files')
      .select('*')
      .eq('encounter_id', encounter_id)
      .order('uploaded_at');

    if (error) throw error;
    return data;
  }

  async createMediaFile({ encounter_id, file_type, s3_bucket, s3_key, file_size, mime_type, width, height }) {
    const { data, error } = await this.supabase
      .from('media_files')
      .insert({
        encounter_id,
        file_type,
        s3_bucket,
        s3_key,
        file_size,
        mime_type,
        width,
        height
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ============================================================================
  // PUBLICATIONS
  // ============================================================================

  async createPublication({ encounter_id, platform, post_type, post_url, caption }) {
    const user = await this.getUser();
    const { data, error } = await this.supabase
      .from('publications')
      .insert({
        encounter_id,
        platform,
        post_type,
        post_url,
        caption,
        published_by: user?.id
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getEncounterPublications(encounter_id) {
    const { data, error } = await this.supabase
      .from('publications')
      .select('*')
      .eq('encounter_id', encounter_id)
      .order('published_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  // ============================================================================
  // AWS S3 PRESIGNED URLs
  // ============================================================================

  async getUploadUrl(cust_id, filename, contentType) {
    const token = await this.getAuthToken();
    const response = await fetch(`${this.awsBase}/media/presign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        cust_id,
        object_name: filename,
        content_type: contentType
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to get upload URL: ${response.status} ${text}`);
    }

    return await response.json();
  }

  async uploadToS3(presignedUrl, file, headers = {}) {
    const response = await fetch(presignedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        ...headers
      },
      body: file
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`S3 upload failed: ${response.status} ${text}`);
    }

    return true;
  }

  // ============================================================================
  // AI CAPTION GENERATION (Backend Lambda)
  // ============================================================================

  async generateCaptions({ encounter_id, treatment_type, tone = 'professional' }) {
    const token = await this.getAuthToken();
    const response = await fetch(`${this.awsBase}/media/generate-captions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        encounter_id,
        treatment_type,
        tone,
        platform: 'instagram'
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to generate captions: ${response.status} ${text}`);
    }

    return await response.json();
  }

  // ============================================================================
  // REVIEWS (Existing Functions)
  // ============================================================================

  async sendReviewRequest({ cust_id, place_ref = 'google' }) {
    // Calls existing reviews-nudge-run function
    const { data, error } = await this.supabase.functions.invoke('reviews-nudge-run', {
      body: { cust_id, place_ref }
    });

    if (error) throw error;
    return data;
  }

  async getReviews(cust_id) {
    const { data, error } = await this.supabase
      .from('reviews')
      .select('*')
      .eq('cust_id', cust_id)
      .order('posted_ts', { ascending: false });

    if (error) throw error;
    return data;
  }
}

// Create singleton instance
window.api = new API();

// Export for modules
export default window.api;
