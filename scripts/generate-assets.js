const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const brandDir = path.join(root, 'assets', 'brand');
const outDir = path.join(root, 'assets');

const COLORS = {
  top: '#7C6CFF',
  mid: '#5B4CF0',
  bottom: '#2A1C8F',
  splashLight: '#F4F3FF',
  splashDark: '#0D0A26',
};

const keyhole = (fill, opacity = 1) => `
  <g fill="${fill}" fill-opacity="${opacity}">
    <circle cx="512" cy="448" r="112"/>
    <path d="M462 520 L432 680 Q427 708 456 708 L568 708 Q597 708 592 680 L562 520 Z"/>
  </g>`;

const ring = (stroke, opacity) =>
  `<circle cx="512" cy="512" r="292" fill="none" stroke="${stroke}" stroke-opacity="${opacity}" stroke-width="22"/>`;

const defs = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${COLORS.top}"/>
      <stop offset="0.5" stop-color="${COLORS.mid}"/>
      <stop offset="1" stop-color="${COLORS.bottom}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.28" cy="0.18" r="0.75">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.28"/>
      <stop offset="0.6" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="18"/>
      <feOffset dy="14"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.35"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>`;

const svg = (body, { size = 1024, extraDefs = '' } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">${defs}${extraDefs}${body}</svg>`;

const background = `<rect width="1024" height="1024" fill="url(#bg)"/><rect width="1024" height="1024" fill="url(#glow)"/>`;
const mark = `${ring('#FFFFFF', 0.22)}<g filter="url(#shadow)">${keyhole('#FFFFFF')}</g>`;

const scaled = (inner, scale) =>
  `<g transform="translate(512 512) scale(${scale}) translate(-512 -512)">${inner}</g>`;

const sources = {
  'icon.svg': svg(background + mark),
  'adaptive-background.svg': svg(background),
  'adaptive-foreground.svg': svg(scaled(mark, 0.78)),
  'adaptive-monochrome.svg': svg(scaled(ring('#FFFFFF', 0.35) + keyhole('#FFFFFF'), 0.78)),
  'splash.svg': svg(
    `<clipPath id="squircle"><rect x="112" y="112" width="800" height="800" rx="200"/></clipPath>
     <g clip-path="url(#squircle)">${background}${scaled(mark, 0.78)}</g>`,
  ),
};

async function render(svgFile, pngFile, size, { opaque = false } = {}) {
  let img = sharp(Buffer.from(sources[svgFile]), { density: 72 * (size / 1024) * 4 }).resize(size, size);
  if (opaque) img = img.flatten({ background: COLORS.mid });
  await img.png({ compressionLevel: 9 }).toFile(path.join(outDir, pngFile));
}

async function main() {
  fs.mkdirSync(brandDir, { recursive: true });
  for (const [name, content] of Object.entries(sources)) {
    fs.writeFileSync(path.join(brandDir, name), content.trim() + '\n');
  }
  await render('icon.svg', 'icon.png', 1024, { opaque: true });
  await render('adaptive-background.svg', 'android-icon-background.png', 1024, { opaque: true });
  await render('adaptive-foreground.svg', 'android-icon-foreground.png', 1024);
  await render('adaptive-monochrome.svg', 'android-icon-monochrome.png', 1024);
  await render('splash.svg', 'splash-icon.png', 1024);
  await render('icon.svg', 'favicon.png', 48);
  process.stdout.write(`assets written to ${path.relative(root, outDir)}\n`);
}

module.exports = { COLORS };

if (require.main === module) {
  main().catch((e) => {
    process.stderr.write(`${e.stack}\n`);
    process.exit(1);
  });
}
