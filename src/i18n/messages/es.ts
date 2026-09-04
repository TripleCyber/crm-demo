import type { PartialMessages } from '../translate';

/**
 * **El castellano, que aquí es una traducción y no el original.**
 *
 * Los textos son los que tenía la consola antes de que hubiera catálogo: se han
 * movido, no reescrito. Lo que ha cambiado es su papel — el original es ahora
 * `./en.ts`, y de allí sale la lista de claves que existen.
 *
 * El tipo es `PartialMessages`, así que:
 *
 *  · **falta una clave y compila.** Esa pantalla sale en inglés, que es el
 *    respaldo. No revienta y no pinta el nombre de la clave.
 *  · **sobra una clave y NO compila.** Una clave que no está en el inglés es una
 *    traducción de algo que ya no existe, y esas son las que se quedan años.
 *
 * ⚠ Los cinco desenlaces (`verdict`, `stage`) son una propiedad de seguridad:
 *   «rechazada por el titular» es un aviso de fraude y «caducada» es un
 *   reintento. Si una traducción los acerca, el agente cuelga cuando tenía que
 *   insistir, o insiste cuando tenía que colgar.
 */
export const es: PartialMessages = {
  app: {
    fallbackTitle: 'CRM',
    fallbackDescription: 'Consola de agentes',
    description: 'Consola de agentes de {organization}',
  },

  nav: {
    groupService: 'Atención al cliente',
    groupIntegration: 'Integración',
    customers: 'Clientes',
    verifications: 'Verificaciones',
    diagnostics: 'Diagnóstico',
    events: 'Eventos',
    settings: 'Ajustes',
    consoleFallbackName: 'Consola de agentes',
    unconfigured: 'sin configurar',
    unconfiguredAgent: 'Consola sin configurar. Se configura en Ajustes.',
    setUp: 'Configurar esta instalación',
    unidentifiedAgent: 'Sin identificar.',
    agentNumber: 'Agente',
  },

  session: {
    unidentifiedAgentName: 'Agente de {organization}',
  },

  locale: {
    legend: 'Idioma',
    switchTo: 'Cambiar a {language}',
  },

  common: {
    technicalDetail: 'Ver el detalle técnico',
    none: 'no consta',
    dash: '—',
    noEmail: 'sin correo',
    never: 'nunca',
    unknownFailure: 'fallo desconocido',
    yes: 'Sí',
    no: 'No',
  },

  attributes: {
    givenName: 'Nombre',
    familyName: 'Apellidos',
    accountLast4: 'Últimos cuatro de la cuenta',
    accountLast4Short: 'Cuenta',
    supplyPointNumber: 'Punto de suministro',
    supplyPointNumberShort: 'Suministro',
    customerSince: 'Cliente desde',
    // Se rotulan como la pregunta que contestan y no como el dato del que
    // salen: «Mayor de 18» es lo que el titular ve que comparte. «Edad» sería
    // otra cosa, y además una que esta credencial no lleva.
    ageOver18: 'Mayor de 18',
    ageOver21: 'Mayor de 21',
    ageOver65: 'Mayor de 65',
    customerOver5Years: 'Cliente desde hace más de 5 años',
  },

  credentialTypes: {
    cliente: 'Cliente del banco',
    kyc: 'Comprobación de identidad',
    customer: 'Titular del contrato',
  },

  delivery: {
    emailLabel: 'Correo',
    emailHint: 'Al correo de la ficha, desde tu propio buzón',
    emailPhrase: 'por correo',
    linkLabel: 'Enlace',
    linkHint: 'Lo copias y lo pegas donde haga falta',
    linkPhrase: 'por enlace',
    qrLabel: 'QR',
    qrHint: 'El cliente está delante y lo escanea de esta pantalla',
    qrPhrase: 'por QR',
    // El canal `app` ya no se ofrece —se fue con el portal—, pero su frase se
    // queda: el historial de la ficha todavía tiene filas suyas y hay que poder
    // leerlas. Ver `RETIRED_PHRASES` en `lib/delivery.ts`.
    appPhrase: 'en su área de cliente',
  },

  verdict: {
    pendingLabel: 'En curso',
    pendingDetail: 'Esperando a que el titular conteste.',
    noAnswerLabel: 'Sin respuesta',
    noAnswerDetail: 'El plazo se agotó y nadie llegó a contestar.',
    verifiedLabel: 'Verificada',
    verifiedDetail: 'Presentó su credencial y la comprobación salió bien.',
    rejectedLabel: 'Rechazada por el titular',
    rejectedDetail: 'Dijo desde su cartera que no ha sido él. Es un aviso de fraude.',
    failedLabel: 'Credencial no válida',
    failedDetail: 'No es un «no soy yo»: la credencial no valió. Se puede reintentar.',
    expiredLabel: 'Sin respuesta',
    expiredDetail: 'Nadie contestó dentro del plazo.',
  },

  time: {
    justNow: 'ahora mismo',
    secondsAgo: 'hace {seconds} s',
    minutesAgo: 'hace {minutes} min',
  },

  customers: {
    eyebrow: 'Atención al cliente',
    title: 'Clientes',
    subtitle:
      'El padrón es de esta organización y no sale de aquí. Ningún sistema de TripleEnable lo lee.',
    newCustomer: 'Dar de alta un cliente',
    loadFailed: 'No se ha podido leer el padrón: {reason}',
    searchLabel: 'Buscar clientes',
    searchPlaceholder: 'Nombre, identificador o correo',
    searchPlaceholderWithReference: 'Nombre, identificador, correo o {reference}',
    search: 'Buscar',
    clearFilter: 'Quitar el filtro',
    countOne: '{count} ficha',
    countMany: '{count} fichas',
    countForTerm: ' de «{term}»',
    emptySearchTitle: 'Ninguna ficha coincide',
    emptySearchBody:
      'La búsqueda mira el nombre completo, el identificador, el correo y la referencia de la ficha — y sólo dentro de esta organización. No hay ningún directorio global que consultar.',
    emptySearchAction: 'Ver todas las fichas',
    emptyTitle: 'Todavía no hay clientes',
    emptyBody:
      'El alta crea la ficha a cuyo nombre se emite después la credencial. Sin ella no hay a quién emitir.',
    columnCustomer: 'Cliente',
    columnContact: 'Contacto',
    columnSince: 'Alta',
    columnCredential: 'Credencial',
    columnLastVerification: 'Última verificación',
    offered: 'Ofrecida',
    notOffered: 'sin ofrecer',
  },

  customerNew: {
    title: 'Alta de cliente',
    subtitle:
      'El identificador es el que llevará dentro su credencial y por el que se le reconoce después. Una vez emitida una credencial con él, cambiarlo deja el vínculo huérfano.',
    technical:
      'Es el <code>sub</code> de la credencial y el <code>subjectReference</code> con el que te-api ata el titular a su perfil, tanto al emitir como al pedir una presentación.',
  },

  customerForm: {
    externalId: 'Identificador de cliente (el que irá en la credencial)',
    givenName: 'Nombre',
    familyName: 'Apellidos',
    email: 'Correo',
    phone: 'Teléfono',
    accountLast4: 'Últimos cuatro de la cuenta',
    customerSince: 'Cliente desde',
    supplyPointNumber: 'Punto de suministro',
    birthDate: 'Fecha de nacimiento',
    birthDateHint:
      'No sale de esta ficha. La credencial lleva sólo las respuestas —mayor de 18, de 21, de 65—, nunca la fecha.',
    externalIdExample: 'AC-40218804',
    givenNameExample: 'Juan',
    familyNameExample: 'Pérez Molina',
    emailExample: 'juan@example.com',
    submit: 'Dar de alta',
    submitting: 'Guardando…',
    checkFields: 'Revisa los campos marcados.',
    duplicateField: 'ya existe en esta organización',
    errorRequiredExternalId: 'el identificador de cliente es obligatorio',
    errorExternalIdCharset: 'sólo letras, dígitos y . _ : - (hasta 128 caracteres)',
    errorRequiredGivenName: 'el nombre es obligatorio',
    errorRequiredFamilyName: 'los apellidos son obligatorios',
    errorAccountLast4: 'son exactamente cuatro dígitos',
    errorReferenceCharset: 'sólo letras, dígitos y . / _ : - (hasta 64 caracteres)',
    errorCustomerSince: 'la fecha va en formato AAAA-MM-DD',
    errorBirthDate: 'la fecha va en formato AAAA-MM-DD',
    errorBirthDateFuture: 'una fecha de nacimiento no puede estar en el futuro',
    duplicate: 'ya hay un cliente con el identificador {externalId}',
  },

  customer: {
    customerSince: 'Cliente desde {date}',
    teApiWarning: 'No se ha podido consultar TripleEnable: {reason}',
    holderData: 'Datos del titular',
    identifier: 'Identificador',
    email: 'Correo',
    phone: 'Teléfono',
    activityTitle: 'Actividad de identidad',
    activityIntro:
      'Lo que esta consola ha hecho con la identidad de esta persona, de lo más reciente a lo más antiguo. Es el registro de la organización: cada línea es algo que hizo un empleado suyo, con su hora.',
    activityEmpty:
      'Todavía no ha pasado nada. Empieza emitiéndole su credencial: sin ella no hay nada que comprobar después.',
    activityOffer: 'Credencial ofrecida',
    activityOfferFrom: 'desde',
    activityVerification: 'Verificación de identidad',
    activityVerificationLink: 'ver la verificación',
    digitalIdentity: 'Identidad digital',
    credential: 'Credencial',
    credentialNeverOffered: 'Todavía no se le ha ofrecido ninguna',
    credentialOfferedOn: 'Ofrecida el {date}',
    lastVerification: 'Última verificación',
    neverVerified: 'Nunca se le ha comprobado la identidad',
    honestyNote:
      '«Ofrecida» es lo que hizo esta organización. <b>Si el titular la guardó, no lo sabemos</b>, y por eso aquí no hay ninguna insignia de «credencial activa».',
    actionsTitle: 'Qué se puede hacer',
    resumeVerification: 'Seguir la verificación en curso',
    resumeVerificationHint: 'Lanzada a las {time}.',
    issueCredential: 'Emitir credencial',
    issueCredentialHint: 'Crear la oferta y hacérsela llegar por uno de los cuatro canales.',
    verifyCaller: 'Verificar quién habla',
    verifyCallerHint: 'Nivel 1 · que quien está al teléfono sea el titular.',
    authoriseTransaction: 'Autorizar operación',
    authoriseTransactionHint: 'Nivel 2 · firmar un importe. Todavía no se puede ejecutar.',
    checkAge: 'Comprobar que es mayor de edad',
    checkAgeHint: 'Una pregunta. Su fecha de nacimiento se queda en su teléfono.',
    ceremonies: 'Catálogo de verificaciones',
    ceremoniesHint: '36 peticiones ya escritas, de trece industrias.',
    channelPhone: 'Aviso a su móvil',
    channelQr: 'En el mostrador',
    onBehalfOf: 'a nombre de {agent}',
  },

  credential: {
    title: 'Emitir credencial',
    subtitle:
      'La crea <b>esta organización</b>: lo que lleva dentro sale de su padrón y de ningún otro sitio. TripleEnable la firma a nombre de esta entidad y la lleva hasta la cartera del titular.',
    teApiWarning:
      'No se ha podido consultar TripleEnable, así que no se sabe qué credenciales puede emitir esta organización: {reason}',
    noTypesTitle: 'No hay ningún tipo que emitir',
    noTypesBody:
      'Esta organización no declara ningún tipo de credencial. Compruébalo en <a>Diagnóstico</a>: el catálogo lo declara TripleEnable, no esta consola.',
    offerTitle: 'La oferta',
    type: 'Tipo de credencial',
    typeOption: '{label} (máx. {days} días)',
    validity: 'Vigencia en días (vacío = el tope del tipo)',
    withPin:
      'Con código de un solo uso — sin él, quien reciba la oferta por el canal que sea se lleva la credencial',
    channelsLegend: 'Cómo se la mandamos',
    channelsNote:
      'Los cuatro entregan la misma oferta, con la misma firma. El canal decide cómo llega, no si es de fiar: eso lo decide la firma del emisor, y la comprueba la cartera.',
    send: 'Enviar oferta',
    sending: 'Enviando…',
    failed: 'la emisión ha fallado ({status})',
    noServer: 'no se ha podido contactar con el servidor',
    offerCreated: 'Oferta creada',
    offerExpires: 'Caduca el {date}.',
    mailTo: 'Correo a {address}',
    mailIntro:
      'Se abre en tu propio programa de correo, ya redactado. Sale a tu nombre y no de un buzón automático — que es lo que pasa de verdad cuando llama un agente.',
    mailOpenDraft: 'Abrir el borrador',
    mailNote:
      'El código de un solo uso <b>no está</b> en ese texto, y no es un olvido: si viajara en el mismo correo que el enlace, quien leyera el buzón tendría las dos mitades.',
    walletLinkLabel: 'la oferta',
    officialNumbersSent: 'Ha ido dentro: {numbers}',
    offerId: 'Oferta {id}',
    pinTitle: 'Código de un solo uso',
    pinNote:
      'Dáselo por teléfono o en la oficina, <b>nunca por el mismo canal que el enlace</b>. Si viajan juntos, el código no protege de nada.',
    payloadTitle: 'Lo que llevará dentro',
    holder: 'Titular',
    identifier: 'Identificador',
    issuer: 'Emisor',
    noClaims: 'Esta ficha no rellena ningún atributo de este tipo.',
    officialNumbers: 'Números oficiales',
    officialNumbersMissing:
      'Todavía no están dados de alta los teléfonos oficiales de la entidad, así que la credencial saldrá sin ellos y el titular no podrá comprobar desde qué número le llamamos. Se puede emitir igual. Para darlos de alta, habla con quien lleva la integración: el detalle está en <a>Diagnóstico</a>.',
    officialNumbersNote:
      'Van firmados dentro de la credencial. El titular los puede consultar sin llamada y sin conexión, y por eso su cartera puede decir «uno de los números que guarda tu credencial» en vez de «te llama tu entidad».',
    contactNote:
      'El correo y el teléfono del cliente <b>no entran</b> en ninguna credencial: no están en el catálogo de atributos divulgables, y un dato metido «ya que estamos» acaba en todas las presentaciones que se hagan con ella.',
    format: 'Formato',
  },

  mail: {
    subject: 'Tu credencial de cliente',
    greeting: '{name}, aquí tienes tu credencial de cliente.',
    open: 'Ábrela desde el móvil en el que tengas la cartera de TripleEnable:',
    codeNotice:
      'Al guardarla te pedirá un código numérico. Ese código NO va en este correo: te lo decimos por teléfono o te lo damos en la oficina.',
    unexpected: 'Si no has pedido esta credencial, no abras el enlace y avísanos.',
  },

  age: {
    /** Ver `pageTitle` en `en.ts`: la cabecera nombra el sitio, la tarjeta lo que se hace. */
    pageTitle: 'Comprobación de edad',
    title: 'Pedir a {holder} que demuestre que es mayor de edad',
    body:
      'Una pregunta, una respuesta. Su fecha de nacimiento se queda en su teléfono: sólo viaja el sí o el no.',
    noWallet:
      'Este cliente no tiene cartera vinculada con nosotros, así que no hay teléfono al que pedírselo. La petición se creará y caducará sola.',
    typeLabel: 'Credencial',
    typeHelp: 'La credencial de esta organización que lleva su edad dentro.',
    reasonLabel: 'Por qué (opcional)',
    reasonPlaceholder: 'Compra de un producto con restricción de edad',
    reasonHelp:
      'Lo va a leer junto a la pregunta. Di por qué se le pregunta — no le pidas nada aquí.',
    ask: 'Preguntar',
    asking: 'Preguntando…',
    askedTitle: 'Preguntado',
    /**
     * **Lo que la consola puede afirmar, que no es que sonara el teléfono.**
     *
     * Había dos frases —«se ha avisado a su teléfono» y «no se avisó a
     * ninguno»— elegidas por un `delivered` que **te-api no manda**:
     * `POST /v1/requests` lo deja fuera de su respuesta a propósito, y lo dice
     * en su propio comentario —va sólo al diario, «por lo mismo que el timbre
     * calla cuatro de sus cinco razones»—. El cliente lo leía `undefined` y
     * pintaba «no se avisó a ningún teléfono» **siempre**, entregara o no.
     *
     * Así que se dice lo único que esta pantalla sabe: la petición está hecha y
     * se contesta en el teléfono. Que suene no lo confirma nadie, y es la misma
     * honestidad que ya practica la hermana con el timbre.
     */
    asked: 'Pedido. Contesta en su teléfono, no aquí — dile que abra la app.',
    follow: 'Seguirlo',
  },
  transfer: {
    title: 'Autorizar una transferencia de {holder}',
    noWallet:
      'Este cliente no tiene cartera vinculada con nosotros, así que no hay teléfono al que pedírselo. La petición se creará y caducará sola.',
    amountLabel: 'Importe',
    amountPlaceholder: 'EUR 1.240,00',
    amountHelp:
      'Escríbelo como lo tiene que leer el cliente, con su moneda. Es lo más grande de su pantalla y el botón lo dice.',
    destinationLabel: 'A',
    destinationPlaceholder: 'ES91 2100 0418 4502 0005 1332',
    destinationHelp: 'La cuenta que pueda reconocer. Entra en lo que firma.',
    previewTitle: 'Lo que va a leer',
    previewAmount: 'Importe',
    previewDestination: 'A',
    ask: 'Pedirle que la autorice',
    asking: 'Pidiendo…',
    askedTitle: 'Pedido',
    /**
     * **Lo que la consola puede afirmar, que no es que sonara el teléfono.**
     *
     * Había dos frases —«se ha avisado a su teléfono» y «no se avisó a
     * ninguno»— elegidas por un `delivered` que **te-api no manda**:
     * `POST /v1/requests` lo deja fuera de su respuesta a propósito, y lo dice
     * en su propio comentario —va sólo al diario, «por lo mismo que el timbre
     * calla cuatro de sus cinco razones»—. El cliente lo leía `undefined` y
     * pintaba «no se avisó a ningún teléfono» **siempre**, entregara o no.
     *
     * Así que se dice lo único que esta pantalla sabe: la petición está hecha y
     * se contesta en el teléfono. Que suene no lo confirma nadie, y es la misma
     * honestidad que ya practica la hermana con el timbre.
     */
    asked: 'Pedido. Lo autoriza en su teléfono, no aquí — dile que abra la app.',
  },

  /**
   * El catálogo de verificaciones.
   *
   * Sólo los rótulos de la consola. Los 36 casos viven en
   * `src/lib/ceremony-catalogue.ts` y **no se traducen**: son la carga que viaja
   * a te-api y que el titular lee en su teléfono. Ver la cabecera de `en.ts`.
   */
  ceremonies: {
    pageTitle: 'Catálogo de verificaciones',
    pageSub:
      '{cases} peticiones ya escritas, de {industries} industrias. Elige una y le llega al teléfono de {holder} tal y como se ve aquí.',
    askerNote:
      'Estos casos están escritos para otras clases de organización. Quien pregunta sigue siendo {organization}: lo que se enseña es la forma de la ceremonia, no que el banco sea un hospital.',
    noWallet:
      'Este cliente no tiene cartera vinculada con nosotros, así que no hay teléfono al que pedírselo. Las peticiones se crearán y caducarán solas.',
    industriesLabel: 'Industrias',
    writtenFor: 'Escrito para {organization}',
    previewTitle: 'Lo que va a leer',
    noHero: 'Sin héroe: esta pantalla la sostiene el par de abajo, no un solo valor.',
    flagTitle: 'Lo que este marco no hace:',
    send: 'Mandar esta petición',
    sending: 'Mandando…',
    sent: 'Mandado. Contesta en su teléfono, no aquí — dile que abra la app.',

    /* ── El compositor: editar, ensayar, ver la petición y mandarla ────── */

    panesLabel: 'Qué estás mirando',
    panePreview: 'Vista previa',
    paneFields: 'Personalizar',
    paneWire: 'Petición',
    paneContract: 'Contrato',

    statementTitle: 'La frase que firma',
    statementNote:
      'La frase es de la plantilla y no de esta consola: la compone te-api con los valores de abajo y guarda la revisión que usó, así que un recibo del año pasado se vuelve a pintar con el texto de aquel día. Lo que pone quien pregunta son los valores.',
    askerMustShowTitle: 'Tu propia pantalla tiene que enseñar:',

    fieldsTitle: 'Los valores que viajan',
    fieldsNote:
      'Son los del catálogo, y son buenos: manda el caso sin tocar nada y sale exactamente esto. Cámbialos y lo demás va detrás — la vista previa, la frase y el bloque de la petición se componen con lo que haya aquí.',
    fieldLabel: 'Rótulo',
    fieldValue: 'Valor',
    fieldSub: 'Segunda línea',
    fieldSubNote:
      'Una línea debajo del valor, sin rótulo propio. Se firma con el valor, y te-api sólo la admite en las claves que la plantilla exige.',
    fieldSubHint: 'Version 4 · 18 pages',
    fieldReading: 'Lectura',
    fieldWeight: 'Peso',
    readingText: 'Texto',
    readingMono: 'Carácter a carácter',
    readingNumeric: 'Cifras',
    weightHero: 'Héroe',
    weightNormal: 'Normal',
    weightQuiet: 'Apagado',
    roleHero: 'héroe',
    roleRequired: 'obligatoria',
    roleOptional: 'conocida',
    roleGeneric: 'par genérico',
    remove: 'Quitar',
    reset: 'Volver a los valores del catálogo',

    addPair: 'Añadir un par',
    addKey: 'Clave',
    add: 'Añadir',
    addFull: 'Doce campos es el techo, y lo impone te-api: nadie manda cien para esconder el que importa.',
    addKeyBad: 'Una clave son minúsculas, dígitos y guiones bajos. Es el nombre con el que la respuesta firmada dice sobre qué se firmó.',
    addKeyTaken: 'Esa clave ya está en esta petición.',

    draftRefused: 'te-api rechazaría esta petición:',

    wireWillSend: 'Lo que se va a mandar',
    wireWasSent: 'Lo que se mandó',
    wireCredentialNote:
      'Este caso firma con credencial, así que antes va una llamada: POST /v1/b2b/presentations abre la sesión del verificador en TripleEnable y devuelve el requestUri de abajo. El tipo de credencial es el de esta organización, sacado de su padrón, no el del caso.',
    wirePlaceholders:
      'Los dos valores entre ángulos todavía no existen: se rellenan un instante antes de la llamada. Mándala y este bloque lo sustituye el cuerpo que salió de verdad.',

    brandNote:
      'El color y el logotipo son de la organización, nunca de la petición: te-api los congela desde su padrón al crear la fila, así que quien pregunta no puede aparecer en el teléfono de nadie con un logotipo que no es suyo. Nada del cuerpo de abajo los lleva.',
    brandNone: 'Esta instalación no declara colores de marca, así que la consola se queda con los suyos.',
    brandChange: 'Se cambian en Ajustes',

    contractTitle: 'Qué usa este caso y qué permite',
    contractUnknown:
      'La copia del catálogo de plantillas de esta consola no conoce esa plantilla. Quien decide es te-api: mándala y lee lo que conteste.',
    contractInternal:
      'Esta plantilla sólo la puede crear la costura interna de te-api: una petición de acceso abre una sesión, y eso es un acto del emisor de identidad, no de un socio. POST /v1/requests contesta invalid_request. El caso está aquí porque la forma merece enseñarse; mandarlo va a fallar, y ese fallo es la verdad.',
    contractTemplate: 'Plantilla',
    contractVersion: 'Revisión',
    contractKind: 'Clase',
    contractSignWith: 'Se firma con',
    contractSignWithNote: 'Esta plantilla admite: {allowed}',
    contractCredential: 'Tipo de credencial',
    contractClaims: 'Atributos que se le piden: {claims}',
    contractHero: 'Clave del héroe',
    contractNoHero: 'ninguna — la decisión es un par, no un valor',
    contractRequired: 'Claves obligatorias',
    contractOptional: 'Claves conocidas',
    contractGeneric: 'Pares genéricos de este borrador',
    versionAgrees: 'te-api ha confirmado la revisión {version}.',
    versionDiffers:
      'te-api ha usado la revisión {actual} y esta consola tenía la {expected}. Su copia del catálogo está vieja — la que cuenta es la de te-api.',

    mayTitle: 'Lo decide el socio',
    may1: 'Todos los rótulos y valores: son la carga, y se leen en el teléfono del titular en su idioma, no en el de la consola.',
    may2: 'La segunda línea de una clave obligatoria, que se firma junto al valor de encima.',
    may3: 'Cómo se lee cada valor —texto, carácter a carácter o cifras—. La presentación la elige quien pregunta.',
    may4: 'Qué pares añade. El vocabulario es abierto: una clave que la plantilla no declara viaja como par genérico, hasta doce campos.',
    mayNotTitle: 'Lo decide te-api',
    mayNot1: 'La frase que se firma y su revisión. Salen del catálogo de plantillas, nunca de quien llama.',
    mayNot2: 'Qué clave es el héroe — y una clave que la plantilla no declara no puede serlo nunca.',
    mayNot3: 'El nombre de quien pregunta: lo copia del token que hizo la llamada.',
    mayNot4: 'El logotipo y los dos colores, congelados del padrón. Ver la nota de encima de la petición.',
    mayNot5: 'Cuánto dura la ventana. Quien la eligiera estaría eligiendo cuánta prisa tiene la persona que decide.',

    sentTitle: 'Mandado',
    sentRequestId: 'Petición',
    sentStatus: 'Estado',
    sentTemplate: 'Plantilla',
    sentExpires: 'Caduca',
    sentPresentation: 'Sesión del verificador',
    sentLink: 'Enlace de mostrador',

    sendAgain: 'Componer otra',
    receivedTitle: 'Recibido',
    receivedNoEvent:
      'Este caso firma con la identidad de la cartera, y te-api no manda ningún webhook cuando se contesta una petición del marco: los dos tipos de evento que manda hoy son presentation.settled y webhook.test. El desenlace de ésta vive en te-api. Un caso que firma con credencial sí vuelve aquí, por su sesión de verificador.',
    receivedEmpty: 'No ha llegado nada desde que se mandó.',
    receivedMatch: 'Ésta es la respuesta a la petición de al lado — la misma sesión de verificador.',
    checkEvents: 'Mirar qué ha vuelto',
    checking: 'Mirando…',
    eventsLink: 'Todos los eventos que ha recibido esta organización',

    industryDoc: 'Documentos',
    industryPro: 'Profesional',
    industryHealth: 'Salud',
    industryEdu: 'Educación',
    industryHr: 'Empresa',
    industryLog: 'Logística',
    industryIns: 'Seguros',
    industryRe: 'Inmobiliario',
    industryGov: 'Sector público',
    industryMob: 'Movilidad',
    industryRetail: 'Comercio',
    industryEnergy: 'Energía',
    industryTelco: 'Telecomunicaciones',
  },
  verify: {
    title: 'Verificar identidad',
    phone: 'Teléfono',
    teApiWarning:
      'No se ha podido consultar TripleEnable, así que no se sabe qué se le puede pedir: {reason}',
    noTypesTitle: 'No hay nada que comprobar',
    noTypesBody:
      'Esta organización no declara ningún tipo de credencial. Compruébalo en <a>Diagnóstico</a>: el catálogo lo declara TripleEnable, no esta consola.',
    levelIdentity: 'Verificar quién habla',
    levelIdentityHint: 'Nivel 1 · que sea él quien está al teléfono',
    levelTransaction: 'Autorizar operación',
    levelTransactionHint: 'Nivel 2 · firmar un importe · todavía no',
    requestTitle: 'Qué se le pide',
    requestIntro:
      'Se le enviará una solicitud <b>firmada a nombre de esta entidad</b>, y su cartera comprobará esa firma antes de enseñar nada. La verificación la hace TripleEnable: esta organización no tiene que custodiar ninguna clave.',
    type: 'Tipo de credencial',
    claimsLegend: 'Atributos',
    claimsEmpty:
      'Este tipo no lleva ningún atributo que esta ficha pueda rellenar, así que no hay nada que pedirle. Revisa la ficha, o el perfil del tipo en la configuración.',
    claimsNote:
      'Se pide sólo lo que hace falta: <b>lo que no se marque no sale de la cartera del titular</b>, y lo que su cartera enseñe de más tampoco llega hasta aquí.',
    claimsTechnical:
      'Se piden por nombre en la sesión de presentación y te-api devuelve la intersección entre lo pedido y lo que la cartera reveló.',
    alertTitle: 'Cómo se le avisa',
    // Ver la nota larga en `en.ts`: el marcador de posición es un ASUNTO y no
    // una instrucción, porque el ejemplo que ve el agente en el hueco es el que
    // va a imitar.
    callSubject: 'De qué va la llamada',
    callSubjectPlaceholder: 'Un pago con tarjeta que no reconoce',
    callSubjectHint:
      'Es lo primero que lee en su móvil, y a lo que dice que sí o que no. <b>Di de qué va la llamada \u2014 no le pidas nada aquí</b>: ni códigos, ni contraseñas, ni números de tarjeta.',
    callCase: 'Referencia del expediente',
    callCasePlaceholder: 'CASE-2026-4471',
    callCaseHint: 'Opcional. Sólo si puede cotejarla con algo que ya le hayáis mandado.',
    alertPhone: 'Está al teléfono · avisar a su móvil',
    alertPhoneBusy: 'Avisando…',
    alertQr: 'Está delante · enseñar un código',
    alertQrBusy: 'Pidiendo…',
    alertNoWallet:
      '<b>{name} no tiene cartera vinculada con esta entidad</b>, así que no hay a quién mandarle la solicitud — ni al teléfono ni en el mostrador, porque las dos van a la cartera. Emítele una credencial: queda vinculado cuando la acepta en su cartera.',
    alertPhoneNoWallet: 'No hay cartera a la que avisar',
    requestFailed: 'la petición ha fallado ({status})',
    noServer: 'no se ha podido contactar con el servidor',
    previewTitle: 'Lo que le llega a él',
    callSubjectPreview: 'Lee primero',
    callSubjectPreviewEmpty: 'Nada todavía. Di de qué va la llamada.',
    onBehalfOf: 'A nombre de',
    onBehalfOfValue: '{name}, agente {id}',
    about: 'Sobre',
    willBeAsked: 'Se le pedirá',
    willBeAskedEmpty: 'Nada todavía. Marca al menos un atributo.',
    sayItNote:
      '<b>Dile en voz alta que se la has mandado y con qué nombre.</b> Que lo que oye por teléfono sea lo que lee en la pantalla del móvil es la mitad de la comprobación — la otra mitad la pone la firma de su cartera.',
    agentNameNote:
      'El nombre del agente es <i>informativo</i>: no lo verifica nadie y no decide nada. Lo infalsificable es que la solicitud viene firmada por esta organización, y eso lo comprueba su cartera antes de enseñar nada.',
    transactionUnavailable: 'El nivel 2 todavía no se puede ejecutar, y esta pantalla no lo simula.',
    transactionBody:
      'Autorizar una operación es <b>otra ceremonia</b>, no la misma con otro rótulo: el titular tiene que ver el importe, firmarlo —de forma que la firma cubra lo que leyó— y teclear cuatro cifras que sólo pueden haber llegado por la voz de quien le está llamando. Mandar la ceremonia del nivel 1 con este nombre acostumbraría a todo el mundo a autorizar transferencias deslizando, que es exactamente lo que las dos ceremonias existen para impedir.',
    transactionMeanwhile:
      'Mientras tanto, para confirmar que quien está al teléfono es el titular, usa el nivel 1. No autoriza ninguna operación y lo dice: es lo que separa esta ceremonia de un permiso.',
    transactionTechnicalSummary: 'Ver el detalle técnico · qué falta y dónde',
    transactionWallet: 'Cartera',
    transactionWalletDetail:
      '<code>transaction_data</code> de OID4VP en el KB-JWT, y negarse a firmar si no coincide con lo que se pintó. Es el único trabajo de criptografía nuevo del plan.',
    transactionDigits: 'te-api · las cuatro cifras',
    transactionDigitsDetail:
      'Ya las acuña <code>createWakeup</code>, pero no salen: hacen falta en la respuesta de <code>POST /v1/b2b/wakeups</code> —para que este CRM las enseñe— y en <code>GET /v1/requests/pending</code> —para que la cartera las pida—, y <code>POST /v1/requests/:id/outcome</code> tiene que comprobarlas y matar el reto al primer fallo.',
    transactionOperation: 'te-api · la operación',
    transactionOperationDetail:
      'El timbre no lleva importe ni destinatario. Sin ellos no hay nada que resumir dentro del <code>transaction_data</code>.',
  },

  /**
   * Los eventos recibidos por webhook (`/events`).
   *
   * ⚠ Los códigos de fallo de firma —`bad_signature`, `stale_timestamp`— NO
   *   están aquí y no van a estarlo: se guardan en la base y los lee quien
   *   opera, que es la misma persona que los va a buscar en el registro de
   *   te-api. Traducirlos obligaría a mantener un catálogo por cada motivo que
   *   añada la comprobación, y a que el de la pantalla y el de la base
   *   discreparan el día que se añada uno.
   */
  settings: {
    eyebrow: 'Integración',
    title: 'Ajustes',
    subtitle:
      'Todo lo que esta instalación necesita para hablar con TripleEnable. Se guarda en la base del propio CRM, así que un despliegue recién publicado se configura desde aquí y desde ningún otro sitio.',

    stateConfigured: 'Esta instalación está configurada. Si funciona lo dicen las comprobaciones del final.',
    stateIncomplete: 'Todavía sin configurar. Falta: {fields}.',
    missing: {
      orgId: 'el identificador de organización de Logto',
      displayName: 'el nombre de la organización',
      domain: 'el dominio',
      m2mClientId: 'el identificador de cliente de la aplicación de máquina',
      m2mSecret: 'el secreto de la aplicación de máquina',
      referenceClaim: 'la referencia de sector',
      issuerUrl: 'la dirección de te-api',
    },

    databaseDown: 'No se han podido leer los ajustes: {reason}',
    databaseDownNote:
      'Es el único fallo del que esta pantalla no puede salir sola. Comprueba DATABASE_URL y aplica las migraciones.',

    webhookUrlTitle: 'Esta instalación recibe los webhooks en',
    webhookUrlNoDomain:
      'Declara antes el dominio, más abajo. De él sale esta dirección, y también el did:web con el que firma esta organización.',
    webhookUrlNote:
      'Se pega en la consola de TripleEnable, en <b>Credentials \u2192 Webhook</b>. Al registrarla, la consola devuelve el secreto de firma, y ésa es la única vez que se enseña entero — va en la casilla de aquí abajo.',

    sourceTitle: 'De dónde salen estos valores',
    sourceRule: 'La regla',
    sourceRuleDetail:
      '<b>La base manda.</b> Lo que se guarda aquí es lo que corre. No hay un segundo sitio donde mirar.',
    sourceEnv: 'Las variables de entorno',
    sourceEnvSeeded:
      'Esta instalación se <b>sembró desde el entorno</b> en su primer arranque, y por eso las casillas venían rellenas. Desde ese momento el entorno ya no se lee: <b>cambiar una variable y volver a desplegar no hace nada.</b>',
    sourceEnvIgnored:
      'No se leen. Sólo pueden sembrar una instalación que todavía no tenga fila de ajustes, y ésta ya la tiene.',
    sourceRequired: 'Lo que sigue siendo obligatorio en el entorno',
    sourceRequiredDetail:
      '<code>DATABASE_URL</code>, y nada más. Es donde se guarda todo esto, así que no puede guardarse dentro de ella.',

    noAuthWarning:
      '<b>Esta consola no tiene login.</b> Quien llegue a esta dirección puede abrir esta pantalla. Los secretos se escriben y no se releen — sólo se enseña su huella —, pero mientras no exista el login de empleado no dejes una instalación con secretos de verdad en una dirección pública sin nada delante.',

    identityTitle: 'Quién es esta instalación',
    identityNote:
      'La organización de Logto en cuyo nombre emite y verifica este CRM. La crea su administrador en la consola de TripleEnable.',
    orgId: 'Identificador de organización de Logto',
    orgIdNote:
      'Cambiarlo no migra nada: los clientes, las verificaciones y los eventos que ya hay se quedan atados al anterior.',
    displayName: 'Nombre de la organización',
    displayNameExample: 'Northwind Bank',
    displayNameNote: 'Sólo para esta consola. El nombre legal es el que diga te-api.',
    domain: 'Dominio',
    domainNote:
      'Sin esquema. Es la identidad de esta instalación: de él salen el did:web que publica y la dirección de webhook de arriba.',
    referenceClaim: 'Referencia de sector',
    referenceChoose: 'Elige una',
    referenceNote:
      'El dato con el que el titular reconoce de qué relación se le habla. Es la única casilla que ofrece el alta de clientes, así que la equivocada le pone delante a un agente la de otro negocio.',
    officialNumbers: 'Teléfonos oficiales',
    officialNumbersNote:
      'Separados por comas. Viajan dentro de la credencial firmada, así que uno equivocado es peor que ninguno.',

    machineTitle: 'Aplicación de máquina',
    machineNote:
      'Lo que autentica a esta instalación contra te-api. Es la única aplicación que declara, y autentica a un servidor — nunca a una persona.',
    m2mClientId: 'Identificador de cliente',
    m2mSecret: 'Secreto de cliente',
    m2mSecretNote:
      'Se enseña entero una sola vez, cuando la consola lo crea. Su huella se calcula igual allí y aquí, así que se pueden comparar a ojo.',

    webhookSecretTitle: 'Secreto de firma del webhook',
    webhookSecretIntro:
      'Lo único que separa un evento de te-api de un POST escrito por cualquiera. Sin él se rechaza toda entrega: no hay modo «aceptar sin comprobar».',
    webhookSecret: 'Secreto de firma',
    webhookSecretNote:
      'Se pega tal y como lo dio la consola, con el prefijo incluido. Es una cadena opaca y no material criptográfico codificado: quitarle el prefijo o descodificar la cola produce otro MAC y se rechazan todas las entregas.',

    brandTitle: 'Marca',
    brandNote:
      'Dos colores y un monograma. El acento va sobre blanco; la superficie es la barra lateral. Los colores de estado no son la marca y no se tocan aquí.',
    brandAccent: 'Acento',
    brandSurface: 'Superficie',
    brandMonogram: 'Monograma',

    platformTitle: 'Direcciones de la plataforma',
    platformNote:
      'Son iguales en cualquier instalación del producto, así que vienen puestas y casi nunca se tocan. Están aquí para que un Logto de pruebas sea posible sin variables de entorno.',
    logtoEndpoint: 'Endpoint de Logto',
    teApiBaseUrl: 'Dirección de te-api',
    b2bResource: 'Indicador del recurso B2B',
    b2bResourceNote:
      'Es el aud que exige te-api. Tiene que ser el mismo texto que el suyo, carácter a carácter: una barra final de más y el token sale para otro recurso.',
    b2bScope: 'Scopes que se piden',
    b2bScopeNote:
      'Separados por espacios. Logto recorta en silencio lo que el rol de organización no tenga concedido, sin error, así que lo que de verdad se consiguió es el scope del token — lo enseña la comprobación de aquí abajo.',

    save: 'Guardar los ajustes',
    saving: 'Guardando\u2026',
    saved: 'Guardado. Las comprobaciones de abajo ya usan estos valores.',
    checkFields: 'Hay casillas que revisar.',
    required: 'Obligatorio',
    domainInvalid: 'Un nombre de host a secas, como bank.demo-te.com. Sin ruta y sin parámetros.',
    referenceInvalid: 'Elige una de: {values}',
    colourInvalid: 'Un color hexadecimal: #rgb, #rrggbb, o rrggbb sin la almohadilla.',
    brandPair: 'Los dos colores van juntos o no van. Media marca se lee como una pantalla a medio pintar.',
    monogramTooLong: 'Uno o dos caracteres. Más que eso es una mancha en un disco de 32 píxeles.',
    urlInvalid: 'Una dirección absoluta http o https.',
    secretWhitespace: 'Ese valor lleva un espacio dentro. Vuelve a pegarlo sin espacios delante ni detrás.',
    secretLooksLikeFingerprint:
      'Eso parece una huella y no un secreto. La huella es lo que una consola enseña EN LUGAR del secreto; con ella no se puede firmar nada.',
    secretMissing: 'Sin poner',
    secretKeep: 'En blanco se queda el que hay',
    secretPaste: 'Pega aquí el secreto',
    secretClear: 'Vaciar el secreto guardado al guardar',
    fingerprintTitle: 'Los 16 primeros caracteres del SHA-256',
    saveFailed: 'No se han podido guardar los ajustes. El detalle está en el registro del servidor.',

    copy: 'Copiar',
    copied: 'Copiado',

    checkConnectionTitle: 'Comprobar la conexión con TripleEnable',
    checkConnectionNote:
      'Le pide a Logto un token con las credenciales guardadas y con él llama a GET /v1/b2b/organization. Comprueba cuatro cosas de una vez: el secreto, el recurso, los scopes y si esta organización está dada de alta. Prueba lo GUARDADO, no lo que haya escrito arriba.',
    checkConnection: 'Comprobar la conexión',
    checking: 'Comprobando\u2026',
    checkConnectionOk: 'Contestó. La costura está bien montada.',
    checkConnectionOpaque:
      'te-api contesta el mismo 404 a todas ellas a propósito: un token malo, un aud que no cuadra, un scope que falta, una organización sin dar de alta y una suspendida. El requestId es lo que su operador puede buscar.',
    checkScopes: 'Scopes del token',
    checkTypes: 'Tipos emitibles',

    checkWebhookTitle: 'Pedirle a TripleEnable que llame a este CRM',
    checkWebhookNote:
      'Es la única dirección que no se puede comprobar desde dentro, así que hay que pedirla. te-api encola un webhook.test, lo firma con el secreto de esta organización y lo entrega en la dirección que tiene registrada. Es además la única entrega que sale mientras un destino está en probation, y un 2xx es lo que lo asciende.',
    checkWebhook: 'Mandar un evento de prueba',
    sending: 'Mandando\u2026',
    checkWebhookSent:
      'Mandado. Tiene que aparecer en la pantalla de Eventos en unos segundos — empujado por te-api, no preguntado por este CRM.',
    checkWebhookMismatch:
      'Mandado, pero la dirección registrada no es la de esta instalación. La entrega va a otro sitio, así que aquí no va a llegar nada.',
    checkWebhookNotRegistered:
      'Esta organización todavía no tiene ningún destino de webhook registrado, así que no hay nada que probar.',
    checkWebhookRegisterHint:
      'Registra esta dirección en la consola de TripleEnable, en Credentials \u2192 Webhook:',
    checkWebhookRegistered: 'Dirección registrada',
    checkWebhookExpected: 'Esta instalación',
    checkWebhookStatus: 'Estado del destino',
    checkWebhookEventId: 'Id del evento',
    checkWebhookDelivery: 'Entrega',
    checkWebhookNotQueued:
      'te-api registró el evento pero no encoló ninguna entrega: en ese despliegue el envío está apagado.',
    checkWebhookSeeEvents: 'Abrir la pantalla de eventos',
  },

  events: {
    eyebrow: 'Integración',
    title: 'Eventos recibidos',
    subtitle:
      'Lo que TripleEnable ha enviado a este CRM, y si su firma cuadró. Es la mitad de la integración que ocurre sin que nadie esté mirando.',
    loadFailed: 'No se ha podido leer el registro de eventos: {reason}',
    endpointTitle: 'Este CRM recibe en',
    endpointUrl: 'Dirección del webhook',
    endpointSecret: 'Secreto de firma',
    endpointSecretSet: 'Declarado. Cada entrega se comprueba contra él.',
    endpointSecretWhere: 'Se pone en Ajustes',
    endpointSecretMissing: 'Sin declarar, así que se rechaza toda entrega.',
    endpointNote:
      'La dirección se registra en la consola de TripleEnable, en Credentials → Webhook. Al registrarla devuelve el secreto de firma, y ésa es la única vez que se enseña entero.',
    emptyTitle: 'Todavía no ha llegado nada',
    emptyBody:
      'Una vez registrada la dirección de arriba en la consola, un evento de prueba desde allí es la forma más rápida de confirmar que la dirección y el secreto son los buenos.',
    emptyAction: 'Ver el montaje',
    columnReceived: 'Recibido',
    columnType: 'Evento',
    columnCustomer: 'Cliente',
    columnSignature: 'Firma',
    columnPayload: 'Cuerpo',
    occurredAt: 'ocurrió a las {time}',
    outcome: 'desenlace: {status}',
    signatureOk: 'Comprobada',
    signatureBad: 'Rechazada',
    eventId: 'Id del evento',
    deliveryId: 'Id de la entrega',
  },

  verifications: {
    eyebrow: 'Atención al cliente',
    title: 'Verificaciones',
    subtitle:
      'Cada vez que un agente le pide a un cliente que demuestre quién es, queda una línea aquí. La escribe esta organización; el desenlace lo dice TripleEnable.',
    loadFailed: 'No se ha podido leer el registro: {reason}',
    emptyTitle: 'Todavía no se ha comprobado a nadie',
    emptyBody:
      'La comprobación se lanza desde la ficha del cliente. Necesita que el titular tenga ya su credencial: sin ella no hay nada que presentar.',
    emptyAction: 'Ir a los clientes',
    columnCustomer: 'Cliente',
    columnOutcome: 'Resultado',
    columnStarted: 'Lanzada',
    columnChannel: 'Canal',
    columnAgent: 'Agente',
    columnAsked: 'Se le pidió',
    settledAt: 'se supo a las {time}',
    channelPhone: 'Al teléfono',
    channelPhoneHint: 'aviso al móvil',
    channelQr: 'En el mostrador',
    channelQrHint: 'solicitud a su cartera',
  },

  verification: {
    title: 'Verificación de identidad',
    request: 'Petición {id}',
    startedOn: 'Lanzada el {date}',
    startedBy: 'Por {name}, agente {id}',
    backToCustomer: 'Volver a la ficha',
    panelTitle: 'La petición',
    holder: 'Titular',
    holderGone: 'la ficha ya no está en el padrón',
    requiredCredential: 'Credencial exigida',
    requestedClaims: 'Atributos pedidos',
    howAlerted: 'Cómo se avisó',
    alertedPhone: 'Aviso a su móvil · estaba al teléfono',
    alertedQr: 'Solicitud a su cartera · estaba delante',
    requiredIssuer: 'Emisor exigido',
    panelNote:
      'La comprobación la hace TripleEnable. Esta organización no tiene que montar ni custodiar ningún verificador: pone la pregunta y lee la respuesta.',
    protocol: 'Protocolo',
    requiredType: 'Tipo exigido',
    walletCollectsAt: 'La cartera la recoge en',
  },

  stage: {
    waitingTitle: 'Esperando al titular',
    waitingPhone: 'Le hemos avisado a su móvil. Pídale que abra la app y confirme.',
    waitingQr: 'Enséñele el código. Tiene que escanearlo con su cartera y confirmar ahí.',
    overdueTitle: 'Sin respuesta',
    overdueBody: 'El plazo se agotó y nadie contestó. Puede volver a intentarlo desde aquí.',
    verifiedTitle: 'Es quien dice ser',
    verifiedBody:
      'Ha presentado su credencial y la verificación ha salido bien. Puede continuar con la operación.',
    rejectedTitle: 'El titular dice que no ha sido él',
    rejectedBody:
      'Ha <b>rechazado la petición desde su cartera</b>. No continúe con la operación y curse el aviso de fraude: si usted está hablando con alguien y el titular dice que no, hay dos personas distintas.',
    failedTitle: 'La credencial no ha valido',
    failedBody:
      'No es un «no soy yo»: es la credencial fallando —caducada, revocada o de otro titular—. Se puede volver a intentar.',
    expiredTitle: 'Caducó sin respuesta',
    expiredBody: 'Nadie contestó dentro del plazo. Puede volver a intentarlo desde aquí.',
    expiredCaveat:
      'Una denuncia del titular —«no estoy en ninguna llamada»— se ve hoy exactamente igual que un plazo agotado. Si sospecha, pregúntele.',
    polling: 'Comprobando si ha contestado',
    holder: 'Titular',
    customerNumber: 'Número de cliente',
    holderGone: 'la ficha ya no está en el padrón',
    signedAt: 'Firmó a las',
    knownAt: 'Lo supimos a las',
    retry: 'Volver a intentarlo',
    retrying: 'Lanzando otra…',
    askSomethingElse: 'Pedir otra cosa',
    expiresIn: 'La solicitud caduca en {countdown}.',
  },

  tracker: {
    codeTitle: 'Su código',
    inboxTitle: 'Dónde está la solicitud',
    inboxBody:
      'En su móvil, en la app de TripleEnable: se abre desde el aviso, y si lo ha descartado sigue esperándole dentro de la app. En esta pantalla no hay código: este despliegue tiene el canal de código apagado.',
    wakeupUnconfirmed:
      'Que le haya sonado el móvil <b>no lo confirma nadie</b>. Si no contesta, pregúntele si tiene la app instalada en vez de darlo por hecho.',
    wakeupTechnical:
      'Aviso <code>{id}</code>. te-api contesta lo mismo tenga cartera el titular o no, y es deliberado: si distinguiera, esta pantalla serviría para averiguar quién tiene la app probando identificadores.',
    timelineTitle: 'Estado',
    milestoneCreated: 'Solicitud creada',
    milestoneCreatedHint: 'firmada a nombre de esta entidad',
    milestoneWakeup: 'Aviso enviado a su móvil',
    milestoneWakeupHint: 'salió el aviso; que le suene el móvil no lo confirma nadie',
    milestoneWaiting: 'Esperando su respuesta',
    milestoneWaitingHint: 'Caduca sola cuando llegue a cero; entonces hay que volver a avisar.',
    milestoneSigned: 'Firmó desde su cartera',
    milestoneSignedHint: 'hora de su teléfono, no la de esta consola',
    milestoneOverdue: 'El plazo se agotó',
    milestoneOverdueHint: 'hora a la que caducaba la solicitud',
    milestoneSettledHint: 'hora en la que esta consola lo supo',
    outcomeVerified: 'Ha confirmado desde su cartera',
    outcomeRejected: 'Ha dicho que no ha sido él',
    outcomeFailed: 'La credencial no ha valido',
    outcomeExpired: 'Caducó sin respuesta',
    architectureNote:
      'Esta pantalla <b>no habla con TripleEnable</b>: pregunta cada {seconds} segundos al servidor de esta organización (<code>GET /api/credentials/present</code>), y ese servidor contesta de su propia base. <b>Tampoco él le pregunta nada a te-api</b>: el resultado le llega solo, por un webhook firmado (<code>POST /api/webhooks/te-api</code>), que es como se entera cualquier sistema de negocio. Se comprueba abriendo la pestaña de red.',
    verifierNote:
      'La solicitud se abrió en el verificador de TripleEnable, firmada con el DID de esta organización. No tiene verificador propio ni clave de verificación.',
    pollFailed: 'la consulta ha fallado ({status})',
    retryFailed: 'no se ha podido lanzar otra ({status})',
    noServer: 'no se ha podido contactar con el servidor',
    receiptTitle: 'Recibo · lo que {organization} guarda',
    receiptConfirmed: 'Confirmado',
    receiptConfirmedAt: '{time} · hora en la que esta consola lo supo',
    receiptRequest: 'Petición',
    receiptRequiredCredential: 'Credencial exigida',
    receiptRequiredIssuer: 'Emisor exigido',
    receiptRequiredHolder: 'Titular exigido',
    receiptHolderKey: 'Llave del titular',
    receiptHolderLink: 'Vínculo del titular',
    receiptSignedAt: 'Firmado por el titular',
    receiptKeyBinding: 'Firma de la presentación',
    receiptDisclosed: 'Lo que enseñó',
    receiptGuarantee:
      '<b>Verificado contra el emisor y contra el titular.</b> La firma la puso la cartera del titular; este recibo es lo que {organization} archiva de la comprobación.',
    receiptFormat: 'Formato',
    receiptFormatValue: '<code>SD-JWT VC</code> presentada por <code>OID4VP</code>',
    receiptRequiredType: 'Tipo exigido',
    receiptDisclosedClaims: 'Atributos revelados',
    receiptSignature: 'Firma',
    receiptSignatureValue:
      'la del <code>KB-JWT</code>, que ata esta presentación a la llave del titular',
    receiptHolderKeyJwk: 'Llave pública del titular',
    receiptNonce: 'Nonce',
    receiptAudience: 'Destinatario',
    receiptSdHash: 'Hash SD',
    receiptProofNote:
      'Estos cuatro son lo que permite que cualquiera vuelva a comprobar el <code>KB-JWT</code> sin pedirle nada a esta organización ni a TripleEnable: la llave que lo firmó, el reto al que contesta, el verificador para el que se firmó y el hash que lo ata a esta presentación y a ninguna otra.',
  },

  wallet: {
    open: 'Abrir en la cartera',
    copy: 'Copiar enlace',
    copied: 'Enlace copiado',
    note:
      '«Abrir en la cartera» funciona en el aparato donde esté instalada. Desde este navegador, si no la tiene, no ocurre nada: copia {label} y ábrela allí.',
  },

  diagnostics: {
    eyebrow: 'Integración',
    title: 'Diagnóstico',
    subtitle:
      'Esta llamada sale del servidor del CRM con el token M2M de la organización. No hay ninguna sesión de empleado por medio: borra las cookies y responde igual.',
    incomplete: 'La configuración del CRM está incompleta: {reason}',
    wiringTitle: 'Cómo habla esta consola con TripleEnable',
    whoCalls: 'Quién llama',
    whoCallsDetail:
      'El servidor de este CRM, nunca el navegador del agente. Ni el token M2M ni el secreto con el que se pide bajan al puesto: se comprueba abriendo la pestaña de red.',
    issuing: 'Emitir',
    issuingDetail:
      '<code>POST /v1/b2b/credentials</code>. Los claims los compone este servidor leyendo la ficha del padrón; del navegador sólo llega el identificador del cliente.',
    verifying: 'Verificar',
    verifyingDetail:
      '<code>POST /v1/b2b/presentations</code> abre la sesión en el verificador de TripleEnable y devuelve el enlace <code>OID4VP</code>. Esta organización no tiene verificador ni clave de verificación.',
    waking: 'Avisar al móvil',
    wakingDetail:
      '<code>POST /v1/b2b/wakeups</code>. La respuesta es la misma tenga cartera el titular o no —es deliberado: si distinguiera, serviría para averiguar quién tiene la app probando identificadores—, así que no confirma que haya sonado nada.',
    following: 'Seguir una verificación',
    followingDetail:
      'Este servidor <b>no pregunta a te-api si una verificación ha terminado</b>. El veredicto llega solo, por webhook firmado a <code>POST /api/webhooks/te-api</code>, y se anota en el diario de esta organización. La pantalla de la ceremonia lee ese diario cada 3 s, sin salir de aquí.',
    roster: 'El padrón de clientes',
    rosterDetail:
      'No sale de aquí. Vive en la base de este CRM y ni te-api ni Logto la leen nunca; lo único que viaja de un cliente es lo que se firma dentro de su credencial.',
    localConfigTitle: 'Configuración local',
    organization: 'Organización',
    name: 'Nombre',
    domain: 'Dominio',
    didPublished: 'did:web publicado',
    didNone: 'todavía ninguno · te-api no tiene clave de esta organización, así que /.well-known/did.json contesta 404',
    officialNumbers: 'Números oficiales',
    officialNumbersNone: 'ninguno declarado ·',
    issuerBase: 'te-api (emisión)',
    verifierBase: 'te-api (verificación)',
    brand: 'Marca',
    brandNone: 'la paleta por defecto ·',
    setInSettings: 'se pone en Ajustes',
    orgChoiceTitle: 'Una instalación, una organización',
    whoChooses: 'De dónde sale',
    whoChoosesDetail:
      'De la fila de ajustes de esta instalación, escrita en la pantalla de <b>Ajustes</b>. La petición no puede cambiarlo: la cabecera <code>Host</code> aquí no decide nada, que es lo que hace que la respuesta a «¿de quién es esta pantalla?» sea la misma en todas las peticiones.',
    twoTenants: 'Para servir a una segunda empresa',
    twoTenantsDetail:
      'Se publica la aplicación otra vez con otra configuración. Es la misma imagen: lo que cambia es el entorno, su dominio y su base. No se comparte nada, así que nada de lo que haga una empresa puede llegar a la otra.',
    didNoFallback: 'El documento DID',
    didNoFallbackDetail:
      '<code>/.well-known/did.json</code> se compone siempre con el dominio declarado, así que su <code>id</code> es el mismo DID diga lo que diga la petición. Responde <b>404</b> mientras te-api no tenga clave: una organización que no ha encendido su emisión no tiene identidad de emisor que publicar.',
    webhookTitle: 'Los eventos que llegan a este CRM',
    webhookUrl: 'Dirección del webhook',
    webhookUrlNote: 'Se registra en la consola, en Credentials → Webhook.',
    webhookSecret: 'Secreto de firma',
    webhookSecretSet: 'declarado · cada entrega se comprueba contra él',
    webhookSecretMissing: 'sin declarar, así que se rechaza toda entrega ·',
    webhookReceived: 'Recibidos',
    webhookTally: '{total} en total, {rejected} rechazados',
    webhookNever: 'todavía ninguno',
    webhookLast: 'el último {time}',
    webhookLink: 'Ver los eventos',
    databaseTitle: 'La base del CRM',
    connection: 'Conexión',
    connectionOk: 'Responde.',
    connectionUnknownError: 'la base no responde',
    customerCount: 'Clientes de esta organización',
    teApiTitle: 'Lo que dice te-api',
    teApiScopes: 'scopes del token',
    teApiIssuableTypes: 'tipos que puede emitir',
    teApiTypes: '{type} (máx. {days} d)',
    localeTitle: 'Idioma de la interfaz',
    localeChosenBy: 'Quién elige',
    localeChosenByDetail:
      'Quien mira la pantalla, desde la barra lateral. Se guarda en la cookie <code>crm_locale</code> y vale sólo para ese navegador: no es una variable de entorno, así que cambiarlo no obliga a reconstruir la imagen ni a volver a desplegar.',
    localeActive: 'Idioma activo',
    localeFallback: 'Respaldo',
    localeFallbackDetail:
      'Inglés. Una clave sin traducir se enseña en inglés; el nombre de la clave no se pinta nunca en pantalla.',
  },

  errors: {
    misconfigured:
      'Esta consola todavía no está configurada y no puede mostrar los datos de la organización. Quien lleva la integración la configura en la pantalla de Ajustes, que dice exactamente qué falta.',
    generic:
      'No hemos podido cargar los datos ahora mismo. Vuelve a intentarlo en un momento; si sigue igual, avisa a quien lleva la integración — el detalle está en Diagnóstico.',
    shortRetry: 'vuelve a intentarlo en un momento, y si sigue igual mira Diagnóstico.',
    customerNotFound: 'ese cliente no está en el padrón',
    customerNoEmail: 'esta ficha no tiene correo: elige otro canal o añádelo al padrón',
    missingFields: 'faltan externalId o type',
    badDelivery: 'delivery tiene que ser uno de: {channels}',
    unknownType: '«{type}» no es un tipo de credencial de esta organización',
    transferAmountMissing: 'falta el importe, y es lo más grande de su pantalla',
    transferAmountTooLong: 'el importe no puede pasar de {max} caracteres',
    transferDestinationMissing: 'falta el destino: estaría autorizando una transferencia a ninguna parte',
    transferDestinationTooLong: 'el destino no puede pasar de {max} caracteres',
    transferUpstream: 'No se ha podido pedir la autorización a TripleEnable. El detalle está en Diagnóstico.',
    ageReasonTooLong: 'el motivo no puede pasar de {max} caracteres',
    ageReasonOneLine: 'el motivo es una línea en la pantalla de un móvil: sin saltos de línea',
    ageUpstream: 'No se ha podido pedir la comprobación de edad a TripleEnable. El detalle está en Diagnóstico.',
    bodyNotJson: 'el cuerpo no es JSON',
    badChannel: 'channel tiene que ser qr o phone',
    noClaimsRequested: 'hay que pedir al menos un atributo',
    missingCallSubject: 'falta el asunto de la llamada, y su móvil no tendría nada que enseñar',
    callSubjectTooLong:
      'el asunto de la llamada es una línea en la pantalla de un móvil: {max} caracteres como mucho',
    callCaseTooLong: 'la referencia del expediente no puede pasar de {max} caracteres',
    claimsNotCarried:
      'la credencial «{label}» de este cliente no lleva {claims}, así que no se puede pedir',
    missingPresentationId: 'falta presentationId',
    presentationNotFound: 'esa comprobación no está en el diario de esta organización',
    issueFailed: 'no se ha podido emitir la credencial; mira el log del servidor',
    presentFailed: 'no se ha podido lanzar la petición; mira el log del servidor',
    teApiNotFound:
      'te-api ha rechazado la llamada. La puerta B2B contesta lo mismo para ocho motivos distintos (token, recurso, organización, padrón o scope), así que el motivo real está en el registro de te-api{reference}.',
    // Ver la nota larga en `en.ts`: el consejo de volver a sembrar el tipo era
    // falso —re-sembrar no crea un identificador que el emisor no publica— y el
    // motivo tampoco era el que parecía: cada formato se pide por una clave
    // distinta y la plataforma todavía no construye la de los `mso_mdoc`.
    noWalletLink:
      'No se ha enviado ninguna solicitud: este cliente no tiene una cartera vinculada con vuestra organización, así que no había a quién mandársela. Emítele una credencial: queda vinculado cuando la acepta en su cartera.',
    teApiNoVct:
      'Ese tipo de credencial se puede emitir, pero no pedir de vuelta: la plataforma todavía no construye una petición de presentación para su formato. Para verificar a este cliente, usa un tipo emitido como SD-JWT o como credencial JWT del modelo W3C{reference}.',
    teApiCannotComplete:
      'La plataforma se ha negado a completar esta operación y no dice cuál de los motivos posibles es. El de verdad está en el registro de te-api{reference}.',
    teApiUnavailable: 'El emisor de credenciales no está operativo ahora mismo{reference}.',
    teApiRateLimited: 'Demasiadas peticiones para esta organización; espera un momento{reference}.',
    teApiBadRequest: 'te-api ha rechazado los datos de la llamada: {code}{reference}.',
    teApiOther: 'te-api ha respondido {status} ({code}){reference}.',
    teApiReference: ' (requestId {requestId})',
    ceremonyUnknownCase: 'Ese caso no está en el catálogo.',
    ceremonyNoCredentialType:
      'Este caso se firma con una credencial y esta organización no declara ninguna, así que no hay nada que pedir.',
    ceremonyNoClaims:
      'Este caso se firma con una credencial pero no nombra ningún atributo que presentar. Así como está no se puede pedir.',
    ceremonyBadDraft: 'No se han podido leer esos campos, así que no se ha mandado nada.',
    ceremonyDraftRefused: 'te-api rechazaría esta petición, así que no se ha mandado:',
    ceremonyUpstream: 'No se ha podido mandar la petición. Míralo en Diagnóstico.',
  },
};
