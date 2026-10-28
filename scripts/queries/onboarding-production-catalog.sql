-- SELECT-only audit input. Run through the verified production read-only
-- interface. Keep the result in temporary private audit storage, not Git.
-- Includes ledger values; no users/profile rows or private blob contents.
WITH tables AS (
 SELECT c.oid,c.relname FROM pg_class c
 WHERE c.relnamespace='public'::regnamespace AND c.relkind='r'
)
SELECT json_build_object(
 'tables',(
  SELECT json_agg(json_build_object('name',t.relname,'sql',(
   SELECT 'CREATE TABLE public.'||quote_ident(t.relname)||' ('||
    string_agg(quote_ident(a.attname)||' '||format_type(a.atttypid,a.atttypmod)||
     CASE WHEN d.oid IS NOT NULL THEN ' DEFAULT '||pg_get_expr(d.adbin,d.adrelid) ELSE '' END||
     CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END,',' ORDER BY a.attnum)||');'
   FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
   WHERE a.attrelid=t.oid AND a.attnum>0 AND NOT a.attisdropped)))
  FROM tables t),
 'sequences',(
  SELECT json_agg('CREATE SEQUENCE public.'||quote_ident(c.relname)||';')
  FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='S'),
 'enums',(
  SELECT json_agg(x.ddl) FROM (
   SELECT 'CREATE TYPE public.'||quote_ident(t.typname)||' AS ENUM ('||
    string_agg(quote_literal(e.enumlabel),',' ORDER BY e.enumsortorder)||');' ddl
   FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid
   WHERE t.typnamespace='public'::regnamespace GROUP BY t.oid,t.typname)x),
 'constraints',(
  SELECT json_agg(json_build_object('kind',k.contype,'sql',
   'ALTER TABLE public.'||quote_ident(t.relname)||' ADD CONSTRAINT '||
   quote_ident(k.conname)||' '||pg_get_constraintdef(k.oid)||';'))
  FROM pg_constraint k JOIN tables t ON t.oid=k.conrelid),
 'functions',(
  SELECT json_agg(pg_get_functiondef(p.oid)) FROM pg_proc p
  WHERE p.pronamespace='public'::regnamespace AND p.prokind='f'
   AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.objid=p.oid AND d.deptype='e')),
 'indexes',(
  SELECT json_agg(pg_get_indexdef(i.indexrelid)||';') FROM pg_index i JOIN tables t ON t.oid=i.indrelid
  WHERE NOT EXISTS(SELECT 1 FROM pg_constraint k WHERE k.conindid=i.indexrelid)),
 'triggers',(
  SELECT json_agg(pg_get_triggerdef(g.oid)||';') FROM pg_trigger g JOIN tables t ON t.oid=g.tgrelid
  WHERE NOT g.tgisinternal),
 'deposits',(SELECT json_agg(to_jsonb(d)) FROM security_deposits d)
) AS snapshot;
