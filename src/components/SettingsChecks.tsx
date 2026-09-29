'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import {
  sendTestWebhookAction,
  testConnectionAction,
  type ConnectionCheck,
  type WebhookCheck,
} from '@/app/(console)/settings/actions';
import { useTranslator } from '@/i18n/client';
import type { MessageKey } from '@/i18n/translate';

/**
 * **Los dos botones que prueban la integración desde la propia pantalla.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  SON DOS Y NO UNO PORQUE PRUEBAN DIRECCIONES OPUESTAS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  · **Probar la conexión** — el CRM llama a te-api. Comprueba de una vez las
 *    cuatro cosas que pueden estar mal en lo que se acaba de escribir: el
 *    secreto M2M, el recurso B2B (`aud`), los scopes y el alta de la
 *    organización en el padrón de te-api. Es exactamente la misma llamada que
 *    hace la pantalla de Diagnóstico —`GET /v1/b2b/organization`, la misma
 *    función— y no una segunda comprobación que pudiera decir algo distinto.
 *
 *  · **Mandar un evento de prueba** — te-api llama al CRM. Es la única
 *    dirección que no se puede comprobar desde dentro, y por eso hay que
 *    pedírsela a te-api: `POST /v1/b2b/webhook/test`. Prueba que la dirección
 *    registrada llega hasta este proceso y que el secreto guardado aquí es el
 *    mismo con el que firma te-api.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  PRUEBAN LO GUARDADO, NO LO ESCRITO. Y HAY QUE DECIRLO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Las dos acciones leen la configuración de la base, así que un secreto tecleado
 * y sin guardar **no entra en la prueba**. Podrían recibir el formulario entero
 * y probar con él, y sería peor: el resultado diría que funciona algo que no
 * está guardado, y se puede cerrar la pestaña convencido de haberlo dejado
 * puesto. Guardar primero y probar después es un paso más y un malentendido
 * menos, y el rótulo del botón lo dice.
 *
 * Cada botón va en su propio `<form>`: `useFormStatus` lee el envío del
 * formulario que lo contiene, así que dos botones en uno solo se desactivarían
 * a la vez y quedaría pareciendo que el que corre es el otro.
 */

function CheckButton({ labelKey, runningKey }: { labelKey: MessageKey; runningKey: MessageKey }) {
  const { pending } = useFormStatus();
  const t = useTranslator();
  return (
    <button type="submit" disabled={pending}>
      {t(pending ? runningKey : labelKey)}
    </button>
  );
}

export function SettingsChecks({ eventsHref = '/events' }: { readonly eventsHref?: string }) {
  const [connection, runConnection] = useActionState(testConnectionAction, undefined);
  const [webhook, runWebhook] = useActionState(sendTestWebhookAction, undefined);
  const t = useTranslator();

  return (
    <>
      <div className="card">
        <h2>{t('settings.checkConnectionTitle')}</h2>
        <p className="muted">{t('settings.checkConnectionNote')}</p>
        <form action={runConnection}>
          <CheckButton labelKey="settings.checkConnection" runningKey="settings.checking" />
        </form>
        {connection !== undefined && <ConnectionResult check={connection} />}
      </div>

      <div className="card">
        <h2>{t('settings.checkWebhookTitle')}</h2>
        <p className="muted">{t('settings.checkWebhookNote')}</p>
        <form action={runWebhook}>
          <CheckButton labelKey="settings.checkWebhook" runningKey="settings.sending" />
        </form>
        {webhook !== undefined && <WebhookResult check={webhook} eventsHref={eventsHref} />}
      </div>
    </>
  );
}

function ConnectionResult({ check }: { readonly check: ConnectionCheck }) {
  const t = useTranslator();

  if (!check.ok) {
    return (
      <>
        <p className="alert">{check.error}</p>
        {/*
          El 404 de la puerta B2B de te-api significa cinco cosas a la vez —token
          malo, `aud` que no cuadra, scope que falta, organización no dada de
          alta o suspendida— y contesta lo mismo para todas a propósito. Decirlo
          aquí es lo único que evita que alguien mire sólo el secreto.
        */}
        <p className="muted">{t('settings.checkConnectionOpaque')}</p>
      </>
    );
  }

  return (
    <>
      <p className="alert ok">{t('settings.checkConnectionOk')}</p>
      <dl className="facts">
        <dt>organizationId</dt>
        <dd className="mono">{check.organizationId}</dd>
        <dt>legalName</dt>
        <dd>{check.legalName}</dd>
        <dt>did</dt>
        <dd className="mono">{check.did}</dd>
        {/*
          Los scopes del TOKEN, no los pedidos. Logto recorta en silencio lo que
          el rol no tenga concedido —sin error—, así que ésta es la única
          pantalla donde se ve lo que de verdad se consiguió.
        */}
        <dt>{t('settings.checkScopes')}</dt>
        <dd className="mono">{check.scopes?.join(' ') ?? t('common.dash')}</dd>
        <dt>{t('settings.checkTypes')}</dt>
        <dd className="mono">
          {check.credentialTypes === undefined || check.credentialTypes.length === 0
            ? t('common.dash')
            : check.credentialTypes.join(', ')}
        </dd>
      </dl>
    </>
  );
}

function WebhookResult({
  check,
  eventsHref,
}: {
  readonly check: WebhookCheck;
  readonly eventsHref: string;
}) {
  const t = useTranslator();

  if (check.notRegistered === true) {
    return (
      <>
        <p className="alert warn">{t('settings.checkWebhookNotRegistered')}</p>
        <p className="muted">
          {t('settings.checkWebhookRegisterHint')} <span className="mono">{check.expectedUrl}</span>
        </p>
      </>
    );
  }

  if (!check.ok) return <p className="alert">{check.error}</p>;

  return (
    <>
      {check.matches === true ? (
        <p className="alert ok">{t('settings.checkWebhookSent')}</p>
      ) : (
        // El caso que más cuesta diagnosticar sin esto: te-api entrega en otra
        // dirección, aquí no llega nada, y la bandeja vacía se lee como «todavía
        // no ha pasado nada» en vez de como «está registrado en otro sitio».
        <p className="alert warn">{t('settings.checkWebhookMismatch')}</p>
      )}
      <dl className="facts">
        <dt>{t('settings.checkWebhookRegistered')}</dt>
        <dd className="mono">{check.registeredUrl}</dd>
        <dt>{t('settings.checkWebhookExpected')}</dt>
        <dd className="mono">{check.expectedUrl}</dd>
        <dt>{t('settings.checkWebhookStatus')}</dt>
        <dd className="mono">{check.status}</dd>
        <dt>{t('settings.checkWebhookEventId')}</dt>
        <dd className="mono">{check.eventId}</dd>
        {check.deliveryId === null && (
          <>
            <dt>{t('settings.checkWebhookDelivery')}</dt>
            {/*
              te-api registró el evento pero no encoló ninguna entrega: la
              entrega está apagada en ese despliegue. Sin esta fila, la prueba
              diría «mandado» y no llegaría nada nunca.
            */}
            <dd className="warn">{t('settings.checkWebhookNotQueued')}</dd>
          </>
        )}
      </dl>
      <p style={{ marginBottom: 0 }}>
        <Link href={eventsHref}>{t('settings.checkWebhookSeeEvents')}</Link>
      </p>
    </>
  );
}
