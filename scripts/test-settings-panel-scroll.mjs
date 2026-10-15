/* ITALIANO: PROVA DEL PANNELLO IMPOSTAZIONI CHE SCORRE
   Con l'AI accesa (chiave, modello, come tagga) e la sezione del server MCP, il pannello delle
   Impostazioni e' piu' alto di uno schermo da portatile. Senza un'altezza massima e lo
   scorrimento usciva dal fondo della finestra: la sezione MCP e la Lingua non si potevano piu'
   raggiungere (visto sul programma vero, schermo 1456x819). Qui si controlla che il pannello
   abbia un'altezza massima legata alla finestra e scorra da solo.
   Uso:  node scripts/test-settings-panel-scroll.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE SCROLLING SETTINGS PANEL
   With the AI on (key, model, how it tags) and the MCP server section, the Settings panel is
   taller than a laptop screen. With no maximum height and no scrolling it ran off the bottom of
   the window: the MCP section and Language could no longer be reached (seen on the real app,
   1456x819 screen). This checks the panel has a maximum height tied to the window and scrolls
   on its own.
   Usage:  node scripts/test-settings-panel-scroll.mjs      (exits with code 1 if anything is off) */

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

const app = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const pannello = /\{isSettingsOpen && <div className=\{`([^`]*)`\}/.exec(app)?.[1] || '';
dice('il pannello delle Impostazioni si trova', true, pannello.length > 0);
dice('ha un\'altezza massima legata alla finestra (100vh)', true, /\bmax-h-\[calc\(100vh-[0-9.]+rem\)\]/.test(pannello));
dice('scorre in verticale quando non ci sta', true, /\boverflow-y-auto\b/.test(pannello));
dice('lo scorrimento non passa alla pagina sotto', true, /\boverscroll-contain\b/.test(pannello));

console.log(`\n${guai === 0 ? 'TUTTO A POSTO' : 'PROBLEMI: ' + guai} (${fatti} controlli)`);
process.exit(guai === 0 ? 0 : 1);
