# ADR 0001 â€“ HIPAA Split Enforcement
- **Date:** 2025-10-08
- **Status:** Accepted
- **Context:** Separation of PHI (AWS enclave) and non-PHI (Supabase).
- **Decision:** PHI data and originals stay in AWS (RDS/S3). Non-PHI CRM, consent, membership metadata in Supabase.
- **Consequences:** Media originals never leave HIPAA bucket; publish-only derivatives to Marketing S3.
