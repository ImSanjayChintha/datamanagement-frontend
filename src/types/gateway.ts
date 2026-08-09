export type HttpMethod     = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type DbObjectType   = 'table' | 'view' | 'function' | 'service';
export type EndpointStatus = 'draft' | 'active' | 'deprecated';
export type OperationType  = 'select' | 'insert' | 'update' | 'delete';

export interface HeaderDef  { name: string; value: string }
export interface FilterDef  { column: string; label: string; operators: string[] }
export interface ColumnDef  { name: string; alias?: string; type?: string; is_multilingual?: boolean }

export interface EndpointConfig {
  pk_column?:          string;   // PK used as entity_id for translations (default: 'id')
  translation_schema?: string;   // override schema for translations table (default: db_schema)
  translation_table?:  string;   // override table name (default: 'translations')
}

export interface ApiEndpoint {
  id:               number;
  name:             string;
  url_path:         string;
  method:           HttpMethod;
  operation_type?:  OperationType;
  db_schema?:       string;
  db_object?:       string;
  db_type?:         DbObjectType;
  headers:          HeaderDef[];
  body_schema:      Record<string, unknown>;
  filters:          FilterDef[];
  columns:          ColumnDef[];
  description?:     string;
  status:           EndpointStatus;
  resource_code?:   string;
  config?:          EndpointConfig;
  inserted_at:      string;
  modified_at?:     string;
  // Flat fields exposed by _row() from config blob
  pagination_enabled: boolean;
  default_limit:      number;
  max_limit:          number;
  include_total:      boolean;
  count_limit:        number;
  response_extras:    { key: string; type: 'static' | 'field'; value: string }[];
  response_key:       string;
  returns?:           string | null;
  raw_response:       boolean;
  sort_fields:        { field: string; direction: 'asc' | 'desc' }[];
  filter_fields:      string[];
  static_filters:     Record<string, unknown>;
}

export interface DbObject    { name: string; type: DbObjectType }
export interface DbColumn    { name: string; type: string; nullable: boolean }
export interface FunctionDef {
  definition:  string;
  return_type: string;
  arguments:   string;
  source:      string;
}
