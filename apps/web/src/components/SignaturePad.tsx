import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { Icon } from './Icon';

/** Alto del lienzo en píxeles CSS. El ancho lo marca el contenedor. */
const HEIGHT = 170;
/** Más resolución no mejora una firma y engorda el PNG que viaja al servidor. */
const MAX_RATIO = 2;

interface Props {
  /** Data URL del PNG, o cadena vacía si aún no hay firma. */
  value: string;
  onChange: (dataUrl: string) => void;
}

/**
 * Captura la firma manuscrita del cliente. El trazo se dibuja sobre fondo
 * blanco opaco para que el PNG se lea igual en cualquier visor, y solo se
 * exporta al soltar: así no se genera una imagen por cada movimiento.
 */
export function SignaturePad({ value, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [active, setActive] = useState(false);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const ratio = canvas.width / canvas.clientWidth;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#242628';
  }, []);

  // El lienzo se dimensiona una sola vez: redimensionarlo lo vaciaría, y la
  // firma se hace de una sentada sobre un equipo fijo del mostrador.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_RATIO);
    canvas.width = Math.round(canvas.clientWidth * ratio);
    canvas.height = Math.round(HEIGHT * ratio);
    clear();
  }, [clear]);

  // Tras confirmar un alquiler el formulario se reinicia; el lienzo también.
  useEffect(() => {
    if (value === '') clear();
  }, [value, clear]);

  function pointAt(event: PointerEvent<HTMLCanvasElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  function start(event: PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    setActive(true);
    const { x, y } = pointAt(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
    // Un toque sin arrastre debe dejar marca: el punto es una firma válida.
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function move(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = pointAt(event);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    setActive(false);
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL('image/png'));
  }

  const signed = value !== '';

  return (
    <div className={`signature${signed ? ' is-signed' : ''}${active ? ' is-active' : ''}`}>
      <canvas
        ref={canvasRef}
        className="signature-canvas"
        style={{ height: `${String(HEIGHT)}px` }}
        role="img"
        aria-label="Lienzo de firma del cliente"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      />
      {!signed && !active && (
        <span className="signature-placeholder" aria-hidden="true">
          <Icon name="pen" />
          Firma aquí con el dedo o el ratón
        </span>
      )}
      <div className="signature-bar">
        <span className={`signature-state${signed ? ' is-ready' : ''}`} role="status">
          {signed ? (
            <>
              <Icon name="check" />
              Firma capturada
            </>
          ) : (
            'Pendiente de firma'
          )}
        </span>
        <button
          type="button"
          className="button outline small"
          onClick={() => {
            clear();
            onChange('');
          }}
          disabled={!signed}
        >
          Borrar
        </button>
      </div>
    </div>
  );
}
