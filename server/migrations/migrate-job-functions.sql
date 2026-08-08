-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: normalise legacy category / job_function values to canonical names
-- Run once; safe to re-run (WHERE clause restricts to only legacy values).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Pre-migration audit ────────────────────────────────────────────────────
\echo '=== Pre-migration: distinct category values ==='
SELECT category, count(*) AS cnt
FROM   jobs
GROUP  BY category
ORDER  BY cnt DESC;

-- ── 2. Migrate category column ────────────────────────────────────────────────
UPDATE jobs
SET    category = CASE LOWER(TRIM(category))
  WHEN 'admin'            THEN 'Operations'
  WHEN 'it'               THEN 'Information Technology (IT)'
  WHEN 'finance'          THEN 'Finance & Accounting'
  WHEN 'hr'               THEN 'Human Resources'
  WHEN 'customer success' THEN 'Customer Success'
  WHEN 'customer support' THEN 'Customer Support'
  WHEN 'development'      THEN 'Engineering'
  WHEN 'tech support'     THEN 'Information Technology (IT)'
  WHEN 'design'           THEN 'Design (UI/UX)'
  WHEN 'marketing'        THEN 'Marketing'
  WHEN 'sales'            THEN 'Sales'
  WHEN 'operations'       THEN 'Operations'
  WHEN 'data'             THEN 'Data & Analytics'
  WHEN 'product'          THEN 'Product'
  WHEN 'legal'            THEN 'Legal & Compliance'
  WHEN 'strategy'         THEN 'Strategy'
END
WHERE  category IS NOT NULL
  AND  LOWER(TRIM(category)) IN (
         'admin','it','finance','hr','customer success','customer support',
         'development','tech support','design','marketing','sales',
         'operations','data','product','legal','strategy'
       );

-- ── 3. Add job_function column if absent, seed from (now-canonical) category ──
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_function TEXT;

UPDATE jobs
SET    job_function = category
WHERE  job_function IS NULL OR job_function = '';

-- Also apply the canonical mapping to any existing job_function values
-- that weren't seeded via the startup migration yet.
UPDATE jobs
SET    job_function = CASE LOWER(TRIM(job_function))
  WHEN 'admin'            THEN 'Operations'
  WHEN 'it'               THEN 'Information Technology (IT)'
  WHEN 'finance'          THEN 'Finance & Accounting'
  WHEN 'hr'               THEN 'Human Resources'
  WHEN 'customer success' THEN 'Customer Success'
  WHEN 'customer support' THEN 'Customer Support'
  WHEN 'development'      THEN 'Engineering'
  WHEN 'tech support'     THEN 'Information Technology (IT)'
  WHEN 'design'           THEN 'Design (UI/UX)'
  WHEN 'marketing'        THEN 'Marketing'
  WHEN 'sales'            THEN 'Sales'
  WHEN 'operations'       THEN 'Operations'
  WHEN 'data'             THEN 'Data & Analytics'
  WHEN 'product'          THEN 'Product'
  WHEN 'legal'            THEN 'Legal & Compliance'
  WHEN 'strategy'         THEN 'Strategy'
END
WHERE  job_function IS NOT NULL
  AND  LOWER(TRIM(job_function)) IN (
         'admin','it','finance','hr','customer success','customer support',
         'development','tech support','design','marketing','sales',
         'operations','data','product','legal','strategy'
       );

-- ── 4. Post-migration audit ───────────────────────────────────────────────────
\echo '=== Post-migration: distinct category values ==='
SELECT category, count(*) AS cnt
FROM   jobs
GROUP  BY category
ORDER  BY cnt DESC;

\echo '=== Post-migration: distinct job_function values ==='
SELECT job_function, count(*) AS cnt
FROM   jobs
GROUP  BY job_function
ORDER  BY cnt DESC;

\echo '=== Unmapped (ambiguous) values left for admin review ==='
SELECT id, title, category, job_function
FROM   jobs
WHERE  category IS NOT NULL
  AND  category NOT IN (
         'Executive','Operations','Engineering','Artificial Intelligence',
         'Data & Analytics','Product','Design (UI/UX)','Information Technology (IT)',
         'Marketing','Sales','Customer Success','Customer Support',
         'Finance & Accounting','Human Resources','Legal & Compliance',
         'Procurement','Supply Chain','Business Development','Strategy',
         'Project & Program Management','Research & Development (R&D)'
       )
ORDER  BY category;

COMMIT;
