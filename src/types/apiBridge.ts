export type AuthType = 'none' | 'bearer' | 'basic' | 'api_key' | 'oauth2';

export interface ApiResource {
  id:              number;
  code:            string;
  name:            string;
  description:     string | null;
  base_url:        string;
  timeout_seconds: number;
  auth_type:       AuthType;
  auth_config:     Record<string, string>;
  default_headers: Record<string, string>;
  ssl_verify:      boolean;
  is_active:       boolean;
  inserted_at:     string;
  inserted_by:     string | null;
  modified_at:     string;
  modified_by:     string | null;
}

export interface TestConnectionResult {
  success:         boolean;
  status_code:     number | null;
  message:         string;
  response_time_ms: number | null;
}

/** UI-only: headers stored as key/value pairs for editable rows */
export interface HeaderEntry {
  key:   string;
  value: string;
}

export interface ResourceFormState {
  code:            string;
  name:            string;
  description:     string;
  base_url:        string;
  timeout_seconds: number;
  auth_type:       AuthType;
  auth_config:     Record<string, string>;
  default_headers: HeaderEntry[];
  ssl_verify:      boolean;
  is_active:       boolean;
}
