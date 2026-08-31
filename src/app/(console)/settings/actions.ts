'use server';

import { revalidatePath } from 'next/cache';

import { getTranslator } from '@/i18n/server';
import { invalidateB2bToken } from '@/lib/b2b-token';
import { logConsoleFailure } from '@/lib/console-failures';
import {
  getOrganization,
  normalizeBrandColor,
  normalizeDomain,
  OrganizationConfigError,
} from '@/lib/organization';
import { isReferenceClaim, REFERENCE_CLAIMS } from '@/lib/reference-claims';
import {
  describeTeApiError,
  fetchB2bOrganization,
  fetchB2bWebhook,
  sendB2bWebhookTest,
  TeApiError,
} from '@/lib/te-api';
import {
  loadTenantSettings,
  parseOfficialNumbers,
  saveTenantSettings,
  type SecretField,
  type TenantSettingsPatch,
} from '@/lib/tenant-settings';

/**
 * Las tres acciones de la pantalla de ajustes: guardar, probar la conexión y
 * pedir un webhook de prueba.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  POR QUÉ SON ACCIONES DE SERVIDOR Y NO RUTAS DE API
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Porque aquí se manejan **tres secretos**, y una acción de servidor no expone
 * ningún endpoint que alguien pueda llamar con `curl` desde fuera: Next las
 * publica con un identificador que sólo conoce la propia página. El alta de
 * cliente ya se hacía así y por la razón contraria —no hay secreto, así que
 * funciona sin JavaScript—; aquí la razón es la superficie.
 *
 * Eso **no es autenticación** y no se pretende que lo sea. Ver la nota de la
 * página (`./page.tsx`), que dice con todas las letras quién puede llegar a esta
 * pantalla hoy.
 *
 * ## Los secretos entran y no vuelven a salir
 *
 * El formulario los manda cuando se escriben y los deja en blanco cuando no. Un
 * blanco significa **«no lo toques»**, nunca «bórralo»: si significara borrarlo,
 * cambiar un color de marca se llevaría por delante el secreto M2M. Para
 * borrarlos de verdad hay una casilla por secreto, y va marcada explícitamente.
 */

export interface SaveSettingsState {
  /** Un aviso general, ya traducido. */
  readonly error?: string;
  /** `true` tras un guardado bueno. Lo usa la pantalla para el acuse. */
  readonly saved?: boolean;
  /** Los campos con problema, por nombre del `<input>`. */
  readonly fields?: Record<string, string>;
}

export async function saveSettingsAction(
  _previous: SaveSettingsState,
  formData: FormData,
): Promise<SaveSettingsState> {
  const t = await getTranslator();

  const read = (name: string): string => {
    const value = formData.get(name);
    return typeof value === 'string' ? value.trim() : '';
  };
  const checked = (name: string): boolean => formData.get(name) === 'on';

  const fields: Record<string, string> = {};

  // ── Quién es ────────────────────────────────────────────────────────────
  const orgId = read('orgId');
  if (orgId === '') fields['orgId'] = t('settings.required');

  const domainRaw = read('domain');
  const domain = normalizeDomain(domainRaw);
  if (domainRaw === '') fields['domain'] = t('settings.required');
  else if (domain === null) fields['domain'] = t('settings.domainInvalid');

  const referenceClaim = read('referenceClaim').toLowerCase();
  if (!isReferenceClaim(referenceClaim)) {
    fields['referenceClaim'] = t('settings.referenceInvalid', {
      values: REFERENCE_CLAIMS.join(', '),
    });
  }

  const m2mClientId = read('m2mClientId');
  if (m2mClientId === '') fields['m2mClientId'] = t('settings.required');

  // ── Los secretos ────────────────────────────────────────────────────────
  //
  // Se comprueban sólo si se ha escrito uno: el campo en blanco es «el que ya
  // había». Lo único que se rechaza son las dos formas de equivocarse que se han
  // visto de verdad —espacios dentro, y haber pegado la huella en vez del
  // secreto—, y no la forma del valor: el prefijo `whsec_` lo elige te-api y
  // rechazar por él dejaría fuera un secreto legítimo el día que lo cambie. Que
  // el secreto sea el bueno lo demuestra el botón de prueba, que recorre el
  // camino entero; una expresión regular no demuestra nada.
  const stored = await loadTenantSettings();
  const secrets: Partial<Record<SecretField, string>> = {};
  const clearSecrets: SecretField[] = [];

  const readSecret = (name: string, field: SecretField): void => {
    if (checked(`clear_${name}`)) {
      clearSecrets.push(field);
      return;
    }
    const value = read(name);
    if (value === '') return;
    if (/\s/.test(value)) {
      fields[name] = t('settings.secretWhitespace');
      return;
    }
    if (/^[0-9a-f]{16}$/i.test(value)) {
      fields[name] = t('settings.secretLooksLikeFingerprint');
      return;
    }
    secrets[field] = value;
  };

  readSecret('m2mSecret', 'm2mSecret');
  readSecret('webhookSecret', 'webhookSecret');
  readSecret('portalClientSecret', 'portalClientSecret');

  // Sin secreto M2M —ni guardado ni escrito— no hay token que pedir y no hay
  // integración. Se señala en la casilla y no como aviso general: es lo único
  // que falta y está a la vista.
  const willHaveM2mSecret =
    secrets.m2mSecret !== undefined ||
    (stored.m2mSecret !== undefined && !clearSecrets.includes('m2mSecret'));
  if (!willHaveM2mSecret) fields['m2mSecret'] = t('settings.required');

  // ── La marca: los dos colores van juntos o no van ───────────────────────
  const brandAccentRaw = read('brandAccent');
  const brandSurfaceRaw = read('brandSurface');
  const brandAccent = normalizeBrandColor(brandAccentRaw);
  const brandSurface = normalizeBrandColor(brandSurfaceRaw);
  if (brandAccentRaw !== '' && brandAccent === null) {
    fields['brandAccent'] = t('settings.colourInvalid');
  }
  if (brandSurfaceRaw !== '' && brandSurface === null) {
    fields['brandSurface'] = t('settings.colourInvalid');
  }
  if ((brandAccentRaw === '') !== (brandSurfaceRaw === '')) {
    // Media marca es peor que ninguna: una barra violeta con los enlaces azules
    // de la hoja no se lee como «otra empresa», se lee como una pantalla a medio
    // pintar. Ver `BrandConfig` en `lib/organization.ts`.
    const empty = brandAccentRaw === '' ? 'brandAccent' : 'brandSurface';
    fields[empty] = t('settings.brandPair');
  }

  const monogram = read('brandMonogram');
  if ([...monogram].length > 2) fields['brandMonogram'] = t('settings.monogramTooLong');

  // ── El portal: el par también va junto ──────────────────────────────────
  const portalClientId = read('portalClientId');
  const willHavePortalSecret =
    secrets.portalClientSecret !== undefined ||
    (stored.portalClientSecret !== undefined && !clearSecrets.includes('portalClientSecret'));
  if (portalClientId !== '' && !willHavePortalSecret) {
    fields['portalClientSecret'] = t('settings.portalPair');
  }
  if (portalClientId === '' && willHavePortalSecret) {
    fields['portalClientId'] = t('settings.portalPair');
  }

  // ── Las direcciones ─────────────────────────────────────────────────────
  const urlFields: ReadonlyArray<{ name: string; required: boolean }> = [
    { name: 'logtoEndpoint', required: true },
    { name: 'teApiBaseUrl', required: true },
    { name: 'b2bResource', required: true },
    { name: 'portalBaseUrl', required: false },
  ];
  for (const { name, required } of urlFields) {
    const value = read(name);
    if (value === '') {
      if (required) fields[name] = t('settings.required');
      continue;
    }
    if (!isAbsoluteHttpUrl(value)) fields[name] = t('settings.urlInvalid');
  }

  if (Object.keys(fields).length > 0) {
    return { error: t('settings.checkFields'), fields };
  }

  const patch: TenantSettingsPatch = {
    orgId,
    displayName: read('displayName'),
    domain: domain ?? '',
    m2mClientId,
    referenceClaim,
    officialNumbers: parseOfficialNumbers(read('officialNumbers')),
    brandAccent: brandAccent ?? '',
    brandSurface: brandSurface ?? '',
    brandMonogram: monogram,
    portalClientId,
    portalLinkType: read('portalLinkType'),
    portalBaseUrl: read('portalBaseUrl'),
    logtoEndpoint: read('logtoEndpoint'),
    teApiBaseUrl: read('teApiBaseUrl'),
    b2bResource: read('b2bResource'),
    b2bScope: read('b2bScope'),
    ...secrets,
    clearSecrets,
  };

  try {
    await saveTenantSettings(patch);
  } catch (error) {
    logConsoleFailure(error, 'no se pudieron guardar los ajustes');
    return { error: t('settings.saveFailed') };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  EL TOKEN CACHEADO SE TIRA, Y LOS DOS: EL DE ANTES Y EL DE AHORA
  // ═══════════════════════════════════════════════════════════════════════
  //
  // El token M2M vive una hora en memoria del proceso, con el `orgId` de clave.
  // Sin esto, cambiar el secreto y darle a «probar» seguiría usando el token que
  // sacó el secreto anterior: la prueba diría que todo va bien durante una hora
  // y empezaría a fallar sola después. Se tira también el de la organización
  // anterior, porque cambiar de `orgId` deja el suyo colgado en el mapa.
  if (stored.orgId !== undefined) invalidateB2bToken(stored.orgId);
  invalidateB2bToken(orgId);

  // La disposición entera: el nombre y el color de la barra salen de aquí, y
  // guardarlos sin refrescarla dejaría la consola con la marca anterior hasta
  // la siguiente navegación completa.
  revalidatePath('/', 'layout');

  return { saved: true };
}

/** `http://` o `https://` con host. Ni rutas relativas ni `javascript:`. */
function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.host !== '';
  } catch {
    return false;
  }
}

/**
 * Lo que contesta el botón «probar la conexión».
 *
 * Es exactamente lo que ya comprueba la pantalla de Diagnóstico, y la llamada es
 * la misma función (`fetchB2bOrganization`): no hay una segunda comprobación que
 * pueda decir algo distinto. Lo que cambia es cuándo se puede pedir — allí al
 * cargar la pantalla, aquí en el momento en que acabas de escribir el secreto.
 */
export interface ConnectionCheck {
  readonly ok: boolean;
  /** Ya traducido. Sólo cuando `!ok`. */
  readonly error?: string;
  readonly organizationId?: string;
  readonly legalName?: string;
  readonly did?: string;
  /** Los scopes que TRAE el token. Es lo que le falta a quien depura. */
  readonly scopes?: readonly string[];
  readonly credentialTypes?: readonly string[];
}

export async function testConnectionAction(
  _previous: ConnectionCheck | undefined,
  _formData: FormData,
): Promise<ConnectionCheck> {
  const t = await getTranslator();
  try {
    const organization = await getOrganization();
    const result = await fetchB2bOrganization(organization);
    return {
      ok: true,
      organizationId: result.organizationId,
      legalName: result.legalName,
      did: result.did,
      scopes: result.scopes,
      credentialTypes: result.credentialTypes.map((entry) => entry.type),
    };
  } catch (error) {
    return { ok: false, error: describeCheckFailure(t, error) ?? t('common.unknownFailure') };
  }
}

/** Lo que contesta el botón «mandar un evento de prueba». */
export interface WebhookCheck {
  readonly ok: boolean;
  readonly error?: string;
  /** No hay ningún destino registrado en tenant-admin todavía. */
  readonly notRegistered?: boolean;
  /** La dirección que te-api tiene registrada. */
  readonly registeredUrl?: string;
  /** La de esta instalación, para poder comparar a ojo. */
  readonly expectedUrl?: string;
  /** `false` = te-api va a llamar a otro sitio, y aquí no va a llegar nada. */
  readonly matches?: boolean;
  /** `probation` | `active` | `paused` | `suspended`. */
  readonly status?: string;
  readonly eventId?: string;
  /** `null` = te-api registró el evento pero no encoló ninguna entrega. */
  readonly deliveryId?: string | null;
}

export async function sendTestWebhookAction(
  _previous: WebhookCheck | undefined,
  _formData: FormData,
): Promise<WebhookCheck> {
  const t = await getTranslator();
  try {
    const organization = await getOrganization();

    // Primero se lee qué hay registrado. Es lo que permite decir «no hay
    // ninguno» y «hay uno, pero apunta a otro sitio» en vez de mandar un evento
    // al vacío y dejar a alguien esperando una fila que no va a llegar nunca.
    const { endpoint } = await fetchB2bWebhook(organization);
    if (endpoint === null) {
      return { ok: false, notRegistered: true, expectedUrl: organization.webhookUrl };
    }

    const matches = normalizeUrl(endpoint.url) === normalizeUrl(organization.webhookUrl);
    // Se manda igual cuando no cuadran, y el resultado lo dice: la entrega irá a
    // la dirección registrada, no a ésta. Es más útil que negarse — quien lo vea
    // sabe a dónde ha ido y por qué su bandeja sigue vacía.
    const test = await sendB2bWebhookTest(organization);

    return {
      ok: true,
      registeredUrl: endpoint.url,
      expectedUrl: organization.webhookUrl,
      matches,
      status: endpoint.status,
      eventId: test.eventId,
      deliveryId: test.deliveryId,
    };
  } catch (error) {
    return { ok: false, error: describeCheckFailure(t, error) ?? t('common.unknownFailure') };
  }
}

/**
 * El fallo de una comprobación, dicho para quien la ha pulsado.
 *
 * Los tres casos que salen de verdad, y son distintos:
 *
 *  · **Configuración incompleta** — falta algo de esta misma pantalla. Se dice
 *    con la lista, que es lo accionable.
 *  · **te-api contestó** — se traduce con el mismo catálogo que usa Diagnóstico
 *    (`describeTeApiError`), que ya sabe que el 404 de la puerta B2B significa
 *    cinco cosas a la vez y lo explica.
 *  · **Logto rechazó el token** — el mensaje de `B2bTokenError` ya viene escrito
 *    para quien opera y no lleva ni el `client_id` ni el secreto.
 */
function describeCheckFailure(
  t: Awaited<ReturnType<typeof getTranslator>>,
  error: unknown,
): string | undefined {
  if (error instanceof OrganizationConfigError) return error.message;
  if (error instanceof TeApiError) return describeTeApiError(t, error);
  if (error instanceof Error) {
    logConsoleFailure(error, 'una comprobación de la pantalla de ajustes falló');
    return error.message;
  }
  logConsoleFailure(error, 'una comprobación de la pantalla de ajustes falló');
  return undefined;
}

/**
 * Dos direcciones son la misma si sólo se diferencian en la barra final o en las
 * mayúsculas del host.
 *
 * No se normaliza más: el resto de una URL —la ruta, el puerto— **sí distingue**,
 * y decir que `…/api/webhooks/te-api` y `…/api/webhooks/te-api/` son distintas
 * sería un falso positivo que manda a alguien a buscar un problema que no tiene.
 */
function normalizeUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, '')}`;
  } catch {
    return value.trim().replace(/\/+$/, '');
  }
}
