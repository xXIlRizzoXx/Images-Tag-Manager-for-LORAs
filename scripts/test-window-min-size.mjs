/* ITALIANO: PROVA DELLA MISURA MINIMA DELLA FINESTRA
   Senza un minimo la finestra si poteva stringere quanto si voleva: sotto i 1024 px di larghezza i
   tre riquadri in alto vanno uno sotto l'altro e la grafica interna si scompone (il pannello delle
   Impostazioni finiva anche sotto il bordo). Ora c'e' un minimo di 1024x600, ma mai piu' grande
   dell'area utile dello schermo, altrimenti su un portatile piccolo la finestra uscirebbe dai bordi.
   Si estrae il calcolo VERO da electron/main.cjs e lo si prova con schermi finti.
   Uso:  node scripts/test-window-min-size.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE MINIMUM WINDOW SIZE
   With no minimum the window could be shrunk at will: below 1024 px wide the three top panels stack
   and the inner layout falls apart (the Settings panel also ran under the edge). Now there is a
   1024x600 minimum, but never larger than the screen work area, or on a small laptop the window
   would go off the screen. The REAL calculation is extracted from electron/main.cjs and tried with
   fake screens.
   Usage:  node scripts/test-window-min-size.mjs      (exits with code 1 if anything is off) */

import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let guai = 0;
let fatti = 0;
const dice = (cosa, atteso, avuto) => {
    fatti++;
    const ok = JSON.stringify(atteso) === JSON.stringify(avuto);
    if (!ok) guai++;
    console.log(`${ok ? 'OK  ' : 'NO  '} ${cosa}${ok ? '' : `  (atteso ${JSON.stringify(atteso)}, avuto ${JSON.stringify(avuto)})`}`);
};

const main = fs.readFileSync(path.join(radice, 'electron/main.cjs'), 'utf8');
const pezzo = /const FINESTRA_MIN_LARGHEZZA[\s\S]*?\n};\n/.exec(main)?.[0] || '';
dice('il calcolo della misura minima si trova in main.cjs', true, pezzo.length > 0);
const crea = (screen) => new Function('screen', `${pezzo}\nreturn misuraMinima;`)(screen);
const schermo = (width, height) => ({ getPrimaryDisplay: () => ({ workAreaSize: { width, height } }) });

if (pezzo) {
    dice('schermo grande (1920x1032): minimo 1024x600', { minWidth: 1024, minHeight: 600 }, crea(schermo(1920, 1032))());
    dice('portatile 1366x768 al 125% (~1093x566): l\'altezza minima scende a 566', { minWidth: 1024, minHeight: 566 }, crea(schermo(1093, 566))());
    dice('schermo piu\' stretto di 1024 (853x672): la larghezza minima scende a 853', { minWidth: 853, minHeight: 600 }, crea(schermo(853, 672))());
    dice('se lo schermo non si legge, resta 1024x600 senza errori', { minWidth: 1024, minHeight: 600 },
        crea({ getPrimaryDisplay: () => { throw new Error('non pronto'); } })());
}
dice('la finestra principale usa la misura minima', true, /new BrowserWindow\(\{\s*width: 1280,\s*height: 800,\s*\.\.\.misuraMinima\(\),/.test(main));
dice('screen viene importato da electron', true, /const \{[^}]*\bscreen\b[^}]*\} = require\('electron'\);/.test(main));
const pronto = main.indexOf('app.whenReady()');
const chiamate = [...main.matchAll(/\n\s+createMainWindow\(\);/g)].map(m => m.index);
dice('la finestra si crea solo dopo app.whenReady (serve a screen)', true, pronto > 0 && chiamate.length > 0 && chiamate.every(i => i > pronto));

console.log(`\n${guai === 0 ? 'TUTTO A POSTO' : 'PROBLEMI: ' + guai} (${fatti} controlli)`);
process.exit(guai === 0 ? 0 : 1);
