/**
 * Legal content for marcador.gal (SPEC-058, CA-5).
 * Pure module: no DB, no framework dependencies, no network.
 */

export const TITULAR = {
  nombre: "Alberto Fojo Eiras",
  forma: "persona física",
  domicilio: "Estrada de Viveiro 62, 15337 Porto do Barqueiro, Mañón, A Coruña",
  contacto: "ola@tremen.dev",
  dominio: "marcador.gal",
} as const;

export const MARCA = {
  nombre: "tremen.dev",
  url: "https://tremen.dev",
  lineaGl: "marcador.gal, un proxecto de tremen.dev",
  lineaEs: "marcador.gal, un proyecto de tremen.dev",
} as const;

export const LEGAL_ROUTES = {
  gl: {
    avisoLegal: "/aviso-legal",
    privacidade: "/privacidade",
    cookies: "/cookies",
  },
  es: {
    avisoLegal: "/es/aviso-legal",
    privacidade: "/es/privacidad",
    cookies: "/es/cookies",
  },
} as const;

export interface LegalDocument {
  readonly title: string;
  readonly description: string;
  readonly lastUpdated: string;
  readonly sections: ReadonlyArray<{
    readonly title: string;
    readonly content: ReadonlyArray<string>;
  }>;
}

export const LEGAL_DOCS_GL: Record<
  "avisoLegal" | "privacidade" | "cookies",
  LegalDocument
> = {
  avisoLegal: {
    title: "Aviso legal",
    description:
      "Identificación do titular, condicións de uso e descargo deportivo de marcador.gal.",
    lastUpdated: "Novembro de 2026",
    sections: [
      {
        title: "1. Titular do servizo",
        content: [
          `En cumprimento do artigo 10 da Lei 34/2002 (LSSI-CE), infórmase de que o titular deste sitio web é ${TITULAR.nombre} (${TITULAR.forma}), con enderezo en ${TITULAR.domicilio}.`,
          `Para calquera cuestión relacionada con este sitio web, o enderezo de contacto é ${TITULAR.contacto}. Este buzón é exclusivo para afición, medios e incidencias técnicas; non se admite publicidade nin spam comercial.`,
          `marcador.gal é unha iniciativa desenvolvida polo estudio de produto ${MARCA.nombre} (${MARCA.url}).`,
        ],
      },
      {
        title: "2. Finalidade e carácter informativo deportivo",
        content: [
          "marcador.gal é un taboleiro de resultados en directo do fútbol galego e estatal. O seu propósito é exclusivamente informativo e de divulgación deportiva.",
          "Os resultados, minutos e horarios mostrados non teñen carácter de acta oficial federativa. A única fonte oficial con validez regulamentaria son as actas e comunicacións emitidas pola Real Federación Española de Fútbol (RFEF) e as respectivas federacións territoriais.",
          "marcador.gal NON é unha casa de apostas nin contén publicidade de casas de apostas nin xogos de azar. Non se ofrece asesoramento nin prognósticos sobre xogo.",
        ],
      },
      {
        title: "3. Propiedade intelectual e marcas de terceiros",
        content: [
          "Os nomes, marcas e distintivos dos clubs de fútbol e competicións pertencen aos seus respectivos titulares lexítimos. O seu uso neste sitio ten unha finalidade estritamente identificativa e informativa.",
          "O código fonte, deseño e contidos propios de marcador.gal son propiedade de tremen.dev baixo os termos declarados polo titular.",
        ],
      },
      {
        title: "4. Dispoñibilidade do servizo",
        content: [
          "marcador.gal é un servizo gratuíto e independente. Aínda que traballamos para ofrecer a máxima precisión e inmediatez mediante reconciled multiffuente, o servizo ofrécese sen garantías de exactitude inmediata ou dispoñibilidade ininterrompida ante caídas de fontes externas ou problemas de rede.",
        ],
      },
    ],
  },
  privacidade: {
    title: "Política de privacidade",
    description:
      "Información sobre o tratamento de datos persoais en marcador.gal.",
    lastUpdated: "Novembro de 2026",
    sections: [
      {
        title: "1. Compromiso de privacidade: cero rastrexo",
        content: [
          "A navegación pública en marcador.gal é completamente anónima. Non recompilamos datos de carácter persoal de quen consulta os marcadores.",
          "Non hai contas de usuario públicas que crear, nin contrasinais que teclear, nin perfís que construír.",
        ],
      },
      {
        title: "2. Datos de quen contacta voluntariamente",
        content: [
          `Se decides escribirnos ao noso buzón de contacto (${TITULAR.contacto}), a túa mensaxe e enderezo de correo só se utilizarán para responder á túa consulta ou xestionar a incidencia notificada. Non se ceden a terceiros nin se utilizan para enviar publicidade.`,
        ],
      },
      {
        title: "3. Responsable e exercicio de dereitos",
        content: [
          `O responsable do tratamento é ${TITULAR.nombre}. Podes exercer os teus dereitos de acceso, rectificación, supresión e limitación escribindo a ${TITULAR.contacto}.`,
        ],
      },
    ],
  },
  cookies: {
    title: "Política de cookies",
    description:
      "Compromiso de ausencia de cookies de rastrexo e uso exclusivo de almacenamento técnico local.",
    lastUpdated: "Novembro de 2026",
    sections: [
      {
        title: "1. Sen cookies de terceiros nin analítica invasiva",
        content: [
          "marcador.gal cumpre unha regra estrita: sen cookies de publicidade, sen píxeles de seguimento e sen analítica invasiva de terceiros.",
          "Non rastrexamos a túa navegación nin compartimos os teus hábitos de consumo con redes sociais nin anunciantes.",
        ],
      },
      {
        title: "2. Por que non hai banner de cookies?",
        content: [
          "A normativa europea e a guía da AEPD só requiren un banner de consentimento cando se instalan cookies de publicidade comportamental ou analíticas non exentas.",
          "Como marcador.gal respecta a túa privacidade e non instala cookies publicitarias nin de rastrexo, non hai consentimento que pedir nin banner intrusivo que moleste na pantalla.",
        ],
      },
      {
        title: "3. Almacenamento técnico local (localStorage)",
        content: [
          "A aplicación emprega unicamente a memoria local do teu navegador (localStorage) para funcións estritamente técnicas e de personalización elixidas por ti:",
          "• Preferencia de ligas visibles (ocultar ou amosar determinadas competicións).",
          "• Preferencia de lingua (se seleccionaches galego ou castelán).",
          "Estes datos nunca saen do teu dispositivo nin se transmiten aos nosos servidores.",
        ],
      },
    ],
  },
};

export const LEGAL_DOCS_ES: Record<
  "avisoLegal" | "privacidade" | "cookies",
  LegalDocument
> = {
  avisoLegal: {
    title: "Aviso legal",
    description:
      "Identificación del titular, condiciones de uso y descargo deportivo de marcador.gal.",
    lastUpdated: "Noviembre de 2026",
    sections: [
      {
        title: "1. Titular del servicio",
        content: [
          `En cumplimiento del artículo 10 de la Ley 34/2002 (LSSI-CE), se informa de que el titular de este sitio web es ${TITULAR.nombre} (${TITULAR.forma}), con domicilio en ${TITULAR.domicilio}.`,
          `Para cualquier cuestión relacionada con este sitio web, la dirección de contacto es ${TITULAR.contacto}. Este buzón es exclusivo para afición, medios e incidencias técnicas; no se admite publicidad ni spam comercial.`,
          `marcador.gal es una iniciativa desarrollada por el estudio de producto ${MARCA.nombre} (${MARCA.url}).`,
        ],
      },
      {
        title: "2. Finalidad y carácter informativo deportivo",
        content: [
          "marcador.gal es un tablero de resultados en directo del fútbol gallego y estatal. Su propósito es exclusivamente informativo y de divulgación deportiva.",
          "Los resultados, minutos y horarios mostrados no tienen carácter de acta oficial federativa. La única fuente oficial con validez reglamentaria son las actas y comunicaciones emitidas por la Real Federación Española de Fútbol (RFEF) y las respectivas federaciones territoriales.",
          "marcador.gal NO es una casa de apuestas ni contiene publicidad de casas de apuestas ni juegos de azar. No se ofrece asesoramiento ni pronósticos sobre juego.",
        ],
      },
      {
        title: "3. Propiedad intelectual y marcas de terceros",
        content: [
          "Los nombres, marcas y distintivos de los clubes de fútbol y competiciones pertenecen a sus respectivos titulares legítimos. Su uso en este sitio tiene una finalidad estrictamente identificativa e informativa.",
          "El código fuente, diseño y contenidos propios de marcador.gal son propiedad de tremen.dev bajo los términos declarados por el titular.",
        ],
      },
      {
        title: "4. Disponibilidad del servicio",
        content: [
          "marcador.gal es un servicio gratuito e independiente. Aunque trabajamos para ofrecer la máxima precisión e inmediatez mediante reconciliación multifuente, el servicio se ofrece sin garantías de exactitud inmediata o disponibilidad ininterrumpida ante caídas de fuentes externas o problemas de red.",
        ],
      },
    ],
  },
  privacidade: {
    title: "Política de privacidad",
    description:
      "Información sobre el tratamiento de datos personales en marcador.gal.",
    lastUpdated: "Noviembre de 2026",
    sections: [
      {
        title: "1. Compromiso de privacidad: cero rastreo",
        content: [
          "La navegación pública en marcador.gal es completamente anónima. No recopilamos datos de carácter personal de quien consulta los marcadores.",
          "No hay cuentas de usuario públicas que crear, ni contraseñas que teclear, ni perfiles que construir.",
        ],
      },
      {
        title: "2. Datos de quien contacta voluntariamente",
        content: [
          `Si decides escribirnos a nuestro buzón de contacto (${TITULAR.contacto}), tu mensaje y dirección de correo solo se utilizarán para responder a tu consulta o gestionar la incidencia notificada. No se ceden a terceros ni se utilizan para enviar publicidad.`,
        ],
      },
      {
        title: "3. Responsable y ejercicio de derechos",
        content: [
          `El responsable del tratamiento es ${TITULAR.nombre}. Puedes ejercer tus derechos de acceso, rectificación, supresión y limitación escribiendo a ${TITULAR.contacto}.`,
        ],
      },
    ],
  },
  cookies: {
    title: "Política de cookies",
    description:
      "Compromiso de ausencia de cookies de rastreo y uso exclusivo de almacenamiento técnico local.",
    lastUpdated: "Noviembre de 2026",
    sections: [
      {
        title: "1. Sin cookies de terceros ni analítica invasiva",
        content: [
          "marcador.gal cumple una regla estricta: sin cookies de publicidad, sin píxeles de seguimiento y sin analítica invasiva de terceros.",
          "No rastreamos tu navegación ni compartimos tus hábitos de consumo con redes sociales ni anunciantes.",
        ],
      },
      {
        title: "2. ¿Por qué no hay banner de cookies?",
        content: [
          "La normativa europea y la guía de la AEPD solo requieren un banner de consentimiento cuando se instalan cookies de publicidad comportamental o analíticas no exentas.",
          "Como marcador.gal respeta tu privacidad y no instala cookies publicitarias ni de rastreo, no hay consentimiento que pedir ni banner intrusivo que moleste en la pantalla.",
        ],
      },
      {
        title: "3. Almacenamiento técnico local (localStorage)",
        content: [
          "La aplicación emplea únicamente la memoria local de tu navegador (localStorage) para funciones estrictamente técnicas y de personalización elegidas por ti:",
          "• Preferencia de ligas visibles (ocultar o mostrar determinadas competiciones).",
          "• Preferencia de idioma (si has seleccionado gallego o castellano).",
          "Estos datos nunca salen de tu dispositivo ni se transmiten a nuestros servidores.",
        ],
      },
    ],
  },
};
