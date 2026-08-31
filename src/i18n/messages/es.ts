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
    fallbackDescription: 'Consola de agentes y portal de clientes',
    description: 'Consola de agentes y portal de clientes de {organization}',
  },

  nav: {
    groupService: 'Atención al cliente',
    groupIntegration: 'Integración',
    customers: 'Clientes',
    verifications: 'Verificaciones',
    diagnostics: 'Diagnóstico',
    events: 'Eventos',
    consoleFallbackName: 'Consola de agentes',
    unconfigured: 'sin configurar',
    unconfiguredAgent: 'Consola sin configurar. El detalle está en Diagnóstico.',
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
  },

  attributes: {
    givenName: 'Nombre',
    familyName: 'Apellidos',
    accountLast4: 'Últimos cuatro de la cuenta',
    accountLast4Short: 'Cuenta',
    supplyPointNumber: 'Punto de suministro',
    supplyPointNumberShort: 'Suministro',
    customerSince: 'Cliente desde',
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
    appLabel: 'Desde nuestra app',
    appHint: 'Le espera en el portal, ya autenticado',
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
    channelPhone: 'Aviso a su móvil',
    channelQr: 'QR en el mostrador',
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
    portalTitle: 'Esperándole en el portal',
    portalBody:
      'La oferta queda guardada para este cliente. La verá al entrar en <code>{url}</code> con su cuenta de TripleEnable, y sólo la ve él: es el único de los cuatro canales en el que quien recoge la oferta está autenticado.',
    portalNote:
      'Dile por teléfono que entre en su área de cliente. Y el código de un solo uso, en voz alta por esta misma llamada.',
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
    alertPhone: 'Está al teléfono · avisar a su móvil',
    alertPhoneBusy: 'Avisando…',
    alertQr: 'Está delante · enseñar QR',
    alertQrBusy: 'Pidiendo…',
    requestFailed: 'la petición ha fallado ({status})',
    noServer: 'no se ha podido contactar con el servidor',
    previewTitle: 'Lo que le llega a él',
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
    endpointSecretMissing: 'Sin declarar, así que se rechaza toda entrega. Falta',
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
    channelQrHint: 'QR en pantalla',
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
    alertedQr: 'QR en pantalla · estaba delante',
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
    walletTitle: 'Abrir en la cartera',
    walletLinkLabel: 'la solicitud',
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
      'Esta pantalla <b>no habla con TripleEnable</b>: pregunta cada {seconds} segundos al servidor de esta organización (<code>GET /api/credentials/present</code>), y es él quien consulta a te-api (<code>GET /v1/b2b/presentations/:id</code>) con el token de la organización. Ni el token ni el secreto que lo pide bajan al navegador, y se comprueba abriendo la pestaña de red.',
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
      'La pantalla de la ceremonia sondea este mismo servidor cada 3 s y es él quien consulta <code>GET /v1/b2b/presentations/:id</code>. Tres segundos y no uno porque la puerta B2B lleva un cubo de tasa por organización compartido con la emisión.',
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
    officialNumbersNone: 'ninguno declarado · ',
    issuerBase: 'te-api (emisión)',
    verifierBase: 'te-api (verificación)',
    customerPortal: 'Portal del cliente',
    portalUndeclared: 'sin aplicación declarada · ',
    brand: 'Marca',
    brandNone: 'la paleta por defecto · se declara con ',
    orgChoiceTitle: 'Una instalación, una organización',
    whoChooses: 'De dónde sale',
    whoChoosesDetail:
      'Del entorno de este proceso — <code>CRM_ORG_ID</code> y las variables planas de al lado. La petición no puede cambiarlo: la cabecera <code>Host</code> aquí no decide nada, que es lo que hace que la respuesta a «¿de quién es esta pantalla?» sea la misma en todas las peticiones.',
    twoTenants: 'Para servir a una segunda empresa',
    twoTenantsDetail:
      'Se publica la aplicación otra vez con otra configuración. Es la misma imagen: lo que cambia es el entorno, su dominio y su base. No se comparte nada, así que nada de lo que haga una empresa puede llegar a la otra.',
    didNoFallback: 'El documento DID',
    didNoFallbackDetail:
      '<code>/.well-known/did.json</code> se compone siempre con <code>CRM_ORG_DOMAIN</code>, así que su <code>id</code> es el mismo DID diga lo que diga la petición. Responde <b>404</b> mientras te-api no tenga clave: una organización que no ha encendido su emisión no tiene identidad de emisor que publicar.',
    webhookTitle: 'Los eventos que llegan a este CRM',
    webhookUrl: 'Dirección del webhook',
    webhookUrlNote: 'Se registra en la consola, en Credentials → Webhook.',
    webhookSecret: 'Secreto de firma',
    webhookSecretSet: 'declarado · cada entrega se comprueba contra él',
    webhookSecretMissing: 'sin declarar, así que se rechaza toda entrega · ',
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

  portal: {
    header: 'Portal de clientes',
    fallbackName: 'Portal de clientes',
    titleGeneric: 'Tu cuenta',
    title: 'Tu cuenta de {organization}',
    intro:
      'Vincula tu cuenta con tu identidad de TripleEnable. A partir de ese momento podremos avisarte en tu móvil cuando haya que confirmar algo, sin llamarte por teléfono y sin pedirte datos por correo.',
    signInTitle: 'Entra para vincular',
    signInBody:
      'Te llevamos a TripleEnable para que confirmes que eres tú. Nosotros no vemos tu contraseña en ningún momento.',
    signIn: 'Entrar con TripleEnable',
    signInDisabled: 'El acceso está deshabilitado porque falta configuración. Mira el aviso de arriba.',
    linked: 'Tu cuenta de {organization} está vinculada con tu identidad de TripleEnable.',
    offerTitle: 'Tienes una credencial esperándote',
    offerBody:
      'Te la hemos emitido desde atención al cliente. Ábrela en el móvil donde tengas tu cartera de TripleEnable y guárdala: a partir de ese momento podremos comprobar que eres tú sin preguntarte datos por teléfono.',
    offerSave: 'Guardar en mi cartera',
    offerType: 'Tipo',
    offerExpires: 'Caduca',
    offerPinNote:
      'Te pedirá un código numérico. Te lo damos por teléfono o en la oficina, y <b>nunca aparece en esta pantalla ni en un correo</b>: es lo que impide que esta credencial acabe en el móvil de otro.',
    whoTitle: 'Quién eres',
    signedInAs: 'Has entrado como',
    verifiedEmail: 'Correo verificado',
    yourRecord: 'Tu ficha en {organization}',
    account: 'Cuenta',
    linkTitle: 'El vínculo',
    linkReference: 'Referencia',
    linkConfirmedAt: 'Confirmado el',
    linkPrevious: 'Vínculo anterior',
    linkPreviousReplaced: 'Sustituido por éste.',
    linkNote:
      '{organization} no sabe qué identidad de TripleEnable hay detrás, y TripleEnable no sabe que eres cliente nuestro: lo único que existe es esta referencia. Puedes retirarla desde tu cartera cuando quieras.',
    supportTitle: 'Para soporte',
    supportBody: 'Si nos llamas, dinos esta referencia: {requestId}',
    relink: 'Volver a vincular',
    signOut: 'Cerrar sesión',
    errorGeneric: 'Algo no ha salido bien.',
    errorNoPortal:
      'El acceso con TripleEnable todavía no está disponible en este portal. Si necesitas vincular tu cuenta, llámanos y lo hacemos contigo.',
    errorSessionLost:
      'Se perdió el hilo del login. Suele pasar al volver con el botón «atrás» o si la pestaña ha estado abierta mucho rato. Vuelve a empezar.',
    errorState: 'La respuesta no corresponde a esta petición de acceso. Vuelve a empezar.',
    errorProvider: 'No hemos podido completar el acceso. Vuelve a intentarlo.',
    errorExchange: 'No hemos podido completar el login con TripleEnable. Vuelve a intentarlo.',
    errorUnavailable: 'Este portal no está disponible ahora mismo. Vuelve a intentarlo en un rato o llámanos.',
    linkNoEmail: 'TripleEnable no nos ha dado tu correo, así que no podemos encontrar tu ficha de cliente.',
    linkNoCustomer: 'No encontramos ninguna ficha de cliente con ese correo en {organization}.',
    linkFailedGeneric: 'No hemos podido completar el vínculo.',
    linkNoTeApi: 'No hemos podido hablar con TripleEnable ahora mismo.',
  },

  errors: {
    misconfigured:
      'Esta consola está a medio configurar y no puede mostrar los datos de la organización. Avisa a quien lleva la integración: el detalle está en Diagnóstico.',
    generic:
      'No hemos podido cargar los datos ahora mismo. Vuelve a intentarlo en un momento; si sigue igual, avisa a quien lleva la integración — el detalle está en Diagnóstico.',
    shortRetry: 'vuelve a intentarlo en un momento, y si sigue igual mira Diagnóstico.',
    customerNotFound: 'ese cliente no está en el padrón',
    customerNoEmail: 'esta ficha no tiene correo: elige otro canal o añádelo al padrón',
    missingFields: 'faltan externalId o type',
    badDelivery: 'delivery tiene que ser uno de: {channels}',
    unknownType: '«{type}» no es un tipo de credencial de esta organización',
    bodyNotJson: 'el cuerpo no es JSON',
    badChannel: 'channel tiene que ser qr o phone',
    noClaimsRequested: 'hay que pedir al menos un atributo',
    claimsNotCarried:
      'la credencial «{label}» de este cliente no lleva {claims}, así que no se puede pedir',
    missingPresentationId: 'falta presentationId',
    issueFailed: 'no se ha podido emitir la credencial; mira el log del servidor',
    presentFailed: 'no se ha podido lanzar la petición; mira el log del servidor',
    statusFailed: 'no se ha podido leer el estado de la verificación; mira el log del servidor',
    teApiNotFound:
      'te-api ha rechazado la llamada. La puerta B2B contesta lo mismo para ocho motivos distintos (token, recurso, organización, padrón o scope), así que el motivo real está en el registro de te-api{reference}.',
    teApiNoVct:
      'te-api no puede pedir ese tipo de credencial de vuelta: le falta el `vct` en el padrón de la organización. Se emite pero no se verifica, y se arregla volviendo a sembrar el tipo en te-api, no reintentando desde aquí{reference}.',
    teApiLink:
      'te-api no ha podido completar el vínculo. El motivo más habitual es que esa cuenta todavía no tiene una cartera de TripleEnable dada de alta; el motivo real está en el registro de te-api{reference}.',
    teApiUnavailable: 'El emisor de credenciales no está operativo ahora mismo{reference}.',
    teApiRateLimited: 'Demasiadas peticiones para esta organización; espera un momento{reference}.',
    teApiBadRequest: 'te-api ha rechazado los datos de la llamada: {code}{reference}.',
    teApiOther: 'te-api ha respondido {status} ({code}){reference}.',
    teApiReference: ' (requestId {requestId})',
  },
};
