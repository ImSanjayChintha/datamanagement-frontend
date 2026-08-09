export type DestType =
  | 'azure_blob'
  | 'email'
  | 's3_compatible'
  | 'amazon_s3'
  | 'filesystem'
  | 'rabbitmq'
  | 'sftp'
  | 'http_api';

export const DEST_TYPE_LABELS: Record<DestType, string> = {
  azure_blob:   'Azure Blob',
  email:        'Email',
  s3_compatible: 'S3 Compatible',
  amazon_s3:    'Amazon S3',
  filesystem:   'File System',
  rabbitmq:     'RabbitMQ',
  sftp:         'SFTP',
  http_api:     'HTTP API',
};

export const DEST_TYPES: DestType[] = [
  'azure_blob', 'email', 's3_compatible', 'amazon_s3', 'filesystem',
  'rabbitmq', 'sftp', 'http_api',
];

export interface PushDestination {
  id:          number;
  name:        string;
  description: string | null;
  dest_type:   DestType;
  config:      Record<string, unknown>;
  is_active:   boolean;
  inserted_at: string;
  inserted_by: string | null;
  modified_at: string;
  modified_by: string | null;
}

export interface PushDestinationsListResult {
  rows:      PushDestination[];
  total:     number;
  page:      number;
  page_size: number;
  pages:     number;
}

export interface PushDestinationsListParams {
  search?:    string;
  dest_type?: DestType | '';
  page?:      number;
  page_size?: number;
}

export interface CreatePushDestination {
  name:        string;
  description: string;
  dest_type:   DestType;
  config:      Record<string, unknown>;
  secrets:     Record<string, string>;
  is_active:   boolean;
}

export interface UpdatePushDestination {
  id:          number;
  name:        string;
  description: string;
  config:      Record<string, unknown>;
  secrets:     Record<string, string>;
  is_active:   boolean;
}

export interface TestResult {
  ok:      boolean;
  message: string;
}
