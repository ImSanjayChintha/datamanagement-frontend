import { useCallback, useEffect, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import { CheckCircle, Play, RefreshCw, RotateCcw, ShieldCheck, XCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { toolkitSqlApi, toolkitTablesApi } from '@/modules/toolkit/core/api';
import Spinner from '@/components/ui/Spinner';
import toast from 'react-hot-toast';

// ── Interfaces ────────────────────────────────────────────────────────────────

interface DdlPart {
  operation: string;
  sql: string;
  label?: string;
}

interface BannerState {
  success: boolean;
  message: string;
  source: 'validate' | 'apply';
}

interface Props {
  tableCode: string | undefined;
  existingId?: number;
}

interface ParsedCol { name: string; type: string }

interface ParsedFK {
  column:    string;
  refTable:  string;
  refColumn: string;
}

interface ParsedTable {
  schema:     string;
  table:      string;
  cols:       ParsedCol[];
  fks:        ParsedFK[];
  uniqueKeys: string[][];   // each inner array = one unique constraint's columns
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EDITABLE_OPS    = new Set(['create_view', 'create_function']);
const FN_OP           = 'create_function';
const BULK_FN_MARKER  = 'insert_';
const SYNC_FN_MARKER  = 'sync_';
const UPSERT_FN_MARKER  = 'upsert_';
const DELETE_FN_MARKER  = 'delete_';
const MAX_SYNC_ROWS     = 5000;
const AUDIT_COLS     = new Set(['inserted_at', 'modified_at', 'inserted_by', 'modified_by']);
const contentPadding = EditorView.theme({ '.cm-content': { paddingBottom: '80px' } });

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractFnName(sqlText: string): string {
  return (
    sqlText.match(/create\s+or\s+replace\s+function\s+(\S+)\s*\(/i)?.[1] ??
    sqlText.match(/drop\s+function\s+if\s+exists\s+(\S+)/i)?.[1] ??
    ''
  );
}

function partLabel(p: DdlPart): string {
  if (p.label) return p.label;
  if (p.operation === 'create_table') return 'Create Table';
  if (p.operation === 'create_view')  return 'Create View';
  if (p.operation === 'alter_table')  return 'Alter Table';
  if (p.operation === FN_OP) {
    const fn = extractFnName(p.sql);
    if (fn.includes('fn_list_'))        return 'List Function';
    if (fn.includes('fn_get_'))         return 'Get Function';
    if (fn.includes('fn_upsert_'))      return 'Upsert';
    if (fn.includes('fn_delete_'))      return 'Delete';
    if (fn.includes('fn_bulk_insert_')) return 'Bulk Insert';
    return 'Function';
  }
  return p.operation.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function partDesc(p: DdlPart, tableCode: string): string {
  const fn = extractFnName(p.sql);
  if (p.operation === 'create_table')
    return 'Physical table structure — managed by Save. Edit fields in Table Designer to update.';
  if (p.operation === 'create_view')
    return `v_${tableCode} — resolves translations, computed expressions and reference labels. Editable.`;
  if (fn.includes('fn_list_'))
    return `${fn}(p_filters, p_sort, p_lang, p_limit, p_offset, p_with_total) — thin wrapper calling toolkit.fn_list. Editable.`;
  if (p.label === 'Upsert')
    return 'Upsert — select conflict target columns above. INSERT … ON CONFLICT DO UPDATE directly on the table. Editable.';
  if (p.label === 'Bulk Insert')
    return 'Bulk insert / sync — select sync key columns above. Stages rows in a temp table, deletes matched rows, then inserts. Editable.';
  if (p.label === 'Delete')
    return 'Delete — select filter columns above. Deletes rows where all selected key columns match. Editable.';
  if (p.operation === 'alter_table')
    return 'Column changes for existing fields — applied automatically on Save.';
  return '';
}

function clientValidate(sqlText: string, operation: string, tableCode: string): string | null {
  const s = sqlText.trim();
  if (!s) return 'SQL cannot be empty';
  const lower = s.toLowerCase();
  const tbl   = tableCode.toLowerCase().replace(/[^a-z0-9_]/g, '_');

  if (operation === 'create_view') {
    if (!lower.includes('view'))        return 'Must be a CREATE [OR REPLACE] VIEW statement';
    if (!lower.includes(`v_${tbl}`))    return `View must be named v_${tbl}`;
  }
  if (operation === FN_OP) {
    if (!/create\s+(or\s+replace\s+)?function/i.test(s))
      return 'Must be a CREATE [OR REPLACE] FUNCTION statement';
    const isList   = lower.includes(`fn_list_${tbl}`);
    const isUpsert = lower.includes(`upsert_${tbl}`);
    const isSync   = lower.includes(`sync_${tbl}`);
    const isDelete = lower.includes(`delete_${tbl}`);
    if (!isList && !isUpsert && !isDelete && !isSync)
      return `Function must be named fn_list_${tbl}, upsert_${tbl}, sync_${tbl}, or delete_${tbl}`;
  }
  // Inside a function body, DROP TABLE IF EXISTS _staging and DELETE FROM are
  // legitimate (temp table cleanup / sync delete). Only block top-level DDL.
  const destructivePatterns = operation === FN_OP
    ? ['truncate ']
    : ['drop table ', 'truncate ', 'delete from '];
  for (const blocked of destructivePatterns) {
    if (lower.includes(blocked)) return `Blocked pattern: "${blocked.trim()}"`;
  }
  return null;
}

// ── SQL type helpers ──────────────────────────────────────────────────────────

const PG_TYPES = new Set([
  'text', 'varchar', 'char', 'character',
  'integer', 'int', 'int2', 'int4', 'int8', 'bigint', 'smallint',
  'serial', 'serial2', 'serial4', 'serial8', 'bigserial', 'smallserial',
  'boolean', 'bool',
  'numeric', 'decimal', 'real', 'float', 'float4', 'float8', 'double',
  'jsonb', 'json',
  'uuid',
  'timestamptz', 'timestamp', 'date', 'time', 'timetz',
  'bytea', 'money', 'bit', 'citext', 'inet', 'macaddr',
]);

const SQL_KW = new Set([
  'constraint', 'references', 'check', 'primary', 'unique',
  'index', 'create', 'drop', 'comment', 'before', 'after',
  'for', 'on', 'when', 'execute', 'begin', 'end',
  'not', 'null', 'default', 'delete', 'update', 'restrict',
  'cascade', 'set', 'as', 'select', 'from', 'where',
  'join', 'and', 'or', 'is', 'in', 'each', 'row', 'statement',
  'insert', 'into', 'values', 'trigger', 'function', 'procedure',
  'table', 'view', 'schema', 'if', 'then', 'else', 'return',
  'using', 'language', 'returns', 'void', 'with', 'alter',
  'add', 'column', 'sequence', 'owned', 'nextval', 'deferrable',
  'initially', 'deferred', 'no', 'action', 'match', 'partial', 'full',
]);

const PG_RESERVED_WORDS = new Set([
  'all', 'analyse', 'analyze', 'and', 'any', 'array', 'as', 'asc',
  'asymmetric', 'authorization', 'between', 'bigint', 'binary', 'bit',
  'boolean', 'both', 'by', 'case', 'cast', 'char', 'character', 'check',
  'coalesce', 'collate', 'collation', 'column', 'concurrently', 'constraint',
  'create', 'cross', 'current', 'current_date', 'current_role',
  'current_schema', 'current_time', 'current_timestamp', 'current_user',
  'dec', 'decimal', 'default', 'deferrable', 'desc', 'distinct', 'do',
  'else', 'end', 'except', 'exists', 'extract', 'false', 'fetch', 'filter',
  'float', 'for', 'foreign', 'freeze', 'from', 'full', 'grant', 'greatest',
  'group', 'grouping', 'having', 'ilike', 'in', 'initially', 'inner',
  'inout', 'int', 'integer', 'intersect', 'interval', 'into', 'is',
  'isnull', 'join', 'lateral', 'leading', 'least', 'left', 'like', 'limit',
  'localtime', 'localtimestamp', 'national', 'natural', 'nchar', 'not',
  'notnull', 'null', 'nullif', 'numeric', 'of', 'offset', 'on', 'only',
  'or', 'order', 'out', 'outer', 'over', 'overlaps', 'overlay', 'placing',
  'position', 'primary', 'real', 'references', 'returning', 'right', 'row',
  'rows', 'select', 'session_user', 'similar', 'smallint', 'some',
  'substring', 'symmetric', 'table', 'tablesample', 'then', 'time',
  'timestamp', 'to', 'trailing', 'treat', 'trim', 'true', 'union', 'unique',
  'user', 'using', 'values', 'varchar', 'variadic', 'verbose', 'when',
  'where', 'window', 'with',
]);

function normalizePgType(t: string): string {
  if (t === 'bigserial'   || t === 'serial8') return 'bigint';
  if (t === 'serial'      || t === 'serial4') return 'integer';
  if (t === 'smallserial' || t === 'serial2') return 'smallint';
  return t;
}

function quoteCol(name: string): string {
  return PG_RESERVED_WORDS.has(name.toLowerCase()) ? `"${name}"` : name;
}

// ── DDL parser ────────────────────────────────────────────────────────────────

function parseFullTable(createTableSql: string): ParsedTable | null {
  if (!createTableSql) return null;

  const nameMatch = createTableSql.match(
    /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?(\w+)"?\.)?"?(\w+)"?\s*\(/i,
  );
  if (!nameMatch) return null;
  const schema = nameMatch[1] ?? '';
  const table  = nameMatch[2] ?? '';

  // Depth-tracked paren finder — stops at the matching ) for the CREATE TABLE body.
  // lastIndexOf would overshoot into trailing CREATE INDEX / trigger statements.
  const parenStart = createTableSql.indexOf('(');
  if (parenStart === -1) return null;
  let depth = 0, parenEnd = -1;
  for (let i = parenStart; i < createTableSql.length; i++) {
    if (createTableSql[i] === '(')      depth++;
    else if (createTableSql[i] === ')') { depth--; if (depth === 0) { parenEnd = i; break; } }
  }
  if (parenEnd === -1) return null;
  const body = createTableSql.slice(parenStart + 1, parenEnd);

  const cols:       ParsedCol[] = [];
  const fks:        ParsedFK[]  = [];
  const uniqueKeys: string[][]  = [];
  let   currentCol: string | null = null;

  for (const raw of body.split('\n')) {
    const line = raw.trim().replace(/,\s*$/, '').trim();
    if (!line || line.startsWith('--')) continue;

    // Table-level UNIQUE constraint
    const uqMatch = line.match(/constraint\s+\w+\s+unique\s*\(([^)]+)\)/i);
    if (uqMatch) {
      uniqueKeys.push(
        uqMatch[1].split(',').map(c => c.trim().replace(/"/g, '').toLowerCase()),
      );
      continue;
    }

    // Column definition — name must not be a SQL keyword, type must be a known PG type
    const m = line.match(/^"?(\w+)"?\s+(\w+)/);
    if (m && !SQL_KW.has(m[1].toLowerCase()) && PG_TYPES.has(m[2].toLowerCase())) {
      currentCol = m[1].toLowerCase();
      cols.push({ name: currentCol, type: m[2].toLowerCase() });
    }

    // REFERENCES continuation — associate with the preceding column
    const ref = line.match(/references\s+"?(\w+)"?\s*\(\s*"?(\w+)"?\s*\)/i);
    if (ref && currentCol) {
      fks.push({ column: currentCol, refTable: ref[1].toLowerCase(), refColumn: ref[2].toLowerCase() });
    }
  }

  return { schema, table, cols, fks, uniqueKeys };
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function buildHierarchyRefresh(schema: string, table: string, cols: ParsedCol[], context = 'operation'): string[] {
  const hasHierarchy = cols.some(c => c.name === 'has_children') && cols.some(c => c.name === 'parent_code');
  if (!hasHierarchy) return [];
  return [
    ``,
    `    -- Recalculate has_children for rows that gained or lost children in this ${context}`,
    `    UPDATE ${schema}.${table} p`,
    `    SET has_children = EXISTS(`,
    `        SELECT 1 FROM ${schema}.${table} c WHERE c.parent_code = p.code`,
    `    )`,
    `    WHERE p.has_children = true`,
    `       OR p.code IN (`,
    `          SELECT DISTINCT parent_code FROM ${schema}.${table}`,
    `          WHERE parent_code IS NOT NULL AND parent_code <> ''`,
    `       );`,
  ];
}

// ── Bulk insert builder ───────────────────────────────────────────────────────

function buildBulkInsertSql(schema: string, table: string, cols: ParsedCol[]): string {
  const fnName    = `insert_${table}`;
  const writeCols = cols.filter(c => !AUDIT_COLS.has(c.name));
  if (!writeCols.length) return `-- No writable columns found for ${schema}.${table}`;

  const sp8 = '        ';
  const insertCols = [
    ...writeCols.map(c => `${sp8}${quoteCol(c.name)}`),
    `${sp8}inserted_by`, `${sp8}inserted_at`, `${sp8}modified_by`, `${sp8}modified_at`,
  ].join(',\n');
  const selectCols = [
    ...writeCols.map(c => {
      if (c.name !== 'id') return `${sp8}${quoteCol(c.name)}`;
      if (c.type === 'uuid')
        return `${sp8}COALESCE(x.id, gen_random_uuid())`;
      if (c.type === 'bigserial' || c.type === 'serial' || c.type === 'smallserial')
        return `${sp8}COALESCE(x.id, nextval(pg_get_serial_sequence('${schema}.${table}', 'id')))`;
      return `${sp8}${quoteCol(c.name)}`;
    }),
    `${sp8}p_audit_user`, `${sp8}NOW()`, `${sp8}p_audit_user`, `${sp8}NOW()`,
  ].join(',\n');
  const typeList = writeCols.map(c => `${sp8}${quoteCol(c.name)} ${normalizePgType(c.type)}`).join(',\n');

  const hcRefresh = buildHierarchyRefresh(schema, table, cols, 'batch');

  return [
    `DROP FUNCTION IF EXISTS ${schema}.${fnName}(jsonb, text);`,
    `CREATE OR REPLACE FUNCTION ${schema}.${fnName}(p_data jsonb, p_audit_user text DEFAULT NULL)`,
    `RETURNS void AS $$`,
    `BEGIN`,
    `    INSERT INTO ${schema}.${table} (`,
    insertCols,
    `    )`,
    `    SELECT`,
    selectCols,
    `    FROM jsonb_to_recordset(p_data) AS x(`,
    typeList,
    `    );`,
    ...hcRefresh,
    `END;`,
    `$$ LANGUAGE plpgsql;`,
  ].join('\n');
}

// ── Sync function builder ─────────────────────────────────────────────────────

function buildSyncFunctionSql(
  schema:   string,
  table:    string,
  cols:     ParsedCol[],
  fks:      ParsedFK[],
  syncKeys: string[],
  maxRows:  number = MAX_SYNC_ROWS,
): string {
  if (!syncKeys.length) {
    return [
      `-- Select at least one sync key above to generate this function.`,
      `--`,
      `-- Sync keys define which records are deleted before re-insert:`,
      `--   DELETE FROM ${schema}.${table} WHERE (key1, key2) IN (staging keys)`,
      `--   INSERT all staging rows → clean replacement of exactly those records.`,
    ].join('\n');
  }

  const fnName    = `sync_${table}`;
  const writeCols = cols.filter(c => !AUDIT_COLS.has(c.name));
  const sp8       = '        ';

  // recordset type list
  const typeList = writeCols
    .map(c => `${sp8}${quoteCol(c.name)} ${normalizePgType(c.type)}`)
    .join(',\n');

  // INSERT / SELECT column lists
  const insertCols = [
    ...writeCols.map(c => `${sp8}${quoteCol(c.name)}`),
    `${sp8}inserted_by`, `${sp8}inserted_at`, `${sp8}modified_by`, `${sp8}modified_at`,
  ].join(',\n');
  const selectCols = [
    ...writeCols.map(c => `${sp8}${quoteCol(c.name)}`),
    `${sp8}p_audit_user`, `${sp8}NOW()`, `${sp8}p_audit_user`, `${sp8}NOW()`,
  ].join(',\n');

  // Check 2 — NULL guard on every sync key column
  const nullGuard = syncKeys
    .map((k, i) => `${i === 0 ? '        ' : '        OR  '}${quoteCol(k)} IS NULL`)
    .join('\n');

  // Check 3 — duplicate composite key in staging
  const keyList    = syncKeys.map(quoteCol).join(', ');

  // Check 4 — FK existence check for each sync key that has a FK constraint
  const syncKeyFKs = fks.filter(fk => syncKeys.includes(fk.column));
  const fkBlocks   = syncKeyFKs.map(fk => [
    `    -- FK: ${fk.column} → ${fk.refTable}.${fk.refColumn}`,
    `    IF EXISTS (`,
    `        SELECT 1 FROM _staging s`,
    `        LEFT  JOIN ${schema}.${fk.refTable} r ON r.${quoteCol(fk.refColumn)} = s.${quoteCol(fk.column)}`,
    `        WHERE  s.${quoteCol(fk.column)} IS NOT NULL`,
    `        AND    r.${quoteCol(fk.refColumn)} IS NULL`,
    `    ) THEN`,
    `        RAISE EXCEPTION '${fk.column}: value not found in ${fk.refTable}';`,
    `    END IF;`,
  ].join('\n'));

  // DELETE clause — row constructor for composite keys, simple IN for single key
  const deleteClause = syncKeys.length === 1
    ? [
        `    DELETE FROM ${schema}.${table}`,
        `    WHERE  ${quoteCol(syncKeys[0])} IN (SELECT DISTINCT ${quoteCol(syncKeys[0])} FROM _staging);`,
      ].join('\n')
    : [
        `    DELETE FROM ${schema}.${table}`,
        `    WHERE  (${keyList}) IN (`,
        `        SELECT DISTINCT ${keyList} FROM _staging`,
        `    );`,
      ].join('\n');

  const hcRefresh = buildHierarchyRefresh(schema, table, cols, 'sync');

  const lines: string[] = [
    `DROP FUNCTION IF EXISTS ${schema}.${fnName}(jsonb, text);`,
    `CREATE OR REPLACE FUNCTION ${schema}.${fnName}(`,
    `    p_data       jsonb,`,
    `    p_audit_user text DEFAULT NULL`,
    `)`,
    `RETURNS jsonb AS $$`,
    `DECLARE`,
    `    v_count    int;`,
    `    v_deleted  int := 0;`,
    `    v_inserted int := 0;`,
    `BEGIN`,
    ``,
    `    -- Stage: load payload into a session-scoped temp table.`,
    `    -- DROP first so the function is safe when called twice in the same session.`,
    `    DROP TABLE IF EXISTS _staging;`,
    `    CREATE TEMP TABLE _staging ON COMMIT DROP AS`,
    `    SELECT * FROM jsonb_to_recordset(p_data) AS x(`,
    typeList,
    `    );`,
    ``,
    `    -- Check 1: empty payload`,
    `    SELECT COUNT(*) INTO v_count FROM _staging;`,
    `    IF v_count = 0 THEN`,
    `        RAISE EXCEPTION 'No data provided';`,
    `    END IF;`,
    ``,
    `    -- Check 2: null sync keys  [${syncKeys.join(', ')}]`,
    `    IF EXISTS (`,
    `        SELECT 1 FROM _staging WHERE`,
    nullGuard,
    `    ) THEN`,
    `        RAISE EXCEPTION 'Sync key columns cannot be null: ${syncKeys.join(', ')}';`,
    `    END IF;`,
    ``,
    `    -- Check 3: duplicate sync keys in payload`,
    `    IF EXISTS (`,
    `        SELECT ${keyList} FROM _staging`,
    `        GROUP  BY ${keyList}`,
    `        HAVING COUNT(*) > 1`,
    `    ) THEN`,
    `        RAISE EXCEPTION 'Duplicate sync key values in payload: ${syncKeys.join(', ')}';`,
    `    END IF;`,
    ``,
    ...(fkBlocks.length > 0
      ? [`    -- Check 4: FK integrity for sync key columns`, ...fkBlocks, ``]
      : [`    -- Check 4: no FK constraints found for sync key columns`, ``]),
    `    -- Check 5: row count safety limit`,
    `    IF v_count > ${maxRows} THEN`,
    `        RAISE EXCEPTION 'Batch too large: % rows (max ${maxRows})', v_count;`,
    `    END IF;`,
    ``,
    `    -- Delete existing records whose sync keys appear in staging`,
    deleteClause,
    `    GET DIAGNOSTICS v_deleted = ROW_COUNT;`,
    ``,
    `    -- Insert staging rows with audit columns`,
    `    INSERT INTO ${schema}.${table} (`,
    insertCols,
    `    )`,
    `    SELECT`,
    selectCols,
    `    FROM _staging;`,
    `    GET DIAGNOSTICS v_inserted = ROW_COUNT;`,
    ...hcRefresh,
    ``,
    `    RETURN jsonb_build_object(`,
    `        'ok',       true,`,
    `        'deleted',  v_deleted,`,
    `        'inserted', v_inserted`,
    `    );`,
    ``,
    `END;`,
    `$$ LANGUAGE plpgsql;`,
  ];

  return lines.join('\n');
}

// ── Delete function builder ───────────────────────────────────────────────────

function buildDeleteFunctionSql(
  schema:     string,
  table:      string,
  cols:       ParsedCol[],
  filterKeys: string[],
): string {
  if (!filterKeys.length) {
    return [
      `-- Select at least one filter column above to generate this function.`,
      `--`,
      `-- Filter columns determine which rows are targeted for deletion.`,
      `-- If any matched row is referenced by a child table FK, the delete is rejected.`,
    ].join('\n');
  }

  const fnName     = `delete_${table}`;
  const filterCols = cols.filter(c => filterKeys.includes(c.name));

  const declares = filterCols
    .map(c => `    v_${c.name}  ${normalizePgType(c.type)};`)
    .join('\n');

  const extracts = filterCols
    .map(c => {
      const pgType = normalizePgType(c.type);
      const op = pgType === 'jsonb' ? `->'${c.name}'` : `->>'${c.name}'`;
      return `    v_${c.name} := (p_filter${op})::${pgType};`;
    })
    .join('\n');

  const nullGuards = filterCols
    .map(c => [
      `    IF v_${c.name} IS NULL THEN`,
      `        RAISE EXCEPTION 'Filter value for ${c.name} is required';`,
      `    END IF;`,
    ].join('\n'))
    .join('\n');

  const whereLines = filterCols
    .map((c, i) => `        ${i === 0 ? 'WHERE  ' : 'AND    '}${quoteCol(c.name)} = v_${c.name}`)
    .join('\n');

  return [
    `DROP FUNCTION IF EXISTS ${schema}.${fnName}(jsonb, text);`,
    `CREATE OR REPLACE FUNCTION ${schema}.${fnName}(p_filter jsonb, p_audit_user text DEFAULT NULL)`,
    `RETURNS jsonb AS $$`,
    `DECLARE`,
    declares,
    `    v_deleted  int := 0;`,
    `BEGIN`,
    ``,
    `    -- Extract and validate filter values`,
    extracts,
    ``,
    nullGuards,
    ``,
    `    -- Delete matching rows.`,
    `    -- PostgreSQL raises foreign_key_violation (23503) automatically when a row`,
    `    -- is still referenced by a child table; we catch it and re-raise clearly.`,
    `    BEGIN`,
    `        DELETE FROM ${schema}.${table}`,
    whereLines + `;`,
    `        GET DIAGNOSTICS v_deleted = ROW_COUNT;`,
    `    EXCEPTION`,
    `        WHEN foreign_key_violation THEN`,
    `            RAISE EXCEPTION 'Cannot delete: records are still referenced by child tables. Remove dependent records first.';`,
    `    END;`,
    ``,
    `    IF v_deleted = 0 THEN`,
    `        RAISE EXCEPTION 'No records found matching the given filter';`,
    `    END IF;`,
    ``,
    `    RETURN jsonb_build_object('ok', true, 'deleted', v_deleted);`,
    ``,
    `END;`,
    `$$ LANGUAGE plpgsql;`,
  ].join('\n');
}

// ── Upsert function builder ───────────────────────────────────────────────────

function buildUpsertFunctionSql(
  schema:     string,
  table:      string,
  cols:       ParsedCol[],
  upsertKeys: string[],
): string {
  if (!upsertKeys.length) {
    return [
      `-- Select at least one conflict target above to generate this function.`,
      `--`,
      `-- The conflict target must match a UNIQUE index or PRIMARY KEY on ${schema}.${table}.`,
      `-- Rows whose key values already exist are updated; new rows are inserted.`,
    ].join('\n');
  }

  const fnName    = `upsert_${table}`;
  const writeCols = cols.filter(c => !AUDIT_COLS.has(c.name));
  const sp8       = '        ';

  const typeList = writeCols
    .map(c => `${sp8}${quoteCol(c.name)} ${normalizePgType(c.type)}`)
    .join(',\n');

  const insertCols = [
    ...writeCols.map(c => `${sp8}${quoteCol(c.name)}`),
    `${sp8}inserted_by`, `${sp8}inserted_at`, `${sp8}modified_by`, `${sp8}modified_at`,
  ].join(',\n');

  const selectCols = [
    ...writeCols.map(c => {
      if (c.name !== 'id') return `${sp8}${quoteCol(c.name)}`;
      if (c.type === 'uuid')
        return `${sp8}COALESCE(x.id, gen_random_uuid())`;
      if (c.type === 'bigserial' || c.type === 'serial' || c.type === 'smallserial')
        return `${sp8}COALESCE(x.id, nextval(pg_get_serial_sequence('${schema}.${table}', 'id')))`;
      return `${sp8}${quoteCol(c.name)}`;
    }),
    `${sp8}p_audit_user`, `${sp8}NOW()`, `${sp8}p_audit_user`, `${sp8}NOW()`,
  ].join(',\n');

  const conflictTarget = upsertKeys.map(quoteCol).join(', ');

  const hcRefresh = buildHierarchyRefresh(schema, table, cols, 'upsert');

  // DO UPDATE SET: all writable non-key cols + modified audit; inserted audit stays unchanged
  const updateItems = [
    ...writeCols
      .filter(c => !upsertKeys.includes(c.name))
      .map(c => `${sp8}${quoteCol(c.name)} = EXCLUDED.${quoteCol(c.name)}`),
    `${sp8}modified_at = NOW()`,
    `${sp8}modified_by = p_audit_user`,
  ];
  const updateSet = updateItems.join(',\n');

  return [
    `DROP FUNCTION IF EXISTS ${schema}.${fnName}(jsonb, text);`,
    `CREATE OR REPLACE FUNCTION ${schema}.${fnName}(p_data jsonb, p_audit_user text DEFAULT NULL)`,
    `RETURNS jsonb AS $$`,
    `DECLARE`,
    `    v_upserted int := 0;`,
    `    v_new_id   text;`,
    `BEGIN`,
    `    WITH upserted AS (`,
    `        INSERT INTO ${schema}.${table} (`,
    insertCols,
    `        )`,
    `        SELECT`,
    selectCols,
    `        FROM jsonb_to_recordset(p_data) AS x(`,
    typeList,
    `        )`,
    `        ON CONFLICT (${conflictTarget}) DO UPDATE SET`,
    updateSet,
    `        RETURNING id::text AS row_id`,
    `    )`,
    `    SELECT COUNT(*), (ARRAY_AGG(row_id))[1]`,
    `    INTO v_upserted, v_new_id`,
    `    FROM upserted;`,
    ...hcRefresh,
    ``,
    `    RETURN jsonb_build_object('ok', true, 'upserted', v_upserted, 'id', v_new_id);`,
    `END;`,
    `$$ LANGUAGE plpgsql;`,
  ].join('\n');
}

// ── Synthetic part makers ─────────────────────────────────────────────────────

function makeBulkInsertPart(parsed: ParsedTable): DdlPart | null {
  if (!parsed.cols.length) return null;
  return {
    operation: FN_OP,
    sql:       buildBulkInsertSql(parsed.schema, parsed.table, parsed.cols),
  };
}

function makeSyncPart(parsed: ParsedTable, syncKeys: string[]): DdlPart {
  return {
    operation: FN_OP,
    label:     'Bulk Insert',
    sql:       buildSyncFunctionSql(parsed.schema, parsed.table, parsed.cols, parsed.fks, syncKeys),
  };
}

function makeUpsertPart(parsed: ParsedTable, upsertKeys: string[]): DdlPart {
  return {
    operation: FN_OP,
    label:     'Upsert',
    sql:       buildUpsertFunctionSql(parsed.schema, parsed.table, parsed.cols, upsertKeys),
  };
}

function makeDeletePart(parsed: ParsedTable, filterKeys: string[]): DdlPart {
  return {
    operation: FN_OP,
    label:     'Delete',
    sql:       buildDeleteFunctionSql(parsed.schema, parsed.table, parsed.cols, filterKeys),
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PreviewDdlTab({ tableCode, existingId }: Props) {
  const [parts, setParts]                   = useState<DdlPart[]>([]);
  const [loading, setLoading]               = useState(false);
  const [activeIdx, setActiveIdx]           = useState(0);
  const [editedSql, setEditedSql]           = useState<Record<number, string>>({});
  const [validating, setValidating]         = useState<Record<number, boolean>>({});
  const [validated, setValidated]           = useState<Record<number, boolean>>({});
  const [applying, setApplying]             = useState<Record<number, boolean>>({});
  const [banners, setBanners]               = useState<Record<number, BannerState>>({});
  const [regenerating, setRegenerating]         = useState(false);
  const [resetting, setResetting]               = useState(false);
  const [parsedTable, setParsedTable]           = useState<ParsedTable | null>(null);
  const [syncPartIdx, setSyncPartIdx]           = useState(-1);
  const [upsertPartIdx, setUpsertPartIdx]       = useState(-1);
  const [deletePartIdx, setDeletePartIdx]       = useState(-1);
  const [syncKeys, setSyncKeys]                 = useState<string[]>([]);
  const [upsertKeys, setUpsertKeys]             = useState<string[]>([]);
  const [deleteKeys, setDeleteKeys]             = useState<string[]>([]);

  // ── Load DDL ────────────────────────────────────────────────────────────────

  const loadDdl = useCallback(() => {
    if (!tableCode) return;
    setLoading(true);
    toolkitTablesApi.ddl(tableCode)
      .then(res => {
        const backend  = res.parts ?? [];
        const saved    = (res.saved_functions ?? {}) as Record<string, { sql: string; keys: string[] }>;
        const ctPart   = backend.find((p: DdlPart) => p.operation === 'create_table');
        const parsed   = ctPart ? parseFullTable(ctPart.sql) : null;
        setParsedTable(parsed);

        const all: DdlPart[] = [...backend];
        let uIdx = -1, sIdx = -1, dIdx = -1;
        if (parsed) {
          uIdx = all.length;
          all.push(saved.upsert
            ? { operation: FN_OP, label: 'Upsert',      sql: saved.upsert.sql }
            : makeUpsertPart(parsed, []));
          sIdx = all.length;
          all.push(saved.sync
            ? { operation: FN_OP, label: 'Bulk Insert', sql: saved.sync.sql   }
            : makeSyncPart(parsed, []));
          dIdx = all.length;
          all.push(saved.delete
            ? { operation: FN_OP, label: 'Delete',      sql: saved.delete.sql }
            : makeDeletePart(parsed, []));
        }
        setUpsertPartIdx(uIdx);
        setSyncPartIdx(sIdx);
        setDeletePartIdx(dIdx);
        setParts(all);
        setEditedSql(Object.fromEntries(all.map((pt, i) => [i, pt.sql])));
        setBanners({});
        setValidated({});
        setActiveIdx(0);

        // Restore key selections from saved metadata — effects will regenerate SQL from them
        setUpsertKeys(saved.upsert?.keys?.length ? saved.upsert.keys : []);
        setSyncKeys(saved.sync?.keys?.length     ? saved.sync.keys   : []);
        setDeleteKeys(saved.delete?.keys?.length ? saved.delete.keys : []);
      })
      .catch(() => toast.error('Could not load DDL'))
      .finally(() => setLoading(false));
  }, [tableCode]);

  useEffect(() => { loadDdl(); }, [loadDdl]);

  useEffect(() => {
    if (upsertPartIdx < 0 || !parsedTable) return;
    if (upsertKeys.length === 0) return;
    const p = makeUpsertPart(parsedTable, upsertKeys);
    setParts(prev => prev.map((pt, i) => i === upsertPartIdx ? p : pt));
    setEditedSql(prev => ({ ...prev, [upsertPartIdx]: p.sql }));
    setValidated(prev => ({ ...prev, [upsertPartIdx]: false }));
  }, [upsertKeys, upsertPartIdx, parsedTable]);

  useEffect(() => {
    if (syncPartIdx < 0 || !parsedTable) return;
    if (syncKeys.length === 0) return;
    const p = makeSyncPart(parsedTable, syncKeys);
    setParts(prev => prev.map((pt, i) => i === syncPartIdx ? p : pt));
    setEditedSql(prev => ({ ...prev, [syncPartIdx]: p.sql }));
    setValidated(prev => ({ ...prev, [syncPartIdx]: false }));
  }, [syncKeys, syncPartIdx, parsedTable]);

  useEffect(() => {
    if (deletePartIdx < 0 || !parsedTable) return;
    if (deleteKeys.length === 0) return;
    const p = makeDeletePart(parsedTable, deleteKeys);
    setParts(prev => prev.map((pt, i) => i === deletePartIdx ? p : pt));
    setEditedSql(prev => ({ ...prev, [deletePartIdx]: p.sql }));
    setValidated(prev => ({ ...prev, [deletePartIdx]: false }));
  }, [deleteKeys, deletePartIdx, parsedTable]);

  // ── Regenerate ──────────────────────────────────────────────────────────────

  async function handleRegenerate() {
    if (!existingId) { toast.error('Save the table first'); return; }
    const op          = activePart?.operation;
    const objectType  = op === 'create_view' ? 'view' : op === 'create_function' ? 'function' : undefined;
    const label       = objectType === 'view' ? 'View' : objectType === 'function' ? 'List function' : 'View and list function';
    setRegenerating(true);
    try {
      await toolkitTablesApi.regenerate(existingId, objectType);
      toast.success(`${label} regenerated`);
      loadDdl();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Regeneration failed');
    } finally {
      setRegenerating(false);
    }
  }

  // ── Regenerate synthetic (client-side) ─────────────────────────────────────

  function handleRegenerateSynthetic(idx: number) {
    if (!parsedTable) return;
    let newPart: DdlPart | undefined;
    if (idx === upsertPartIdx) newPart = makeUpsertPart(parsedTable, upsertKeys);
    else if (idx === syncPartIdx)   newPart = makeSyncPart(parsedTable, syncKeys);
    else if (idx === deletePartIdx) newPart = makeDeletePart(parsedTable, deleteKeys);
    if (!newPart) return;
    setParts(prev => prev.map((pt, i) => i === idx ? newPart! : pt));
    setEditedSql(prev => ({ ...prev, [idx]: newPart!.sql }));
    setValidated(prev => ({ ...prev, [idx]: false }));
    setBanners(prev => { const n = { ...prev }; delete n[idx]; return n; });
    toast.success('SQL regenerated from current key selection');
  }

  // ── Validate ────────────────────────────────────────────────────────────────

  async function handleValidate(idx: number) {
    const p = parts[idx];
    if (!tableCode || !p) return;
    const sqlText = editedSql[idx] ?? p.sql;

    const clientErr = clientValidate(sqlText, p.operation, tableCode);
    if (clientErr) {
      setBanners(prev  => ({ ...prev, [idx]: { success: false, message: clientErr, source: 'validate' } }));
      setValidated(prev => ({ ...prev, [idx]: false }));
      return;
    }

    setValidating(prev => ({ ...prev, [idx]: true }));
    setBanners(prev    => { const n = { ...prev }; delete n[idx]; return n; });
    try {
      const res = await toolkitSqlApi.validate(sqlText);
      setBanners(prev  => ({ ...prev, [idx]: { success: true, message: res.message, source: 'validate' } }));
      setValidated(prev => ({ ...prev, [idx]: true }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Validation failed';
      setBanners(prev  => ({ ...prev, [idx]: { success: false, message: msg, source: 'validate' } }));
      setValidated(prev => ({ ...prev, [idx]: false }));
    } finally {
      setValidating(prev => ({ ...prev, [idx]: false }));
    }
  }

  // ── Apply ───────────────────────────────────────────────────────────────────

  async function handleApply(idx: number) {
    const p = parts[idx];
    if (!tableCode || !p) return;
    const sqlText = editedSql[idx] ?? p.sql;

    let objectMeta: object | undefined;
    if (idx === upsertPartIdx && upsertKeys.length > 0) objectMeta = { keys: upsertKeys };
    else if (idx === syncPartIdx && syncKeys.length > 0) objectMeta = { keys: syncKeys };
    else if (idx === deletePartIdx && deleteKeys.length > 0) objectMeta = { keys: deleteKeys };

    setApplying(prev => ({ ...prev, [idx]: true }));
    setBanners(prev  => { const n = { ...prev }; delete n[idx]; return n; });
    try {
      await toolkitSqlApi.execute(sqlText, tableCode, objectMeta);
      setBanners(prev => ({ ...prev, [idx]: { success: true, message: `${partLabel(p)} applied successfully`, source: 'apply' } }));
      setValidated(prev => ({ ...prev, [idx]: false }));
      toast.success(`${partLabel(p)} applied to database`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Execute failed';
      setBanners(prev => ({ ...prev, [idx]: { success: false, message: msg, source: 'apply' } }));
      toast.error(msg);
    } finally {
      setApplying(prev => ({ ...prev, [idx]: false }));
    }
  }

  // ── Reset to generated ─────────────────────────────────────────────────────

  async function handleResetToGenerated(idx: number) {
    const p = parts[idx];
    if (!existingId || !p) return;

    const objectType = p.operation === 'create_view' ? 'view' : 'function';
    let objectCode: string;
    if (objectType === 'view') {
      const m = p.sql.match(/create\s+(?:or\s+replace\s+)?view\s+(?:\w+\.)?(\w+)/i);
      objectCode = m?.[1] ?? '';
    } else {
      const fullName = extractFnName(p.sql);
      objectCode = fullName.includes('.') ? fullName.split('.').pop()! : fullName;
    }
    if (!objectCode) return;

    setResetting(true);
    setBanners(prev => { const n = { ...prev }; delete n[idx]; return n; });
    try {
      const res = await toolkitTablesApi.resetObject(existingId, objectCode, objectType);
      // Replace local SQL with the freshly generated version
      setEditedSql(prev => ({ ...prev, [idx]: res.sql }));
      setParts(prev => prev.map((pt, i) => i === idx ? { ...pt, sql: res.sql } : pt));
      setValidated(prev => ({ ...prev, [idx]: false }));
      setBanners(prev => ({ ...prev, [idx]: { success: true, message: `Reset to auto-generated ${objectType}`, source: 'apply' } }));
      toast.success(`${partLabel(p)} reset to auto-generated`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Reset failed';
      setBanners(prev => ({ ...prev, [idx]: { success: false, message: msg, source: 'apply' } }));
      toast.error(msg);
    } finally {
      setResetting(false);
    }
  }

  // ── Early returns ───────────────────────────────────────────────────────────

  if (!tableCode) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-10 text-center text-sm text-gray-400">
        Save the table first to preview the generated SQL.
      </div>
    );
  }
  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-10 flex justify-center">
        <Spinner size="lg" />
      </div>
    );
  }
  if (!parts.length) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-10 text-center text-sm text-gray-400">
        No DDL available.
      </div>
    );
  }

  // ── Derived state ────────────────────────────────────────────────────────────

  const activePart     = parts[activeIdx];
  const label          = partLabel(activePart);
  const isEditable     = EDITABLE_OPS.has(activePart?.operation ?? '');
  const activeBanner   = banners[activeIdx];
  const isValidating   = validating[activeIdx] ?? false;
  const isValidated    = validated[activeIdx]  ?? false;
  const isApplying     = applying[activeIdx]   ?? false;
  const currentSql     = editedSql[activeIdx]  ?? activePart?.sql ?? '';
  const isDirty        = currentSql !== (activePart?.sql ?? '');
  const isUpsertTab    = activeIdx === upsertPartIdx;
  const isSyncTab      = activeIdx === syncPartIdx;
  const isDeleteTab    = activeIdx === deletePartIdx;
  const isSyntheticTab = isUpsertTab || isSyncTab || isDeleteTab;
  const syncCandidates = parsedTable
    ? parsedTable.cols.filter(c => !AUDIT_COLS.has(c.name))
    : [];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden flex flex-col">

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 bg-gray-50 px-1 pt-1 gap-0.5 overflow-x-auto shrink-0">
        {parts.map((p, i) => {
          const lbl      = partLabel(p);
          const b        = banners[i];
          const isBulk   = lbl === 'Bulk Insert';
          const isUpsert = lbl === 'Upsert';
          const isDel    = lbl === 'Delete';
          return (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t border-b-2 whitespace-nowrap transition-colors',
                activeIdx === i
                  ? isUpsert ? 'border-amber-500 text-amber-700 bg-white'
                  : isDel    ? 'border-rose-500 text-rose-700 bg-white'
                  : isBulk   ? 'border-emerald-500 text-emerald-700 bg-white'
                  : 'border-indigo-500 text-indigo-600 bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100',
              )}
            >
              {lbl}
              {EDITABLE_OPS.has(p.operation) && (
                <span className={clsx(
                  'w-1.5 h-1.5 rounded-full shrink-0',
                  b?.source === 'apply'    && b.success ? 'bg-emerald-400'
                    : b?.source === 'validate' && b.success ? 'bg-blue-400'
                    : b && !b.success                       ? 'bg-red-400'
                    : 'bg-gray-300',
                )} />
              )}
            </button>
          );
        })}
      </div>

      {/* Part header */}
      <div className="flex items-start justify-between gap-4 px-4 py-3 border-b border-gray-100 bg-gray-50 shrink-0">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-700 flex items-center gap-2">
            {label}
            {isEditable && (
              <span className="text-[10px] font-normal text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded">
                editable
              </span>
            )}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5 leading-relaxed">
            {partDesc(activePart, tableCode)}
          </p>
          {isEditable && isDirty && !isValidated && (
            <span className="inline-flex items-center gap-1 text-[10px] text-amber-500 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              Validate before applying
            </span>
          )}
          {isEditable && isValidated && (
            <span className="inline-flex items-center gap-1 text-[10px] text-blue-500 mt-1">
              <ShieldCheck size={11} />
              Validated — ready to apply
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isSyntheticTab && (
            <button
              onClick={() => handleRegenerateSynthetic(activeIdx)}
              disabled={!parsedTable}
              title="Regenerate SQL from current key selection"
              className={clsx(
                'flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border transition-colors',
                !parsedTable
                  ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                  : 'border-gray-200 text-gray-500 hover:bg-gray-100 hover:border-gray-300',
              )}
            >
              <RefreshCw size={12} />
              Regenerate
            </button>
          )}

          {isEditable && !isSyntheticTab && (
            <button
              onClick={handleRegenerate}
              disabled={regenerating || !existingId}
              title={`Regenerate ${activePart?.operation === 'create_view' ? 'view' : 'list function'} from catalog`}
              className={clsx(
                'flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border transition-colors',
                regenerating || !existingId
                  ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                  : 'border-gray-200 text-gray-500 hover:bg-gray-100 hover:border-gray-300',
              )}
            >
              {regenerating ? <Spinner size="sm" /> : <RefreshCw size={12} />}
              Regenerate
            </button>
          )}

          {isEditable && !isSyntheticTab && (
            <button
              onClick={() => handleResetToGenerated(activeIdx)}
              disabled={resetting || !existingId}
              title="Discard custom SQL and restore the auto-generated version"
              className={clsx(
                'flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border transition-colors',
                resetting || !existingId
                  ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                  : 'border-amber-200 text-amber-600 hover:bg-amber-50 hover:border-amber-300',
              )}
            >
              {resetting ? <Spinner size="sm" /> : <RotateCcw size={12} />}
              Reset to generated
            </button>
          )}

          {isEditable && (
            <button
              onClick={() => handleValidate(activeIdx)}
              disabled={isValidating || isApplying}
              className={clsx(
                'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border font-medium transition-colors',
                isValidating || isApplying
                  ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                  : isValidated
                  ? 'border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400',
              )}
            >
              {isValidating ? <Spinner size="sm" /> : <ShieldCheck size={12} />}
              {isValidated ? 'Re-validate' : 'Validate SQL'}
            </button>
          )}

          {isEditable && isValidated && (
            <button
              onClick={() => handleApply(activeIdx)}
              disabled={isApplying || isValidating}
              className={clsx(
                'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border font-medium transition-colors',
                isApplying || isValidating
                  ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                  : 'border-indigo-200 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-400',
              )}
            >
              {isApplying ? <Spinner size="sm" /> : <Play size={12} />}
              Apply to DB
            </button>
          )}
        </div>
      </div>

      {/* Key selectors for synthetic function tabs */}
      {isUpsertTab && parsedTable && (
        <div className="px-4 py-2.5 border-b border-amber-100 bg-amber-50 flex flex-wrap gap-x-5 gap-y-1.5 items-center shrink-0">
          <span className="text-xs font-medium text-amber-700 shrink-0">Conflict target:</span>
          {syncCandidates.map(c => (
            <label key={c.name} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={upsertKeys.includes(c.name)}
                onChange={e => setUpsertKeys(prev =>
                  e.target.checked ? [...prev, c.name] : prev.filter(k => k !== c.name)
                )}
                className="rounded border-amber-300 text-amber-500"
              />
              <span className="font-mono text-gray-700">{c.name}</span>
              <span className="text-gray-400 text-[10px]">{c.type}</span>
            </label>
          ))}
        </div>
      )}

      {isSyncTab && parsedTable && (
        <div className="px-4 py-2.5 border-b border-emerald-100 bg-emerald-50 flex flex-wrap gap-x-5 gap-y-1.5 items-center shrink-0">
          <span className="text-xs font-medium text-emerald-700 shrink-0">Sync keys:</span>
          {syncCandidates.map(c => (
            <label key={c.name} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={syncKeys.includes(c.name)}
                onChange={e => setSyncKeys(prev =>
                  e.target.checked ? [...prev, c.name] : prev.filter(k => k !== c.name)
                )}
                className="rounded border-emerald-300 text-emerald-600"
              />
              <span className="font-mono text-gray-700">{c.name}</span>
              <span className="text-gray-400 text-[10px]">{c.type}</span>
            </label>
          ))}
        </div>
      )}

      {isDeleteTab && parsedTable && (
        <div className="px-4 py-2.5 border-b border-rose-100 bg-rose-50 flex flex-wrap gap-x-5 gap-y-1.5 items-center shrink-0">
          <span className="text-xs font-medium text-rose-700 shrink-0">Filter columns:</span>
          {syncCandidates.map(c => (
            <label key={c.name} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={deleteKeys.includes(c.name)}
                onChange={e => setDeleteKeys(prev =>
                  e.target.checked ? [...prev, c.name] : prev.filter(k => k !== c.name)
                )}
                className="rounded border-rose-300 text-rose-500"
              />
              <span className="font-mono text-gray-700">{c.name}</span>
              <span className="text-gray-400 text-[10px]">{c.type}</span>
            </label>
          ))}
        </div>
      )}

      {/* Result banner */}
      {activeBanner && (
        <div className={clsx(
          'flex items-start gap-2 px-4 py-2.5 text-xs border-b shrink-0',
          activeBanner.success
            ? activeBanner.source === 'validate'
              ? 'bg-blue-50 border-blue-100 text-blue-700'
              : 'bg-emerald-50 border-emerald-100 text-emerald-700'
            : 'bg-red-50 border-red-100 text-red-700',
        )}>
          {activeBanner.success
            ? <CheckCircle size={13} className={clsx('shrink-0 mt-0.5', activeBanner.source === 'validate' ? 'text-blue-500' : 'text-emerald-500')} />
            : <XCircle    size={13} className="text-red-500 shrink-0 mt-0.5" />
          }
          <span className="font-mono leading-relaxed whitespace-pre-wrap break-all">
            {activeBanner.message}
          </span>
        </div>
      )}

      {/* SQL editor */}
      <CodeMirror
        key={activeIdx}
        value={currentSql}
        extensions={[sql(), contentPadding]}
        theme={oneDark}
        editable={isEditable}
        onChange={isEditable ? (val) => {
          setEditedSql(prev  => ({ ...prev, [activeIdx]: val }));
          setBanners(prev    => { const n = { ...prev }; delete n[activeIdx]; return n; });
          setValidated(prev  => ({ ...prev, [activeIdx]: false }));
        } : undefined}
        basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: isEditable }}
        style={{ fontSize: '12px', minHeight: '520px' }}
      />
    </div>
  );
}
