-- ============================================================================
-- Migration 001: Add tables/columns required by Spring Boot sync service.
-- Safe to re-run. Uses IF NOT EXISTS everywhere.
-- Apply via Vercel Dashboard → Storage → Postgres → Query.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. employees — directory of staff (consumed by Spring /api/sync/employees)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    emp_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    email VARCHAR(200),
    phone VARCHAR(20),
    department VARCHAR(100),
    designation VARCHAR(100),
    manager_emp_id VARCHAR(50),
    role VARCHAR(20) NOT NULL DEFAULT 'employee',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_emp_id  ON employees (emp_id);
CREATE INDEX IF NOT EXISTS idx_employees_dept    ON employees (department);
CREATE INDEX IF NOT EXISTS idx_employees_manager ON employees (manager_emp_id);

-- ---------------------------------------------------------------------------
-- 2. alerts — extend existing table with event-based fields
-- ---------------------------------------------------------------------------
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS event_id              INTEGER REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS delivery_status       VARCHAR(20) DEFAULT 'pending';
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS response_deadline_at  TIMESTAMP WITH TIME ZONE;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS push_sent_at          TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_alerts_event_id ON alerts (event_id);

-- ---------------------------------------------------------------------------
-- 3. responses — Spring-compatible response table (separate from alert_responses)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS responses (
    id SERIAL PRIMARY KEY,
    alert_id INTEGER NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    emp_id VARCHAR(50) NOT NULL,
    response_type VARCHAR(30) NOT NULL,
    response_lat DOUBLE PRECISION,
    response_lng DOUBLE PRECISION,
    responded_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_within_sla BOOLEAN NOT NULL DEFAULT FALSE,
    is_late BOOLEAN NOT NULL DEFAULT FALSE,
    response_time_seconds INTEGER,
    synced BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_responses_alert_id ON responses (alert_id);
CREATE INDEX IF NOT EXISTS idx_responses_event_id ON responses (event_id);
CREATE INDEX IF NOT EXISTS idx_responses_emp_id   ON responses (emp_id);
CREATE INDEX IF NOT EXISTS idx_responses_synced   ON responses (synced);

-- ---------------------------------------------------------------------------
-- 4. device_tokens — FCM tokens for push notifications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS device_tokens (
    id SERIAL PRIMARY KEY,
    emp_id VARCHAR(50) NOT NULL,
    fcm_token TEXT NOT NULL,
    platform VARCHAR(20) DEFAULT 'android',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(emp_id, fcm_token)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_emp_id ON device_tokens (emp_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_active ON device_tokens (is_active);

-- ---------------------------------------------------------------------------
-- 5. consent_logs — add `synced` if not present
-- ---------------------------------------------------------------------------
ALTER TABLE consent_logs ADD COLUMN IF NOT EXISTS synced BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_consent_logs_synced ON consent_logs (synced);

-- ============================================================================
-- Done. Verify with:
--   SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- ============================================================================
