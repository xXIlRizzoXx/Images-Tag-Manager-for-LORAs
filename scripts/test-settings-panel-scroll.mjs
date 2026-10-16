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

// ITALIANO: secondo ricontrollo (16/10/2026). Il pannello parte piu' in basso quando la finestra e'
//           stretta (l'intestazione va in colonna): con un'altezza sola il fondo finiva sotto il
//           contenitore che taglia. Misurato nell'anteprima: 26-27 px di margine a 1456 e a 700 px.
// ENGLISH: second review (16/10/2026). The panel starts lower when the window is narrow (the header
//          stacks): with a single height its bottom went under the clipping container. Measured in
//          the preview: 26-27 px of margin at 1456 and at 700 px.
const altezze = [...pannello.matchAll(/(?:^|\s)(md:)?max-h-\[calc\(100vh-([0-9.]+)rem\)\]/g)].map(m => ({ md: !!m[1], rem: Number(m[2]) }));
const stretta = altezze.find(a => !a.md), larga = altezze.find(a => a.md);
dice('un\'altezza per la finestra stretta e una per quella larga (md:)', true, !!stretta && !!larga);
dice('...e quella stretta lascia piu\' spazio sopra (l\'intestazione e\' in colonna)', true, !!stretta && !!larga && stretta.rem > larga.rem);
dice('...la larga lascia almeno 8 rem (pannello da 6 rem dall\'alto + taglio sotto)', true, !!larga && larga.rem >= 8);
// ITALIANO: il menu delle lingue sta dentro il pannello che scorre. Nascosto con "invisible" restava
//           impaginato: ~260 px di vuoto in fondo e una barra di scorrimento anche con l'AI spenta.
//           Nascosto con "hidden" non occupa spazio; si apre verso l'alto, attaccato alla riga
//           (senza margine, altrimenti il mouse lo perde attraversando lo spazio).
// ENGLISH: the language menu sits inside the scrolling panel. Hidden with "invisible" it still took
//          layout: ~260 px of empty space at the bottom and a scrollbar even with the AI off. Hidden
//          with "hidden" it takes no space; it opens upward, attached to the row (no margin, or the
//          mouse loses it crossing the gap).
const menuLingue = /<div className="relative group">[\s\S]{0,1200}?<div className=\{`(absolute right-0 [^`]*)`\}/.exec(app)?.[1] || '';
dice('il menu delle lingue si trova', true, menuLingue.length > 0);
dice('...nascosto con hidden, non con invisible', true, /\bhidden\b/.test(menuLingue) && /\bgroup-hover:block\b/.test(menuLingue) && !/\binvisible\b/.test(menuLingue));
dice('...si apre verso l\'alto, attaccato alla riga', true, /\bbottom-full\b/.test(menuLingue) && !/\bm[bt]-\d/.test(menuLingue));

console.log(`\n${guai === 0 ? 'TUTTO A POSTO' : 'PROBLEMI: ' + guai} (${fatti} controlli)`);
process.exit(guai === 0 ? 0 : 1);
