export type PillarIcon = 'Sparkles' | 'Languages' | 'Shield' | 'Code2';

export interface ModuleText {
  title: string;
  hook?: string;
  description: string;
  status_label: string;
  launch_label?: string;
  features?: string[];
}

export interface PillarText {
  icon: PillarIcon;
  title: string;
  description: string;
}

export interface HomeContent {
  dir: 'ltr' | 'rtl';
  platform_name: string;
  platform_tagline: string;
  hero: {
    eyebrow: string;
    title: string;
    title_accent: string;
    subtitle: string;
    cta_toolkit: string;
    cta_modules: string;
  };
  stats: {
    modules_total: string;
    modules_active: string;
    tables: string;
    fields: string;
  };
  suite_heading: string;
  suite_sub: string;
  label_available: string;
  label_coming_soon: string;
  roadmap_heading: string;
  roadmap_sub: string;
  phases: Array<{
    label: string;
    name: string;
    story: string;
  }>;
  modules: Record<string, ModuleText>;
  pillars_heading: string;
  pillars_sub: string;
  pillars: PillarText[];
  cta: {
    heading: string;
    sub: string;
    button: string;
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
    platform_name: 'CoreX Platform',
    platform_tagline: 'Build · Manage · Scale',
    hero: {
      eyebrow: 'Enterprise Admin Suite',
      title: 'One Platform.',
      title_accent: 'Every Module You Need.',
      subtitle:
        'DB Toolkit, PIM Admin, API Administration, Import/Export pipelines, User Management, and a full E-Commerce storefront — all integrated, all in one place.',
      cta_toolkit: 'Launch DB Toolkit',
      cta_modules: 'Explore All Modules',
    },
    stats: {
      modules_total: 'Modules in Suite',
      modules_active: 'Active Now',
      tables: 'Database Tables',
      fields: 'Custom Fields',
    },
    suite_heading: 'The Complete Enterprise Suite',
    suite_sub: 'Seven integrated modules covering every layer of your data infrastructure and business operations.',
    label_available: 'Available Now',
    label_coming_soon: 'Roadmap',
    roadmap_heading: "What's coming next",
    roadmap_sub: 'Six modules building the complete enterprise stack — each designed to integrate with your existing data foundation.',
    phases: [
      { label: 'Phase 2', name: 'Data Enrichment',     story: 'With your schema in place, PIM and API make your data accessible and distributable across every system.' },
      { label: 'Phase 3', name: 'Operational Control', story: 'Move data across systems without friction and manage exactly who can access what — at any level of granularity.' },
      { label: 'Phase 4', name: 'Go to Market',        story: 'Put everything you\'ve built in front of customers and align your entire sales operation around it.' },
    ],
    modules: {
      'db-toolkit': {
        title: 'DB Toolkit',
        description: 'Visual schema designer with AI generation, SQL console, DDL preview, multilingual field support, and auto-generated CRUD interfaces. The foundation of your data layer.',
        status_label: 'Active',
        launch_label: 'Launch Toolkit',
        features: ['Visual Table Designer', 'AI-Powered Generation', 'SQL Console', 'Multilingual Fields'],
      },
      pim: {
        title: 'PIM Admin',
        hook: 'Ship product data to every channel.',
        description: 'Centralized Product Information Management. Define, enrich, and distribute product data across all sales channels with full multilingual support and media management.',
        status_label: 'Coming Soon',
      },
      api: {
        title: 'API Administrator',
        hook: 'Own every endpoint, end to end.',
        description: 'Design, document, and govern your REST API endpoints. Rate limiting, API key management, versioning, request logging, and real-time monitoring in one unified panel.',
        status_label: 'Coming Soon',
      },
      'import-export': {
        title: 'Import / Export',
        hook: 'Move data without writing a pipeline.',
        description: 'ETL pipeline management for your data infrastructure. Import from CSV, Excel, and JSON; transform and validate; schedule exports to any destination automatically.',
        status_label: 'Coming Soon',
      },
      users: {
        title: 'User Management',
        hook: 'Control who sees what, everywhere.',
        description: 'Complete authentication and authorization suite. Role-based access control, OAuth integrations, team management, audit logs, and per-module permission matrices.',
        status_label: 'Coming Soon',
      },
      ecommerce: {
        title: 'E-Commerce',
        hook: 'A full storefront, powered by your data.',
        description: 'Full-featured online storefront powered by your PIM data. Product catalog, cart, checkout flows, order management, promotions, and real-time inventory sync.',
        status_label: 'Coming Soon',
      },
      sales: {
        title: 'Sales Demand',
        hook: 'Align demand planning across your org.',
        description: 'B2B sales demand planning and cross-team collaboration. Pipeline forecasting, demand signals, territory management, and shared visibility across your entire sales operation.',
        status_label: 'Coming Soon',
      },
    },
    pillars_heading: 'Why CoreX Platform',
    pillars_sub: 'Built for engineering teams that refuse to compromise on quality, speed, or scale.',
    pillars: [
      { icon: 'Sparkles', title: 'AI-Powered by Default', description: 'Generate database schemas, API structures, and content models from plain-language descriptions. AI accelerates every module.' },
      { icon: 'Languages', title: 'Multi-language Built In', description: 'Every module ships with i18n from day one. Manage translations at the field level across all your configured languages.' },
      { icon: 'Shield', title: 'Role-based Access', description: 'Fine-grained permission matrices per module, per team, per company. Enable or restrict entire features with a single toggle.' },
      { icon: 'Code2', title: 'Developer-First Design', description: 'Direct SQL access, DDL preview & apply, clean REST APIs, and TypeScript-first interfaces. Full control when you need it.' },
    ],
    cta: {
      heading: 'Start building with DB Toolkit today',
      sub: 'The first module is live and ready. Design your schema, run SQL, and generate structures with AI in minutes.',
      button: 'Open DB Toolkit',
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
    platform_name: 'CoreX Platform',
    platform_tagline: 'Aufbauen · Verwalten · Skalieren',
    hero: {
      eyebrow: 'Enterprise Admin Suite',
      title: 'Eine Plattform.',
      title_accent: 'Jedes Modul, das Sie brauchen.',
      subtitle:
        'DB Toolkit, PIM Admin, API-Verwaltung, Import/Export-Pipelines, Benutzerverwaltung und ein vollständiger E-Commerce-Shop — alles integriert, alles an einem Ort.',
      cta_toolkit: 'DB Toolkit starten',
      cta_modules: 'Alle Module erkunden',
    },
    stats: {
      modules_total: 'Module in der Suite',
      modules_active: 'Jetzt aktiv',
      tables: 'Datenbanktabellen',
      fields: 'Benutzerdefinierte Felder',
    },
    suite_heading: 'Die vollständige Enterprise Suite',
    suite_sub: 'Sieben integrierte Module für jede Schicht Ihrer Dateninfrastruktur und Geschäftsprozesse.',
    label_available: 'Jetzt verfügbar',
    label_coming_soon: 'Roadmap',
    roadmap_heading: 'Was als Nächstes kommt',
    roadmap_sub: 'Sechs Module für den vollständigen Enterprise-Stack — jedes nahtlos in Ihre bestehende Datenbasis integriert.',
    phases: [
      { label: 'Phase 2', name: 'Datenanreicherung',    story: 'Mit Ihrem Schema als Fundament machen PIM und API Ihre Daten zugänglich und nutzbar für alle Systeme.' },
      { label: 'Phase 3', name: 'Betriebliche Kontrolle', story: 'Daten nahtlos zwischen Systemen verschieben und präzise steuern, wer worauf Zugriff hat.' },
      { label: 'Phase 4', name: 'Markteinführung',      story: 'Alles, was Sie gebaut haben, zu Kunden bringen und die gesamte Vertriebsorganisation darauf ausrichten.' },
    ],
    modules: {
      'db-toolkit': {
        title: 'DB Toolkit',
        description: 'Visueller Schema-Designer mit KI-Generierung, SQL-Konsole, DDL-Vorschau, mehrsprachiger Feldunterstützung und automatisch generierten CRUD-Oberflächen.',
        status_label: 'Aktiv',
        launch_label: 'Toolkit starten',
        features: ['Visueller Tabellen-Designer', 'KI-gestützte Generierung', 'SQL-Konsole', 'Mehrsprachige Felder'],
      },
      pim: {
        title: 'PIM Admin',
        hook: 'Produktdaten an jeden Kanal liefern.',
        description: 'Zentrales Produktinformationsmanagement. Produktdaten über alle Vertriebskanäle hinweg definieren, anreichern und verteilen — mit vollem Mehrsprachigkeits- und Medienverwaltungs-Support.',
        status_label: 'Demnächst',
      },
      api: {
        title: 'API Administrator',
        hook: 'Jeden API-Endpunkt vollständig kontrollieren.',
        description: 'REST-API-Endpunkte entwerfen, dokumentieren und verwalten. Rate Limiting, API-Key-Verwaltung, Versionierung, Request-Logging und Echtzeit-Monitoring in einem Panel.',
        status_label: 'Demnächst',
      },
      'import-export': {
        title: 'Import / Export',
        hook: 'Daten verschieben ohne eigene Pipeline.',
        description: 'ETL-Pipeline-Management für Ihre Infrastruktur. Import aus CSV, Excel und JSON; Transformieren und Validieren; Exporte automatisch planen.',
        status_label: 'Demnächst',
      },
      users: {
        title: 'Benutzerverwaltung',
        hook: 'Steuern, wer was wo sieht.',
        description: 'Vollständige Authentifizierungs- und Autorisierungssuite. Rollenbasierte Zugriffskontrolle, OAuth-Integrationen, Teamverwaltung, Audit-Logs und Berechtigungsmatrizen pro Modul.',
        status_label: 'Demnächst',
      },
      ecommerce: {
        title: 'E-Commerce',
        hook: 'Ein vollständiger Shop aus Ihren Daten.',
        description: 'Vollwertiger Online-Shop auf Basis Ihrer PIM-Daten. Produktkatalog, Warenkorb, Checkout, Bestellverwaltung, Aktionen und Echtzeit-Bestandsabgleich.',
        status_label: 'Demnächst',
      },
      sales: {
        title: 'Sales Demand',
        hook: 'Nachfrageplanung im ganzen Unternehmen.',
        description: 'B2B-Nachfrageplanung und teamübergreifende Zusammenarbeit. Pipeline-Prognosen, Nachfragesignale, Gebietsmanagement und gemeinsame Transparenz im gesamten Vertrieb.',
        status_label: 'Demnächst',
      },
    },
    pillars_heading: 'Warum CoreX Platform',
    pillars_sub: 'Für Engineering-Teams, die bei Qualität, Geschwindigkeit und Skalierung keine Kompromisse eingehen.',
    pillars: [
      { icon: 'Sparkles', title: 'KI-gestützt by Default', description: 'Datenbankschemas, API-Strukturen und Content-Modelle aus Klartextbeschreibungen generieren. KI beschleunigt jedes Modul.' },
      { icon: 'Languages', title: 'Mehrsprachigkeit von Anfang an', description: 'Jedes Modul wird mit i18n ausgeliefert. Übersetzungen auf Feldebene über alle konfigurierten Sprachen verwalten.' },
      { icon: 'Shield', title: 'Rollenbasierter Zugriff', description: 'Feingranulare Berechtigungsmatrizen pro Modul, Team und Unternehmen. Funktionen mit einem Toggle aktivieren oder einschränken.' },
      { icon: 'Code2', title: 'Developer-First Design', description: 'Direkter SQL-Zugriff, DDL-Vorschau und -Anwendung, saubere REST-APIs und TypeScript-first-Schnittstellen.' },
    ],
    cta: {
      heading: 'Heute mit dem DB Toolkit starten',
      sub: 'Das erste Modul ist live. Schema entwerfen, SQL ausführen und Strukturen in Minuten mit KI generieren.',
      button: 'DB Toolkit öffnen',
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
    platform_name: 'CoreX Platform',
    platform_tagline: 'Construire · Gérer · Scaler',
    hero: {
      eyebrow: 'Suite Admin Enterprise',
      title: 'Une plateforme.',
      title_accent: 'Chaque module dont vous avez besoin.',
      subtitle:
        'DB Toolkit, PIM Admin, Administration API, pipelines Import/Export, Gestion des utilisateurs et une boutique E-Commerce complète — tout intégré, en un seul endroit.',
      cta_toolkit: 'Lancer DB Toolkit',
      cta_modules: 'Explorer tous les modules',
    },
    stats: {
      modules_total: 'Modules dans la suite',
      modules_active: 'Actif maintenant',
      tables: 'Tables de base de données',
      fields: 'Champs personnalisés',
    },
    suite_heading: 'La suite enterprise complète',
    suite_sub: 'Sept modules intégrés couvrant chaque couche de votre infrastructure de données et de vos opérations métier.',
    label_available: 'Disponible maintenant',
    label_coming_soon: 'Feuille de route',
    roadmap_heading: 'Ce qui arrive ensuite',
    roadmap_sub: 'Six modules pour constituer la suite enterprise complète — chacun conçu pour s\'intégrer à votre socle de données existant.',
    phases: [
      { label: 'Phase 2', name: 'Enrichissement des données', story: 'Avec votre schéma en place, PIM et API rendent vos données accessibles et distribuables sur tous vos systèmes.' },
      { label: 'Phase 3', name: 'Contrôle opérationnel',      story: 'Déplacez les données entre systèmes sans friction et gérez précisément qui accède à quoi, à tous les niveaux.' },
      { label: 'Phase 4', name: 'Mise sur le marché',         story: 'Mettez tout ce que vous avez construit devant vos clients et alignez toute votre organisation commerciale.' },
    ],
    modules: {
      'db-toolkit': {
        title: 'DB Toolkit',
        description: 'Concepteur de schéma visuel avec génération IA, console SQL, aperçu DDL, support de champs multilingues et interfaces CRUD auto-générées. La fondation de votre couche de données.',
        status_label: 'Actif',
        launch_label: 'Lancer le Toolkit',
        features: ['Concepteur de tables visuel', 'Génération pilotée par IA', 'Console SQL', 'Champs multilingues'],
      },
      pim: {
        title: 'PIM Admin',
        hook: 'Diffusez vos données produit sur chaque canal.',
        description: 'Gestion centralisée des informations produit. Définissez, enrichissez et distribuez les données produit sur tous les canaux de vente avec support multilingue complet et gestion des médias.',
        status_label: 'Bientôt disponible',
      },
      api: {
        title: 'API Administrator',
        hook: 'Maîtrisez chaque endpoint, de bout en bout.',
        description: 'Concevez, documentez et gouvernez vos endpoints REST. Rate limiting, gestion des clés API, versioning, journalisation des requêtes et surveillance en temps réel dans un seul panneau.',
        status_label: 'Bientôt disponible',
      },
      'import-export': {
        title: 'Import / Export',
        hook: 'Déplacez des données sans écrire un pipeline.',
        description: 'Gestion de pipelines ETL pour votre infrastructure. Importez depuis CSV, Excel et JSON ; transformez et validez ; planifiez des exports vers n\'importe quelle destination.',
        status_label: 'Bientôt disponible',
      },
      users: {
        title: 'Gestion des utilisateurs',
        hook: 'Contrôlez qui voit quoi, partout.',
        description: 'Suite complète d\'authentification et d\'autorisation. Contrôle d\'accès basé sur les rôles, intégrations OAuth, gestion d\'équipe, journaux d\'audit et matrices de permissions par module.',
        status_label: 'Bientôt disponible',
      },
      ecommerce: {
        title: 'E-Commerce',
        hook: 'Une boutique complète alimentée par vos données.',
        description: 'Boutique en ligne complète propulsée par vos données PIM. Catalogue produits, panier, tunnels de commande, gestion des commandes, promotions et synchronisation des stocks en temps réel.',
        status_label: 'Bientôt disponible',
      },
      sales: {
        title: 'Sales Demand',
        hook: 'Alignez la planification de la demande dans toute l\'org.',
        description: 'Planification de la demande B2B et collaboration inter-équipes. Prévisions de pipeline, signaux de demande, gestion des territoires et visibilité partagée sur l\'ensemble de vos ventes.',
        status_label: 'Bientôt disponible',
      },
    },
    pillars_heading: 'Pourquoi CoreX Platform',
    pillars_sub: 'Conçu pour les équipes d\'ingénierie qui refusent de faire des compromis sur la qualité, la vitesse ou l\'échelle.',
    pillars: [
      { icon: 'Sparkles', title: 'IA par défaut', description: 'Générez des schémas de base de données, des structures API et des modèles de contenu à partir de descriptions en langage naturel.' },
      { icon: 'Languages', title: 'Multilingue intégré', description: 'Chaque module est livré avec i18n dès le premier jour. Gérez les traductions au niveau du champ pour toutes vos langues.' },
      { icon: 'Shield', title: 'Accès basé sur les rôles', description: 'Matrices de permissions granulaires par module, par équipe, par entreprise. Activez ou restreignez des fonctionnalités entières en un clic.' },
      { icon: 'Code2', title: 'Pensé pour les développeurs', description: 'Accès SQL direct, aperçu et application DDL, APIs REST propres et interfaces TypeScript-first. Contrôle total quand vous en avez besoin.' },
    ],
    cta: {
      heading: 'Commencez à construire avec DB Toolkit aujourd\'hui',
      sub: 'Le premier module est en ligne et prêt. Concevez votre schéma, exécutez du SQL et générez des structures avec l\'IA en quelques minutes.',
      button: 'Ouvrir DB Toolkit',
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
    platform_name: 'CoreX Platform',
    platform_tagline: 'Construir · Gestionar · Escalar',
    hero: {
      eyebrow: 'Suite Admin Enterprise',
      title: 'Una plataforma.',
      title_accent: 'Cada módulo que necesitas.',
      subtitle:
        'DB Toolkit, PIM Admin, Administración API, pipelines de Importación/Exportación, Gestión de usuarios y una tienda E-Commerce completa — todo integrado, todo en un solo lugar.',
      cta_toolkit: 'Lanzar DB Toolkit',
      cta_modules: 'Explorar todos los módulos',
    },
    stats: {
      modules_total: 'Módulos en la suite',
      modules_active: 'Activo ahora',
      tables: 'Tablas de base de datos',
      fields: 'Campos personalizados',
    },
    suite_heading: 'La Suite Enterprise Completa',
    suite_sub: 'Siete módulos integrados que cubren cada capa de tu infraestructura de datos y operaciones de negocio.',
    label_available: 'Disponible ahora',
    label_coming_soon: 'Hoja de ruta',
    roadmap_heading: 'Lo que viene a continuación',
    roadmap_sub: 'Seis módulos que construyen el stack empresarial completo — cada uno diseñado para integrarse con tu base de datos existente.',
    phases: [
      { label: 'Phase 2', name: 'Enriquecimiento de datos',  story: 'Con tu esquema establecido, PIM y API hacen que tus datos sean accesibles y distribuibles en todos los sistemas.' },
      { label: 'Phase 3', name: 'Control operacional',       story: 'Mueve datos entre sistemas sin fricción y gestiona exactamente quién tiene acceso a qué, a cualquier nivel.' },
      { label: 'Phase 4', name: 'Salida al mercado',         story: 'Pon todo lo que has construido frente a los clientes y alinea toda tu operación de ventas a su alrededor.' },
    ],
    modules: {
      'db-toolkit': {
        title: 'DB Toolkit',
        description: 'Diseñador visual de esquemas con generación por IA, consola SQL, vista previa DDL, soporte de campos multilingüe e interfaces CRUD auto-generadas. La base de tu capa de datos.',
        status_label: 'Activo',
        launch_label: 'Lanzar Toolkit',
        features: ['Diseñador visual de tablas', 'Generación con IA', 'Consola SQL', 'Campos multilingüe'],
      },
      pim: {
        title: 'PIM Admin',
        hook: 'Envía datos de producto a cada canal.',
        description: 'Gestión centralizada de información de producto. Define, enriquece y distribuye datos de producto por todos los canales de venta con soporte multilingüe completo y gestión de medios.',
        status_label: 'Próximamente',
      },
      api: {
        title: 'API Administrator',
        hook: 'Controla cada endpoint de API, de extremo a extremo.',
        description: 'Diseña, documenta y gobierna tus endpoints REST. Rate limiting, gestión de claves API, versionado, registro de solicitudes y monitoreo en tiempo real en un panel unificado.',
        status_label: 'Próximamente',
      },
      'import-export': {
        title: 'Import / Export',
        hook: 'Mueve datos sin escribir un pipeline.',
        description: 'Gestión de pipelines ETL para tu infraestructura. Importa desde CSV, Excel y JSON; transforma y valida; programa exportaciones a cualquier destino automáticamente.',
        status_label: 'Próximamente',
      },
      users: {
        title: 'Gestión de usuarios',
        hook: 'Controla quién ve qué, en todas partes.',
        description: 'Suite completa de autenticación y autorización. Control de acceso basado en roles, integraciones OAuth, gestión de equipos, registros de auditoría y matrices de permisos por módulo.',
        status_label: 'Próximamente',
      },
      ecommerce: {
        title: 'E-Commerce',
        hook: 'Una tienda completa, impulsada por tus datos.',
        description: 'Tienda en línea completa impulsada por tus datos PIM. Catálogo de productos, carrito, flujos de pago, gestión de pedidos, promociones y sincronización de inventario en tiempo real.',
        status_label: 'Próximamente',
      },
      sales: {
        title: 'Sales Demand',
        hook: 'Alinea la planificación de demanda en toda la org.',
        description: 'Planificación de demanda B2B y colaboración entre equipos. Previsión de pipeline, señales de demanda, gestión de territorios y visibilidad compartida en toda tu operación de ventas.',
        status_label: 'Próximamente',
      },
    },
    pillars_heading: 'Por qué CoreX Platform',
    pillars_sub: 'Creado para equipos de ingeniería que se niegan a comprometer la calidad, la velocidad o la escala.',
    pillars: [
      { icon: 'Sparkles', title: 'IA por defecto', description: 'Genera esquemas de bases de datos, estructuras API y modelos de contenido desde descripciones en lenguaje natural. La IA acelera cada módulo.' },
      { icon: 'Languages', title: 'Multilingüe desde el inicio', description: 'Cada módulo viene con i18n desde el primer día. Gestiona traducciones a nivel de campo en todos tus idiomas configurados.' },
      { icon: 'Shield', title: 'Acceso basado en roles', description: 'Matrices de permisos detalladas por módulo, equipo y empresa. Habilita o restringe funciones completas con un solo toggle.' },
      { icon: 'Code2', title: 'Diseño para desarrolladores', description: 'Acceso SQL directo, vista previa y aplicación de DDL, APIs REST limpias e interfaces TypeScript-first. Control total cuando lo necesitas.' },
    ],
    cta: {
      heading: 'Empieza a construir con DB Toolkit hoy',
      sub: 'El primer módulo está activo y listo. Diseña tu esquema, ejecuta SQL y genera estructuras con IA en minutos.',
      button: 'Abrir DB Toolkit',
    },
    footer: {
      copyright: '© 2026 CorexStack. Todos los derechos reservados.',
      privacy: 'Política de privacidad',
      legal: 'Aviso legal',
      cookies: 'Política de cookies',
    },
  },
};
