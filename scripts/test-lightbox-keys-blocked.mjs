/* ITALIANO: PROVA DEI TASTI DEL VISUALIZZATORE CON UNA FINESTRA APERTA SOPRA
   Il visualizzatore ascolta Esc e le frecce su tutta la pagina. Con la finestra della chiave API
   (aperta da "Genera tag con AI" senza chiave valida) o con il riepilogo dell'importazione (foto
   trascinate) SOPRA il visualizzatore, Esc chiudeva il visualizzatore sotto e lasciava la finestra,
   e le frecce cambiavano foto dietro la finestra. Ora App.tsx passa tastiBloccati con le stesse
   finestre che fermano gia' Ctrl+Z, e il gestore dei tasti si ferma. Si esegue il testo VERO di
   handleKeyDown (src/components/Lightbox.tsx). Casi vicini che non devono cambiare: senza finestre
   sopra Esc chiude e le frecce sfogliano; con il fuoco in una casella di testo i tasti restano
   alla casella; agli estremi (nessuna foto dopo/prima) le frecce non fanno niente.
   Uso:  node scripts/test-lightbox-keys-blocked.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE VIEWER'S KEYS WITH A DIALOG OPEN ON TOP
   The viewer listens to Esc and the arrows on the whole page. With the API key dialog (opened by
   "Generate tags with AI" without a valid key) or the import summary (dropped photos) OVER the
   viewer, Esc closed the viewer underneath and left the dialog, and the arrows changed photo behind
   the dialog. Now App.tsx passes tastiBloccati with the same dialogs that already stop Ctrl+Z, and
   the key handler stops. The REAL text of handleKeyDown (src/components/Lightbox.tsx) runs.
   Neighbouring cases that must not change: with no dialog on top Esc closes and the arrows browse;
   with focus in a text box the keys stay with the box; at the ends (no next/previous photo) the
   arrows do nothing.
   Usage:  node scripts/test-lightbox-keys-blocked.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();

const sorgente = fs.readFileSync(path.join(radice, 'src/components/Lightbox.tsx'), 'utf8');
const intestazione = '    const handleKeyDown = useCallback(';
const inizio = sorgente.indexOf(intestazione);
const chiusura = /\r?\n    \}, \[[^\]]*\]\);\r?\n/g;
chiusura.lastIndex = Math.max(inizio, 0);
const fine = inizio < 0 ? null : chiusura.exec(sorgente);
if (inizio < 0 || !fine) { console.log('NO  handleKeyDown non trovato in Lightbox.tsx'); process.exit(1); }
const js = (await esbuild.transform(sorgente.slice(inizio, fine.index + fine[0].length), { loader: 'tsx' })).code;

// ITALIANO: il nuovo prop deve essere letto dal componente (con valore predefinito falso).
// ENGLISH: the new prop must be read by the component (with a false default).
dice('Lightbox riceve il prop tastiBloccati (predefinito falso)', true, /tastiBloccati\s*=\s*false/.test(sorgente));

const premi = (tasto, { tastiBloccati = false, hasNext = true, hasPrev = true, fuoco = 'BUTTON' } = {}) => {
    const chiamate = [];
    const f = new Function('useCallback', 'imageRef', 'document', 'hasNext', 'hasPrev', 'onNext', 'onPrev', 'onClose', 'tastiBloccati',
        js + '\nreturn handleKeyDown;')(
        (fn) => fn, { current: { id: '1' } }, { activeElement: { tagName: fuoco } }, hasNext, hasPrev,
        () => chiamate.push('avanti'), () => chiamate.push('indietro'), () => chiamate.push('chiudi'), tastiBloccati);
    f({ key: tasto });
    return chiamate.join(',') || 'niente';
};

console.log('\n--- finestra aperta sopra il visualizzatore (chiave API, riepilogo importazione) ---');
dice('Esc non chiude il visualizzatore sotto', 'niente', premi('Escape', { tastiBloccati: true }));
dice('freccia destra non cambia foto dietro la finestra', 'niente', premi('ArrowRight', { tastiBloccati: true }));
dice('freccia sinistra non cambia foto dietro la finestra', 'niente', premi('ArrowLeft', { tastiBloccati: true }));

console.log('\n--- nessuna finestra sopra: come prima ---');
dice('Esc chiude', 'chiudi', premi('Escape'));
dice('freccia destra va avanti', 'avanti', premi('ArrowRight'));
dice('freccia sinistra va indietro', 'indietro', premi('ArrowLeft'));
dice('freccia destra sull\'ultima foto: niente', 'niente', premi('ArrowRight', { hasNext: false }));
dice('freccia sinistra sulla prima foto: niente', 'niente', premi('ArrowLeft', { hasPrev: false }));
dice('fuoco in una casella di testo: Esc resta alla casella', 'niente', premi('Escape', { fuoco: 'INPUT' }));
dice('fuoco in un\'area di testo: la freccia resta all\'area', 'niente', premi('ArrowRight', { fuoco: 'TEXTAREA' }));

console.log('\n--- App.tsx passa il prop con le finestre che fermano gia\' Ctrl+Z ---');
{
    const app = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
    const lb = app.indexOf('<Lightbox');
    const lbFine = lb < 0 ? -1 : app.indexOf('/>', lb);
    const blocco = lb < 0 ? '' : app.slice(lb, lbFine);
    const prop = /tastiBloccati=\{([^}]*)\}/.exec(blocco);
    dice('<Lightbox ... tastiBloccati={...}> presente', true, !!prop);
    // ITALIANO: l'elenco delle finestre della guardia di Ctrl+Z (stesso effetto, stesse finestre).
    // ENGLISH: the list of dialogs in the Ctrl+Z guard (same effect, same dialogs).
    const guardia = /if \((isTagEditorOpen \|\| confirmDialog\.isOpen[^{]*)\) \{\r?\n\s*return;/.exec(app);
    dice('premessa: guardia di Ctrl+Z trovata', true, !!guardia);
    const voci = guardia ? guardia[1].split('||').map((s) => s.trim()).filter(Boolean) : [];
    dice('premessa: la guardia elenca la chiave API e il riepilogo', true, voci.includes('isApiKeyDialogOpen') && voci.includes('importSummary.isOpen'));
    const nelProp = prop ? prop[1].split('||').map((s) => s.trim()) : [];
    const mancanti = voci.filter((v) => !nelProp.includes(v));
    dice('il prop contiene tutte le finestre della guardia', '', mancanti.join(' '));
}

process.exit(esito());
