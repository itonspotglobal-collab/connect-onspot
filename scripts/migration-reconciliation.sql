-- Transaction-local reconciliation support for the pending 0018--0031 SQL.
-- No connection handling, ledger writes, or production bootstrap operations.
-- Expected definitions come from the versioned migration, not ORM inference.
SET LOCAL search_path = pg_catalog, public;
CREATE TEMP TABLE IF NOT EXISTS _migration_reconcile_paused (
  relation oid NOT NULL,
  name text NOT NULL,
  definition text NOT NULL,
  PRIMARY KEY (relation, name)
) ON COMMIT DROP;

CREATE OR REPLACE FUNCTION pg_temp.reconcile_target(target text)
RETURNS text LANGUAGE plpgsql AS $body$
BEGIN
  IF target !~ '^public\.[a-z_][a-z0-9_]*$' THEN
    RAISE EXCEPTION 'reconciliation: unsupported target %', target;
  END IF;
  RETURN split_part(target, '.', 2);
END
$body$;

CREATE OR REPLACE FUNCTION pg_temp.reconcile_relation(target text)
RETURNS oid LANGUAGE plpgsql AS $body$
DECLARE result oid;
BEGIN
  PERFORM pg_temp.reconcile_target(target);
  result := to_regclass(target);
  IF result IS NULL OR NOT EXISTS (
    SELECT FROM pg_class WHERE oid = result AND relkind = 'r'
  ) THEN
    RAISE EXCEPTION 'reconciliation: % must be an ordinary table', target;
  END IF;
  RETURN result;
END
$body$;

CREATE OR REPLACE FUNCTION pg_temp.reconcile_default_matches(
  actual text, expected text, sql_type text
) RETURNS boolean LANGUAGE plpgsql AS $body$
DECLARE equal_value boolean;
BEGIN
  IF actual IS NOT DISTINCT FROM expected THEN RETURN true; END IF;
  IF actual IS NULL OR expected IS NULL THEN RETURN false; END IF;
  -- Only evaluate literal constants. Never execute an unexpected default
  -- function/expression merely to decide whether it is safe.
  IF actual ~ '^([+-]?[0-9]+(\.[0-9]+)?|true|false|''([^'']|'''')*''(::(numeric|text|character varying|boolean|jsonb))?)$'
     AND expected ~ '^([+-]?[0-9]+(\.[0-9]+)?|true|false|''([^'']|'''')*''(::(numeric|text|character varying|boolean|jsonb))?)$' THEN
    EXECUTE format(
      'SELECT ((%s)::%s) IS NOT DISTINCT FROM ((%s)::%s)',
      actual, sql_type, expected, sql_type
    ) INTO equal_value;
    RETURN equal_value;
  END IF;
  RETURN false;
END
$body$;

-- PostgreSQL forbids temporary-table FKs to persistent tables. Build empty
-- reference structures in a transaction-owned scratch schema instead. Each
-- helper drops it before returning, and rollback removes it on any failure.
-- Never reuse a pre-existing scratch schema or drop it with CASCADE.
CREATE OR REPLACE FUNCTION pg_temp.begin_reconcile_template(target text, body text)
RETURNS text LANGUAGE plpgsql AS $body$
DECLARE previous_path text := current_setting('search_path');
BEGIN
  IF to_regnamespace('_migration_reconcile_template') IS NOT NULL THEN
    RAISE EXCEPTION 'reconciliation: scratch schema already exists; refusing to reuse it';
  END IF;
  EXECUTE 'CREATE SCHEMA _migration_reconcile_template';
  PERFORM set_config('search_path', '_migration_reconcile_template, pg_catalog, public', true);
  EXECUTE format('CREATE TABLE _migration_reconcile_template.%I (%s)',
    pg_temp.reconcile_target(target), body);
  RETURN previous_path;
END
$body$;

CREATE OR REPLACE FUNCTION pg_temp.end_reconcile_template(target text, previous_path text)
RETURNS void LANGUAGE plpgsql AS $body$
BEGIN
  EXECUTE format('DROP TABLE _migration_reconcile_template.%I',
    pg_temp.reconcile_target(target));
  EXECUTE 'DROP SCHEMA _migration_reconcile_template';
  PERFORM set_config('search_path', previous_path, true);
END
$body$;

CREATE OR REPLACE FUNCTION pg_temp.reconcile_column_from_template(
  target text, template oid, column_name text,
  allow_stricter_not_null boolean DEFAULT false,
  safe_add_to_populated boolean DEFAULT false
) RETURNS void LANGUAGE plpgsql AS $body$
DECLARE
  relation oid := pg_temp.reconcile_relation(target);
  wanted record;
  actual record;
  populated boolean;
  declaration text;
BEGIN
  SELECT a.*, pg_get_expr(d.adbin, d.adrelid) AS default_sql
  INTO STRICT wanted FROM pg_attribute a
  LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  WHERE a.attrelid = template AND a.attname = column_name
    AND a.attnum > 0 AND NOT a.attisdropped;

  SELECT a.*, pg_get_expr(d.adbin, d.adrelid) AS default_sql
  INTO actual FROM pg_attribute a
  LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  WHERE a.attrelid = relation AND a.attname = column_name
    AND a.attnum > 0 AND NOT a.attisdropped;

  IF NOT FOUND THEN
    EXECUTE format('SELECT EXISTS (SELECT FROM %s)', target) INTO populated;
    IF populated AND wanted.attnotnull AND NOT safe_add_to_populated THEN
      RAISE EXCEPTION
        'reconciliation: cannot invent missing required %.% on a populated table',
        target, column_name;
    END IF;
    declaration := format('%I %s', column_name,
      format_type(wanted.atttypid, wanted.atttypmod));
    IF wanted.default_sql IS NOT NULL THEN
      declaration := declaration || ' DEFAULT ' || wanted.default_sql;
    END IF;
    IF wanted.attnotnull THEN declaration := declaration || ' NOT NULL'; END IF;
    EXECUTE format('ALTER TABLE %s ADD COLUMN %s', target, declaration);
    RETURN;
  END IF;

  IF actual.atttypid <> wanted.atttypid
     OR actual.atttypmod <> wanted.atttypmod
     OR actual.attcollation <> wanted.attcollation
     OR actual.attidentity <> wanted.attidentity
     OR actual.attgenerated <> wanted.attgenerated
     OR (actual.attnotnull <> wanted.attnotnull
         AND NOT (allow_stricter_not_null AND actual.attnotnull))
     OR NOT pg_temp.reconcile_default_matches(actual.default_sql,
          wanted.default_sql, format_type(wanted.atttypid, wanted.atttypmod)) THEN
    RAISE EXCEPTION
      'reconciliation: conflicting column %.% (type %, not_null %, default %; expected %, not_null %, default %)',
      target, column_name, format_type(actual.atttypid, actual.atttypmod),
      actual.attnotnull, actual.default_sql,
      format_type(wanted.atttypid, wanted.atttypmod),
      wanted.attnotnull, wanted.default_sql;
  END IF;
END
$body$;

CREATE OR REPLACE FUNCTION pg_temp.reconcile_constraint_from_template(
  target text, template_constraint oid, accept_not_valid boolean DEFAULT false
) RETURNS void LANGUAGE plpgsql AS $body$
DECLARE
  relation oid := pg_temp.reconcile_relation(target);
  wanted record;
  actual record;
  definition text;
  conflicting_fk record;
BEGIN
  SELECT *, regexp_replace(pg_get_constraintdef(oid, false),
      ' NOT VALID$', '') AS canonical
  INTO STRICT wanted FROM pg_constraint WHERE oid = template_constraint;
  definition := wanted.canonical;
  IF wanted.contype = 'f' THEN
    -- Constraint names may differ between ORM and SQL. An incompatible FK on
    -- the same source columns must not survive alongside the intended FK.
    FOR conflicting_fk IN
      SELECT conname, pg_get_constraintdef(oid, false) AS definition
      FROM pg_constraint existing
      WHERE existing.conrelid = relation AND existing.contype = 'f'
        AND ARRAY(SELECT a.attname::text FROM unnest(existing.conkey) k(attnum)
          JOIN pg_attribute a ON a.attrelid = relation AND a.attnum = k.attnum
          ORDER BY a.attname)
          = ARRAY(SELECT a.attname::text FROM unnest(wanted.conkey) k(attnum)
          JOIN pg_attribute a ON a.attrelid = wanted.conrelid AND a.attnum = k.attnum
          ORDER BY a.attname)
    LOOP
      IF regexp_replace(conflicting_fk.definition, ' NOT VALID$', '') <> definition THEN
        RAISE EXCEPTION 'reconciliation: conflicting foreign key %.%: %; expected %',
          target, conflicting_fk.conname, conflicting_fk.definition, definition;
      END IF;
    END LOOP;
  END IF;
  SELECT *, regexp_replace(pg_get_constraintdef(oid, false),
      ' NOT VALID$', '') AS canonical
  INTO actual FROM pg_constraint
  WHERE conrelid = relation AND conname = wanted.conname;
  IF FOUND AND (actual.contype <> wanted.contype
      OR actual.canonical <> definition
      OR actual.condeferrable <> wanted.condeferrable
      OR actual.condeferred <> wanted.condeferred) THEN
    RAISE EXCEPTION 'reconciliation: conflicting constraint %.%: %; expected %',
      target, wanted.conname, actual.canonical, definition;
  END IF;
  IF NOT FOUND THEN
    SELECT *, regexp_replace(pg_get_constraintdef(oid, false),
        ' NOT VALID$', '') AS canonical
    INTO actual FROM pg_constraint
    WHERE conrelid = relation AND contype = wanted.contype
      AND regexp_replace(pg_get_constraintdef(oid, false), ' NOT VALID$', '') = definition
      AND condeferrable = wanted.condeferrable AND condeferred = wanted.condeferred
    LIMIT 1;
  END IF;
  IF NOT FOUND THEN
    IF accept_not_valid THEN
      definition := definition || ' NOT VALID';
    END IF;
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s',
      target, wanted.conname, definition);
  ELSIF NOT actual.convalidated AND NOT accept_not_valid THEN
    EXECUTE format('ALTER TABLE %s VALIDATE CONSTRAINT %I',
      target, actual.conname);
  END IF;
END
$body$;

CREATE OR REPLACE FUNCTION pg_temp.reconcile_table(
  target text, body text,
  optional_columns text[] DEFAULT '{}',
  optional_unique_definitions text[] DEFAULT '{}',
  allowed_extra_columns text[] DEFAULT '{}'
) RETURNS void LANGUAGE plpgsql AS $body$
DECLARE
  name text := pg_temp.reconcile_target(target);
  relation oid := to_regclass(target);
  template oid;
  item record;
  previous_path text;
BEGIN
  IF relation IS NULL THEN
    EXECUTE format('CREATE TABLE %s (%s)', target, body);
    RETURN;
  END IF;
  PERFORM pg_temp.reconcile_relation(target);
  EXECUTE format('LOCK TABLE %s IN ACCESS EXCLUSIVE MODE', target);
  previous_path := pg_temp.begin_reconcile_template(target, body);
  template := to_regclass('_migration_reconcile_template.' || quote_ident(name));
  FOR item IN SELECT attname FROM pg_attribute
    WHERE attrelid = relation AND attnum > 0 AND NOT attisdropped
      AND NOT attname = ANY(allowed_extra_columns)
      AND NOT EXISTS (SELECT FROM pg_attribute expected
        WHERE expected.attrelid = template AND expected.attname = pg_attribute.attname
          AND expected.attnum > 0 AND NOT expected.attisdropped)
  LOOP
    RAISE EXCEPTION 'reconciliation: unexpected column %.%', target, item.attname;
  END LOOP;
  FOR item IN SELECT attname FROM pg_attribute
    WHERE attrelid = template AND attnum > 0 AND NOT attisdropped
  LOOP
    IF item.attname = ANY(optional_columns) AND NOT EXISTS (
      SELECT FROM pg_attribute WHERE attrelid = relation
        AND attname = item.attname AND attnum > 0 AND NOT attisdropped
    ) THEN CONTINUE; END IF;
    PERFORM pg_temp.reconcile_column_from_template(target, template, item.attname);
  END LOOP;
  FOR item IN SELECT oid, pg_get_constraintdef(oid, false) AS definition
    FROM pg_constraint WHERE conrelid = template AND contype IN ('p','u','f','c')
  LOOP
    IF item.definition = ANY(optional_unique_definitions) THEN CONTINUE; END IF;
    PERFORM pg_temp.reconcile_constraint_from_template(target, item.oid);
  END LOOP;
  PERFORM pg_temp.end_reconcile_template(target, previous_path);
END
$body$;

CREATE OR REPLACE FUNCTION pg_temp.reconcile_column(
  target text, column_name text, definition text,
  allow_stricter_not_null boolean DEFAULT false
) RETURNS void LANGUAGE plpgsql AS $body$
DECLARE name text := pg_temp.reconcile_target(target); template oid; previous_path text; item record;
BEGIN
  PERFORM pg_temp.reconcile_relation(target);
  EXECUTE format('LOCK TABLE %s IN ACCESS EXCLUSIVE MODE', target);
  previous_path := pg_temp.begin_reconcile_template(target, format('%I %s', column_name, definition));
  template := to_regclass('_migration_reconcile_template.' || quote_ident(name));
  PERFORM pg_temp.reconcile_column_from_template(
    target, template, column_name, allow_stricter_not_null, true);
  -- Inline REFERENCES/CHECK/UNIQUE clauses are part of the column definition,
  -- including when the column was precreated without those protections.
  FOR item IN SELECT oid FROM pg_constraint
    WHERE conrelid = template AND contype IN ('p','u','f','c')
  LOOP
    PERFORM pg_temp.reconcile_constraint_from_template(target, item.oid);
  END LOOP;
  PERFORM pg_temp.end_reconcile_template(target, previous_path);
END
$body$;

CREATE OR REPLACE FUNCTION pg_temp.reconcile_constraint(
  target text, name text, definition text,
  accept_not_valid boolean DEFAULT false
) RETURNS void LANGUAGE plpgsql AS $body$
DECLARE table_name text := pg_temp.reconcile_target(target); constraint_oid oid; previous_path text;
BEGIN
  PERFORM pg_temp.reconcile_relation(target);
  EXECUTE format('LOCK TABLE %s IN ACCESS EXCLUSIVE MODE', target);
  previous_path := pg_temp.begin_reconcile_template(target, format('LIKE %s', target));
  EXECUTE format('ALTER TABLE _migration_reconcile_template.%I ADD CONSTRAINT %I %s',
    table_name, name, definition);
  SELECT oid INTO STRICT constraint_oid FROM pg_constraint
  WHERE conrelid = to_regclass('_migration_reconcile_template.' || quote_ident(table_name)) AND conname = name;
  PERFORM pg_temp.reconcile_constraint_from_template(target, constraint_oid, accept_not_valid);
  PERFORM pg_temp.end_reconcile_template(target, previous_path);
END
$body$;

CREATE OR REPLACE FUNCTION pg_temp.reconcile_index(
  target text, name text, ddl text
) RETURNS void LANGUAGE plpgsql AS $body$
DECLARE
  table_name text := pg_temp.reconcile_target(target);
  actual_oid oid;
  expected_oid oid;
  actual_signature jsonb;
  expected_signature jsonb;
  previous_path text;
BEGIN
  PERFORM pg_temp.reconcile_relation(target);
  EXECUTE format('LOCK TABLE %s IN ACCESS EXCLUSIVE MODE', target);
  previous_path := pg_temp.begin_reconcile_template(target, format('LIKE %s', target));
  EXECUTE regexp_replace(ddl, '(\sON\s+)(public\.)?' || table_name || '\M',
    '\1_migration_reconcile_template.' || quote_ident(table_name), 'i');
  expected_oid := to_regclass('_migration_reconcile_template.' || quote_ident(name));
  actual_oid := to_regclass('public.' || quote_ident(name));
  IF expected_oid IS NULL THEN
    RAISE EXCEPTION 'reconciliation: expected index % was not instantiated', name;
  END IF;
  SELECT jsonb_build_object(
    'table', c.relname, 'unique', i.indisunique, 'method', am.amname,
    'keys', ARRAY(SELECT pg_get_indexdef(i.indexrelid, k, false)
      FROM generate_series(1, i.indnatts) k),
    'opclasses', i.indclass::text, 'collations', i.indcollation::text,
    'options', i.indoption::text, 'key_count', i.indnkeyatts,
    'immediate', i.indimmediate, 'nulls_not_distinct', to_jsonb(i)->'indnullsnotdistinct',
    'predicate', pg_get_expr(i.indpred, i.indrelid))
  INTO expected_signature FROM pg_index i
  JOIN pg_class c ON c.oid = i.indrelid
  JOIN pg_class ic ON ic.oid = i.indexrelid
  JOIN pg_am am ON am.oid = ic.relam WHERE i.indexrelid = expected_oid;
  IF actual_oid IS NOT NULL THEN
    SELECT jsonb_build_object(
      'table', c.relname, 'unique', i.indisunique, 'method', am.amname,
      'keys', ARRAY(SELECT pg_get_indexdef(i.indexrelid, k, false)
        FROM generate_series(1, i.indnatts) k),
      'opclasses', i.indclass::text, 'collations', i.indcollation::text,
      'options', i.indoption::text, 'key_count', i.indnkeyatts,
      'immediate', i.indimmediate, 'nulls_not_distinct', to_jsonb(i)->'indnullsnotdistinct',
      'predicate', pg_get_expr(i.indpred, i.indrelid))
    INTO actual_signature FROM pg_index i
    JOIN pg_class c ON c.oid = i.indrelid
    JOIN pg_class ic ON ic.oid = i.indexrelid
    JOIN pg_am am ON am.oid = ic.relam
    WHERE i.indexrelid = actual_oid AND i.indrelid = to_regclass(target)
      AND i.indisvalid AND i.indisready AND i.indislive;
    IF actual_signature IS DISTINCT FROM expected_signature THEN
      RAISE EXCEPTION 'reconciliation: conflicting index public.%: %; expected %',
        name, actual_signature, expected_signature;
    END IF;
  END IF;
  PERFORM pg_temp.end_reconcile_template(target, previous_path);
  IF actual_oid IS NULL THEN EXECUTE ddl; END IF;
END
$body$;

CREATE OR REPLACE FUNCTION pg_temp.assert_known_function(name text)
RETURNS void LANGUAGE plpgsql AS $body$
DECLARE actual record; hashes text[];
BEGIN
  name := regexp_replace(name, '^public\.', '');
  hashes := CASE name
    WHEN 'reject_timesheet_history_mutation' THEN ARRAY['f4e68ba1e2d006e67573b1ddff30917f']
    WHEN 'prevent_offer_billing_mode_change' THEN ARRAY['6eb2b474500a751a8dbf8bd8e8f44a44']
    WHEN 'prevent_signed_contract_billing_mode_change' THEN ARRAY['123bd250ef377b235cd1f0ba2bc9dee0','99230f95517faa3f1c10cc3002c87c9b']
    WHEN 'prevent_signed_contract_billing_start_change' THEN ARRAY['824312f7e9fe77cc0caebb42c83ccbf1','9395f7efee65ee045440ea8c882d6b14']
    WHEN 'protect_sent_talent_invoice' THEN ARRAY['eb7ae85eb0b1f0656055c7a2e1e45d28']
    WHEN 'protect_talent_credit_memos' THEN ARRAY['a6a793d9e25aeb07e380c2f03b9b9f8b']
    WHEN 'protect_credit_memo_application_v2' THEN ARRAY['8a85b9b601211e735b73e933fea07344']
    WHEN 'protect_credit_memo_application_legacy' THEN ARRAY['8a85b9b601211e735b73e933fea07344']
    WHEN 'protect_security_deposit_replenishments' THEN ARRAY['62afa86b1a959ec31309a69bf1d534bd']
    WHEN 'protect_sent_client_monthly_invoices' THEN ARRAY['f25e869c799d78d5ddf74e1ae79f7b51']
    WHEN 'protect_client_monthly_invoice_lines' THEN ARRAY['01873fc81ae7b6ff9ef31d246326b6c1']
    WHEN 'protect_client_late_claims' THEN ARRAY['b85603838ebe06217d1d3215109fb6b6']
    WHEN 'protect_client_credit_memos' THEN ARRAY['bb30f00002ccbb111a84b94dabeef52f']
    WHEN 'protect_client_credit_applications' THEN ARRAY['3f4c69923164b54bb6bdcdc5bf9ee145','6f50261e0d2cfb70a9fc184192c04f31']
    WHEN 'protect_hiring_contract_termination' THEN ARRAY['81edd371f0979a323490c358399e3430']
    WHEN 'protect_hiring_contract_termination_requests' THEN ARRAY['07d49eed0e4153278709d9da94ca8a8a','8b2d9e3efe2fb345d9c0c78c506f004f']
    ELSE NULL END;
  IF hashes IS NULL THEN RAISE EXCEPTION 'reconciliation: unowned function %', name; END IF;
  SELECT p.*, l.lanname INTO actual FROM pg_proc p
  JOIN pg_language l ON l.oid = p.prolang
  WHERE p.oid = to_regprocedure(format('public.%I()', name));
  IF NOT FOUND THEN RETURN; END IF;
  IF actual.prorettype <> 'trigger'::regtype OR actual.lanname <> 'plpgsql'
     OR actual.prosecdef OR actual.proconfig IS NOT NULL
     OR actual.provolatile <> 'v' OR actual.proparallel <> 'u'
     OR actual.proisstrict OR actual.proretset OR actual.prokind <> 'f'
     OR actual.proleakproof OR actual.prosupport <> 0
     OR actual.procost <> 100 OR actual.prorows <> 0
     OR NOT md5(actual.prosrc) = ANY(hashes) THEN
    RAISE EXCEPTION 'reconciliation: unexpected existing definition/properties of public.%()', name;
  END IF;
END
$body$;

CREATE OR REPLACE FUNCTION pg_temp.reconcile_function(name text, ddl text)
RETURNS void LANGUAGE plpgsql AS $body$
DECLARE qualified_ddl text;
BEGIN
  name := regexp_replace(name, '^public\.', '');
  ddl := ltrim(ddl);
  PERFORM pg_temp.assert_known_function(name);
  qualified_ddl := regexp_replace(ddl,
    '^CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+(public\.)?' || name || '\s*\(',
    'CREATE OR REPLACE FUNCTION public.' || quote_ident(name) || '(', 'i');
  IF qualified_ddl = ddl AND ddl !~* ('^CREATE OR REPLACE FUNCTION public\.' || name) THEN
    RAISE EXCEPTION 'reconciliation: unexpected function DDL for %', name;
  END IF;
  EXECUTE qualified_ddl;
  PERFORM pg_temp.assert_known_function(name);
END
$body$;

CREATE OR REPLACE FUNCTION pg_temp.reconcile_trigger(
  target text, name text, ddl text,
  allowed_event_masks smallint[] DEFAULT '{}',
  replace_allowed boolean DEFAULT false
) RETURNS void LANGUAGE plpgsql AS $body$
DECLARE
  table_name text := pg_temp.reconcile_target(target);
  expected record;
  actual record;
  previous_path text;
BEGIN
  PERFORM pg_temp.reconcile_relation(target);
  EXECUTE format('LOCK TABLE %s IN ACCESS EXCLUSIVE MODE', target);
  previous_path := pg_temp.begin_reconcile_template(target, format('LIKE %s', target));
  EXECUTE regexp_replace(ddl, '(\sON\s+)(public\.)?' || table_name || '\M',
    '\1_migration_reconcile_template.' || quote_ident(table_name), 'i');
  SELECT t.*, p.proname INTO STRICT expected FROM pg_trigger t
  JOIN pg_proc p ON p.oid = t.tgfoid
  WHERE t.tgrelid = to_regclass('_migration_reconcile_template.' || quote_ident(table_name)) AND t.tgname = name;
  PERFORM pg_temp.assert_known_function(expected.proname);
  SELECT * INTO actual FROM pg_trigger
  WHERE tgrelid = to_regclass(target) AND tgname = name;
  IF FOUND THEN
    IF actual.tgisinternal OR actual.tgenabled <> 'O'
       OR actual.tgfoid <> expected.tgfoid
       OR ARRAY(SELECT a.attname::text FROM unnest(actual.tgattr::smallint[]) k(attnum)
            JOIN pg_attribute a ON a.attrelid = actual.tgrelid AND a.attnum = k.attnum
            ORDER BY a.attname)
          <> ARRAY(SELECT a.attname::text FROM unnest(expected.tgattr::smallint[]) k(attnum)
            JOIN pg_attribute a ON a.attrelid = expected.tgrelid AND a.attnum = k.attnum
            ORDER BY a.attname)
       OR actual.tgargs <> expected.tgargs
       OR pg_get_expr(actual.tgqual, actual.tgrelid) IS DISTINCT FROM
          pg_get_expr(expected.tgqual, expected.tgrelid)
       OR (actual.tgtype <> expected.tgtype AND NOT actual.tgtype = ANY(allowed_event_masks))
       OR actual.tgconstraint <> 0 OR actual.tgdeferrable OR actual.tginitdeferred THEN
      RAISE EXCEPTION 'reconciliation: conflicting or disabled trigger %.%', target, name;
    END IF;
  END IF;
  PERFORM pg_temp.end_reconcile_template(target, previous_path);
  IF actual.oid IS NULL THEN EXECUTE ddl;
  ELSIF replace_allowed AND actual.tgtype <> expected.tgtype THEN
    EXECUTE format('DROP TRIGGER %I ON %s', name, target);
    EXECUTE ddl;
  END IF;
END
$body$;

CREATE OR REPLACE FUNCTION pg_temp.pause_known_trigger(
  target text, name text, ddl text
) RETURNS boolean LANGUAGE plpgsql AS $body$
DECLARE relation oid := pg_temp.reconcile_relation(target); definition text;
BEGIN
  IF NOT EXISTS (SELECT FROM pg_trigger WHERE tgrelid = relation AND tgname = name) THEN
    RETURN false;
  END IF;
  PERFORM pg_temp.reconcile_trigger(target, name, ddl);
  SELECT pg_get_triggerdef(oid, false) INTO STRICT definition FROM pg_trigger
  WHERE tgrelid = relation AND tgname = name AND tgenabled = 'O';
  INSERT INTO pg_temp._migration_reconcile_paused VALUES (relation, name, definition);
  EXECUTE format('ALTER TABLE %s DISABLE TRIGGER %I', target, name);
  RETURN true;
END
$body$;

CREATE OR REPLACE FUNCTION pg_temp.resume_known_trigger(target text, name text)
RETURNS void LANGUAGE plpgsql AS $body$
DECLARE target_relation oid := pg_temp.reconcile_relation(target); expected text; actual text;
BEGIN
  SELECT definition INTO expected FROM pg_temp._migration_reconcile_paused
  WHERE _migration_reconcile_paused.relation = target_relation
    AND _migration_reconcile_paused.name = resume_known_trigger.name;
  IF NOT FOUND THEN RETURN; END IF;
  EXECUTE format('ALTER TABLE %s ENABLE TRIGGER %I', target, name);
  SELECT pg_get_triggerdef(oid, false) INTO actual FROM pg_trigger
  WHERE tgrelid = target_relation AND tgname = name AND tgenabled = 'O';
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'reconciliation: trigger %.% was not restored exactly', target, name;
  END IF;
  DELETE FROM pg_temp._migration_reconcile_paused
  WHERE _migration_reconcile_paused.relation = target_relation
    AND _migration_reconcile_paused.name = resume_known_trigger.name;
END
$body$;

CREATE OR REPLACE FUNCTION pg_temp.drop_obsolete_unique_pair(target text, column_names text[])
RETURNS void LANGUAGE plpgsql AS $body$
DECLARE item record; relation oid := pg_temp.reconcile_relation(target);
BEGIN
  IF target <> 'public.talent_credit_memos'
     OR column_names <> ARRAY['original_invoice_id','corrected_revision_id']::text[] THEN
    RAISE EXCEPTION 'reconciliation: unapproved obsolete unique restriction on %', target;
  END IF;
  EXECUTE format('LOCK TABLE %s IN ACCESS EXCLUSIVE MODE', target);
  FOR item IN
    SELECT i.indexrelid, c.relname, con.conname, con.contype,
      i.indpred, i.indisvalid, i.indisready, i.indislive,
      i.indnatts, i.indoption, am.amname,
      to_jsonb(i)->'indnullsnotdistinct' AS nulls_not_distinct
    FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_am am ON am.oid = c.relam
    LEFT JOIN pg_constraint con ON con.conindid = i.indexrelid AND con.conrelid = relation
    WHERE i.indrelid = relation AND i.indisunique AND i.indnkeyatts = 2
      AND i.indexprs IS NULL
      AND ARRAY(SELECT a.attname::text FROM unnest(i.indkey::smallint[]) WITH ORDINALITY k(attnum, ord)
        JOIN pg_attribute a ON a.attrelid = relation AND a.attnum = k.attnum
        WHERE k.ord <= i.indnkeyatts ORDER BY a.attname)
        = ARRAY['corrected_revision_id','original_invoice_id']::text[]
  LOOP
    IF item.indpred IS NOT NULL OR NOT item.indisvalid
       OR NOT item.indisready OR NOT item.indislive
       OR item.indnatts <> 2 OR item.indoption::text <> '0 0'
       OR item.amname <> 'btree' OR item.nulls_not_distinct = 'true'::jsonb THEN
      RAISE EXCEPTION
        'reconciliation: conflicting obsolete pair index public.%; review required before removal',
        item.relname;
    ELSIF item.contype = 'p' THEN
      RAISE EXCEPTION 'reconciliation: cannot remove unexpected primary key %.%', target, item.conname;
    ELSIF item.conname IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', target, item.conname);
    ELSE
      EXECUTE format('DROP INDEX public.%I', item.relname);
    END IF;
  END LOOP;
END
$body$;

CREATE OR REPLACE FUNCTION pg_temp.finish_reconciliation()
RETURNS void LANGUAGE plpgsql AS $body$
DECLARE paused text;
BEGIN
  SELECT string_agg(format('%s.%I', relation::regclass, name), ', ')
    INTO paused FROM pg_temp._migration_reconcile_paused;
  IF paused IS NOT NULL THEN
    RAISE EXCEPTION 'reconciliation: refusing completion with paused triggers: %', paused;
  END IF;
  IF to_regnamespace('_migration_reconcile_template') IS NOT NULL THEN
    RAISE EXCEPTION 'reconciliation: refusing completion with a leftover scratch schema';
  END IF;
END
$body$;