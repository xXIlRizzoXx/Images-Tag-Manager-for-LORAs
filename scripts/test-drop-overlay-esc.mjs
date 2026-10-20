/* ITALIANO: PROVA DEL VELO "RILASCIA QUI LE IMMAGINI" DOPO UN TRASCINAMENTO ANNULLATO CON ESC
   Trascinando dei file sulla finestra compare il velo. Se l'utente annulla il trascinamento con Esc,
   il browser non manda sempre l'ultimo "dragleave": il contatore restava sopra zero e il velo restava
   a schermo finche' non si trascinava di nuovo qualcosa. Durante un trascinamento il browser non
   manda eventi del mouse: il primo movimento del mouse (o un clic) dopo vuol dire che il
   trascinamento e' finito, e ora spegne il velo.
   Si esegue il codice VERO dell'effetto del trascinamento preso da src/App.tsx, con una finestra finta.
   Uso:  node scripts/test-drop-overlay-esc.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE "DROP IMAGES HERE" OVERLAY AFTER A DRAG CANCELLED WITH ESC
   Dragging files over the window shows the overlay. When the user cancels the drag with Esc, the
   browser does not always send the last "dragleave": the counter stayed above zero and the overlay
   stayed on screen until something was dragged again. During a drag the browser sends no mouse
   events: the first mouse move (or click) afterwards means the drag is over, and it now turns the
   overlay off.
   The REAL code of the drag effect taken from src/App.tsx is run, with a fake window.
   Usage:  node scripts/test-drop-overlay-esc.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const inizio = sorgente.indexOf('    useEffect(() => {\r\n        let dragDepth = 0;') >= 0
    ? sorgente.indexOf('    useEffect(() => {\r\n        let dragDepth = 0;')
    : sorgente.indexOf('    useEffect(() => {\n        let dragDepth = 0;');
const fine = sorgente.indexOf('    }, []);', inizio);
if (inizio < 0 || fine < 0) { console.log('NO  effetto del trascinamento non trovato in src/App.tsx'); process.exit(1); }
const codice = (await esbuild.transform(sorgente.slice(inizio, fine + '    }, []);'.length), { loader: 'ts' })).code;

const avvia = () => {
    const finestra = new EventTarget();
    const s = { velo: false, rilasci: 0, pulizia: null };
    const useEffect = (f) => { s.pulizia = f(); };
    new Function('useEffect', 'window', 'setIsDragging', 'dropHandlerRef', codice)(
        useEffect, finestra, (v) => { s.velo = v; }, { current: () => { s.rilasci++; } });
    const manda = (tipo, conFile = true) => {
        const e = new Event(tipo, { cancelable: true });
        e.dataTransfer = conFile ? { types: ['Files'], files: [{ name: 'a.png' }], items: [] } : { types: ['text/plain'], files: [], items: [] };
        finestra.dispatchEvent(e);
        return e;
    };
    return { finestra, s, manda };
};

console.log('\n--- trascinamento annullato con Esc (manca l\'ultimo dragleave) ---');
{
    const { s, manda } = avvia();
    manda('dragenter'); manda('dragenter'); manda('dragleave');
    dice('premessa: durante il trascinamento il velo e\' acceso', true, s.velo);
    manda('mousemove', false);
    dice('il primo movimento del mouse dopo spegne il velo', false, s.velo);
    manda('dragenter');
    dice('un trascinamento nuovo lo riaccende', true, s.velo);
    manda('dragleave');
    dice('e il suo dragleave lo spegne di nuovo (contatore ripartito da zero)', false, s.velo);
}
{
    const { s, manda } = avvia();
    manda('dragenter');
    manda('pointerdown', false);
    dice('anche un clic dopo il trascinamento annullato spegne il velo', false, s.velo);
}

console.log('\n--- quello che non deve cambiare ---');
{
    const { s, manda } = avvia();
    manda('dragenter'); manda('dragenter'); manda('dragleave');
    dice('passando sopra un elemento figlio il velo resta', true, s.velo);
    const e = manda('drop');
    dice('il rilascio spegne il velo e importa', [false, 1, true], [s.velo, s.rilasci, e.defaultPrevented]);
}
{
    const { s, manda } = avvia();
    manda('mousemove', false);
    dice('un movimento del mouse senza trascinamento non fa niente', false, s.velo);
    manda('dragenter', false);
    dice('un trascinamento di testo (non file) non accende il velo', false, s.velo);
}
{
    const { finestra, s, manda } = avvia();
    s.pulizia();
    manda('dragenter');
    dice('dopo lo smontaggio i listener sono tolti', false, s.velo);
    void finestra;
}

process.exit(esito());
