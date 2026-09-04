import type { MessageKey } from '@/i18n/translate';

/**
 * **El catálogo de verificaciones: 36 casos, trece industrias.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESTO ES CARGA DE DEMOSTRACIÓN, NO UN FORMULARIO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Sale del artifact «Ceremony Catalogue», que es la especificación: cada caso
 * trae su plantilla, su héroe, sus pares y el verbo de su botón, y **los valores
 * de ejemplo son los buenos**. Se mandan tal cual.
 *
 * Por eso aquí no hay editor de campos y no debe haberlo: lo que el titular lee
 * entra en el texto que firma, y un catálogo con casillas editables sería otra
 * cosa —un compositor de peticiones— con otras preguntas de seguridad. Si algún
 * día hay que escribir estos valores, es otra tarea.
 *
 * ## Quién pregunta sigue siendo esta organización
 *
 * Los casos están escritos para una notaría, un hospital o una eléctrica
 * (`writtenFor`), y ese nombre **no viaja**: `POST /v1/requests` copia el nombre
 * del partner que trae el token, así que en el teléfono pone Banco Demo. Lo que
 * se demuestra es **la forma de la ceremonia**, no que el banco sea un hospital,
 * y la pantalla lo dice en una línea para que nadie se confunda al enseñarlo.
 *
 * ## Los textos van en inglés y no pasan por i18n
 *
 * `CLAUDE.md §5` manda que lo que ve el usuario nazca en inglés. Estos textos
 * son además **la carga**: `label` y `value` viajan a te-api y los lee el
 * titular en su teléfono, en su idioma y no en el de la consola —la misma regla
 * que ya siguen la transferencia y la puerta de edad—. Los rótulos de la
 * consola que envuelven al catálogo sí pasan por i18n; estos no, porque no son
 * de la consola.
 *
 * ## Las claves no se inventan: son el contrato
 *
 * El héroe y las obligatorias de cada plantilla salen de la tabla que comparten
 * te-api, la cartera y este CRM. Una clave que falte sale como
 * `missing_required_field` y una clave de más entra como par genérico —el
 * vocabulario es abierto—, pero **una clave desconocida nunca puede ser
 * héroe**: eso lo decide la plantilla, y por eso `style` se escribe aquí caso a
 * caso en vez de deducirse.
 */

/**
 * **Cómo se lee un valor.** Formato, nunca significado. El mismo de te-api.
 *
 * La cartera sólo elige tipografía con esto, así que la regla es la de la
 * lectura y no la del tipo de dato:
 *
 * - `mono` — **sólo lo que se coteja carácter a carácter contra algo que está
 *   fuera del teléfono**: un IBAN, la huella de un contrato, una referencia de
 *   expediente que se dicta por teléfono, la palabra que sale en las dos
 *   pantallas. Ahí la monoespaciada gana lo único que importa, que no es la
 *   anchura sino la forma: el cero partido y la ele con cola.
 * - `text` — todo lo que se **lee**: nombres de personas y de empresas,
 *   direcciones, motivos, cualquier frase. «Vellum Energy» en monoespaciada no
 *   se compara mejor; sólo se lee peor y parece un código.
 * - `numeric` — importes, fechas, horas, plazos y recuentos. Da cifras
 *   tabulares, que es lo que evita que una hora o un importe baile de ancho al
 *   cambiar.
 */
export type CeremonyFieldType = 'text' | 'mono' | 'numeric';

/**
 * **Cuánto pesa en la decisión.** Lo decide la plantilla, no quien pregunta.
 *
 * - `hero` — **como mucho uno por caso**, y no siempre: `account.change.v1` y
 *   `custody.handover.v1` no llevan ninguno a propósito, porque su decisión no
 *   cabe en un campo sino en el salto entre dos.
 * - `normal` — lo que hay que leer para decidir.
 * - `quiet` — lo que acompaña y se ojea: una comisión, quién lo tramitó, el
 *   motivo administrativo, una hora estimada. La cartera lo baja de peso y de
 *   tinta, y **ésa es la jerarquía**: sin `quiet`, seis datos pesan lo mismo y
 *   el que decide no se distingue del que rellena. Un caso con cinco o seis
 *   campos suele tener uno o dos.
 *
 * Y al revés: **una huella o un identificador que hay que comparar nunca es
 * `quiet`**. En tinta apagada se ojea, que es justo lo contrario de lo que se
 * le pide a quien lo lee.
 */
export type CeremonyFieldStyle = 'hero' | 'normal' | 'quiet';

/** Qué ejecuta te-api. Eje aparte de `signWith`. */
export type CeremonyKind = 'authenticate' | 'verify' | 'authorize' | 'present';

/** Qué prueba hace falta. */
export type CeremonySignWith = 'identity' | 'credential';

/** Un campo tal y como viaja en `fields`, y tal y como se pinta en la ficha. */
export interface CeremonyField {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly type: CeremonyFieldType;
  readonly style: CeremonyFieldStyle;
}

/** Una industria del catálogo. El rótulo sí pasa por i18n: es navegación. */
export interface CeremonyIndustry {
  readonly id: string;
  readonly labelKey: MessageKey;
}

export interface CeremonyCase {
  /** `doc.msa`. Estable: es lo que viaja del navegador a la acción. */
  readonly id: string;
  readonly industry: string;
  readonly title: string;
  /** Qué resuelve, en una línea. Es lo que se lee en la lista. */
  readonly problem: string;
  /**
   * La organización para la que el artifact lo escribió.
   *
   * **No se manda.** Está para que el agente sepa de qué sector es la forma que
   * está enseñando; quien pregunta es siempre esta organización.
   */
  readonly writtenFor: string;
  readonly template: string;
  readonly kind: CeremonyKind;
  readonly signWith: CeremonySignWith;
  /**
   * Los atributos que se le piden a la credencial, y **sólo** cuando se firma
   * con una.
   *
   * Firmar con credencial necesita una sesión de verificador —la credencial es
   * la prueba, y quien la comprueba es el verificador de TripleEnable, no este
   * CRM—, y una sesión necesita al menos un atributo. Es el mismo camino de dos
   * llamadas que ya hace la puerta de edad.
   */
  readonly claims?: readonly string[];
  readonly fields: readonly CeremonyField[];
  /** El verbo del botón que aprueba, tal cual lo lee el titular. */
  readonly verb: string;
  /** El verbo del que rechaza. */
  readonly deny: string;
  /**
   * Si negar pesa más que aprobar.
   *
   * Sólo `account.change.v1`, y es su razón de ser: es el cambio que abre todas
   * las demás cuentas, así que rechazar es un toque y es el botón primario
   * mientras aprobar es un deslizamiento largo debajo.
   */
  readonly denyLeads?: boolean;
  /**
   * Lo que este marco **no** hace y este caso roza.
   *
   * Va en la ficha y no en un pie de página: quien lo va a vender lo tiene que
   * leer antes de prometerlo. La lista completa está en
   * `docs/PLANTILLAS-QUE-VIENEN.md` §7 — sin quórum, sin enfriamiento, sin
   * campos de entrada, sin proximidad, sin mover dinero y sin servicio de
   * confianza cualificado.
   */
  readonly flag?: string;
}

export const CEREMONY_INDUSTRIES: readonly CeremonyIndustry[] = [
  { id: 'doc', labelKey: 'ceremonies.industryDoc' },
  { id: 'pro', labelKey: 'ceremonies.industryPro' },
  { id: 'health', labelKey: 'ceremonies.industryHealth' },
  { id: 'edu', labelKey: 'ceremonies.industryEdu' },
  { id: 'hr', labelKey: 'ceremonies.industryHr' },
  { id: 'log', labelKey: 'ceremonies.industryLog' },
  { id: 'ins', labelKey: 'ceremonies.industryIns' },
  { id: 're', labelKey: 'ceremonies.industryRe' },
  { id: 'gov', labelKey: 'ceremonies.industryGov' },
  { id: 'mob', labelKey: 'ceremonies.industryMob' },
  { id: 'retail', labelKey: 'ceremonies.industryRetail' },
  { id: 'energy', labelKey: 'ceremonies.industryEnergy' },
  { id: 'telco', labelKey: 'ceremonies.industryTelco' },
];

export const CEREMONY_CASES: readonly CeremonyCase[] = [
  /* ── Documents & legal ─────────────────────────────────────────────── */
  {
    id: 'doc.msa',
    industry: 'doc',
    title: 'A commercial contract',
    problem:
      'The agreement travels as a PDF and comes back with a squiggle drawn by a mouse. Nobody can show who moved the mouse.',
    writtenFor: 'Northwind Legal',
    template: 'doc.sign.v1',
    kind: 'authorize',
    signWith: 'identity',
    fields: [
      { key: 'document', label: 'Document', value: 'Master Services Agreement', type: 'text', style: 'hero' },
      { key: 'fingerprint', label: 'Fingerprint', value: '9F2C·4B71·A184', type: 'mono', style: 'normal' },
      { key: 'version', label: 'Version', value: 'Version 4 · 18 pages', type: 'text', style: 'normal' },
      { key: 'parties', label: 'Parties', value: 'Northwind Ltd · Cassia Foods', type: 'text', style: 'normal' },
      { key: 'signing_as', label: 'Signing as', value: 'Director, Cassia Foods', type: 'text', style: 'normal' },
      { key: 'term', label: 'Term', value: '24 months from 1 Nov 2026', type: 'numeric', style: 'quiet' },
    ],
    verb: 'Sign — Master Services Agreement',
    deny: 'Refuse',
    flag:
      'The wallet has no PDF viewer. What is signed is the fingerprint plus these values — the person must have read the file on the portal.',
  },
  {
    id: 'doc.poa',
    industry: 'doc',
    title: 'A power of attorney',
    problem:
      'Granting a power means both parties in the same room on the same morning, and a second appointment when the first runs out of time.',
    writtenFor: 'Ridgeway Notaries',
    template: 'doc.sign.v1',
    kind: 'authorize',
    signWith: 'identity',
    fields: [
      { key: 'document', label: 'Deed', value: 'Special power of attorney', type: 'text', style: 'hero' },
      { key: 'fingerprint', label: 'Fingerprint', value: 'C41A·88E0·2D6F', type: 'mono', style: 'normal' },
      { key: 'protocol', label: 'Protocol', value: 'Protocol 2026/1184 · 6 pages', type: 'text', style: 'normal' },
      { key: 'granted_to', label: 'Granted to', value: 'Alia Restrepo', type: 'text', style: 'normal' },
      { key: 'powers', label: 'Powers', value: 'Sale of one property only', type: 'text', style: 'normal' },
      { key: 'expires', label: 'Expires', value: '31 Dec 2026', type: 'numeric', style: 'quiet' },
    ],
    verb: 'Sign — Special power of attorney',
    deny: 'Refuse',
    flag:
      'Notarial force needs a qualified signature and a qualified timestamp. This framework proves who approved what and when te-api saw it; it is not a trust service provider and must sit beside one.',
  },
  {
    id: 'doc.board',
    industry: 'doc',
    title: 'A board resolution',
    problem:
      'The resolution circulates by email and its validity rests on a thread. Six months later nobody can say which version was agreed.',
    writtenFor: 'Cassia Foods',
    template: 'doc.sign.v1',
    kind: 'authorize',
    signWith: 'identity',
    fields: [
      { key: 'document', label: 'Resolution', value: 'Approval of the 2027 budget', type: 'text', style: 'hero' },
      { key: 'fingerprint', label: 'Fingerprint', value: '71B9·03CC·E52A', type: 'mono', style: 'normal' },
      { key: 'meeting', label: 'Meeting', value: 'Board meeting 2026-11-04', type: 'text', style: 'normal' },
      { key: 'signing_as', label: 'Signing as', value: 'Director (3 of 7)', type: 'text', style: 'normal' },
      { key: 'quorum_needed', label: 'Quorum needed', value: '4 of 7', type: 'numeric', style: 'quiet' },
    ],
    verb: 'Sign — Approval of the 2027 budget',
    deny: 'Abstain',
    flag:
      'The framework has no quorum. Counting four of seven, and deciding what happens at three, stays with the caller.',
  },

  /* ── Professional identity ─────────────────────────────────────────── */
  {
    id: 'pro.capacity',
    industry: 'pro',
    title: 'Signing as a professional',
    problem:
      'A professional signature is a scanned image plus a certificate on a stick that expires quietly. Nothing checks the licence is still valid this morning.',
    writtenFor: 'Halden City Council',
    template: 'pro.seal.v1',
    kind: 'authorize',
    signWith: 'credential',
    claims: ['given_name', 'family_name'],
    fields: [
      { key: 'act', label: 'Act', value: 'Structural sign-off', type: 'text', style: 'hero' },
      {
        key: 'capacity',
        label: 'Signing in capacity',
        value: 'Architect · Reg. 28-4471 · Institute of Architects',
        type: 'text',
        style: 'normal',
      },
      { key: 'file', label: 'File', value: 'File PL-2026-8841', type: 'mono', style: 'normal' },
      { key: 'site', label: 'Site', value: '12 Marlow Wharf', type: 'text', style: 'normal' },
      { key: 'scope', label: 'Scope', value: 'Load-bearing alterations', type: 'text', style: 'normal' },
      { key: 'fingerprint', label: 'Fingerprint', value: 'A0D7·6C13·9F44', type: 'mono', style: 'normal' },
    ],
    verb: 'Seal as Architect',
    deny: 'Refuse',
  },
  {
    id: 'pro.rx',
    industry: 'pro',
    title: 'An electronic prescription',
    problem:
      'Paper prescriptions are photocopied, altered and re-presented. The pharmacy loses the box and the insurer loses the reimbursement.',
    writtenFor: 'Meridian Health',
    template: 'pro.seal.v1',
    kind: 'authorize',
    signWith: 'credential',
    claims: ['given_name', 'family_name'],
    fields: [
      { key: 'act', label: 'Prescription', value: 'Amoxicillin 500 mg', type: 'text', style: 'hero' },
      {
        key: 'capacity',
        label: 'Signing in capacity',
        value: 'Physician · Lic. 44-2019 · General Medical Registry',
        type: 'text',
        style: 'normal',
      },
      { key: 'quantity', label: 'Quantity', value: '21 capsules', type: 'text', style: 'normal' },
      { key: 'patient', label: 'Patient', value: 'Ref. P-88213', type: 'mono', style: 'normal' },
      { key: 'dosage', label: 'Dosage', value: '1 every 8 h, 7 days', type: 'text', style: 'normal' },
      { key: 'valid_until', label: 'Valid until', value: '12 Oct 2026', type: 'numeric', style: 'quiet' },
    ],
    verb: 'Seal as Physician',
    deny: 'Cancel',
  },
  {
    id: 'pro.audit',
    industry: 'pro',
    title: 'An auditor’s sign-off',
    problem:
      'The audit opinion is a signature block in a Word file. Its weight comes entirely from the firm’s letterhead, which is a font.',
    writtenFor: 'Vantage Audit',
    template: 'pro.seal.v1',
    kind: 'authorize',
    signWith: 'credential',
    claims: ['given_name', 'family_name'],
    fields: [
      { key: 'act', label: 'Opinion', value: 'Unqualified', type: 'text', style: 'hero' },
      {
        key: 'capacity',
        label: 'Signing in capacity',
        value: 'Registered auditor · ROAC 19-5502',
        type: 'text',
        style: 'normal',
      },
      { key: 'client', label: 'Client', value: 'Cassia Foods · FY2026', type: 'text', style: 'normal' },
      { key: 'report_fingerprint', label: 'Report fingerprint', value: '5E88·C201·77BD', type: 'mono', style: 'normal' },
      { key: 'period', label: 'Period', value: '1 Jan – 31 Dec 2026', type: 'numeric', style: 'normal' },
      { key: 'engagement', label: 'Engagement', value: 'ENG-2026-0413', type: 'mono', style: 'quiet' },
    ],
    verb: 'Seal as Registered auditor',
    deny: 'Refuse',
  },

  /* ── Healthcare ────────────────────────────────────────────────────── */
  {
    id: 'health.consent',
    industry: 'health',
    title: 'Informed consent for a procedure',
    problem:
      'Consent is a form signed on a clipboard an hour before surgery, and impossible to produce three years later when it is the only thing that matters.',
    writtenFor: 'Meridian Health',
    template: 'doc.sign.v1',
    kind: 'authorize',
    signWith: 'identity',
    fields: [
      { key: 'document', label: 'Consent for', value: 'Arthroscopy, right knee', type: 'text', style: 'hero' },
      { key: 'fingerprint', label: 'Fingerprint', value: 'D318·9A47·02EC', type: 'mono', style: 'normal' },
      { key: 'form', label: 'Form', value: 'Consent form v3 · 4 pages', type: 'text', style: 'quiet' },
      { key: 'clinician', label: 'Clinician', value: 'Dr. R. Okonkwo', type: 'text', style: 'normal' },
      { key: 'scheduled', label: 'Scheduled', value: '14 Oct 2026, 08:30', type: 'numeric', style: 'normal' },
      { key: 'anaesthesia', label: 'Anaesthesia', value: 'Regional', type: 'text', style: 'quiet' },
    ],
    verb: 'Sign — Consent for arthroscopy',
    deny: 'Not now',
    flag:
      'The patient must have read the consent document elsewhere. The wallet shows the fingerprint and the summary, never the text.',
  },
  {
    id: 'health.records',
    industry: 'health',
    title: 'Letting a specialist read your records',
    problem:
      'Access is granted by a receptionist ticking a box, is never scoped and is never withdrawn. Nobody can tell you afterwards who read what.',
    writtenFor: 'Meridian Health',
    template: 'data.consent.v1',
    kind: 'authorize',
    signWith: 'identity',
    fields: [
      { key: 'scope', label: 'Sharing', value: 'Cardiology records, 2024–2026', type: 'text', style: 'hero' },
      { key: 'recipient', label: 'With', value: 'Dr. L. Vasquez, Ardent Clinic', type: 'text', style: 'normal' },
      { key: 'until', label: 'For', value: '30 days', type: 'numeric', style: 'normal' },
      { key: 'purpose', label: 'Purpose', value: 'Second opinion', type: 'text', style: 'quiet' },
      {
        key: 'withdrawable',
        label: 'Can be withdrawn',
        value: 'Any time, from this wallet',
        type: 'text',
        style: 'quiet',
      },
    ],
    verb: 'Share for 30 days',
    deny: 'Refuse',
    flag:
      'This proves the grant. Enforcing the scope stays with whoever holds the records; the framework cannot police reads.',
  },
  {
    id: 'health.dispense',
    industry: 'health',
    title: 'Collecting someone else’s prescription',
    problem:
      'The pharmacist reads a name, a date of birth and an address off a card, and hands over a controlled medicine on the strength of a photograph.',
    writtenFor: 'Larkfield Pharmacy',
    template: 'attr.minimal.v2',
    kind: 'present',
    signWith: 'credential',
    claims: ['given_name', 'family_name'],
    fields: [
      { key: 'word', label: 'Confirmation word', value: 'THISTLE', type: 'mono', style: 'hero' },
      {
        key: 'attribute',
        label: 'Sharing',
        value: 'Authorised to collect prescription P-88213',
        type: 'text',
        style: 'normal',
      },
    ],
    verb: 'Share this only',
    deny: 'Refuse',
  },

  /* ── Education ─────────────────────────────────────────────────────── */
  {
    id: 'edu.degree',
    industry: 'edu',
    title: 'Proving a degree to an employer',
    problem:
      'The candidate emails a scan of a diploma. The employer pays a background-check firm and waits three days for a phone call to a registry.',
    writtenFor: 'Kestrel Logistics',
    template: 'attr.minimal.v1',
    kind: 'present',
    signWith: 'credential',
    claims: ['given_name', 'family_name'],
    fields: [
      {
        key: 'attribute',
        label: 'Sharing',
        value: 'BSc Computer Science, Northgate University',
        type: 'text',
        style: 'hero',
      },
    ],
    verb: 'Share this only',
    deny: 'Refuse',
  },
  {
    id: 'edu.exam',
    industry: 'edu',
    title: 'Sitting a remote exam',
    problem:
      'Proctoring means a webcam and an ID card held up to a lens. It proves a face was present, not that the right person answered.',
    writtenFor: 'Northgate University',
    template: 'auth.signin.v1',
    kind: 'authenticate',
    signWith: 'identity',
    fields: [
      // OAuth obliga a registrar una aplicacion: `app` es su nombre, y la
      // cartera lo pone encima del dominio. El nombre se reconoce; el dominio
      // se coteja.
      { key: 'app', label: 'Application', value: 'Northgate Exams', type: 'text', style: 'normal' },
      { key: 'destination', label: 'Signing in to', value: 'exams.demo-te.com', type: 'mono', style: 'hero' },
      // `account` es una clave que `auth.signin.v1` lee por su nombre: es la
      // identidad con la que se entra, y la cartera la pinta arriba. La
      // matricula no es eso —es un dato del centro— y por eso va en su propia
      // clave, como par.
      { key: 'account', label: 'Account', value: 'a.restrepo@demo-te.com', type: 'mono', style: 'normal' },
      { key: 'paper', label: 'Paper', value: 'CS-4412 Distributed Systems', type: 'text', style: 'normal' },
      { key: 'enrolment', label: 'Enrolment', value: 'NG-2024-11907', type: 'mono', style: 'quiet' },
      { key: 'session', label: 'Session', value: 'Starts 09:00, 3 hours', type: 'numeric', style: 'quiet' },
      { key: 'started', label: 'Started', value: '08:52 · 3 minutes ago', type: 'numeric', style: 'normal' },
    ],
    verb: 'Sign in',
    deny: 'Cancel',
  },
  {
    id: 'edu.enrol',
    industry: 'edu',
    title: 'Enrolling on a course',
    problem:
      'Enrolment is a form, a scanned ID and a bank mandate, keyed by hand in August, and wrong often enough that there is a department for it.',
    writtenFor: 'Northgate University',
    template: 'doc.sign.v1',
    kind: 'authorize',
    signWith: 'identity',
    fields: [
      { key: 'document', label: 'Document', value: 'Enrolment agreement 2026/27', type: 'text', style: 'hero' },
      { key: 'fingerprint', label: 'Fingerprint', value: '2C90·B47F·1188', type: 'mono', style: 'normal' },
      { key: 'version', label: 'Version', value: 'Version 2 · 9 pages', type: 'text', style: 'normal' },
      { key: 'programme', label: 'Programme', value: 'MSc Data Engineering', type: 'text', style: 'normal' },
      { key: 'entry_on', label: 'Entry on', value: 'BSc Computer Science', type: 'text', style: 'quiet' },
      { key: 'tuition', label: 'Tuition', value: '€8,400 per year', type: 'numeric', style: 'quiet' },
    ],
    verb: 'Sign — Enrolment agreement 2026/27',
    deny: 'Not yet',
    flag:
      'Tuition itself is out of scope. The wallet approves the enrolment; the payment runs on whatever rail the university already uses.',
  },

  /* ── HR & workplace ────────────────────────────────────────────────── */
  {
    id: 'hr.hire',
    industry: 'hr',
    title: 'An employment contract',
    problem:
      'The offer is a PDF, the signature is a photograph of a signature, and the right-to-work check is a photocopy HR must then store for years.',
    writtenFor: 'Kestrel Logistics',
    template: 'doc.sign.v1',
    kind: 'authorize',
    signWith: 'identity',
    fields: [
      { key: 'document', label: 'Document', value: 'Employment contract', type: 'text', style: 'hero' },
      { key: 'fingerprint', label: 'Fingerprint', value: '8B12·F5A0·34D9', type: 'mono', style: 'normal' },
      { key: 'version', label: 'Version', value: 'Version 1 · 11 pages', type: 'text', style: 'normal' },
      { key: 'role', label: 'Role', value: 'Operations analyst', type: 'text', style: 'normal' },
      { key: 'starts', label: 'Starts', value: '2 Nov 2026', type: 'numeric', style: 'normal' },
      { key: 'salary', label: 'Salary', value: '€46,000 per year', type: 'numeric', style: 'quiet' },
    ],
    verb: 'Sign — Employment contract',
    deny: 'Decline',
  },
  {
    id: 'hr.door',
    industry: 'hr',
    title: 'Getting into the building',
    problem:
      'A plastic badge opens the door. It works when it is lent, when it is stolen, and for three weeks after the contractor’s last day.',
    writtenFor: 'Kestrel Logistics',
    template: 'access.grant.v1',
    kind: 'authorize',
    signWith: 'identity',
    fields: [
      { key: 'place', label: 'Opening', value: 'Bay 4 — cold store', type: 'text', style: 'hero' },
      { key: 'valid_until', label: 'Valid until', value: 'Today, 18:40', type: 'numeric', style: 'normal' },
      { key: 'site', label: 'Site', value: 'Riverside distribution centre', type: 'text', style: 'normal' },
      { key: 'reason', label: 'Reason', value: 'Contracted maintenance', type: 'text', style: 'quiet' },
      { key: 'escort', label: 'Escort', value: 'Not required', type: 'text', style: 'quiet' },
    ],
    verb: 'Open until 18:40',
    deny: 'Cancel',
    flag:
      'Both the reader and the phone must be online. There is no NFC or BLE path, so a door in a basement with no signal is out of reach.',
  },
  {
    id: 'hr.payroll',
    industry: 'hr',
    title: 'Releasing the payroll run',
    problem:
      'The finance director approves a six-figure run by replying “ok” to an email, and business email compromise is a funded attack on exactly that reply.',
    writtenFor: 'Kestrel Logistics',
    template: 'exchange.transfer.v1',
    kind: 'authorize',
    signWith: 'identity',
    fields: [
      { key: 'amount', label: 'Releasing', value: '€412,880.00', type: 'numeric', style: 'hero' },
      { key: 'destination', label: 'From', value: 'Operating account ··4471', type: 'mono', style: 'normal' },
      { key: 'run', label: 'Run', value: 'March payroll · 214 employees', type: 'text', style: 'normal' },
      { key: 'changed_since', label: 'Changed since February', value: '3 bank details', type: 'numeric', style: 'normal' },
      { key: 'prepared_by', label: 'Prepared by', value: 'M. Ferreira', type: 'text', style: 'quiet' },
    ],
    verb: 'Release €412,880.00',
    deny: 'Hold',
    flag: 'This authorises. The bank still moves the money.',
  },
  {
    id: 'hr.bgcheck',
    industry: 'hr',
    title: 'Consenting to a background check',
    problem:
      'The candidate signs a broad consent form that lets a screening firm ask anyone, anything, for as long as it likes.',
    writtenFor: 'Kestrel Logistics',
    template: 'data.consent.v1',
    kind: 'authorize',
    signWith: 'identity',
    fields: [
      { key: 'scope', label: 'Sharing', value: 'Employment history, last 5 years', type: 'text', style: 'hero' },
      { key: 'recipient', label: 'With', value: 'Vantage Screening, ref SC-9930', type: 'text', style: 'normal' },
      { key: 'until', label: 'For', value: '21 days', type: 'numeric', style: 'normal' },
      { key: 'purpose', label: 'Purpose', value: 'Pre-employment check', type: 'text', style: 'quiet' },
      {
        key: 'withdrawable',
        label: 'Can be withdrawn',
        value: 'Any time, from this wallet',
        type: 'text',
        style: 'quiet',
      },
    ],
    verb: 'Share for 21 days',
    deny: 'Refuse',
    flag:
      'The grant is provable here. Whether the screening firm respects the scope stays with the screening firm.',
  },

  /* ── Logistics ─────────────────────────────────────────────────────── */
  {
    id: 'log.delivery',
    industry: 'log',
    title: 'A verified delivery',
    problem:
      'The proof of delivery is a finger-drawn line on a courier’s screen. It proves a squiggle happened, not who received the shipment.',
    writtenFor: 'Kestrel Logistics',
    template: 'custody.handover.v1',
    kind: 'authorize',
    signWith: 'identity',
    fields: [
      { key: 'item', label: 'Consignment', value: 'KL-2026-114-8841', type: 'mono', style: 'normal' },
      { key: 'from_party', label: 'From', value: 'Kestrel Logistics · Driver 8841', type: 'text', style: 'normal' },
      { key: 'to_party', label: 'To', value: 'You — Cassia Foods, Riverside', type: 'text', style: 'normal' },
      { key: 'contents', label: 'Contents', value: '6 pallets, sealed', type: 'text', style: 'normal' },
      { key: 'seals_intact', label: 'Seals intact', value: 'Yes', type: 'text', style: 'quiet' },
    ],
    verb: 'Confirm handover',
    deny: 'Refuse — raise a discrepancy',
    flag:
      'Each side signs its own request. The framework has no notion of a pair, so linking the two rows is the caller’s job.',
  },
  {
    id: 'log.coldchain',
    industry: 'log',
    title: 'Cold-chain custody',
    problem:
      'The temperature log is a printout in the cab. If the batch is later questioned, the chain of custody is signatures nobody can attribute.',
    writtenFor: 'Ardent Pharma',
    template: 'custody.handover.v1',
    kind: 'authorize',
    signWith: 'identity',
    fields: [
      { key: 'item', label: 'Batch', value: 'AP-4471-B', type: 'mono', style: 'normal' },
      { key: 'from_party', label: 'From', value: 'Riverside cold store · J. Adeyemi', type: 'text', style: 'normal' },
      { key: 'to_party', label: 'To', value: 'You — Vantage Transport, leg 2', type: 'text', style: 'normal' },
      { key: 'reported_temp', label: 'Reported temp', value: '4.1 °C', type: 'numeric', style: 'normal' },
      { key: 'excursions', label: 'Excursions', value: 'None recorded', type: 'text', style: 'quiet' },
    ],
    verb: 'Confirm handover',
    deny: 'Refuse — log an excursion',
    flag:
      'The sensor reading is a value the wallet was handed. The phone signs that it was shown 4.1 °C — it does not measure the box.',
  },

  /* ── Insurance ─────────────────────────────────────────────────────── */
  {
    id: 'ins.fnol',
    industry: 'ins',
    title: 'Reporting a claim',
    problem:
      'The claim is taken over the phone by an agent typing into a form. What the policyholder actually said is a recording nobody listens to.',
    writtenFor: 'Ardent Insurance',
    template: 'claim.attest.v1',
    kind: 'authorize',
    signWith: 'identity',
    fields: [
      {
        key: 'claim',
        label: 'Declaring',
        value: 'First notice of loss, claim CL-2026-31904',
        type: 'text',
        style: 'hero',
      },
      {
        key: 'statement_1',
        label: 'Statement 1',
        value: 'The damage happened on 8 Oct 2026, at about 19:20.',
        type: 'text',
        style: 'normal',
      },
      {
        key: 'statement_2',
        label: 'Statement 2',
        value: 'I was driving. No other person was in the vehicle.',
        type: 'text',
        style: 'normal',
      },
      {
        key: 'statement_3',
        label: 'Statement 3',
        value: 'No injuries were caused to anyone.',
        type: 'text',
        style: 'normal',
      },
      {
        key: 'statement_4',
        label: 'Statement 4',
        value: 'The vehicle has not been repaired since.',
        type: 'text',
        style: 'normal',
      },
      { key: 'policy', label: 'Policy', value: 'AR-77-410288', type: 'mono', style: 'normal' },
      { key: 'claim_reference', label: 'Claim', value: 'CL-2026-31904', type: 'mono', style: 'quiet' },
    ],
    verb: 'I declare',
    deny: 'These are not my words',
    flag:
      'The wallet cannot collect an answer. The agent pre-fills these statements on the call; the person only confirms or refuses the set.',
  },
  {
    id: 'ins.payout',
    industry: 'ins',
    title: 'Changing where a payout lands',
    problem:
      'A caller convinces an agent to update the bank details on a policy. The payout leaves for the right amount, on the right day, to the wrong account.',
    writtenFor: 'Ardent Insurance',
    template: 'account.change.v1',
    kind: 'authorize',
    signWith: 'identity',
    fields: [
      { key: 'what', label: 'What changes', value: 'Payout account', type: 'text', style: 'normal' },
      { key: 'change_from', label: 'From', value: 'ES·· ···· ···· 4471', type: 'mono', style: 'normal' },
      { key: 'change_to', label: 'To', value: 'GB·· ···· ···· 9930', type: 'mono', style: 'normal' },
      {
        key: 'consequence',
        label: 'What this means',
        value:
          'Whoever holds the new account receives your next claim payment. This cannot be reversed once the payment leaves.',
        type: 'text',
        style: 'normal',
      },
      { key: 'requested_by', label: 'Requested by', value: 'Phone agent, 14:02', type: 'text', style: 'quiet' },
      { key: 'policy', label: 'Policy', value: 'AR-77-410288', type: 'mono', style: 'quiet' },
    ],
    verb: 'Slide to approve the change',
    deny: 'Not me — stop this',
    denyLeads: true,
  },
  {
    id: 'ins.insurercall',
    industry: 'ins',
    title: '“I am calling from your insurer”',
    problem:
      'The caller knows your policy number and your last claim, because so does anyone who bought the leaked file. Nothing the honest caller says the fraudster cannot.',
    writtenFor: 'Ardent Insurance',
    template: 'agent.identify.v1',
    kind: 'verify',
    signWith: 'identity',
    fields: [
      { key: 'about', label: 'Calling about', value: 'Claim CL-2026-31904', type: 'text', style: 'normal' },
      { key: 'agent', label: 'Agent', value: 'M. Ferreira · ID 4471', type: 'text', style: 'normal' },
      { key: 'started', label: 'Started', value: '14:02, 3 minutes ago', type: 'numeric', style: 'quiet' },
    ],
    verb: 'Slide to confirm the call',
    deny: 'End the call',
  },

  /* ── Real estate ───────────────────────────────────────────────────── */
  {
    id: 're.viewing',
    industry: 're',
    title: 'Whoever is coming to the viewing',
    problem:
      'An agent hands the keys of an empty flat to a stranger after photographing their ID card — creating both no security and a data-protection liability.',
    writtenFor: 'Brookline Estates',
    template: 'attr.minimal.v2',
    kind: 'present',
    signWith: 'credential',
    claims: ['given_name', 'family_name'],
    fields: [
      { key: 'word', label: 'Confirmation word', value: 'HARBOUR', type: 'mono', style: 'hero' },
      {
        key: 'attribute',
        label: 'Sharing',
        value: 'A verified adult, booked for 17:00',
        type: 'text',
        style: 'normal',
      },
    ],
    verb: 'Share this only',
    deny: 'Refuse',
  },
  {
    id: 're.keybox',
    industry: 're',
    title: 'A self-service viewing',
    problem:
      'Unaccompanied viewings run on a key safe with a four-digit code that is texted out and never changes.',
    writtenFor: 'Brookline Estates',
    template: 'access.grant.v1',
    kind: 'authorize',
    signWith: 'identity',
    fields: [
      { key: 'place', label: 'Opening', value: 'Flat 3, 12 Marlow Wharf', type: 'text', style: 'hero' },
      { key: 'valid_until', label: 'Valid until', value: 'Today, 17:45', type: 'numeric', style: 'normal' },
      { key: 'opens', label: 'Opens', value: 'Front door and key safe', type: 'text', style: 'normal' },
      { key: 'window', label: 'Window', value: '45 minutes', type: 'numeric', style: 'normal' },
      { key: 'booked', label: 'Booked', value: '17:00, today', type: 'numeric', style: 'quiet' },
      { key: 'accompanied', label: 'Accompanied', value: 'No', type: 'text', style: 'quiet' },
    ],
    verb: 'Open until 17:45',
    deny: 'Cancel',
    flag:
      'The key safe has to be online. There is no proximity path, so an unpowered box on a gatepost is out of reach.',
  },
  {
    id: 're.arras',
    industry: 're',
    title: 'Releasing a deposit',
    problem:
      'The buyer transfers a five-figure deposit after reading an account number pasted into an email. Conveyancing fraud is built on exactly that paste.',
    writtenFor: 'Brookline Escrow',
    template: 'exchange.transfer.v1',
    kind: 'authorize',
    signWith: 'identity',
    fields: [
      { key: 'amount', label: 'Releasing', value: '€18,000.00', type: 'numeric', style: 'hero' },
      { key: 'destination', label: 'To', value: 'Client account ··9930', type: 'mono', style: 'normal' },
      {
        key: 'purpose',
        label: 'Purpose',
        value: 'Deposit · Flat 3, 12 Marlow Wharf',
        type: 'text',
        style: 'normal',
      },
      { key: 'held_by', label: 'Held by', value: 'Brookline Escrow, regulated', type: 'text', style: 'normal' },
      { key: 'refundable_until', label: 'Refundable until', value: '30 Nov 2026', type: 'numeric', style: 'quiet' },
    ],
    verb: 'Release €18,000.00',
    deny: 'Hold',
    flag: 'This authorises. The bank moves the money.',
  },

  /* ── Public administration ─────────────────────────────────────────── */
  {
    id: 'gov.tender',
    industry: 'gov',
    title: 'A responsible declaration in a tender',
    problem:
      'Bidders declare they are not disqualified and have no conflict of interest by ticking boxes. The declaration is only worth something if it can be attributed later.',
    writtenFor: 'Halden City Council',
    template: 'claim.attest.v1',
    kind: 'authorize',
    signWith: 'identity',
    fields: [
      {
        key: 'claim',
        label: 'Declaring',
        value: 'Responsible declaration for tender TEN-2026-0088',
        type: 'text',
        style: 'hero',
      },
      {
        key: 'statement_1',
        label: 'Statement 1',
        value: 'Cassia Foods is not subject to any prohibition to contract.',
        type: 'text',
        style: 'normal',
      },
      {
        key: 'statement_2',
        label: 'Statement 2',
        value: 'Cassia Foods is current with tax and social security.',
        type: 'text',
        style: 'normal',
      },
      {
        key: 'statement_3',
        label: 'Statement 3',
        value: 'No director has a conflict of interest with this tender.',
        type: 'text',
        style: 'normal',
      },
      {
        key: 'statement_4',
        label: 'Statement 4',
        value: 'The information in bid TEN-2026-0088 is true.',
        type: 'text',
        style: 'normal',
      },
      { key: 'signing_as', label: 'Signing as', value: 'Director, Cassia Foods', type: 'text', style: 'normal' },
      { key: 'tender', label: 'Tender', value: 'TEN-2026-0088', type: 'mono', style: 'quiet' },
    ],
    verb: 'I declare',
    deny: 'These are not my words',
    flag: 'Values arrive pre-filled from the bid. The wallet cannot ask a question.',
  },
  {
    id: 'gov.taxdata',
    industry: 'gov',
    title: 'Letting a lender see your tax position',
    problem:
      'The applicant downloads a PDF certificate from the tax portal and emails it to the lender, who cannot tell it from a PDF that was edited.',
    writtenFor: 'Halden Revenue',
    template: 'data.consent.v1',
    kind: 'authorize',
    signWith: 'identity',
    fields: [
      { key: 'scope', label: 'Sharing', value: 'Tax status: current', type: 'text', style: 'hero' },
      {
        key: 'recipient',
        label: 'With',
        value: 'Meridian Lending, application L-4471',
        type: 'text',
        style: 'normal',
      },
      { key: 'until', label: 'For', value: '14 days', type: 'numeric', style: 'normal' },
      { key: 'purpose', label: 'Purpose', value: 'Mortgage assessment', type: 'text', style: 'quiet' },
      {
        key: 'withdrawable',
        label: 'Can be withdrawn',
        value: 'Any time, from this wallet',
        type: 'text',
        style: 'quiet',
      },
    ],
    verb: 'Share for 14 days',
    deny: 'Refuse',
    flag:
      'The grant is provable here. Enforcing what the lender actually reads stays with the tax portal.',
  },
  {
    id: 'gov.taxcall',
    industry: 'gov',
    title: '“This is the tax office calling”',
    problem:
      'Agencies warn the public that they never call, which is untrue and unhelpful — and the fraudulent caller sounds exactly the same.',
    writtenFor: 'Halden Revenue',
    template: 'agent.identify.v1',
    kind: 'verify',
    signWith: 'identity',
    fields: [
      { key: 'about', label: 'Calling about', value: 'Return 2025, review', type: 'text', style: 'normal' },
      { key: 'officer', label: 'Officer', value: 'D. Aliyev · ID 2288', type: 'text', style: 'normal' },
      { key: 'started', label: 'Started', value: '11:14, 2 minutes ago', type: 'numeric', style: 'quiet' },
    ],
    verb: 'Slide to confirm the call',
    deny: 'End the call',
  },

  /* ── Transport & mobility ──────────────────────────────────────────── */
  {
    id: 'mob.rental',
    industry: 'mob',
    title: 'Picking up a hire car',
    problem:
      'A counter agent photocopies a licence, a card and a passport and stores them in a drawer for two years. The car goes to whoever presented the plastic.',
    writtenFor: 'Vantage Mobility',
    template: 'custody.handover.v1',
    kind: 'authorize',
    signWith: 'identity',
    fields: [
      { key: 'item', label: 'Vehicle', value: 'Plate 4471-KDR', type: 'mono', style: 'normal' },
      { key: 'from_party', label: 'From', value: 'Vantage Mobility · Riverside desk', type: 'text', style: 'normal' },
      { key: 'to_party', label: 'To', value: 'You — booking VM-88413', type: 'text', style: 'normal' },
      { key: 'fuel', label: 'Fuel / charge', value: '92%', type: 'numeric', style: 'quiet' },
      { key: 'existing_damage', label: 'Existing damage', value: '2 items, photographed', type: 'text', style: 'quiet' },
    ],
    verb: 'Confirm handover',
    deny: 'Refuse — raise a discrepancy',
  },
  {
    id: 'mob.roadside',
    industry: 'mob',
    title: 'A licence check at the roadside',
    problem:
      'Handing over a plastic card gives an officer a name, an address and a photograph, when the question was whether you may drive this vehicle.',
    writtenFor: 'Halden Traffic Police',
    template: 'attr.minimal.v2',
    kind: 'present',
    signWith: 'credential',
    claims: ['given_name', 'family_name'],
    fields: [
      { key: 'word', label: 'Confirmation word', value: 'LANTERN', type: 'mono', style: 'hero' },
      { key: 'attribute', label: 'Sharing', value: 'Entitled to drive category B', type: 'text', style: 'normal' },
    ],
    verb: 'Share this only',
    deny: 'Refuse',
    flag:
      'Both ends must be online. Offline proximity presentation over NFC or BLE is not something this framework does.',
  },

  /* ── Retail & age ──────────────────────────────────────────────────── */
  {
    id: 'retail.alcohol',
    industry: 'retail',
    title: 'Alcohol at the door',
    problem:
      'The driver is told to check ID. The driver is paid per drop, is late, and checks nothing — and the retailer carries the fine.',
    writtenFor: 'Larkfield Retail',
    template: 'age.gate.v1',
    kind: 'present',
    signWith: 'credential',
    claims: ['age_over_18'],
    fields: [
      { key: 'age_over_18', label: 'Over 18', value: 'Yes', type: 'text', style: 'hero' },
      { key: 'reason', label: 'Why', value: 'Age-restricted delivery', type: 'text', style: 'quiet' },
    ],
    verb: 'Share this only',
    deny: 'Refuse',
  },
  {
    id: 'retail.betting',
    industry: 'retail',
    title: 'Checking the self-exclusion register',
    problem:
      'A person who asked to be excluded signs up at another operator the same evening. Checking the register means handing full identity to every operator.',
    writtenFor: 'Larkfield Gaming',
    template: 'attr.minimal.v1',
    kind: 'present',
    signWith: 'credential',
    claims: ['given_name', 'family_name'],
    fields: [
      {
        key: 'attribute',
        label: 'Sharing',
        value: 'Not on the self-exclusion register',
        type: 'text',
        style: 'hero',
      },
    ],
    verb: 'Share this only',
    deny: 'Refuse',
  },

  /* ── Energy & utilities ────────────────────────────────────────────── */
  {
    id: 'energy.tech',
    industry: 'energy',
    title: 'The technician at your door',
    problem:
      'A printed lanyard is the entire defence. Distraction burglary using a utility uniform is common enough that utilities print warnings on their bills.',
    writtenFor: 'Vellum Energy',
    template: 'agent.identify.v1',
    kind: 'verify',
    signWith: 'identity',
    fields: [
      { key: 'about', label: 'Here for', value: 'Annual meter inspection', type: 'text', style: 'normal' },
      { key: 'technician', label: 'Technician', value: 'S. Nowak · ID 7712', type: 'text', style: 'normal' },
      { key: 'booked', label: 'Booked', value: 'Today, 10:00–12:00', type: 'numeric', style: 'quiet' },
    ],
    verb: 'Slide to confirm the visit',
    deny: 'Send them away',
  },
  {
    id: 'energy.siteaccess',
    industry: 'energy',
    title: 'A contractor at a substation',
    problem:
      'Site access is a signing-in book and a supervisor’s memory of which safety cards are still valid.',
    writtenFor: 'Vellum Energy',
    template: 'access.grant.v1',
    kind: 'authorize',
    signWith: 'identity',
    fields: [
      { key: 'place', label: 'Opening', value: 'Marlow substation, gate 2', type: 'text', style: 'hero' },
      { key: 'valid_until', label: 'Valid until', value: 'Today, 16:00', type: 'numeric', style: 'normal' },
      { key: 'area', label: 'Area', value: 'High-voltage restricted area', type: 'text', style: 'normal' },
      { key: 'window', label: 'Window', value: '4 hours', type: 'numeric', style: 'normal' },
      { key: 'work_order', label: 'Work order', value: 'WO-2026-3318', type: 'mono', style: 'normal' },
      { key: 'escort', label: 'Escort', value: 'Required', type: 'text', style: 'quiet' },
    ],
    verb: 'Open until 16:00',
    deny: 'Cancel',
    flag: 'The gate must be online.',
  },
  {
    id: 'energy.switch',
    industry: 'energy',
    title: 'Being switched to another supplier',
    problem:
      'Doorstep and telephone switching happens without real consent often enough to have its own name and its own regulator’s fine.',
    writtenFor: 'Halden Energy Registry',
    template: 'account.change.v1',
    kind: 'authorize',
    signWith: 'identity',
    fields: [
      { key: 'what', label: 'What changes', value: 'Electricity supplier', type: 'text', style: 'normal' },
      { key: 'change_from', label: 'From', value: 'Vellum Energy', type: 'text', style: 'normal' },
      { key: 'change_to', label: 'To', value: 'Northwind Power', type: 'text', style: 'normal' },
      {
        key: 'consequence',
        label: 'What this means',
        value:
          'Your current tariff ends and your exit fee, if any, becomes payable. Unwinding a registered switch takes weeks.',
        type: 'text',
        style: 'normal',
      },
      { key: 'requested_by', label: 'Requested by', value: 'Doorstep agent, 18:40', type: 'text', style: 'quiet' },
      { key: 'meter_point', label: 'Meter point', value: 'MP-4471-0928', type: 'mono', style: 'quiet' },
    ],
    verb: 'Slide to approve the change',
    deny: 'Not me — stop this',
    denyLeads: true,
  },

  /* ── Telecom ───────────────────────────────────────────────────────── */
  {
    id: 'telco.simswap',
    industry: 'telco',
    title: 'Moving your number to a new SIM',
    problem:
      'An agent is talked into moving a number to an attacker’s SIM. Every account that recovers by SMS then belongs to the attacker.',
    writtenFor: 'Orbit Telecom',
    template: 'account.change.v1',
    kind: 'authorize',
    signWith: 'identity',
    fields: [
      { key: 'what', label: 'What changes', value: 'Number +34 ··· ··· 412', type: 'text', style: 'normal' },
      {
        key: 'change_from',
        label: 'From',
        value: 'SIM ··· ··· 8841 (in your phone)',
        type: 'mono',
        style: 'normal',
      },
      { key: 'change_to', label: 'To', value: 'SIM ··· ··· 0027 (new)', type: 'mono', style: 'normal' },
      {
        key: 'consequence',
        label: 'What this means',
        value:
          'Your calls, your messages and every account that recovers by SMS move to the new SIM. This phone stops receiving them immediately.',
        type: 'text',
        style: 'normal',
      },
      { key: 'requested_at', label: 'Requested at', value: 'Orbit store, Riverside', type: 'text', style: 'quiet' },
      { key: 'requested_by', label: 'By', value: 'Counter agent 3319', type: 'text', style: 'quiet' },
    ],
    verb: 'Slide to approve the change',
    deny: 'Not me — stop this',
    denyLeads: true,
    flag:
      'A cool-off period would help here and the framework has none. expires_at ends a request; it cannot delay one taking effect.',
  },
  {
    id: 'telco.port',
    industry: 'telco',
    title: 'Porting your number to another operator',
    problem:
      'Porting is authorised with a code sent by SMS to the number being ported — which is the exact thing under attack.',
    writtenFor: 'Halden Number Registry',
    template: 'account.change.v1',
    kind: 'authorize',
    signWith: 'identity',
    fields: [
      { key: 'what', label: 'What changes', value: 'Number +34 ··· ··· 412', type: 'text', style: 'normal' },
      { key: 'change_from', label: 'From', value: 'Orbit Telecom', type: 'text', style: 'normal' },
      { key: 'change_to', label: 'To', value: 'Vantage Mobile', type: 'text', style: 'normal' },
      {
        key: 'consequence',
        label: 'What this means',
        value:
          'Your current contract ends and any remaining device instalments become payable. Porting back takes a further request.',
        type: 'text',
        style: 'normal',
      },
      { key: 'requested_by', label: 'Requested by', value: 'Vantage Mobile, online', type: 'text', style: 'quiet' },
      { key: 'scheduled', label: 'Scheduled', value: '12 Oct 2026, 02:00', type: 'numeric', style: 'quiet' },
    ],
    verb: 'Slide to approve the change',
    deny: 'Not me — stop this',
    denyLeads: true,
  },
];

/** Un caso por su id, o `undefined`. Lo usa la acción de servidor. */
export function findCeremonyCase(id: string): CeremonyCase | undefined {
  return CEREMONY_CASES.find((entry) => entry.id === id);
}

/** Los casos de una industria, en el orden del catálogo. */
export function casesOfIndustry(industry: string): readonly CeremonyCase[] {
  return CEREMONY_CASES.filter((entry) => entry.industry === industry);
}
