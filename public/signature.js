export function validateSignature(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 100) throw new Error('La firma no es válida. Bórrala e intenta de nuevo.');
  let count = 0;
  for (const stroke of value) {
    if (!Array.isArray(stroke) || stroke.length < 2) throw new Error('La firma necesita un trazo completo.');
    count += stroke.length;
    if (count > 1000) throw new Error('La firma es demasiado extensa. Bórrala e intenta de nuevo.');
    for (const point of stroke) {
      if (!Array.isArray(point) || point.length !== 2 || point.some(n => !Number.isInteger(n) || n < 0 || n > 1000)) throw new Error('La firma contiene coordenadas no válidas.');
    }
  }
  return value;
}

function paint(canvas, strokes) {
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#242628';
  context.lineWidth = 3;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (const stroke of strokes) {
    context.beginPath();
    stroke.forEach(([x,y], index) => {
      const p = [x * canvas.width / 1000, y * canvas.height / 1000];
      if (index) context.lineTo(...p); else context.moveTo(...p);
    });
    context.stroke();
  }
}

export function signatureImage(strokes) {
  if (!strokes?.length) return '';
  const canvas = document.createElement('canvas');
  canvas.width = 1000; canvas.height = 500;
  paint(canvas, strokes);
  return canvas.toDataURL('image/png');
}

export function bindSignature(root, initial = [], onChange) {
  const canvas = root.querySelector('#signature-pad');
  const status = root.querySelector('#signature-status');
  let strokes = structuredClone(initial), current = null, pointer = null;
  const count = () => strokes.reduce((sum, stroke) => sum + stroke.length, 0);
  const point = event => {
    const rect = canvas.getBoundingClientRect();
    return [Math.max(0, Math.min(1000, Math.round((event.clientX - rect.left) / rect.width * 1000))), Math.max(0, Math.min(1000, Math.round((event.clientY - rect.top) / rect.height * 1000)))];
  };
  const update = () => {
    paint(canvas, strokes);
    status.textContent = strokes.length ? 'Firma capturada. Se guardará con el alquiler.' : 'Sin firma. Pide al cliente que firme dentro del recuadro.';
  };
  canvas.addEventListener('pointerdown', event => {
    if (pointer !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if (count() >= 990 || strokes.length >= 100) { status.textContent = 'Límite de trazos alcanzado. Puedes borrar la firma y repetirla.'; return; }
    event.preventDefault(); pointer = event.pointerId;
    canvas.setPointerCapture(pointer); current = [point(event)];
  });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerId !== pointer || !current) return;
    const next = point(event), previous = current.at(-1);
    if (Math.hypot(next[0]-previous[0], next[1]-previous[1]) < 3 || count()+current.length >= 1000) return;
    current.push(next); paint(canvas, [...strokes, current]);
  });
  const finish = event => {
    if (event.pointerId !== pointer) return;
    if (current?.length > 1) strokes.push(current);
    current = null; pointer = null; update(); onChange(structuredClone(strokes));
  };
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', finish);
  canvas.addEventListener('lostpointercapture', finish);
  root.querySelector('[data-clear-signature]').addEventListener('click', () => {
    strokes = []; current = null; pointer = null; update(); onChange([]);
  });
  update();
}
