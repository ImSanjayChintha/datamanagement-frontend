export interface TranslationMap {
  [field_code: string]: { [lang_code: string]: string };
}

export interface LangOption {
  code: string;
  name?: string;
  native_name?: string;
  flag_emoji?: string;
  direction?: 'ltr' | 'rtl';
  is_default?: boolean;
}
