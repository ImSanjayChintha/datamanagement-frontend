export type FeatureColor = 'blue' | 'sky' | 'emerald' | 'violet' | 'amber' | 'rose';
export type FeatureIcon = 'LayoutGrid' | 'Database' | 'Terminal' | 'Sparkles' | 'Languages' | 'Code2';

export interface FeatureItem {
  id: string;
  icon: FeatureIcon;
  color: FeatureColor;
  title: string;
  description: string;
  badge?: string;
  href?: string;
}

export interface HomeContent {
  dir: 'ltr' | 'rtl';
  hero: {
    eyebrow: string;
    title: string;
    title_accent: string;
    subtitle: string;
    cta_new: string;
    cta_sql: string;
  };
  stats: {
    tables: string;
    active: string;
    fields: string;
  };
  features_heading: string;
  features_sub: string;
  features: FeatureItem[];
  quickstart: {
    eyebrow: string;
    heading: string;
    steps: Array<{ title: string; description: string }>;
  };
  footer: {
    copyright: string;
    privacy: string;
    legal: string;
    cookies: string;
  };
}

export const LANG_NAMES: Record<string, string> = {
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
};

export const HOME_CONTENT: Record<string, HomeContent> = {
  en: {
    dir: 'ltr',
    hero: {
      eyebrow: 'Admin Data Platform',
      title: 'Your Data Layer,',
      title_accent: 'Fully in Control.',
      subtitle: 'Design database schemas visually, manage multilingual content, run SQL directly, and generate structures with AI — all in one powerful toolkit.',
      cta_new: 'Create New Table',
      cta_sql: 'Open SQL Console',
    },
    stats: { tables: 'Total Tables', active: 'Active Tables', fields: 'Total Fields' },
    features_heading: 'Everything you need to manage your data',
    features_sub: 'A complete data management platform built for modern admin teams.',
    features: [
      { id: 'table-designer',  icon: 'LayoutGrid', color: 'blue',    title: 'Table Designer',      badge: 'Core', href: '/toolkit/tables/new', description: 'Build database schemas visually. Define field types, constraints, references, and multilingual labels without writing a line of SQL.' },
      { id: 'data-management', icon: 'Database',   color: 'sky',     title: 'Data Management',                                          description: 'Full CRUD interface auto-generated from your schema. Search, filter, paginate, and manage records with ease.' },
      { id: 'sql-console',     icon: 'Terminal',   color: 'emerald', title: 'SQL Console',                        href: '/toolkit/sql', description: 'Execute raw SQL directly against your database. Full DDL history, admin-only access, and Ctrl+Enter quick execution.' },
      { id: 'ai-generate',     icon: 'Sparkles',   color: 'violet',  title: 'AI Generator',        badge: 'AI',   href: '/toolkit/tables/new', description: 'Describe what you need in plain language. AI drafts tables, views, and PostgreSQL functions ready for one-click apply.' },
      { id: 'translations',    icon: 'Languages',  color: 'amber',   title: 'Translations',                                             description: 'Multi-language support built in. Translate field labels, select options, and toggle values across all configured languages.' },
      { id: 'ddl-preview',     icon: 'Code2',      color: 'rose',    title: 'DDL Preview & Apply',                                      description: 'Review generated SQL before applying. Validate with PostgreSQL dry-run, edit views and functions, then apply in one click.' },
    ],
    quickstart: {
      eyebrow: 'Getting Started',
      heading: 'Up and running in minutes',
      steps: [
        { title: 'Design your schema',    description: 'Use the Table Designer to define fields, types, and relationships — no SQL required.' },
        { title: 'Generate & Apply DDL',  description: 'Preview the generated SQL, validate with PostgreSQL dry-run, then apply with one click.' },
        { title: 'Manage your data',      description: 'Use the auto-generated CRUD interface for records, or open SQL Console for advanced queries.' },
      ],
    },
    footer: {
      copyright: '© 2026 CorexStack. All rights reserved.',
      privacy: 'Privacy Policy',
      legal: 'Legal Notice',
      cookies: 'Cookie Policy',
    },
  },

  de: {
    dir: 'ltr',
    hero: {
      eyebrow: 'Admin-Datenplattform',
      title: 'Ihre Datenschicht,',
      title_accent: 'Vollständig unter Kontrolle.',
      subtitle: 'Datenbankschemas visuell entwerfen, mehrsprachige Inhalte verwalten, SQL direkt ausführen und Strukturen mit KI generieren — alles in einem leistungsstarken Toolkit.',
      cta_new: 'Neue Tabelle erstellen',
      cta_sql: 'SQL-Konsole öffnen',
    },
    stats: { tables: 'Tabellen gesamt', active: 'Aktive Tabellen', fields: 'Felder gesamt' },
    features_heading: 'Alles, was Sie zur Datenverwaltung brauchen',
    features_sub: 'Eine vollständige Datenverwaltungsplattform für moderne Admin-Teams.',
    features: [
      { id: 'table-designer',  icon: 'LayoutGrid', color: 'blue',    title: 'Tabellen-Designer',         badge: 'Kern', href: '/toolkit/tables/new', description: 'Datenbankschemas visuell aufbauen. Feldtypen, Constraints, Referenzen und mehrsprachige Labels definieren — ohne SQL.' },
      { id: 'data-management', icon: 'Database',   color: 'sky',     title: 'Datenverwaltung',                                                description: 'Vollständige CRUD-Oberfläche, automatisch aus Ihrem Schema generiert. Suchen, filtern, blättern und Datensätze verwalten.' },
      { id: 'sql-console',     icon: 'Terminal',   color: 'emerald', title: 'SQL-Konsole',                              href: '/toolkit/sql', description: 'SQL direkt gegen die Datenbank ausführen. Vollständiger DDL-Verlauf, Admin-Zugang und schnelle Ausführung mit Ctrl+Enter.' },
      { id: 'ai-generate',     icon: 'Sparkles',   color: 'violet',  title: 'KI-Generator',              badge: 'KI',   href: '/toolkit/tables/new', description: 'Beschreiben Sie in normaler Sprache, was Sie brauchen. KI entwirft Tabellen, Views und PostgreSQL-Funktionen für die Übernahme per Klick.' },
      { id: 'translations',    icon: 'Languages',  color: 'amber',   title: 'Übersetzungen',                                               description: 'Mehrsprachige Unterstützung integriert. Feldbezeichnungen, Auswahloptionen und Toggle-Werte in allen Sprachen übersetzen.' },
      { id: 'ddl-preview',     icon: 'Code2',      color: 'rose',    title: 'DDL-Vorschau & Anwenden',                                     description: 'Generierten SQL vor der Anwendung prüfen. Mit PostgreSQL Dry-Run validieren, Views und Funktionen bearbeiten, dann per Klick anwenden.' },
    ],
    quickstart: {
      eyebrow: 'Erste Schritte',
      heading: 'In Minuten einsatzbereit',
      steps: [
        { title: 'Schema entwerfen',          description: 'Feldtypen, Constraints und Beziehungen im Tabellen-Designer definieren — kein SQL nötig.' },
        { title: 'DDL generieren & anwenden', description: 'Generierten SQL prüfen, mit PostgreSQL Dry-Run validieren, dann per Klick anwenden.' },
        { title: 'Daten verwalten',           description: 'Automatisch generierte CRUD-Oberfläche für Datensätze nutzen oder SQL-Konsole für komplexe Abfragen öffnen.' },
      ],
    },
    footer: {
      copyright: '© 2026 CorexStack. Alle Rechte vorbehalten.',
      privacy: 'Datenschutzrichtlinie',
      legal: 'Impressum',
      cookies: 'Cookie-Richtlinie',
    },
  },

  fr: {
    dir: 'ltr',
    hero: {
      eyebrow: 'Plateforme de données admin',
      title: 'Votre couche de données,',
      title_accent: 'Totalement sous contrôle.',
      subtitle: 'Concevez des schémas de base de données visuellement, gérez du contenu multilingue, exécutez du SQL directement et générez des structures avec l\'IA — le tout dans un toolkit puissant.',
      cta_new: 'Créer une table',
      cta_sql: 'Ouvrir la console SQL',
    },
    stats: { tables: 'Tables au total', active: 'Tables actives', fields: 'Champs au total' },
    features_heading: 'Tout ce qu\'il faut pour gérer vos données',
    features_sub: 'Une plateforme de gestion de données complète pour les équipes admin modernes.',
    features: [
      { id: 'table-designer',  icon: 'LayoutGrid', color: 'blue',    title: 'Concepteur de tables',       badge: 'Essentiel', href: '/toolkit/tables/new', description: 'Construisez des schémas visuellement. Définissez types de champs, contraintes, références et labels multilingues — sans écrire de SQL.' },
      { id: 'data-management', icon: 'Database',   color: 'sky',     title: 'Gestion des données',                                              description: 'Interface CRUD complète auto-générée depuis votre schéma. Recherchez, filtrez, paginez et gérez les enregistrements facilement.' },
      { id: 'sql-console',     icon: 'Terminal',   color: 'emerald', title: 'Console SQL',                                 href: '/toolkit/sql', description: 'Exécutez du SQL directement sur votre base. Historique DDL complet, accès admin uniquement, exécution rapide avec Ctrl+Entrée.' },
      { id: 'ai-generate',     icon: 'Sparkles',   color: 'violet',  title: 'Générateur IA',              badge: 'IA',        href: '/toolkit/tables/new', description: 'Décrivez vos besoins en langage naturel. L\'IA rédige tables, vues et fonctions PostgreSQL prêtes à appliquer en un clic.' },
      { id: 'translations',    icon: 'Languages',  color: 'amber',   title: 'Traductions',                                                      description: 'Support multilingue intégré. Traduisez labels, options de sélection et valeurs de toggle dans toutes vos langues configurées.' },
      { id: 'ddl-preview',     icon: 'Code2',      color: 'rose',    title: 'Aperçu & Application DDL',                                        description: 'Vérifiez le SQL généré avant de l\'appliquer. Validez avec dry-run PostgreSQL, modifiez vues et fonctions, puis appliquez en un clic.' },
    ],
    quickstart: {
      eyebrow: 'Démarrage rapide',
      heading: 'Opérationnel en quelques minutes',
      steps: [
        { title: 'Concevez votre schéma',         description: 'Utilisez le Concepteur de tables pour définir champs, types et relations — sans SQL requis.' },
        { title: 'Générez & appliquez le DDL',    description: 'Vérifiez le SQL généré, validez avec le dry-run PostgreSQL, puis appliquez en un clic.' },
        { title: 'Gérez vos données',             description: 'Utilisez l\'interface CRUD auto-générée, ou ouvrez la Console SQL pour les requêtes avancées.' },
      ],
    },
    footer: {
      copyright: '© 2026 CorexStack. Tous droits réservés.',
      privacy: 'Politique de confidentialité',
      legal: 'Mentions légales',
      cookies: 'Politique des cookies',
    },
  },

  es: {
    dir: 'ltr',
    hero: {
      eyebrow: 'Plataforma de datos admin',
      title: 'Tu capa de datos,',
      title_accent: 'Totalmente bajo control.',
      subtitle: 'Diseña esquemas de base de datos visualmente, gestiona contenido multilingüe, ejecuta SQL directamente y genera estructuras con IA — todo en un poderoso toolkit.',
      cta_new: 'Crear nueva tabla',
      cta_sql: 'Abrir consola SQL',
    },
    stats: { tables: 'Tablas en total', active: 'Tablas activas', fields: 'Campos en total' },
    features_heading: 'Todo lo que necesitas para gestionar tus datos',
    features_sub: 'Una plataforma de gestión de datos completa para equipos admin modernos.',
    features: [
      { id: 'table-designer',  icon: 'LayoutGrid', color: 'blue',    title: 'Diseñador de tablas',         badge: 'Núcleo', href: '/toolkit/tables/new', description: 'Construye esquemas de base de datos visualmente. Define tipos de campo, restricciones, referencias y etiquetas multilingüe sin escribir SQL.' },
      { id: 'data-management', icon: 'Database',   color: 'sky',     title: 'Gestión de datos',                                                 description: 'Interfaz CRUD completa auto-generada desde tu esquema. Busca, filtra, pagina y gestiona registros con facilidad.' },
      { id: 'sql-console',     icon: 'Terminal',   color: 'emerald', title: 'Consola SQL',                               href: '/toolkit/sql', description: 'Ejecuta SQL directamente contra tu base de datos. Historial DDL completo, acceso solo para admin y ejecución rápida con Ctrl+Enter.' },
      { id: 'ai-generate',     icon: 'Sparkles',   color: 'violet',  title: 'Generador IA',                badge: 'IA',     href: '/toolkit/tables/new', description: 'Describe lo que necesitas en lenguaje natural. La IA redacta tablas, vistas y funciones PostgreSQL listas para aplicar con un clic.' },
      { id: 'translations',    icon: 'Languages',  color: 'amber',   title: 'Traducciones',                                                     description: 'Soporte multilingüe integrado. Traduce etiquetas de campo, opciones de selección y valores de toggle en todos los idiomas configurados.' },
      { id: 'ddl-preview',     icon: 'Code2',      color: 'rose',    title: 'Vista previa y aplicación DDL',                                    description: 'Revisa el SQL generado antes de aplicarlo. Valida con dry-run de PostgreSQL, edita vistas y funciones, luego aplica con un clic.' },
    ],
    quickstart: {
      eyebrow: 'Primeros pasos',
      heading: 'En marcha en minutos',
      steps: [
        { title: 'Diseña tu esquema',    description: 'Usa el Diseñador de tablas para definir campos, tipos y relaciones — sin necesidad de SQL.' },
        { title: 'Genera y aplica DDL',  description: 'Revisa el SQL generado, valida con dry-run de PostgreSQL, luego aplícalo con un clic.' },
        { title: 'Gestiona tus datos',   description: 'Usa la interfaz CRUD auto-generada para registros, o abre la Consola SQL para consultas avanzadas.' },
      ],
    },
    footer: {
      copyright: '© 2026 CorexStack. Todos los derechos reservados.',
      privacy: 'Política de privacidad',
      legal: 'Aviso legal',
      cookies: 'Política de cookies',
    },
  },
};
