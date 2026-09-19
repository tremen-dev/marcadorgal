/* Monta os artboards interactivos: mete o bloque de lóxica compartido
   (_logic.js) onde cada plantilla pon a marca //__SHARED__. */
import { readFileSync, writeFileSync } from 'node:fs';
const shared = readFileSync('_logic.js', 'utf8');
for (const name of ['Global', 'Escritorio', 'Movil']) {
  const tpl = readFileSync(`${name}.tpl.html`, 'utf8');
  if (!tpl.includes('//__SHARED__')) throw new Error(`${name}.tpl.html sen marca //__SHARED__`);
  writeFileSync(`${name}.dc.html`, tpl.replace('  //__SHARED__', shared));
  console.log(`${name}.dc.html`);
}
