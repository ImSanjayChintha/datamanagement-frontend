/**
 * Centralized React Query key factory.
 *
 * Use these constants everywhere instead of raw strings so:
 *   1. Typos are caught at compile time.
 *   2. Invalidating a query key always matches the one used in useQuery.
 *   3. Searching for `QK.table(` shows every place a table is fetched.
 */
export const QK = {
  // Auth
  me: () => ['me'] as const,

  // Toolkit — schemas
  schemas: () => ['toolkit-schemas'] as const,

  // Toolkit — table catalog
  tables: ()             => ['toolkit-tables'] as const,
  table:  (code: string) => ['toolkit-table', code] as const,

  // Toolkit — data rows (per-table, paginated)
  data: (tableCode: string, search?: string, showInactive?: boolean, page?: number) =>
    ['toolkit-data', tableCode, search, showInactive, page] as const,

  record: (tableCode: string, id?: string | number) =>
    ['toolkit-record', tableCode, id] as const,

  // Toolkit — reference options (used in ReferenceSelect)
  refOpts: (fieldId: number, search?: string) =>
    ['ref-opts', fieldId, search] as const,

  // Toolkit — languages
  langs:         () => ['toolkit-langs'] as const,
  pimLangs:      () => ['pim-languages'] as const,
  pimLangsPanel: () => ['pim-languages-panel'] as const,

  // Toolkit — SQL console
  ddlHistory: () => ['ddl-history'] as const,

  // Toolkit — Common Fields
  commonFields: (role?: string, search?: string, showInactive?: boolean) =>
    ['toolkit-common-fields', role, search, showInactive] as const,

  commonField: (id: number) =>
    ['toolkit-common-field', id] as const,

  commonFieldTranslations: () =>
    ['toolkit-common-field-translations'] as const,

  // API Bridge — resource connections
  apiBridgeResources: (search?: string, page?: number) => ['apib-resources', search, page] as const,
  apiBridgeResource:  (id: number)      => ['apib-resource', id] as const,

  // PIM — generic keys used by all pim entity pages
  pimList:   (entity: string, showInactive?: boolean, page?: number)     => ['pim-list', entity, showInactive, page] as const,
  pimRecord: (entity: string, id: string | number | undefined)           => ['pim-record', entity, id] as const,

  // Legacy aliases kept so AttributesListPage / AttributesFormPage keep working
  pimAttrs: (showInactive?: boolean, page?: number)       => ['pim-list', 'attributes', showInactive, page] as const,
  pimAttr:  (id: string | number | undefined)             => ['pim-record', 'attributes', id] as const,

  // Page Definitions
  pageDefs: (navSection?: string) => ['toolkit-page-defs', navSection] as const,
  pageDef:  (code: string)        => ['toolkit-page-def', code]        as const,

  // Push Destinations
  pushDests: (search?: string, destType?: string, page?: number) =>
    ['push-dests', search, destType, page] as const,
  pushDest: (id: number) => ['push-dest', id] as const,

  // Gateway — endpoint builder
  gwEndpoints: ()                              => ['gw-endpoints'] as const,
  gwEndpoint:  (id: number)                   => ['gw-endpoint', id] as const,
  gwSchemas:   ()                              => ['gw-schemas'] as const,
  gwObjects:   (schema: string)               => ['gw-objects', schema] as const,
  gwColumns:   (schema: string, obj: string, type?: string)  => ['gw-columns', schema, obj, type] as const,

} as const;
