/**
 * Script para gerar ícones PWA em SVG + PNG.
 * 
 * Uso: node scripts/generate-icons.js
 * Dependência: sharp (devDependency)
 */

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '..', 'public');

/**
 * Gera o SVG do ícone "FP" estilizado.
 */
function generateIconSVG(size, padding = 0) {
  const s = size;
  const p = padding;
  const innerSize = s - p * 2;
  const radius = Math.round(innerSize * 0.18);
  const fontSize = Math.round(innerSize * 0.55);
  const textX = s / 2 - fontSize * 0.08;
  const textY = s / 2 + fontSize * 0.35;
  const smallFontSize = Math.round(fontSize * 0.38);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect x="${p}" y="${p}" width="${innerSize}" height="${innerSize}" rx="${radius}" fill="#2563eb"/>
  <text x="${textX}" y="${textY}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="900" fill="white" text-anchor="middle" letter-spacing="-1">F</text>
  <text x="${textX + fontSize * 0.33}" y="${textY - fontSize * 0.18}" font-family="Arial, Helvetica, sans-serif" font-size="${smallFontSize}" font-weight="700" fill="#93c5fd" text-anchor="middle">P</text>
</svg>`;
}

function generateMaskableIconSVG(size) {
  const padding = Math.round(size * 0.1);
  return generateIconSVG(size, padding);
}

async function main() {
  const sizes = [192, 512];
  
  for (const size of sizes) {
    const svg = generateIconSVG(size);
    const svgPath = resolve(publicDir, `icon-${size}.svg`);
    const pngPath = resolve(publicDir, `icon-${size}.png`);
    
    writeFileSync(svgPath, svg);
    await sharp(Buffer.from(svg)).png().toFile(pngPath);
    console.log(`  ✅ icon-${size}.svg + .png`);
  }

  // Maskable (512 com safe zone)
  const maskableSvg = generateMaskableIconSVG(512);
  const maskableSvgPath = resolve(publicDir, 'icon-maskable-512.svg');
  const maskablePngPath = resolve(publicDir, 'icon-maskable-512.png');
  
  writeFileSync(maskableSvgPath, maskableSvg);
  await sharp(Buffer.from(maskableSvg)).png().toFile(maskablePngPath);
  console.log('  ✅ icon-maskable-512.svg + .png');

  console.log('\n✅ Todos os ícones gerados em public/');
}

main().catch(console.error);
