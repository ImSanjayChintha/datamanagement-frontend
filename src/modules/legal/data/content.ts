export type LegalPageId = 'privacy' | 'legal' | 'cookies';

export interface LegalSection {
  heading: string;
  body: string;
}

export interface LegalPageContent {
  title: string;
  intro: string;
  sections: LegalSection[];
}

export interface LegalContent {
  dir: 'ltr' | 'rtl';
  back: string;
  pages: Record<LegalPageId, LegalPageContent>;
}

export const LANG_NAMES: Record<string, string> = {
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
};

export const LEGAL_CONTENT: Record<string, LegalContent> = {
  en: {
    dir: 'ltr',
    back: 'Back',
    pages: {
      privacy: {
        title: 'Privacy Policy',
        intro: 'CorexStack is committed to protecting your personal data. This policy explains what information we collect, how we use it, and your rights regarding your data.',
        sections: [
          {
            heading: 'Information We Collect',
            body: 'We collect information you provide directly, such as your name, email address, and account credentials when you register or use the platform. We also collect technical data such as IP addresses, browser type, and usage logs to operate and improve the service.',
          },
          {
            heading: 'How We Use Your Information',
            body: 'Your data is used to provide and maintain the CorexStack platform, authenticate your account, send service-related communications, and improve our features. We do not sell your personal data to third parties.',
          },
          {
            heading: 'Data Retention',
            body: 'We retain your personal data for as long as your account is active or as needed to provide services. You may request deletion of your data at any time by contacting us at privacy@corexstack.com.',
          },
          {
            heading: 'Your Rights',
            body: 'Depending on your jurisdiction, you may have the right to access, correct, delete, or restrict the processing of your personal data. To exercise these rights, please contact privacy@corexstack.com.',
          },
          {
            heading: 'Contact',
            body: 'For any questions regarding this Privacy Policy, please contact us at privacy@corexstack.com.',
          },
        ],
      },
      legal: {
        title: 'Legal Notice',
        intro: 'This legal notice governs the use of the CorexStack platform and the services provided by CorexStack.',
        sections: [
          {
            heading: 'Company Information',
            body: 'CorexStack\nRegistered business address: CorexStack HQ\nContact: legal@corexstack.com',
          },
          {
            heading: 'Intellectual Property',
            body: 'All content, trademarks, logos, and software on the CorexStack platform are the property of CorexStack or its licensors. Unauthorized use, reproduction, or distribution is strictly prohibited.',
          },
          {
            heading: 'Limitation of Liability',
            body: 'CorexStack provides the platform on an "as is" basis. We make no warranties regarding the accuracy, reliability, or availability of the service. To the maximum extent permitted by law, CorexStack shall not be liable for any indirect, incidental, or consequential damages.',
          },
          {
            heading: 'Governing Law',
            body: 'This legal notice and any disputes arising from use of the platform shall be governed by applicable law. CorexStack reserves the right to update this notice at any time.',
          },
        ],
      },
      cookies: {
        title: 'Cookie Policy',
        intro: 'This Cookie Policy explains how CorexStack uses cookies and similar tracking technologies when you use our platform.',
        sections: [
          {
            heading: 'What Are Cookies',
            body: 'Cookies are small text files stored on your device by your browser. They help us recognize your session, remember your preferences, and understand how you use the platform.',
          },
          {
            heading: 'Cookies We Use',
            body: 'Session cookies: Required to keep you logged in during your session. These are deleted when you close your browser.\n\nPreference cookies: Store your language and display preferences between sessions.\n\nAnalytics cookies: Help us understand how users interact with the platform so we can improve it. These are anonymized.',
          },
          {
            heading: 'Managing Cookies',
            body: 'You can control or delete cookies through your browser settings at any time. Note that disabling certain cookies may affect the functionality of the platform, such as staying logged in.',
          },
          {
            heading: 'Third-Party Cookies',
            body: 'CorexStack does not currently use third-party advertising cookies. If this changes, this policy will be updated accordingly.',
          },
          {
            heading: 'Contact',
            body: 'If you have questions about our use of cookies, contact us at privacy@corexstack.com.',
          },
        ],
      },
    },
  },

  de: {
    dir: 'ltr',
    back: 'Zurück',
    pages: {
      privacy: {
        title: 'Datenschutzrichtlinie',
        intro: 'CorexStack verpflichtet sich zum Schutz Ihrer personenbezogenen Daten. Diese Richtlinie erklärt, welche Informationen wir erheben, wie wir sie verwenden und welche Rechte Sie bezüglich Ihrer Daten haben.',
        sections: [
          {
            heading: 'Erhobene Informationen',
            body: 'Wir erheben Informationen, die Sie direkt angeben, wie Name, E-Mail-Adresse und Zugangsdaten bei der Registrierung. Wir erfassen auch technische Daten wie IP-Adressen, Browsertyp und Nutzungsprotokolle, um den Dienst zu betreiben und zu verbessern.',
          },
          {
            heading: 'Verwendung Ihrer Daten',
            body: 'Ihre Daten werden verwendet, um die CorexStack-Plattform bereitzustellen und zu warten, Ihr Konto zu authentifizieren, dienstbezogene Mitteilungen zu senden und unsere Funktionen zu verbessern. Wir verkaufen Ihre persönlichen Daten nicht an Dritte.',
          },
          {
            heading: 'Datenspeicherung',
            body: 'Wir speichern Ihre personenbezogenen Daten, solange Ihr Konto aktiv ist oder zur Erbringung von Dienstleistungen erforderlich. Sie können jederzeit die Löschung Ihrer Daten unter privacy@corexstack.com beantragen.',
          },
          {
            heading: 'Ihre Rechte',
            body: 'Je nach Ihrem Wohnsitzland haben Sie möglicherweise das Recht auf Auskunft, Berichtigung, Löschung oder Einschränkung der Verarbeitung Ihrer Daten. Wenden Sie sich dazu an privacy@corexstack.com.',
          },
          {
            heading: 'Kontakt',
            body: 'Bei Fragen zu dieser Datenschutzrichtlinie wenden Sie sich bitte an privacy@corexstack.com.',
          },
        ],
      },
      legal: {
        title: 'Impressum',
        intro: 'Dieses Impressum regelt die Nutzung der CorexStack-Plattform und der von CorexStack erbrachten Leistungen.',
        sections: [
          {
            heading: 'Unternehmensangaben',
            body: 'CorexStack\nGeschäftssitz: CorexStack HQ\nKontakt: legal@corexstack.com',
          },
          {
            heading: 'Geistiges Eigentum',
            body: 'Alle Inhalte, Marken, Logos und Software auf der CorexStack-Plattform sind Eigentum von CorexStack oder seiner Lizenzgeber. Unbefugte Nutzung, Vervielfältigung oder Verbreitung ist strengstens untersagt.',
          },
          {
            heading: 'Haftungsbeschränkung',
            body: 'CorexStack stellt die Plattform „wie besehen" zur Verfügung. Wir geben keine Garantien hinsichtlich der Richtigkeit, Zuverlässigkeit oder Verfügbarkeit des Dienstes. CorexStack haftet im gesetzlich zulässigen Rahmen nicht für mittelbare oder Folgeschäden.',
          },
          {
            heading: 'Anwendbares Recht',
            body: 'Dieses Impressum und etwaige Streitigkeiten aus der Nutzung der Plattform unterliegen dem anwendbaren Recht. CorexStack behält sich das Recht vor, dieses Impressum jederzeit zu aktualisieren.',
          },
        ],
      },
      cookies: {
        title: 'Cookie-Richtlinie',
        intro: 'Diese Cookie-Richtlinie erklärt, wie CorexStack Cookies und ähnliche Technologien bei der Nutzung unserer Plattform einsetzt.',
        sections: [
          {
            heading: 'Was sind Cookies?',
            body: 'Cookies sind kleine Textdateien, die von Ihrem Browser auf Ihrem Gerät gespeichert werden. Sie helfen uns, Ihre Sitzung zu erkennen, Ihre Einstellungen zu speichern und die Plattformnutzung zu verstehen.',
          },
          {
            heading: 'Verwendete Cookies',
            body: 'Sitzungs-Cookies: Erforderlich, um Sie während Ihrer Sitzung angemeldet zu halten. Sie werden beim Schließen des Browsers gelöscht.\n\nPräferenz-Cookies: Speichern Ihre Sprach- und Anzeigeeinstellungen zwischen Sitzungen.\n\nAnalyse-Cookies: Helfen uns zu verstehen, wie Nutzer mit der Plattform interagieren, um sie zu verbessern. Diese sind anonymisiert.',
          },
          {
            heading: 'Cookie-Verwaltung',
            body: 'Sie können Cookies jederzeit über Ihre Browsereinstellungen kontrollieren oder löschen. Das Deaktivieren bestimmter Cookies kann die Funktionalität der Plattform beeinträchtigen.',
          },
          {
            heading: 'Drittanbieter-Cookies',
            body: 'CorexStack verwendet derzeit keine Werbe-Cookies von Drittanbietern. Sollte sich dies ändern, wird diese Richtlinie entsprechend aktualisiert.',
          },
          {
            heading: 'Kontakt',
            body: 'Bei Fragen zu unserer Cookie-Nutzung wenden Sie sich bitte an privacy@corexstack.com.',
          },
        ],
      },
    },
  },

  fr: {
    dir: 'ltr',
    back: 'Retour',
    pages: {
      privacy: {
        title: 'Politique de confidentialité',
        intro: 'CorexStack s\'engage à protéger vos données personnelles. Cette politique explique quelles informations nous collectons, comment nous les utilisons et quels sont vos droits concernant vos données.',
        sections: [
          {
            heading: 'Informations collectées',
            body: 'Nous collectons les informations que vous fournissez directement, telles que votre nom, adresse e-mail et identifiants lors de l\'inscription. Nous recueillons également des données techniques telles que les adresses IP, le type de navigateur et les journaux d\'utilisation.',
          },
          {
            heading: 'Utilisation de vos données',
            body: 'Vos données sont utilisées pour fournir et maintenir la plateforme CorexStack, authentifier votre compte, envoyer des communications relatives au service et améliorer nos fonctionnalités. Nous ne vendons pas vos données personnelles à des tiers.',
          },
          {
            heading: 'Conservation des données',
            body: 'Nous conservons vos données personnelles aussi longtemps que votre compte est actif ou que nécessaire à la fourniture des services. Vous pouvez demander la suppression de vos données à tout moment en contactant privacy@corexstack.com.',
          },
          {
            heading: 'Vos droits',
            body: 'Selon votre juridiction, vous pouvez avoir le droit d\'accéder, de corriger, de supprimer ou de restreindre le traitement de vos données personnelles. Pour exercer ces droits, contactez privacy@corexstack.com.',
          },
          {
            heading: 'Contact',
            body: 'Pour toute question concernant cette politique de confidentialité, contactez-nous à privacy@corexstack.com.',
          },
        ],
      },
      legal: {
        title: 'Mentions légales',
        intro: 'Ces mentions légales régissent l\'utilisation de la plateforme CorexStack et des services fournis par CorexStack.',
        sections: [
          {
            heading: 'Informations sur la société',
            body: 'CorexStack\nSiège social : CorexStack HQ\nContact : legal@corexstack.com',
          },
          {
            heading: 'Propriété intellectuelle',
            body: 'Tout le contenu, les marques, logos et logiciels de la plateforme CorexStack sont la propriété de CorexStack ou de ses concédants. Toute utilisation, reproduction ou distribution non autorisée est strictement interdite.',
          },
          {
            heading: 'Limitation de responsabilité',
            body: 'CorexStack fournit la plateforme « en l\'état ». Nous ne garantissons pas l\'exactitude, la fiabilité ou la disponibilité du service. Dans la mesure permise par la loi, CorexStack ne sera pas responsable des dommages indirects ou consécutifs.',
          },
          {
            heading: 'Droit applicable',
            body: 'Ces mentions légales et tout litige découlant de l\'utilisation de la plateforme sont régis par le droit applicable. CorexStack se réserve le droit de mettre à jour ces mentions à tout moment.',
          },
        ],
      },
      cookies: {
        title: 'Politique des cookies',
        intro: 'Cette politique des cookies explique comment CorexStack utilise les cookies et technologies similaires lors de l\'utilisation de notre plateforme.',
        sections: [
          {
            heading: 'Qu\'est-ce qu\'un cookie ?',
            body: 'Les cookies sont de petits fichiers texte stockés sur votre appareil par votre navigateur. Ils nous aident à reconnaître votre session, mémoriser vos préférences et comprendre comment vous utilisez la plateforme.',
          },
          {
            heading: 'Cookies utilisés',
            body: 'Cookies de session : Nécessaires pour vous maintenir connecté pendant votre session. Ils sont supprimés à la fermeture du navigateur.\n\nCookies de préférence : Mémorisent vos préférences de langue et d\'affichage entre les sessions.\n\nCookies analytiques : Nous aident à comprendre comment les utilisateurs interagissent avec la plateforme. Ces données sont anonymisées.',
          },
          {
            heading: 'Gestion des cookies',
            body: 'Vous pouvez contrôler ou supprimer les cookies à tout moment via les paramètres de votre navigateur. La désactivation de certains cookies peut affecter les fonctionnalités de la plateforme.',
          },
          {
            heading: 'Cookies tiers',
            body: 'CorexStack n\'utilise actuellement pas de cookies publicitaires tiers. Si cela venait à changer, cette politique serait mise à jour en conséquence.',
          },
          {
            heading: 'Contact',
            body: 'Pour toute question sur notre utilisation des cookies, contactez-nous à privacy@corexstack.com.',
          },
        ],
      },
    },
  },

  es: {
    dir: 'ltr',
    back: 'Volver',
    pages: {
      privacy: {
        title: 'Política de privacidad',
        intro: 'CorexStack se compromete a proteger tus datos personales. Esta política explica qué información recopilamos, cómo la utilizamos y cuáles son tus derechos con respecto a tus datos.',
        sections: [
          {
            heading: 'Información que recopilamos',
            body: 'Recopilamos la información que proporcionas directamente, como tu nombre, dirección de correo electrónico y credenciales de cuenta al registrarte. También recopilamos datos técnicos como direcciones IP, tipo de navegador y registros de uso.',
          },
          {
            heading: 'Cómo utilizamos tu información',
            body: 'Tus datos se utilizan para proporcionar y mantener la plataforma CorexStack, autenticar tu cuenta, enviar comunicaciones relacionadas con el servicio y mejorar nuestras funciones. No vendemos tus datos personales a terceros.',
          },
          {
            heading: 'Retención de datos',
            body: 'Conservamos tus datos personales mientras tu cuenta esté activa o según sea necesario para prestar los servicios. Puedes solicitar la eliminación de tus datos en cualquier momento contactando a privacy@corexstack.com.',
          },
          {
            heading: 'Tus derechos',
            body: 'Dependiendo de tu jurisdicción, puedes tener derecho a acceder, corregir, eliminar o restringir el tratamiento de tus datos personales. Para ejercer estos derechos, contacta a privacy@corexstack.com.',
          },
          {
            heading: 'Contacto',
            body: 'Para cualquier pregunta sobre esta Política de privacidad, contáctanos en privacy@corexstack.com.',
          },
        ],
      },
      legal: {
        title: 'Aviso legal',
        intro: 'Este aviso legal rige el uso de la plataforma CorexStack y los servicios prestados por CorexStack.',
        sections: [
          {
            heading: 'Información de la empresa',
            body: 'CorexStack\nDirección registrada: CorexStack HQ\nContacto: legal@corexstack.com',
          },
          {
            heading: 'Propiedad intelectual',
            body: 'Todo el contenido, marcas, logotipos y software de la plataforma CorexStack son propiedad de CorexStack o sus licenciantes. El uso, reproducción o distribución no autorizados están estrictamente prohibidos.',
          },
          {
            heading: 'Limitación de responsabilidad',
            body: 'CorexStack proporciona la plataforma "tal cual". No garantizamos la exactitud, fiabilidad o disponibilidad del servicio. En la medida permitida por la ley, CorexStack no será responsable de daños indirectos o consecuentes.',
          },
          {
            heading: 'Ley aplicable',
            body: 'Este aviso legal y cualquier disputa derivada del uso de la plataforma se regirán por la ley aplicable. CorexStack se reserva el derecho de actualizar este aviso en cualquier momento.',
          },
        ],
      },
      cookies: {
        title: 'Política de cookies',
        intro: 'Esta Política de cookies explica cómo CorexStack utiliza cookies y tecnologías similares cuando usas nuestra plataforma.',
        sections: [
          {
            heading: '¿Qué son las cookies?',
            body: 'Las cookies son pequeños archivos de texto almacenados en tu dispositivo por tu navegador. Nos ayudan a reconocer tu sesión, recordar tus preferencias y entender cómo usas la plataforma.',
          },
          {
            heading: 'Cookies que utilizamos',
            body: 'Cookies de sesión: Necesarias para mantenerte conectado durante tu sesión. Se eliminan al cerrar el navegador.\n\nCookies de preferencias: Guardan tus preferencias de idioma y visualización entre sesiones.\n\nCookies analíticas: Nos ayudan a entender cómo interactúan los usuarios con la plataforma para mejorarla. Están anonimizadas.',
          },
          {
            heading: 'Gestión de cookies',
            body: 'Puedes controlar o eliminar las cookies en cualquier momento a través de la configuración de tu navegador. Ten en cuenta que deshabilitar ciertas cookies puede afectar la funcionalidad de la plataforma.',
          },
          {
            heading: 'Cookies de terceros',
            body: 'CorexStack no utiliza actualmente cookies publicitarias de terceros. Si esto cambia, esta política se actualizará en consecuencia.',
          },
          {
            heading: 'Contacto',
            body: 'Si tienes preguntas sobre nuestro uso de cookies, contáctanos en privacy@corexstack.com.',
          },
        ],
      },
    },
  },
};
