/**
 * Genera los assets servidos en `apps/web/public/assets`. Los originales se
 * descargaban en PNG/JPEG al triple de resolución de la que se renderiza; aquí se
 * reescalan al tamaño real y se pasan a WebP.
 *
 * Se parte de los recortes de `imagenes/recortes` para no alterar el encuadre,
 * salvo el logo, que se rehace desde el master por tener transparencia.
 *
 *   node scripts/optimize-assets.mjs
 */
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { stat } from 'node:fs/promises';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'apps/web/public/assets');
const crops = join(root, 'imagenes/recortes');

/** `width` es el lado mayor servido: el render CSS a 2x de densidad. */
const JOBS = [
  {
    from: join(root, 'imagenes/ROKAI_logo_transparente_alta_calidad.png'),
    to: 'logo.webp',
    width: 453,
    options: { quality: 90, alphaQuality: 90 },
  },
  {
    from: join(crops, 'hero-rokai-atardecer.jpg'),
    to: 'hero-rokai-atardecer.webp',
    width: 1100,
    options: { quality: 70 },
  },
  {
    from: join(crops, 'hero-rokai-atardecer.jpg'),
    to: 'hero-rokai-atardecer-640.webp',
    width: 640,
    options: { quality: 70 },
  },
  {
    from: join(crops, 'contact-rokai-pro.jpg'),
    to: 'contact-rokai-pro.webp',
    width: 1000,
    options: { quality: 76 },
  },
  {
    from: join(crops, 'scooter-coast.jpg'),
    to: 'scooter-coast.webp',
    width: 720,
    options: { quality: 76 },
  },
];

for (const job of JOBS) {
  const info = await sharp(job.from)
    .resize({ width: job.width, withoutEnlargement: true })
    .webp(job.options)
    .toFile(join(assets, job.to));
  const before = (await stat(job.from)).size;
  console.log(
    `${job.to.padEnd(32)} ${info.width}x${info.height}  ` +
      `${(before / 1024).toFixed(0)} KB -> ${(info.size / 1024).toFixed(1)} KB`,
  );
}

/* Versión del logo para superficies oscuras. El master es grafito sobre
   transparencia: aquí el grafito pasa a blanco y la cuña lima se conserva,
   que es lo que mantiene la marca reconocible sobre el vidrio oscuro. */
const logoMaster = join(root, 'imagenes/ROKAI_logo_transparente_alta_calidad.png');
const { data, info } = await sharp(logoMaster)
  .resize({ width: 453 })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

for (let i = 0; i < data.length; i += info.channels) {
  const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
  const isLime = g > 90 && g > r + 25 && g > b + 40;
  if (!isLime) {
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
  }
}

const inverse = await sharp(data, { raw: info })
  .webp({ quality: 90, alphaQuality: 90 })
  .toFile(join(assets, 'logo-inverse.webp'));
console.log(
  `${'logo-inverse.webp'.padEnd(32)} ${inverse.width}x${inverse.height}  ` +
    `-> ${(inverse.size / 1024).toFixed(1)} KB`,
);
