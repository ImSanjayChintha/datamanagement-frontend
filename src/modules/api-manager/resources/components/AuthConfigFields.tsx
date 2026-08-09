import type { AuthType } from '@/types/apiBridge';

interface Props {
  authType: AuthType;
  config:   Record<string, string>;
  onChange: (field: string, value: string) => void;
}

function Field({
  label, name, value, onChange, type = 'text', placeholder,
}: {
  label: string; name: string; value: string;
  onChange: (v: string) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="label block mb-1">{label}</label>
      <input
        type={type}
        className="input w-full text-sm"
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        autoComplete={type === 'password' ? 'new-password' : undefined}
      />
    </div>
  );
}

export default function AuthConfigFields({ authType, config, onChange }: Props) {
  const v = (key: string) => config[key] ?? '';

  if (authType === 'none') {
    return (
      <p className="text-sm text-gray-400 italic">No authentication required.</p>
    );
  }

  if (authType === 'bearer') {
    return (
      <div className="space-y-3">
        <Field
          label="Token"
          name="token"
          type="password"
          value={v('token')}
          onChange={val => onChange('token', val)}
          placeholder="eyJhbGciOi..."
        />
        <Field
          label="Prefix"
          name="prefix"
          value={v('prefix') || 'Bearer'}
          onChange={val => onChange('prefix', val)}
          placeholder="Bearer"
        />
      </div>
    );
  }

  if (authType === 'basic') {
    return (
      <div className="space-y-3">
        <Field
          label="Username"
          name="username"
          value={v('username')}
          onChange={val => onChange('username', val)}
          placeholder="admin"
        />
        <Field
          label="Password"
          name="password"
          type="password"
          value={v('password')}
          onChange={val => onChange('password', val)}
        />
      </div>
    );
  }

  if (authType === 'api_key') {
    return (
      <div className="space-y-3">
        <Field
          label="Key Name"
          name="key_name"
          value={v('key_name')}
          onChange={val => onChange('key_name', val)}
          placeholder="X-Api-Key"
        />
        <Field
          label="Key Value"
          name="key_value"
          type="password"
          value={v('key_value')}
          onChange={val => onChange('key_value', val)}
        />
        <div>
          <label className="label block mb-1">Location</label>
          <select
            className="input w-full text-sm"
            value={v('location') || 'header'}
            onChange={e => onChange('location', e.target.value)}
          >
            <option value="header">Header</option>
            <option value="query">Query parameter</option>
          </select>
        </div>
      </div>
    );
  }

  if (authType === 'oauth2') {
    return (
      <div className="space-y-3">
        <Field
          label="Client ID"
          name="client_id"
          value={v('client_id')}
          onChange={val => onChange('client_id', val)}
        />
        <Field
          label="Client Secret"
          name="client_secret"
          type="password"
          value={v('client_secret')}
          onChange={val => onChange('client_secret', val)}
        />
        <Field
          label="Token URL"
          name="token_url"
          value={v('token_url')}
          onChange={val => onChange('token_url', val)}
          placeholder="https://auth.example.com/oauth/token"
        />
        <Field
          label="Scope"
          name="scope"
          value={v('scope')}
          onChange={val => onChange('scope', val)}
          placeholder="read write"
        />
        <div>
          <label className="label block mb-1">Grant Type</label>
          <select
            className="input w-full text-sm"
            value={v('grant_type') || 'client_credentials'}
            onChange={e => onChange('grant_type', e.target.value)}
          >
            <option value="client_credentials">Client Credentials</option>
            <option value="password">Resource Owner Password</option>
          </select>
        </div>
      </div>
    );
  }

  return null;
}
