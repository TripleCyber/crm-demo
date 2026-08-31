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
    fallbackTitle: 'CRM',
    fallbackDescription: 'Agent console and customer portal',
    description: 'Agent console and customer portal for {organization}',
  },

  /** La barra lateral de la consola. */
  nav: {
    groupService: 'Customer service',
    groupIntegration: 'Integration',
    customers: 'Customers',
    verifications: 'Verifications',
    diagnostics: 'Diagnostics',
    consoleFallbackName: 'Agent console',
    unconfigured: 'not configured',
    unconfiguredAgent: 'Console not configured. The detail is in Diagnostics.',
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
  },

  /** Los seis atributos del catálogo del padrón (`lib/customers.ts`). */
  attributes: {
    givenName: 'First name',
    familyName: 'Surname',
    accountLast4: 'Last four of the account',
    accountLast4Short: 'Account',
    policyNumber: 'Policy number',
    policyNumberShort: 'Policy',
    medicalRecordNumber: 'Medical record number',
    medicalRecordNumberShort: 'Record',
    customerSince: 'Customer since',
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
    asegurado: 'Policyholder',
    paciente: 'Patient',
  },

  /** Los cuatro canales de entrega (`lib/delivery.ts`). */
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
    appLabel: 'From our app',
    appHint: 'Waiting in the portal, already signed in',
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
    policyNumber: 'Policy number',
    medicalRecordNumber: 'Medical record number',
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
    channelPhone: 'Alert to their phone',
    channelQr: 'QR at the counter',
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
    portalTitle: 'Waiting in the portal',
    portalBody:
      'The offer is stored for this customer. They will see it when they sign in at <code>{url}</code> with their TripleEnable account, and only they see it: it is the only one of the four channels where whoever collects the offer is authenticated.',
    portalNote:
      'Tell them over the phone to sign in to their customer area. And the one-time code out loud, on this same call.',
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
    alertPhone: 'They are on the phone · alert their mobile',
    alertPhoneBusy: 'Alerting…',
    alertQr: 'They are in front of you · show QR',
    alertQrBusy: 'Requesting…',
    requestFailed: 'the request failed ({status})',
    noServer: 'the server could not be reached',
    previewTitle: 'What reaches them',
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
    channelQrHint: 'QR on screen',
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
    alertedQr: 'QR on screen · they were in front of us',
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
    walletTitle: 'Open in the wallet',
    walletLinkLabel: 'the request',
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
      'This screen <b>does not talk to TripleEnable</b>: it asks this organisation’s own server every {seconds} seconds (<code>GET /api/credentials/present</code>), and it is that server that queries te-api (<code>GET /v1/b2b/presentations/:id</code>) with the organisation’s token. Neither the token nor the secret that requests it reach the browser, and that is checked by opening the network tab.',
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
      'The ceremony screen polls this same server every 3 s and it is that server that queries <code>GET /v1/b2b/presentations/:id</code>. Three seconds and not one because the B2B gate carries a per-organisation rate bucket shared with issuing.',
    roster: 'The customer roster',
    rosterDetail:
      'It does not leave here. It lives in this CRM’s own database and neither te-api nor Logto ever read it; the only thing that travels about a customer is what is signed inside their credential.',
    localConfigTitle: 'Local configuration',
    organization: 'Organisation',
    name: 'Name',
    domain: 'Domain',
    domainMissing: 'not declared · CRM_ORG_<SLUG>_DOMAIN is missing',
    didPublished: 'did:web published',
    didNone: 'none · /.well-known/did.json answers 404',
    officialNumbers: 'Official numbers',
    officialNumbersNone: 'none declared · ',
    issuerBase: 'te-api (issuing)',
    verifierBase: 'te-api (verification)',
    customerPortal: 'Customer portal',
    portalUndeclared: 'no application declared · ',
    orgChoiceTitle: 'How the organisation is chosen',
    whoChooses: 'Who chooses',
    whoChoosesDetail:
      'The domain the request came in on. Each organisation declares its own in <code>CRM_ORG_<SLUG>_DOMAIN</code>, and a single deployment answers on all three.',
    unknownDomain: 'If the domain belongs to nobody',
    unknownDomainDetail:
      '<code>CRM_ACTIVE_ORG_ID</code> is used, which is a decision written by whoever deploys. In production it is not set: without it, an address that matches no organisation says so instead of showing the first one’s roster.',
    didNoFallback: 'The DID document has no fallback',
    didNoFallbackDetail:
      '<code>/.well-known/did.json</code> answers <b>404</b> on a domain that belongs to no organisation. Serving another organisation’s document would publish its identity on a domain that is not its own.',
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
      'Whoever is looking at the screen, from the sidebar. It is stored in the <code>crm_locale</code> cookie and applies to this browser only: it does not depend on the domain, which is what identifies the organisation, and it does not need a redeploy.',
    localeActive: 'Active language',
    localeFallback: 'Fallback',
    localeFallbackDetail:
      'English. A key with no translation is shown in English; the key name is never painted on screen.',
  },

  /** El portal del cliente. */
  portal: {
    header: 'Customer portal',
    fallbackName: 'Customer portal',
    titleGeneric: 'Your account',
    title: 'Your {organization} account',
    intro:
      'Link your account with your TripleEnable identity. From that moment on we can alert you on your mobile when something needs confirming, without calling you and without asking you for details by email.',
    signInTitle: 'Sign in to link',
    signInBody:
      'We take you to TripleEnable so you can confirm it is you. We never see your password at any point.',
    signIn: 'Sign in with TripleEnable',
    signInDisabled: 'Sign-in is disabled because configuration is missing. See the notice above.',
    linked: 'Your {organization} account is linked to your TripleEnable identity.',
    offerTitle: 'You have a credential waiting',
    offerBody:
      'We have issued it to you from customer service. Open it on the phone where you have your TripleEnable wallet and save it: from that moment on we can check that it is you without asking you for details over the phone.',
    offerSave: 'Save to my wallet',
    offerType: 'Type',
    offerExpires: 'Expires',
    offerPinNote:
      'It will ask you for a numeric code. We give it to you over the phone or in the branch, and <b>it never appears on this screen or in an email</b>: that is what stops this credential ending up on somebody else’s phone.',
    whoTitle: 'Who you are',
    signedInAs: 'You signed in as',
    verifiedEmail: 'Verified email',
    yourRecord: 'Your record at {organization}',
    account: 'Account',
    linkTitle: 'The link',
    linkReference: 'Reference',
    linkConfirmedAt: 'Confirmed on',
    linkPrevious: 'Previous link',
    linkPreviousReplaced: 'Replaced by this one.',
    linkNote:
      '{organization} does not know which TripleEnable identity is behind this, and TripleEnable does not know you are our customer: the only thing that exists is this reference. You can withdraw it from your wallet whenever you want.',
    supportTitle: 'For support',
    supportBody: 'If you call us, give us this reference: {requestId}',
    relink: 'Link again',
    signOut: 'Sign out',
    errorGeneric: 'Something did not go right.',
    errorNoPortal:
      'Signing in with TripleEnable is not available in this portal yet. If you need to link your account, call us and we will do it with you.',
    errorSessionLost:
      'The sign-in thread was lost. It usually happens when you come back with the “back” button or if the tab has been open for a long time. Start again.',
    errorState: 'The response does not correspond to this sign-in request. Start again.',
    errorProvider: 'We could not complete the sign-in. Try again.',
    errorExchange: 'We could not complete the sign-in with TripleEnable. Try again.',
    errorUnavailable:
      'This portal is not available right now. Try again in a while or call us.',
    linkNoEmail: 'TripleEnable did not give us your email, so we cannot find your customer record.',
    linkNoCustomer: 'We found no customer record with that email at {organization}.',
    linkFailedGeneric: 'We could not complete the link.',
    linkNoTeApi: 'We could not talk to TripleEnable right now.',
  },

  /** Lo que se le dice a un agente cuando algo no ha cargado. */
  errors: {
    misconfigured:
      'This console is only half configured and cannot show the organisation’s data. Let whoever runs the integration know: the detail is in Diagnostics.',
    generic:
      'We could not load the data right now. Try again in a moment; if it stays the same, let whoever runs the integration know — the detail is in Diagnostics.',
    shortRetry: 'try again in a moment, and if it stays the same look at Diagnostics.',
    customerNotFound: 'that customer is not in the roster',
    customerNoEmail: 'this record has no email: choose another channel or add one to the roster',
    missingFields: 'externalId or type is missing',
    badDelivery: 'delivery has to be one of: {channels}',
    unknownType: '“{type}” is not a credential type of this organisation',
    bodyNotJson: 'the body is not JSON',
    badChannel: 'channel has to be qr or phone',
    noClaimsRequested: 'at least one attribute has to be requested',
    claimsNotCarried:
      'this customer’s “{label}” credential does not carry {claims}, so it cannot be requested',
    missingPresentationId: 'presentationId is missing',
    issueFailed: 'the credential could not be issued; check the server log',
    presentFailed: 'the request could not be sent; check the server log',
    statusFailed: 'the verification status could not be read; check the server log',
    teApiNotFound:
      'te-api rejected the call. The B2B gate answers the same for eight different reasons (token, resource, organisation, roster or scope), so the real reason is in te-api’s log{reference}.',
    teApiNoVct:
      'te-api cannot ask for that credential type back: it is missing the `vct` in the organisation’s roster. It can be issued but not verified, and it is fixed by seeding the type in te-api again, not by retrying from here{reference}.',
    teApiLink:
      'te-api could not complete the link. The most common reason is that this account does not yet have a TripleEnable wallet registered; the real reason is in te-api’s log{reference}.',
    teApiUnavailable: 'The credential issuer is not operational right now{reference}.',
    teApiRateLimited: 'Too many requests for this organisation; wait a moment{reference}.',
    teApiBadRequest: 'te-api rejected the call data: {code}{reference}.',
    teApiOther: 'te-api answered {status} ({code}){reference}.',
    teApiReference: ' (requestId {requestId})',
  },
};

export type Messages = typeof en;
