/**
 * Template generator for standard CRUD gateway endpoints.
 * Each function returns a payload suitable for endpointsApi.create().
 */

export interface EndpointTemplate {
  name:               string;
  url_path:           string;
  method:             'POST';
  operation_type:     string;
  db_schema:          string;
  db_object:          string;
  db_type:            'function';
  status:             'active';
  description:        string;
  headers:            [];
  body_schema:        Record<string, unknown>;
  filters:            [];
  columns:            string[];
  pagination_enabled: boolean;
  default_limit:      number;
  max_limit:          number;
  include_total:      boolean;
  count_limit:        number;
  response_key:       string;
  response_extras:    [];
  config_returns:     string;
  config_raw_response: boolean;
}

export function buildEndpointTemplates(
  schema: string,
  code: string,
  label: string,
): EndpointTemplate[] {
  const base: Pick<EndpointTemplate, 'method' | 'db_type' | 'status' | 'headers' | 'filters' | 'columns' | 'response_extras' | 'config_returns' | 'config_raw_response' | 'count_limit'> = {
    method:              'POST',
    db_type:             'function',
    status:              'active',
    headers:             [],
    filters:             [],
    columns:             [],
    response_extras:     [],
    config_returns:      'jsonb',
    config_raw_response: false,
    count_limit:         0,
  };

  return [
    {
      ...base,
      name:               `List ${label}`,
      url_path:           `/gateway/${code}/list`,
      operation_type:     'select',
      db_schema:          schema,
      db_object:          `fn_list_${code}`,
      description:        `Paginated list of ${label} records`,
      body_schema:        {},
      pagination_enabled: true,
      default_limit:      25,
      max_limit:          200,
      include_total:      true,
      response_key:       'rows',
    },
    {
      ...base,
      name:               `Upsert ${label}`,
      url_path:           `/gateway/${code}/upsert`,
      operation_type:     'insert',
      db_schema:          schema,
      db_object:          `upsert_${code}`,
      description:        `Insert or update a ${label} record`,
      body_schema:        {},
      pagination_enabled: false,
      default_limit:      25,
      max_limit:          200,
      include_total:      false,
      response_key:       'rows',
    },
    {
      ...base,
      name:               `Insert ${label}`,
      url_path:           `/gateway/${code}/insert`,
      operation_type:     'insert',
      db_schema:          schema,
      db_object:          `sync_${code}`,
      description:        `Insert a new ${label} record`,
      body_schema:        {},
      pagination_enabled: false,
      default_limit:      25,
      max_limit:          200,
      include_total:      false,
      response_key:       'rows',
    },
    {
      ...base,
      name:               `Delete ${label}`,
      url_path:           `/gateway/${code}/delete`,
      operation_type:     'delete',
      db_schema:          schema,
      db_object:          `delete_${code}`,
      description:        `Delete a ${label} record by id or code`,
      body_schema:        { p_id: 'number | string' },
      pagination_enabled: false,
      default_limit:      25,
      max_limit:          200,
      include_total:      false,
      response_key:       'rows',
    },
  ];
}
