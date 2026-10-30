import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { Icon } from './Icon';

/** Alto del lienzo en píxeles CSS. El ancho lo marca el contenedor. */
const HEIGHT = 170;
const MAX_RATIO = 3;
const MIN_STROKE_DISTANCE = 4;

interface Point {
  x: number;
  y: number;
}

type Stroke = Point[];

function drawStroke(ctx: CanvasRenderingContext2D, width: number, stroke: Stroke): void {
  const first = stroke[0];
  const last = stroke[stroke.length - 1];
  if (!first || !last || stroke.length < 2) return;

  ctx.beginPath();
  ctx.moveTo(first.x * width, first.y * HEIGHT);
  for (let i = 1; i < stroke.length - 1; i += 1) {
    const point = stroke[i];
    const next = stroke[i + 1];
    if (!point || !next) continue;
    ctx.quadraticCurveTo(
      point.x * width,
      point.y * HEIGHT,
      ((point.x + next.x) / 2) * width,
      ((point.y + next.y) / 2) * HEIGHT,
    );
  }
  ctx.lineTo(last.x * width, last.y * HEIGHT);
  ctx.stroke();
}

interface Props {
  /** Data URL del PNG, o cadena vacía si aún no hay firma. */
  value: string;
  onChange: (dataUrl: string) => void;
}

/**
 * Captura trazos vectoriales para poder reconstruir el lienzo al rotar o
 * redimensionar. El PNG mantiene el formato blanco que recibe el backend.
 */
export function SignaturePad({ value, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const activeStroke = useRef<Stroke>([]);
  const strokes = useRef<Stroke[]>([]);
  const distance = useRef(0);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);

  valueRef.current = value;
  onChangeRef.current = onChange;

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const width = canvas.clientWidth;
    if (!width) return;
    const ratio = canvas.width / width;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#242628';

    const paths = drawing.current ? [...strokes.current, activeStroke.current] : strokes.current;
    for (const stroke of paths) drawStroke(ctx, width, stroke);
  }, []);

  const exportPng = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return '';
    const output = document.createElement('canvas');
    output.width = canvas.width;
    output.height = canvas.height;
    const ctx = output.getContext('2d');
    if (!ctx) throw new Error('No se pudo preparar la imagen de la firma.');
    const ratio = output.width / canvas.clientWidth;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, output.width, output.height);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#242628';
    for (const stroke of strokes.current) drawStroke(ctx, canvas.clientWidth, stroke);
    return output.toDataURL('image/png');
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.parentElement) return;

    const resize = () => {
      const width = canvas.getBoundingClientRect().width;
      if (!width) return;
      const ratio = Math.min(window.devicePixelRatio || 1, MAX_RATIO);
      const pixelWidth = Math.round(width * ratio);
      const pixelHeight = Math.round(HEIGHT * ratio);
      if (canvas.width === pixelWidth && canvas.height === pixelHeight) return;
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      redraw();
      if (valueRef.current && strokes.current.length) {
        onChangeRef.current(exportPng());
      }
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas.parentElement);
    window.addEventListener('resize', resize);
    resize();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [exportPng, redraw]);

  useEffect(() => {
    if (value !== '') return;
    strokes.current = [];
    activeStroke.current = [];
    drawing.current = false;
    setActive(false);
    redraw();
  }, [value, redraw]);

  useEffect(
    () => () => {
      if (pulseTimer.current) clearTimeout(pulseTimer.current);
    },
    [],
  );

  function pointAt(event: globalThis.PointerEvent, canvas: HTMLCanvasElement): Point {
    const box = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)),
      y: Math.max(0, Math.min(1, (event.clientY - box.top) / box.height)),
    };
  }

  function start(event: PointerEvent<HTMLCanvasElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    distance.current = 0;
    activeStroke.current = [pointAt(event.nativeEvent, event.currentTarget)];
    setActive(true);
    setStarting(true);
    if (pulseTimer.current) clearTimeout(pulseTimer.current);
    pulseTimer.current = setTimeout(() => {
      setStarting(false);
    }, 320);
    redraw();
  }

  function move(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const coalesced = event.nativeEvent.getCoalescedEvents?.();
    const points = coalesced?.length ? coalesced : [event.nativeEvent];
    for (const pointer of points) {
      const point = pointAt(pointer, event.currentTarget);
      const previous = activeStroke.current[activeStroke.current.length - 1];
      if (!previous) continue;
      const dx = (point.x - previous.x) * event.currentTarget.clientWidth;
      const dy = (point.y - previous.y) * HEIGHT;
      distance.current += Math.hypot(dx, dy);
      if (dx !== 0 || dy !== 0) activeStroke.current.push(point);
    }
    redraw();
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    setActive(false);
    setStarting(false);
    if (pulseTimer.current) clearTimeout(pulseTimer.current);
    if (distance.current >= MIN_STROKE_DISTANCE) {
      strokes.current = [...strokes.current, activeStroke.current];
      onChangeRef.current(exportPng());
    }
    activeStroke.current = [];
    redraw();
  }

  function clearSignature() {
    drawing.current = false;
    activeStroke.current = [];
    strokes.current = [];
    distance.current = 0;
    setActive(false);
    setStarting(false);
    if (pulseTimer.current) clearTimeout(pulseTimer.current);
    redraw();
    onChangeRef.current('');
  }

  const signed = value !== '';

  return (
    <div
      className={`signature${signed ? ' is-signed' : ''}${active ? ' is-active' : ''}${starting ? ' is-starting' : ''}`}
      role="group"
      aria-label="Firma del cliente"
    >
      <canvas
        ref={canvasRef}
        className="signature-canvas"
        style={{ height: `${String(HEIGHT)}px` }}
        aria-label="Área para firmar"
        aria-describedby="signature-instructions"
        tabIndex={0}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onLostPointerCapture={end}
      />
      <span className="sr-only" id="signature-instructions">
        Firma aquí con el dedo, lápiz táctil o ratón. Dibuja un trazo para registrar la firma.
      </span>
      {!signed && !active && (
        <span className="signature-placeholder" aria-hidden="true">
          <Icon name="pen" />
          Firma aquí con el dedo o el ratón
        </span>
      )}
      <div className="signature-bar">
        <span
          className={`signature-state${signed ? ' is-ready' : ''}`}
          role="status"
          aria-live="polite"
        >
          {signed ? (
            <>
              <Icon name="check" />
              Firma registrada
            </>
          ) : (
            'Pendiente de firma'
          )}
        </span>
        <button
          type="button"
          className="button outline small"
          onClick={clearSignature}
          disabled={!signed}
          aria-label="Borrar firma"
        >
          Borrar
        </button>
      </div>
    </div>
  );
}
