/**
 * **El catálogo de mensajes, y la fuente de verdad de qué claves existen.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  EL INGLÉS ES EL ORIGINAL; LOS DEMÁS IDIOMAS SON TRADUCCIONES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * De este fichero sale el tipo `MessageKey`, así que una clave que no esté aquí
 * **no compila** en ninguna pantalla, y una que falte en otro idioma se
 * resuelve cayendo a la de aquí. Ése es todo el mecanismo de respaldo: no hay
 * ningún caso en el que se pinte el nombre de una clave.
 *
 * Los comentarios del proyecto siguen en castellano (`AGENTS.md` §0.5). Lo que
 * está en inglés es lo que se *produce*: esto son los textos que salen en
 * pantalla, no la explicación de por qué dicen lo que dicen.
 *
 * ## Cómo se escriben los valores
 *
 * · `{nombre}` es un hueco que rellena quien llama.
 * · `<b>`, `<i>`, `<code>` y `<a>` son las cuatro marcas que entiende
 *   `t.rich()` (`../translate.tsx`). No hay más, y no hace falta: la maqueta
 *   de la frase es del componente, no del texto.
 * · Una frase entera por clave. Partir «no se ha podido» + «cargar el padrón»
 *   en dos ahorra un valor y hace la traducción imposible, porque el orden de
 *   los trozos no es el mismo en todos los idiomas.
 */
export const en = {
  /** El `<title>` y la descripción del documento. */
  app: {
    fallbackTitle: 'Agent console',
    fallbackDescription: 'Agent console',
    description: 'Agent console for {organization}',
  },

  /** La barra lateral de la consola. */
  nav: {
    groupService: 'Customer service',
    groupIntegration: 'Integration',
    customers: 'Customers',
    verifications: 'Verifications',
    diagnostics: 'Diagnostics',
    events: 'Events',
    settings: 'Settings',
    consoleFallbackName: 'Agent console',
    unconfigured: 'not configured',
    unconfiguredAgent: 'Console not configured. Set it up in Settings.',
    setUp: 'Set this installation up',
    unidentifiedAgent: 'Not identified.',
    agentNumber: 'Agent',
  },

  /** La sesión del empleado. */
  session: {
    unidentifiedAgentName: 'Agent at {organization}',
  },

  /** El selector de idioma. */
  locale: {
    legend: 'Language',
    switchTo: 'Switch to {language}',
  },

  /** Lo que dicen varias pantallas con las mismas palabras. */
  common: {
    technicalDetail: 'Show technical detail',
    none: 'not recorded',
    dash: '—',
    noEmail: 'no email',
    never: 'never',
    unknownFailure: 'unknown failure',
    // Cómo se lee un atributo derivado en pantalla. Dentro de la credencial va
    // `true` o `false`, que es lo que un verificador puede leer sin saber en
    // qué idioma está la consola del banco (`displayAttribute`).
    yes: 'Yes',
    no: 'No',
  },

  /**
   * Los atributos del catálogo del padrón (`lib/customers.ts`).
   *
   * Los cuatro últimos son **derivados**: no son columnas, son la respuesta a
   * una pregunta cerrada sobre una fecha que no sale de la ficha. Se rotulan
   * como la pregunta que contestan —«Over 18», no «Age»—, porque eso es
   * literalmente lo que el titular va a ver que comparte.
   */
  attributes: {
    givenName: 'First name',
    familyName: 'Surname',
    accountLast4: 'Last four of the account',
    accountLast4Short: 'Account',
    supplyPointNumber: 'Supply point number',
    supplyPointNumberShort: 'Supply point',
    customerSince: 'Customer since',
    ageOver18: 'Over 18',
    ageOver21: 'Over 21',
    ageOver65: 'Over 65',
    customerOver5Years: 'Customer for over 5 years',
  },

  /**
   * Los rótulos de los tipos de credencial del padrón de te-api.
   *
   * La clave es el `type_key` tal cual. Lo que no esté aquí cae a
   * `CRM_TYPE_<CLAVE>_LABEL` y, sin ella, al propio `type_key`. Ver
   * `resolveCredentialType` en `lib/credential-profiles.ts`.
   */
  credentialTypes: {
    cliente: 'Bank customer',
    kyc: 'Identity check',
    customer: 'Account holder',
  },

  /** Los tres canales de entrega (`lib/delivery.ts`). */
  delivery: {
    emailLabel: 'Email',
    emailHint: 'To the email on file, from your own mailbox',
    emailPhrase: 'by email',
    linkLabel: 'Link',
    linkHint: 'You copy it and paste it wherever you need to',
    linkPhrase: 'by link',
    qrLabel: 'QR',
    qrHint: 'The customer is in front of you and scans it off this screen',
    qrPhrase: 'by QR',
    // El canal `app` ya no se ofrece —se fue con el portal—, pero su frase se
    // queda: el historial de la ficha todavía tiene filas suyas y hay que poder
    // leerlas. Ver `RETIRED_PHRASES` en `lib/delivery.ts`.
    appPhrase: 'in their customer area',
  },

  /**
   * Los cinco desenlaces (`lib/verification-status.ts`).
   *
   * ⚠ **`rejected` y `expired` no se pueden confundir al traducir.** Con el
   * primero el agente corta la llamada —es un aviso de fraude— y con el segundo
   * vuelve a intentarlo. Si una traducción los acerca, la pantalla enseña dos
   * cosas distintas con las mismas palabras y el agente hace lo que no toca.
   */
  verdict: {
    pendingLabel: 'In progress',
    pendingDetail: 'Waiting for the holder to answer.',
    noAnswerLabel: 'No answer',
    noAnswerDetail: 'The deadline ran out and nobody answered.',
    verifiedLabel: 'Verified',
    verifiedDetail: 'They presented their credential and the check passed.',
    rejectedLabel: 'Rejected by the holder',
    rejectedDetail: 'They said from their wallet that it was not them. This is a fraud warning.',
    failedLabel: 'Credential not valid',
    failedDetail: 'This is not an "it is not me": the credential did not hold. It can be retried.',
    expiredLabel: 'No answer',
    expiredDetail: 'Nobody answered within the deadline.',
  },

  /** Fechas y plazos escritos con palabras (`lib/format.ts`). */
  time: {
    justNow: 'just now',
    secondsAgo: '{seconds} s ago',
    minutesAgo: '{minutes} min ago',
  },

  /** El listado de clientes. */
  customers: {
    eyebrow: 'Customer service',
    title: 'Customers',
    subtitle:
      'The customer roster belongs to this organisation and does not leave it. No TripleEnable system reads it.',
    newCustomer: 'Add a customer',
    loadFailed: 'The roster could not be read: {reason}',
    searchLabel: 'Search customers',
    searchPlaceholder: 'Name, identifier or email',
    searchPlaceholderWithReference: 'Name, identifier, email or {reference}',
    search: 'Search',
    clearFilter: 'Clear the filter',
    countOne: '{count} record',
    countMany: '{count} records',
    countForTerm: ' matching “{term}”',
    emptySearchTitle: 'No record matches',
    emptySearchBody:
      'The search looks at the full name, the identifier, the email and the record reference — and only within this organisation. There is no global directory to query.',
    emptySearchAction: 'See every record',
    emptyTitle: 'No customers yet',
    emptyBody:
      'Adding a customer creates the record the credential is later issued to. Without it there is nobody to issue to.',
    columnCustomer: 'Customer',
    columnContact: 'Contact',
    columnSince: 'Added',
    columnCredential: 'Credential',
    columnLastVerification: 'Last verification',
    offered: 'Offered',
    notOffered: 'not offered',
  },

  /** El alta de cliente. */
  customerNew: {
    title: 'Add a customer',
    subtitle:
      'The identifier is the one the credential will carry and the one they are recognised by afterwards. Once a credential has been issued with it, changing it orphans the link.',
    technical:
      'It is the credential <code>sub</code> and the <code>subjectReference</code> te-api uses to tie the holder to their profile, both when issuing and when requesting a presentation.',
  },

  /** El formulario de alta y su validación. */
  customerForm: {
    externalId: 'Customer identifier (the one that will go in the credential)',
    givenName: 'First name',
    familyName: 'Surname',
    email: 'Email',
    phone: 'Phone',
    accountLast4: 'Last four of the account',
    customerSince: 'Customer since',
    supplyPointNumber: 'Supply point number',
    birthDate: 'Date of birth',
    birthDateHint:
      'It never leaves this record. The credential carries only the answers — over 18, over 21, over 65 — never the date itself.',
    externalIdExample: 'AC-40218804',
    givenNameExample: 'Emma',
    familyNameExample: 'Whitfield',
    emailExample: 'emma@example.com',
    submit: 'Add customer',
    submitting: 'Saving…',
    checkFields: 'Check the highlighted fields.',
    duplicateField: 'already exists in this organisation',
    errorRequiredExternalId: 'the customer identifier is required',
    errorExternalIdCharset: 'letters, digits and . _ : - only (up to 128 characters)',
    errorRequiredGivenName: 'the first name is required',
    errorRequiredFamilyName: 'the surname is required',
    errorAccountLast4: 'exactly four digits',
    errorReferenceCharset: 'letters, digits and . / _ : - only (up to 64 characters)',
    errorCustomerSince: 'the date goes in YYYY-MM-DD format',
    errorBirthDate: 'the date goes in YYYY-MM-DD format',
    errorBirthDateFuture: 'a date of birth cannot be in the future',
    duplicate: 'there is already a customer with the identifier {externalId}',
  },

  /** La ficha del cliente. */
  customer: {
    customerSince: 'Customer since {date}',
    teApiWarning: 'TripleEnable could not be queried: {reason}',
    holderData: 'Holder details',
    identifier: 'Identifier',
    email: 'Email',
    phone: 'Phone',
    activityTitle: 'Identity activity',
    activityIntro:
      'What this console has done with this person’s identity, most recent first. It is the organisation’s own record: every line is something one of its employees did, with the time it happened.',
    activityEmpty:
      'Nothing has happened yet. Start by issuing their credential: without it there is nothing to check later.',
    activityOffer: 'Credential offered',
    activityOfferFrom: 'from',
    activityVerification: 'Identity verification',
    activityVerificationLink: 'see the verification',
    digitalIdentity: 'Digital identity',
    credential: 'Credential',
    credentialNeverOffered: 'Nothing has been offered yet',
    credentialOfferedOn: 'Offered on {date}',
    lastVerification: 'Last verification',
    neverVerified: 'Their identity has never been checked',
    honestyNote:
      '“Offered” is what this organisation did. <b>Whether the holder saved it, we do not know</b>, which is why there is no “credential active” badge here.',
    actionsTitle: 'What can be done',
    resumeVerification: 'Follow the verification in progress',
    resumeVerificationHint: 'Started at {time}.',
    issueCredential: 'Issue credential',
    issueCredentialHint: 'Create the offer and get it to them through one of the four channels.',
    verifyCaller: 'Verify who is calling',
    verifyCallerHint: 'Level 1 · that whoever is on the phone is the holder.',
    authoriseTransaction: 'Authorise transaction',
    authoriseTransactionHint: 'Level 2 · sign an amount. Not executable yet.',
    checkAge: 'Check they are over 18',
    checkAgeHint: 'One question. Their date of birth stays on their phone.',
    ceremonies: 'Verification catalogue',
    ceremoniesHint: '36 ready-made requests across 13 industries.',
    channelPhone: 'Alert to their phone',
    channelQr: 'At the counter',
    onBehalfOf: 'on behalf of {agent}',
  },

  /** La pantalla de emisión. */
  credential: {
    title: 'Issue credential',
    subtitle:
      'It is created by <b>this organisation</b>: what it carries comes from its own roster and from nowhere else. TripleEnable signs it in this entity’s name and delivers it to the holder’s wallet.',
    teApiWarning:
      'TripleEnable could not be queried, so it is not known what credentials this organisation can issue: {reason}',
    noTypesTitle: 'There is no type to issue',
    noTypesBody:
      'This organisation declares no credential type. Check it in <a>Diagnostics</a>: the catalogue is declared by TripleEnable, not by this console.',
    offerTitle: 'The offer',
    type: 'Credential type',
    typeOption: '{label} (max. {days} days)',
    validity: 'Validity in days (empty = the type’s cap)',
    withPin:
      'With a one-time code — without it, whoever receives the offer on whatever channel takes the credential',
    channelsLegend: 'How we send it',
    channelsNote:
      'All four deliver the same offer, with the same signature. The channel decides how it arrives, not whether it is trustworthy: that is decided by the issuer’s signature, and checked by the wallet.',
    send: 'Send offer',
    sending: 'Sending…',
    failed: 'issuing failed ({status})',
    noServer: 'the server could not be reached',
    offerCreated: 'Offer created',
    offerExpires: 'Expires on {date}.',
    mailTo: 'Email to {address}',
    mailIntro:
      'It opens in your own mail program, already written. It goes out in your name and not from an automated mailbox — which is what really happens when an agent calls.',
    mailOpenDraft: 'Open the draft',
    mailNote:
      'The one-time code is <b>not</b> in that text, and that is not an oversight: if it travelled in the same email as the link, whoever read the mailbox would have both halves.',
    walletLinkLabel: 'the offer',
    officialNumbersSent: 'Sent inside: {numbers}',
    offerId: 'Offer {id}',
    pinTitle: 'One-time code',
    pinNote:
      'Give it to them over the phone or in the branch, <b>never on the same channel as the link</b>. If they travel together, the code protects nothing.',
    payloadTitle: 'What it will carry',
    holder: 'Holder',
    identifier: 'Identifier',
    issuer: 'Issuer',
    noClaims: 'This record fills in no attribute of this type.',
    officialNumbers: 'Official numbers',
    officialNumbersMissing:
      'The entity’s official phone numbers have not been registered yet, so the credential will go out without them and the holder will not be able to check what number we are calling from. It can still be issued. To register them, talk to whoever runs the integration: the detail is in <a>Diagnostics</a>.',
    officialNumbersNote:
      'They travel signed inside the credential. The holder can check them with no call and no connection, which is why their wallet can say “one of the numbers your credential holds” instead of “your entity is calling you”.',
    contactNote:
      'The customer’s email and phone <b>do not go</b> into any credential: they are not in the disclosable attribute catalogue, and a field added “while we are at it” ends up in every presentation ever made with it.',
    format: 'Format',
  },

  /** El correo que compone el canal `email`. */
  mail: {
    subject: 'Your customer credential',
    greeting: '{name}, here is your customer credential.',
    open: 'Open it on the phone where you have your TripleEnable wallet:',
    codeNotice:
      'When you save it you will be asked for a numeric code. That code is NOT in this email: we tell you over the phone or hand it to you in the branch.',
    unexpected: 'If you did not ask for this credential, do not open the link and let us know.',
  },

  /** La pantalla que lanza una comprobación. */
  age: {
    /**
     * El rótulo de la **página**, que no es el de la tarjeta.
     *
     * Los dos decían lo mismo, uno debajo del otro: «Pedir a Teofilo que
     * demuestre que es mayor de edad» dos veces. La cabecera nombra el sitio
     * —como «Verificar identidad» en la hermana— y la tarjeta nombra lo que se
     * va a hacer.
     */
    pageTitle: 'Age check',
    title: 'Ask {holder} to prove they are over 18',
    body:
      'One question, one answer. Their date of birth stays on their phone: only the yes or no travels.',
    noWallet:
      'This customer has no wallet linked with us, so there is no phone to ask. The request will be created and will simply expire.',
    typeLabel: 'Credential',
    typeHelp: 'The credential of this organisation that carries their age.',
    reasonLabel: 'Why (optional)',
    reasonPlaceholder: 'Buying age-restricted goods',
    reasonHelp:
      'They will read this next to the question. Say why you are asking — do not ask them for anything here.',
    ask: 'Ask',
    asking: 'Asking…',
    askedTitle: 'Asked',
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
    asked: 'Asked. They answer on their phone, not here — tell them to open the app.',
    follow: 'Follow it',
  },
  transfer: {
    title: 'Authorise a transfer for {holder}',
    noWallet:
      'This customer has no wallet linked with us, so there is no phone to ask. The request will be created and will simply expire.',
    amountLabel: 'Amount',
    amountPlaceholder: 'EUR 1,240.00',
    amountHelp:
      'Write it as the customer should read it, with its currency. It is the biggest thing on their screen and the button says it.',
    destinationLabel: 'To',
    destinationPlaceholder: 'ES91 2100 0418 4502 0005 1332',
    destinationHelp: 'The account they can recognise. It goes into what they sign.',
    previewTitle: 'What they will read',
    previewAmount: 'Amount',
    previewDestination: 'To',
    ask: 'Ask them to authorise',
    asking: 'Asking…',
    askedTitle: 'Asked',
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
    asked: 'Asked. They authorise it on their phone, not here — tell them to open the app.',
  },

  /**
   * El catálogo de verificaciones.
   *
   * Aquí están sólo los **rótulos de la consola**. Los 36 casos —títulos,
   * problemas, campos y verbos— viven en `src/lib/ceremony-catalogue.ts` y **no
   * pasan por i18n**: son la carga que viaja a te-api y que el titular lee en su
   * teléfono, así que van en inglés como los rótulos de la transferencia y los
   * de la puerta de edad. Ver la cabecera de ese fichero.
   */
  ceremonies: {
    pageTitle: 'Verification catalogue',
    pageSub:
      '{cases} ready-made requests across {industries} industries. Pick one and it goes to {holder}’s phone exactly as shown.',
    /**
     * La línea que evita la confusión de toda la pantalla.
     *
     * Los casos están escritos para una notaría, un hospital o una eléctrica, y
     * ese nombre no viaja: te-api copia el del partner que trae el token. Lo que
     * se demuestra es la forma de la ceremonia, no que el banco sea un hospital.
     */
    askerNote:
      'These cases were written for other kinds of organisation. Whoever is asking is still {organization}: what this shows is the shape of the ceremony, not that the bank is a hospital.',
    noWallet:
      'This customer has no wallet linked with us, so there is no phone to ask. Requests will be created and will simply expire.',
    industriesLabel: 'Industries',
    writtenFor: 'Written for {organization}',
    previewTitle: 'What they will read',
    /** `account.change.v1`, `custody.handover.v1` y `agent.identify.v1`. */
    noHero: 'No hero: this screen is carried by the pair below, not by one value.',
    flagTitle: 'What this framework does not do:',
    send: 'Send this request',
    sending: 'Sending…',
    sent: 'Sent. They answer on their phone, not here — tell them to open the app.',
    industryDoc: 'Documents',
    industryPro: 'Professional',
    industryHealth: 'Health',
    industryEdu: 'Education',
    industryHr: 'Workplace',
    industryLog: 'Logistics',
    industryIns: 'Insurance',
    industryRe: 'Property',
    industryGov: 'Public sector',
    industryMob: 'Mobility',
    industryRetail: 'Retail',
    industryEnergy: 'Energy',
    industryTelco: 'Telecom',
  },
  verify: {
    title: 'Verify identity',
    phone: 'Phone',
    teApiWarning:
      'TripleEnable could not be queried, so it is not known what can be asked of them: {reason}',
    noTypesTitle: 'There is nothing to check',
    noTypesBody:
      'This organisation declares no credential type. Check it in <a>Diagnostics</a>: the catalogue is declared by TripleEnable, not by this console.',
    levelIdentity: 'Verify who is calling',
    levelIdentityHint: 'Level 1 · that it is them on the phone',
    levelTransaction: 'Authorise transaction',
    levelTransactionHint: 'Level 2 · sign an amount · not yet',
    requestTitle: 'What they are asked for',
    requestIntro:
      'They will be sent a request <b>signed in this entity’s name</b>, and their wallet will check that signature before showing anything. The verification is done by TripleEnable: this organisation does not have to hold any key.',
    type: 'Credential type',
    claimsLegend: 'Attributes',
    claimsEmpty:
      'This type carries no attribute that this record can fill in, so there is nothing to ask for. Check the record, or the type profile in the configuration.',
    claimsNote:
      'Only what is needed is asked for: <b>what is not ticked does not leave the holder’s wallet</b>, and whatever their wallet shows beyond that does not reach here either.',
    claimsTechnical:
      'They are asked for by name in the presentation session and te-api returns the intersection of what was asked and what the wallet disclosed.',
    alertTitle: 'How they are alerted',
    /*
     * DE QUÉ VA LA LLAMADA — el héroe de la pantalla del titular.
     *
     * Los rótulos viven en la tarjeta del aviso y no en la de arriba porque el
     * asunto no es un atributo de la credencial: es lo que la persona lee para
     * decidir si aprueba. Viaja en la petición del marco por los dos canales.
     *
     * El marcador de posición es un ASUNTO, no una instrucción, y eso no es
     * decoración. El texto lo escribe un agente y lo lee alguien a quien acaban
     * de llamar por teléfono: el ejemplo que vea en el hueco es el que va a
     * imitar, y «un pago con tarjeta que no reconoce» enseña a describir la
     * llamada donde «confirma tu clave» enseñaría a pedir. Es lo único que esta
     * consola puede hacer al respecto — el texto sigue siendo libre, y lo que
     * impide que se lea como la frase del sistema es que la plantilla pinta el
     * asunto APARTE del enunciado, no que aquí se filtre nada.
     */
    callSubject: 'What the call is about',
    callSubjectPlaceholder: 'A card payment you did not recognise',
    callSubjectHint:
      'The first line they read on their phone, and what they say yes or no to. <b>Say what the call is about \u2014 never ask them for anything here</b>: no codes, no passwords, no card numbers.',
    callCase: 'Case reference',
    callCasePlaceholder: 'CASE-2026-4471',
    callCaseHint: 'Optional. Only if they can check it against something you already sent them.',
    alertPhone: 'They are on the phone · alert their mobile',
    alertPhoneBusy: 'Alerting…',
    alertQr: 'They are in front of you · show a code',
    alertQrBusy: 'Requesting…',
    /**
     * El hecho, no el síntoma. Antes esta pantalla decía «We have alerted their
     * mobile» y arrancaba una cuenta atrás de cinco minutos para un aviso que
     * no había salido: te-api contesta 200 igual, y sin cartera vinculada nace
     * un señuelo que caduca solo. Ahora se dice antes de disparar, y se manda
     * al canal que sí funciona.
     */
    alertNoWallet:
      '<b>{name} has no wallet linked to this entity</b>, so there is nobody to send the request to — neither on the phone nor at the counter, because both go to the wallet. Issue them a credential: they are linked once they accept it in their wallet.',
    alertPhoneNoWallet: 'No wallet to alert',
    requestFailed: 'the request failed ({status})',
    noServer: 'the server could not be reached',
    previewTitle: 'What reaches them',
    callSubjectPreview: 'They read first',
    callSubjectPreviewEmpty: 'Nothing yet. Say what the call is about.',
    onBehalfOf: 'On behalf of',
    onBehalfOfValue: '{name}, agent {id}',
    about: 'About',
    willBeAsked: 'They will be asked for',
    willBeAskedEmpty: 'Nothing yet. Tick at least one attribute.',
    sayItNote:
      '<b>Tell them out loud that you have sent it and under what name.</b> That what they hear on the phone is what they read on their phone screen is half the check — the other half is put there by their wallet’s signature.',
    agentNameNote:
      'The agent name is <i>informative</i>: nobody verifies it and it decides nothing. What cannot be forged is that the request comes signed by this organisation, and that is what their wallet checks before showing anything.',
    transactionUnavailable: 'Level 2 cannot be executed yet, and this screen does not simulate it.',
    transactionBody:
      'Authorising a transaction is <b>a different ceremony</b>, not the same one relabelled: the holder has to see the amount, sign it — so that the signature covers what they read — and type four digits that can only have arrived through the voice of whoever is calling them. Sending the level 1 ceremony under this name would teach everybody to authorise transfers by swiping, which is exactly what the two ceremonies exist to prevent.',
    transactionMeanwhile:
      'In the meantime, to confirm that whoever is on the phone is the holder, use level 1. It authorises no transaction and it says so: that is what separates this ceremony from a permission.',
    transactionTechnicalSummary: 'Show technical detail · what is missing and where',
    transactionWallet: 'Wallet',
    transactionWalletDetail:
      'OID4VP <code>transaction_data</code> in the KB-JWT, and refusing to sign if it does not match what was painted. It is the only new cryptography work in the plan.',
    transactionDigits: 'te-api · the four digits',
    transactionDigitsDetail:
      'It already mints them in <code>createWakeup</code>, but they do not come out: they are needed in the response of <code>POST /v1/b2b/wakeups</code> — so this CRM can show them — and in <code>GET /v1/requests/pending</code> — so the wallet can ask for them —, and <code>POST /v1/requests/:id/outcome</code> has to check them and kill the challenge on the first failure.',
    transactionOperation: 'te-api · the transaction',
    transactionOperationDetail:
      'The wake-up carries no amount and no recipient. Without them there is nothing to summarise inside the <code>transaction_data</code>.',
  },

  /** El listado de comprobaciones. */
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
  /**
   * La pantalla de ajustes: lo que antes era el `.env`.
   *
   * Es texto de quien despliega, no de mostrador, así que se permite nombrar
   * mecanismos —`did:web`, scopes, el `aud`— que en las pantallas de atención
   * estarían fuera de sitio. Lo que NO lleva son nombres de variables de
   * entorno: ya no se leen, y decirlos aquí mandaría a alguien a cambiar algo
   * que no hace nada.
   */
  settings: {
    eyebrow: 'Integration',
    title: 'Settings',
    subtitle:
      'Everything this installation needs to talk to TripleEnable. It is stored in this CRM\u2019s own database, so a freshly published deployment is configured from here and nowhere else.',

    stateConfigured: 'This installation is configured. The checks at the bottom say whether it works.',
    stateIncomplete: 'Not configured yet. Still missing: {fields}.',
    missing: {
      orgId: 'Logto organization ID',
      displayName: 'organization name',
      domain: 'domain',
      m2mClientId: 'machine-to-machine client ID',
      m2mSecret: 'machine-to-machine client secret',
      referenceClaim: 'sector reference',
      issuerUrl: 'te-api base URL',
    },

    databaseDown: 'The settings could not be read: {reason}',
    databaseDownNote:
      'This is the one failure this screen cannot fix by itself. Check DATABASE_URL and run the migrations.',

    webhookUrlTitle: 'This installation receives webhooks at',
    webhookUrlNoDomain:
      'Set the domain below first. The webhook address is built from it, and so is the did:web this organization signs with.',
    webhookUrlNote:
      'Paste it in the TripleEnable console, under <b>Credentials \u2192 Webhook</b>. Registering it hands back the signing secret, and that is the only time it is shown in full \u2014 it goes in the field below.',

    sourceTitle: 'Where these values come from',
    sourceRule: 'The rule',
    sourceRuleDetail:
      '<b>The database is the source of truth.</b> What is saved here is what runs. There is no second place to look.',
    sourceEnv: 'Environment variables',
    sourceEnvSeeded:
      'This installation was <b>seeded from the environment</b> on its first boot, which is why the fields came filled in. From that moment the environment is no longer read: <b>changing a variable and redeploying does nothing.</b>',
    sourceEnvIgnored:
      'Not read. They can only seed an installation whose settings row does not exist yet \u2014 this one already has one.',
    sourceRequired: 'Still required in the environment',
    sourceRequiredDetail:
      '<code>DATABASE_URL</code>, and nothing else. It is where all of this is stored, so it cannot be stored inside it.',

    noAuthWarning:
      '<b>This console has no login.</b> Anyone who can reach this address can open this screen. Secrets are write-only \u2014 they are never shown again, only their fingerprint \u2014 but until employee sign-in exists, do not leave an installation holding real secrets on a public address without something in front of it.',

    identityTitle: 'Who this installation is',
    identityNote:
      'The organization in Logto that this CRM issues and verifies on behalf of. Its administrator creates it in the TripleEnable console.',
    orgId: 'Logto organization ID',
    orgIdNote:
      'Changing it does not migrate anything: the existing customers, verifications and events stay attached to the old one.',
    displayName: 'Organization name',
    displayNameExample: 'Northwind Bank',
    displayNameNote: 'For this console only. The legal name is whatever te-api states.',
    domain: 'Domain',
    domainNote:
      'No scheme. This is the installation\u2019s identity: the did:web it publishes and the webhook address above are both built from it.',
    referenceClaim: 'Sector reference',
    referenceChoose: 'Choose one',
    referenceNote:
      'The field the holder recognises the relationship by. It is the only one the new-customer form offers, so the wrong one puts another trade\u2019s box in front of an agent.',
    officialNumbers: 'Official phone numbers',
    officialNumbersNote:
      'Comma separated. They travel inside the signed credential, so a wrong one is worse than none.',

    machineTitle: 'Machine-to-machine application',
    machineNote:
      'What authenticates this installation against te-api. It is the only application it declares, and it authenticates a server — never a person.',
    m2mClientId: 'Client ID',
    m2mSecret: 'Client secret',
    m2mSecretNote:
      'Shown in full only once, when the console creates it. Its fingerprint is computed the same way there and here, so the two can be compared by eye.',

    webhookSecretTitle: 'Webhook signing secret',
    webhookSecretIntro:
      'What separates an event from te-api from a POST written by anybody. Without it every delivery is refused \u2014 there is no accept-without-checking mode.',
    webhookSecret: 'Signing secret',
    webhookSecretNote:
      'Paste it exactly as the console handed it over, prefix included. It is an opaque string, not encoded key material: stripping the prefix or decoding the tail produces a different MAC and every delivery is refused.',

    brandTitle: 'Brand',
    brandNote:
      'Two colours and a monogram. The accent goes on white; the surface is the sidebar. Status colours are not brand and are not set here.',
    brandAccent: 'Accent',
    brandSurface: 'Surface',
    brandMonogram: 'Monogram',

    platformTitle: 'Platform addresses',
    platformNote:
      'The same for every installation of the product, so they come pre-filled and are rarely touched. They are here so a test Logto is possible without an environment variable.',
    logtoEndpoint: 'Logto endpoint',
    teApiBaseUrl: 'te-api base URL',
    b2bResource: 'B2B resource indicator',
    b2bResourceNote:
      'The aud te-api demands. It must match te-api\u2019s own value character by character \u2014 one trailing slash and the token is for another resource.',
    b2bScope: 'Scopes requested',
    b2bScopeNote:
      'Space separated. Logto silently trims whatever the organization role does not grant, with no error, so what was actually obtained is the scope on the token \u2014 the connection check below shows it.',

    save: 'Save settings',
    saving: 'Saving\u2026',
    saved: 'Saved. The checks below now run against these values.',
    checkFields: 'Some fields need looking at.',
    required: 'Required',
    domainInvalid: 'A bare host name, like bank.demo-te.com. No path, no query.',
    referenceInvalid: 'Choose one of: {values}',
    colourInvalid: 'A hex colour: #rgb, #rrggbb, or rrggbb without the hash.',
    brandPair: 'Both colours together, or neither. Half a brand reads as a half-painted screen.',
    monogramTooLong: 'One or two characters. More than that is a smudge at 32 pixels.',
    urlInvalid: 'An absolute http or https address.',
    secretWhitespace: 'That value has a space in it. Paste it again without leading or trailing space.',
    secretLooksLikeFingerprint:
      'That looks like a fingerprint, not a secret. The fingerprint is what a console shows instead of the secret; it cannot be used to sign anything.',
    secretMissing: 'Not set',
    secretKeep: 'Leave blank to keep the current one',
    secretPaste: 'Paste the secret',
    secretClear: 'Clear the stored secret when saving',
    fingerprintTitle: 'First 16 characters of the SHA-256 digest',
    saveFailed: 'The settings could not be saved. The detail is in the server log.',

    copy: 'Copy',
    copied: 'Copied',

    checkConnectionTitle: 'Check the connection to TripleEnable',
    checkConnectionNote:
      'Asks Logto for a token with the saved credentials and calls GET /v1/b2b/organization with it. It checks four things at once: the secret, the resource, the scopes, and whether this organization is enrolled. It tests what is saved, not what is typed above.',
    checkConnection: 'Check the connection',
    checking: 'Checking\u2026',
    checkConnectionOk: 'It answered. The integration is wired correctly.',
    checkConnectionOpaque:
      'te-api answers the same 404 to all of them on purpose: a bad token, an aud that does not match, a missing scope, an organization that is not enrolled, and a suspended one. The requestId is what its operator can look up.',
    checkScopes: 'Scopes on the token',
    checkTypes: 'Issuable types',

    checkWebhookTitle: 'Ask TripleEnable to call this CRM',
    checkWebhookNote:
      'The only direction that cannot be checked from in here, so it has to be asked for. te-api queues a webhook.test, signs it with this organization\u2019s secret and delivers it to the address it has registered. It is also the only delivery that goes out while a destination is on probation, and a 2xx is what promotes it.',
    checkWebhook: 'Send a test event',
    sending: 'Sending\u2026',
    checkWebhookSent:
      'Sent. It should land on the Events screen within a few seconds \u2014 pushed by te-api, not fetched by this CRM.',
    checkWebhookMismatch:
      'Sent, but the registered address is not this installation. The delivery is going somewhere else, so nothing will arrive here.',
    checkWebhookNotRegistered:
      'No webhook destination is registered for this organization yet, so there is nothing to test.',
    checkWebhookRegisterHint:
      'Register this address in the TripleEnable console, under Credentials \u2192 Webhook:',
    checkWebhookRegistered: 'Registered address',
    checkWebhookExpected: 'This installation',
    checkWebhookStatus: 'Destination status',
    checkWebhookEventId: 'Event id',
    checkWebhookDelivery: 'Delivery',
    checkWebhookNotQueued:
      'te-api recorded the event but queued no delivery: sending is switched off on that deployment.',
    checkWebhookSeeEvents: 'Open the events screen',
  },

  events: {
    eyebrow: 'Integration',
    title: 'Events received',
    subtitle:
      'What TripleEnable has pushed to this CRM, and whether its signature checked out. It is the half of the integration that happens with nobody watching.',
    loadFailed: 'The event log could not be read: {reason}',
    endpointTitle: 'This CRM receives at',
    endpointUrl: 'Webhook URL',
    endpointSecret: 'Signing secret',
    endpointSecretSet: 'Declared. Every delivery is checked against it.',
    endpointSecretMissing: 'Not declared, so every delivery is refused.',
    endpointSecretWhere: 'Set it in Settings',
    endpointNote:
      'Register the URL in the TripleEnable console, under Credentials → Webhook. It hands back the signing secret at that moment, and that is the only time it is shown in full.',
    emptyTitle: 'Nothing has arrived yet',
    emptyBody:
      'Once the URL above is registered in the console, a test event from there is the fastest way to confirm the address and the secret are the right ones.',
    emptyAction: 'Check the wiring',
    columnReceived: 'Received',
    columnType: 'Event',
    columnCustomer: 'Customer',
    columnSignature: 'Signature',
    columnPayload: 'Body',
    occurredAt: 'raised at {time}',
    outcome: 'outcome: {status}',
    signatureOk: 'Checked',
    signatureBad: 'Refused',
    eventId: 'Event id',
    deliveryId: 'Delivery id',
  },

  verifications: {
    eyebrow: 'Customer service',
    title: 'Verifications',
    subtitle:
      'Every time an agent asks a customer to prove who they are, a line is left here. It is written by this organisation; the outcome is stated by TripleEnable.',
    loadFailed: 'The record could not be read: {reason}',
    emptyTitle: 'Nobody has been checked yet',
    emptyBody:
      'A check is started from the customer record. It needs the holder to already have their credential: without it there is nothing to present.',
    emptyAction: 'Go to customers',
    columnCustomer: 'Customer',
    columnOutcome: 'Outcome',
    columnStarted: 'Started',
    columnChannel: 'Channel',
    columnAgent: 'Agent',
    columnAsked: 'Asked for',
    settledAt: 'known at {time}',
    channelPhone: 'On the phone',
    channelPhoneHint: 'alert to mobile',
    channelQr: 'At the counter',
    channelQrHint: 'request to their wallet',
  },

  /** La pantalla de una comprobación. */
  verification: {
    title: 'Identity verification',
    request: 'Request {id}',
    startedOn: 'Started on {date}',
    startedBy: 'By {name}, agent {id}',
    backToCustomer: 'Back to the record',
    panelTitle: 'The request',
    holder: 'Holder',
    holderGone: 'the record is no longer in the roster',
    requiredCredential: 'Credential required',
    requestedClaims: 'Attributes requested',
    howAlerted: 'How they were alerted',
    alertedPhone: 'Alert to their mobile · they were on the phone',
    alertedQr: 'Request to their wallet · they were in front of us',
    requiredIssuer: 'Issuer required',
    panelNote:
      'The check is done by TripleEnable. This organisation does not have to run or hold any verifier: it asks the question and reads the answer.',
    protocol: 'Protocol',
    requiredType: 'Type required',
    walletCollectsAt: 'The wallet collects it at',
  },

  /** El escenario: la espera y los cinco desenlaces. */
  stage: {
    waitingTitle: 'Waiting for the holder',
    waitingPhone: 'We have alerted their mobile. Ask them to open the app and confirm.',
    waitingQr: 'Show them the code. They have to scan it with their wallet and confirm there.',
    overdueTitle: 'No answer',
    overdueBody: 'The deadline ran out and nobody answered. You can try again from here.',
    verifiedTitle: 'They are who they say they are',
    verifiedBody:
      'They have presented their credential and the verification passed. You can continue with the transaction.',
    rejectedTitle: 'The holder says it was not them',
    rejectedBody:
      'They have <b>rejected the request from their wallet</b>. Do not continue with the transaction and file the fraud alert: if you are talking to somebody and the holder says no, there are two different people.',
    failedTitle: 'The credential did not hold',
    failedBody:
      'This is not an “it is not me”: it is the credential failing — expired, revoked or belonging to another holder. It can be tried again.',
    expiredTitle: 'Expired with no answer',
    expiredBody: 'Nobody answered within the deadline. You can try again from here.',
    expiredCaveat:
      'A report from the holder — “I am not on any call” — looks today exactly like an expired deadline. If you are suspicious, ask them.',
    polling: 'Checking whether they have answered',
    holder: 'Holder',
    customerNumber: 'Customer number',
    holderGone: 'the record is no longer in the roster',
    signedAt: 'Signed at',
    knownAt: 'We knew at',
    retry: 'Try again',
    retrying: 'Starting another…',
    askSomethingElse: 'Ask for something else',
    expiresIn: 'The request expires in {countdown}.',
  },

  /** La línea de tiempo y el recibo. */
  tracker: {
    codeTitle: 'Their code',
    inboxTitle: 'Where the request is',
    inboxBody:
      'On their phone, in the TripleEnable app: it opens from the notification, and it keeps waiting inside the app if they dismissed it. There is no code on this screen — this deployment has the code channel switched off.',
    wakeupUnconfirmed:
      'That their mobile rang <b>is confirmed by nobody</b>. If they do not answer, ask them whether they have the app installed instead of assuming it.',
    wakeupTechnical:
      'Alert <code>{id}</code>. te-api answers the same whether the holder has a wallet or not, and that is deliberate: if it distinguished, this screen could be used to find out who has the app by trying identifiers.',
    timelineTitle: 'Status',
    milestoneCreated: 'Request created',
    milestoneCreatedHint: 'signed in this entity’s name',
    milestoneWakeup: 'Alert sent to their mobile',
    milestoneWakeupHint: 'the alert went out; that their mobile rings is confirmed by nobody',
    milestoneWaiting: 'Waiting for their answer',
    milestoneWaitingHint: 'It expires on its own when it reaches zero; then you have to alert again.',
    milestoneSigned: 'Signed from their wallet',
    milestoneSignedHint: 'their phone’s clock, not this console’s',
    milestoneOverdue: 'The deadline ran out',
    milestoneOverdueHint: 'time at which the request expired',
    milestoneSettledHint: 'time at which this console knew',
    outcomeVerified: 'They confirmed from their wallet',
    outcomeRejected: 'They said it was not them',
    outcomeFailed: 'The credential did not hold',
    outcomeExpired: 'Expired with no answer',
    architectureNote:
      'This screen <b>does not talk to TripleEnable</b>: it asks this organisation’s own server every {seconds} seconds (<code>GET /api/credentials/present</code>), and that server answers from its own database. <b>It does not query te-api either</b>: the outcome reaches it on its own, over a signed webhook (<code>POST /api/webhooks/te-api</code>), which is how any line-of-business system finds out. That is checked by opening the network tab.',
    verifierNote:
      'The request was opened in TripleEnable’s verifier, signed with this organisation’s DID. It has no verifier of its own and no verification key.',
    pollFailed: 'the query failed ({status})',
    retryFailed: 'another one could not be started ({status})',
    noServer: 'the server could not be reached',
    receiptTitle: 'Receipt · what {organization} keeps',
    receiptConfirmed: 'Confirmed',
    receiptConfirmedAt: '{time} · time at which this console knew',
    receiptRequest: 'Request',
    receiptRequiredCredential: 'Credential required',
    receiptRequiredIssuer: 'Issuer required',
    receiptRequiredHolder: 'Holder required',
    receiptHolderKey: 'Holder key',
    receiptHolderLink: 'Holder link',
    receiptSignedAt: 'Signed by the holder',
    receiptKeyBinding: 'Presentation signature',
    receiptDisclosed: 'What they showed',
    receiptGuarantee:
      '<b>Verified against the issuer and against the holder.</b> The signature was put there by the holder’s wallet; this receipt is what {organization} files about the check.',
    receiptFormat: 'Format',
    receiptFormatValue: '<code>SD-JWT VC</code> presented over <code>OID4VP</code>',
    receiptRequiredType: 'Type required',
    receiptDisclosedClaims: 'Attributes disclosed',
    receiptSignature: 'Signature',
    receiptSignatureValue:
      'that of the <code>KB-JWT</code>, which ties this presentation to the holder’s key',
    receiptHolderKeyJwk: 'Holder public key',
    receiptNonce: 'Nonce',
    receiptAudience: 'Audience',
    receiptSdHash: 'SD hash',
    receiptProofNote:
      'These four are what lets anybody re-check the <code>KB-JWT</code> without asking this organisation or TripleEnable for anything: the key that signed it, the challenge it answers, the verifier it was signed for, and the hash that ties it to this presentation and to no other.',
  },

  /** El enlace que abre la cartera. */
  wallet: {
    open: 'Open in the wallet',
    copy: 'Copy link',
    copied: 'Link copied',
    note:
      '“Open in the wallet” works on the device where it is installed. From this browser, if it is not there, nothing happens: copy {label} and open it there.',
  },

  /** Diagnóstico. */
  diagnostics: {
    eyebrow: 'Integration',
    title: 'Diagnostics',
    subtitle:
      'This call goes out from the CRM server with the organisation’s M2M token. There is no employee session involved: clear the cookies and it answers the same.',
    incomplete: 'The CRM configuration is incomplete: {reason}',
    wiringTitle: 'How this console talks to TripleEnable',
    whoCalls: 'Who calls',
    whoCallsDetail:
      'The server of this CRM, never the agent’s browser. Neither the M2M token nor the secret that requests it reach the workstation: it is checked by opening the network tab.',
    issuing: 'Issuing',
    issuingDetail:
      '<code>POST /v1/b2b/credentials</code>. The claims are composed by this server reading the roster record; only the customer identifier comes from the browser.',
    verifying: 'Verifying',
    verifyingDetail:
      '<code>POST /v1/b2b/presentations</code> opens the session in TripleEnable’s verifier and returns the <code>OID4VP</code> link. This organisation has no verifier and no verification key.',
    waking: 'Alerting the mobile',
    wakingDetail:
      '<code>POST /v1/b2b/wakeups</code>. The response is the same whether the holder has a wallet or not — deliberately: if it distinguished, it could be used to find out who has the app by trying identifiers — so it does not confirm that anything rang.',
    following: 'Following a verification',
    followingDetail:
      'This server <b>does not ask te-api whether a verification has finished</b>. The outcome arrives on its own, over a signed webhook to <code>POST /api/webhooks/te-api</code>, and is written to this organisation’s journal. The ceremony screen reads that journal every 3 s, without leaving here.',
    roster: 'The customer roster',
    rosterDetail:
      'It does not leave here. It lives in this CRM’s own database and neither te-api nor Logto ever read it; the only thing that travels about a customer is what is signed inside their credential.',
    localConfigTitle: 'Local configuration',
    organization: 'Organisation',
    name: 'Name',
    domain: 'Domain',
    didPublished: 'did:web published',
    didNone: 'none yet · te-api holds no key for this organisation, so /.well-known/did.json answers 404',
    officialNumbers: 'Official numbers',
    officialNumbersNone: 'none declared ·',
    issuerBase: 'te-api (issuing)',
    verifierBase: 'te-api (verification)',
    brand: 'Brand',
    brandNone: 'the default palette ·',
    setInSettings: 'set it in Settings',
    orgChoiceTitle: 'One installation, one organisation',
    whoChooses: 'Where it comes from',
    whoChoosesDetail:
      'From this installation’s own settings row, written on the <b>Settings</b> screen. The request cannot change it: the <code>Host</code> header decides nothing here, which is what makes the answer to “whose screen is this?” the same on every request.',
    twoTenants: 'To serve a second company',
    twoTenantsDetail:
      'Publish the application a second time with a different configuration. It is the same image: what changes is the environment, its domain and its database. Nothing is shared, so nothing one company does can reach the other.',
    didNoFallback: 'The DID document',
    didNoFallbackDetail:
      '<code>/.well-known/did.json</code> is always composed with the declared domain, so its <code>id</code> is the same DID whatever the request says. It answers <b>404</b> while te-api holds no key: an organisation that has not switched on issuing has no issuer identity to publish.',
    webhookTitle: 'Events pushed to this CRM',
    webhookUrl: 'Webhook URL',
    webhookUrlNote: 'Register it in the console, under Credentials → Webhook.',
    webhookSecret: 'Signing secret',
    webhookSecretSet: 'declared · every delivery is checked against it',
    webhookSecretMissing: 'not declared, so every delivery is refused ·',
    webhookReceived: 'Received',
    webhookTally: '{total} in total, {rejected} refused',
    webhookNever: 'none yet',
    webhookLast: 'last one {time}',
    webhookLink: 'See the events',
    databaseTitle: 'The CRM database',
    connection: 'Connection',
    connectionOk: 'It answers.',
    connectionUnknownError: 'the database does not answer',
    customerCount: 'Customers of this organisation',
    teApiTitle: 'What te-api says',
    teApiScopes: 'token scopes',
    teApiIssuableTypes: 'types it can issue',
    teApiTypes: '{type} (max. {days} d)',
    localeTitle: 'Interface language',
    localeChosenBy: 'Who chooses',
    localeChosenByDetail:
      'Whoever is looking at the screen, from the sidebar. It is stored in the <code>crm_locale</code> cookie and applies to this browser only: it is not an environment variable, so changing it needs neither a rebuild nor a redeploy.',
    localeActive: 'Active language',
    localeFallback: 'Fallback',
    localeFallbackDetail:
      'English. A key with no translation is shown in English; the key name is never painted on screen.',
  },

  /** Lo que se le dice a un agente cuando algo no ha cargado. */
  errors: {
    misconfigured:
      'This console is not configured yet and cannot show the organisation’s data. Whoever runs the integration sets it up on the Settings screen, which says exactly what is missing.',
    generic:
      'We could not load the data right now. Try again in a moment; if it stays the same, let whoever runs the integration know — the detail is in Diagnostics.',
    shortRetry: 'try again in a moment, and if it stays the same look at Diagnostics.',
    customerNotFound: 'that customer is not in the roster',
    customerNoEmail: 'this record has no email: choose another channel or add one to the roster',
    missingFields: 'externalId or type is missing',
    badDelivery: 'delivery has to be one of: {channels}',
    unknownType: '“{type}” is not a credential type of this organisation',
    transferAmountMissing: 'the amount is missing, and it is the biggest thing on their screen',
    transferAmountTooLong: 'the amount cannot be longer than {max} characters',
    transferDestinationMissing: 'the destination is missing: they would be authorising a transfer to nowhere',
    transferDestinationTooLong: 'the destination cannot be longer than {max} characters',
    transferUpstream: 'TripleEnable could not be asked for the approval. The detail is in Diagnostics.',
    ageReasonTooLong: 'the reason cannot be longer than {max} characters',
    ageReasonOneLine: 'the reason is one line on a phone screen: no line breaks',
    ageUpstream: 'TripleEnable could not be asked for the age check. The detail is in Diagnostics.',
    bodyNotJson: 'the body is not JSON',
    badChannel: 'channel has to be qr or phone',
    noClaimsRequested: 'at least one attribute has to be requested',
    missingCallSubject: 'the call subject is missing, and their phone would have nothing to show',
    callSubjectTooLong:
      'the call subject is one line on a phone screen: {max} characters at most',
    callCaseTooLong: 'the case reference cannot be longer than {max} characters',
    claimsNotCarried:
      'this customer’s “{label}” credential does not carry {claims}, so it cannot be requested',
    missingPresentationId: 'presentationId is missing',
    presentationNotFound: 'that check is not in this organisation’s journal',
    issueFailed: 'the credential could not be issued; check the server log',
    presentFailed: 'the request could not be sent; check the server log',
    teApiNotFound:
      'te-api rejected the call. The B2B gate answers the same for eight different reasons (token, resource, organisation, roster or scope), so the real reason is in te-api’s log{reference}.',
    /*
     * ESTE MENSAJE DABA UN CONSEJO FALSO, Y MANDABA A LA TERMINAL.
     *
     * Decía que se arreglaba «seeding the type in te-api again». No se
     * arregla: re-sembrar no puede crear un identificador que el emisor no
     * publica, así que el consejo mandaba a alguien a repetir un comando que no
     * podía funcionar.
     *
     * Y el motivo tampoco era el que parecía. No es que al padrón le falte el
     * `vct`: es que **cada formato se pide por una clave distinta** —`vct`,
     * `credential_definition.type`, `doctype`— y la plataforma todavía no
     * construye la consulta de todos. Hoy pide los `dc+sd-jwt` y los
     * `jwt_vc_json`; los `mso_mdoc` no.
     *
     * Así que el texto dice el hecho —se emite, no se puede pedir— y lo único
     * accionable: usar un tipo de los que sí se piden.
     */
    /**
     * El aviso que no salió, dicho como hecho y con la salida al lado.
     *
     * «connected service» y no «CRM»: el texto de producto no nombra la pieza
     * que lo pinta.
     */
    noWalletLink:
      'No request was sent: this customer has no wallet linked to your organisation, so there was nobody to send it to. Issue them a credential: they are linked once they accept it in their wallet.',
    teApiNoVct:
      'That credential type can be issued but not asked for back: the platform does not build a presentation request for its format yet. To verify this customer, use a credential type issued as SD-JWT or as a W3C JWT credential{reference}.',
    teApiCannotComplete:
      'The platform refused to complete this operation and does not say which of the possible reasons applies. The real one is in te-api’s log{reference}.',
    teApiUnavailable: 'The credential issuer is not operational right now{reference}.',
    teApiRateLimited: 'Too many requests for this organisation; wait a moment{reference}.',
    teApiBadRequest: 'te-api rejected the call data: {code}{reference}.',
    teApiOther: 'te-api answered {status} ({code}){reference}.',
    teApiReference: ' (requestId {requestId})',
    /**
     * Los tres del catálogo de verificaciones.
     *
     * Ninguno es accionable por el agente y los tres lo dicen: un caso que no
     * existe o un catálogo mal declarado son fallos de configuración, no cosas
     * que se arreglen volviendo a pulsar.
     */
    ceremonyUnknownCase: 'That case is not in the catalogue.',
    ceremonyNoCredentialType:
      'This case is signed with a credential and this organisation declares no credential type, so there is nothing to ask for.',
    ceremonyNoClaims:
      'This case is signed with a credential but names no attribute to present. It cannot be asked as it stands.',
    ceremonyUpstream: 'The request could not be sent. Check Diagnostics.',
  },
};

export type Messages = typeof en;
