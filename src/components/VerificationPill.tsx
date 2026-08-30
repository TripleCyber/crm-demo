import { describeVerification, type VerificationStatus } from '@/lib/verification-status';

/**
 * El desenlace de una comprobación, en una insignia.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  UN SOLO COMPONENTE PARA LAS CUATRO PANTALLAS QUE LO PINTAN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * El listado de clientes, la ficha, el listado de verificaciones y la pantalla
 * de seguimiento enseñan lo mismo: cómo acabó. Que sea el mismo componente no
 * es ahorro de líneas — es lo que garantiza que **el rojo siga siendo sólo del
 * fraude** en las cuatro. Con cuatro copias, la tercera vez que alguien toque
 * una de ellas un `rejected` y un `failed` acabarán del mismo color, y esa
 * distinción es la que decide si el agente cuelga o vuelve a intentarlo.
 *
 * El color nunca va solo: la insignia lleva **texto**, porque uno de cada doce
 * hombres no distingue el rojo del verde y porque un punto de color no dice
 * *rechazada por el titular*.
 */
export function VerificationPill({
  status,
  expiresAt,
}: {
  status: VerificationStatus;
  /**
   * El plazo que puso te-api. Hace falta porque una fila que se quedó en
   * `pending` con el plazo vencido **no está en curso**: nadie tenía la
   * pantalla abierta cuando venció, así que nadie preguntó. Ver
   * `describeVerification`.
   */
  expiresAt: string;
}) {
  const verdict = describeVerification(status, expiresAt);
  return (
    <span className={`pill ${verdict.tone}`}>
      <span className="pill-mark" aria-hidden="true" />
      {verdict.label}
    </span>
  );
}
