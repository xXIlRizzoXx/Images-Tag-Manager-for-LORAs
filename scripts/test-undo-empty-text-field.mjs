/* ITALIANO: PROVA DI Ctrl+Z SUBITO DOPO AVER AGGIUNTO UN TAG CON INVIO
   Nella casella dei tag di una foto (e nel riquadro delle trigger word, nella casella «Cerca o
   aggiungi» del visualizzatore, in «aggiungi tag al progetto») Invio aggiunge il tag, svuota la
   casella e lascia il fuoco li'. Il gestore di Ctrl+Z usciva per ogni campo di testo, anche vuoto:
   Ctrl+Z non annullava niente finche' non si cliccava altrove (una trigger sbagliata restava su
   tutte le foto). Ora un campo di testo VUOTO non tiene Ctrl+Z per se': non ha niente da annullare.
   Un campo con del testo dentro lo tiene come prima, e le finestre aperte sopra il progetto
   continuano a fermare Ctrl+Z.
   Si esegue il testo VERO del gestore dei tasti preso da src/App.tsx con le regole vere di
   src/utils/shortcuts.ts.
   Uso:  node scripts/test-undo-empty-text-field.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF Ctrl+Z RIGHT AFTER ADDING A TAG WITH ENTER
   In a photo's tag box (and in the trigger word box, the viewer's "Search or add" box, "add tag to
   project") Enter adds the tag, empties the box and leaves the focus there. The Ctrl+Z handler left
   for any text field, empty ones too: Ctrl+Z undid nothing until a click elsewhere (a wrong trigger
   stayed on every photo). Now an EMPTY text field does not keep Ctrl+Z for itself: it has nothing to
   undo. A field with text in it keeps it as before, and dialogs open over the project still stop
   Ctrl+Z.
   The REAL text of the key handler from src/App.tsx is run with the real rules of
   src/utils/shortcuts.ts.
   Usage:  node scripts/test-undo-empty-text-field.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');

const iUndo = sorgente.indexOf('handleUndo();');
const inizio = iUndo < 0 ? -1 : sorgente.lastIndexOf('const handleKeyDown = (e: KeyboardEvent) => {', iUndo);
const chiusura = /\r?\n        \};\r?\n/g;
chiusura.lastIndex = Math.max(inizio, 0);
const fine = inizio < 0 ? null : chiusura.exec(sorgente);
if (!fine) { console.log('NO  gestore dei tasti di Ctrl+Z non trovato in src/App.tsx'); process.exit(1); }
const js = (await esbuild.transform(sorgente.slice(inizio, fine.index + fine[0].length), { loader: 'ts' })).code;
const uscita = await esbuild.build({ entryPoints: [path.join(radice, 'src/utils/shortcuts.ts')], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
const R = await import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
const REGOLE = Object.keys(R);

const chiuse = () => ({
    isTagEditorOpen: false, confirmDialog: { isOpen: false }, saveCloseDialog: { isOpen: false }, importSummary: { isOpen: false },
    isApiKeyDialogOpen: false, isStatsOpen: false, exportChoice: null, updateAskOpen: false, updateFound: null, aiuto: null,
});
const NOMI = Object.keys(chiuse());
// ITALIANO: `attivo` = l'elemento col fuoco, con il suo value come in un DOM vero (sempre un testo).
// ENGLISH: `attivo` = the focused element, with its value as in a real DOM (always a string).
const premi = (attivo, { maiuscolo = false, stato = chiuse() } = {}) => {
    const chiamate = [];
    let prevenuto = false;
    const f = new Function('document', 'handleUndo', 'handleRedo', ...NOMI, ...REGOLE, js + '\nreturn handleKeyDown;')(
        { activeElement: attivo }, () => chiamate.push('annulla'), () => chiamate.push('ripeti'), ...NOMI.map(n => stato[n]),
        ...REGOLE.map(n => R[n]));
    f({ ctrlKey: true, shiftKey: maiuscolo, key: maiuscolo ? 'Z' : 'z', code: 'KeyZ', preventDefault() { prevenuto = true; } });
    return { chiamate, prevenuto };
};

console.log('\n--- campo di testo VUOTO (subito dopo Invio): Ctrl+Z annulla il progetto ---');
for (const tipo of ['text', 'search', '']) {
    const r = premi({ tagName: 'INPUT', type: tipo, value: '' });
    dice(`casella "${tipo}" vuota: Ctrl+Z annulla (e ferma l'annulla del campo)`, [['annulla'], true], [r.chiamate, r.prevenuto]);
    dice(`casella "${tipo}" vuota: Ctrl+Shift+Z ripete`, ['ripeti'], premi({ tagName: 'INPUT', type: tipo, value: '' }, { maiuscolo: true }).chiamate);
}
dice('area di testo vuota: Ctrl+Z annulla', ['annulla'], premi({ tagName: 'TEXTAREA', value: '' }).chiamate);

console.log('\n--- quello che NON deve cambiare ---');
{
    const r = premi({ tagName: 'INPUT', type: 'text', value: 'ca' });
    dice('casella con «ca» scritto a meta\': Ctrl+Z resta della casella', [[], false], [r.chiamate, r.prevenuto]);
}
dice('casella con del testo: Ctrl+Shift+Z resta della casella', [], premi({ tagName: 'INPUT', type: 'text', value: 'cat' }, { maiuscolo: true }).chiamate);
dice('area di testo con del testo: Ctrl+Z resta dell\'area', [], premi({ tagName: 'TEXTAREA', value: 'x' }).chiamate);
dice('elemento modificabile (contenteditable), anche vuoto: Ctrl+Z resta suo', [], premi({ tagName: 'DIV', isContentEditable: true, textContent: '' }).chiamate);
dice('casella vuota nell\'editor dei file di tag aperto: niente', [], premi({ tagName: 'INPUT', type: 'text', value: '' }, { stato: { ...chiuse(), isTagEditorOpen: true } }).chiamate);
dice('casella vuota nella finestra della chiave API: niente', [], premi({ tagName: 'INPUT', type: 'password', value: '' }, { stato: { ...chiuse(), isApiKeyDialogOpen: true } }).chiamate);
dice('fuoco sulla pagina: Ctrl+Z annulla', ['annulla'], premi({ tagName: 'BODY' }).chiamate);
dice('cursore dello zoom: Ctrl+Z annulla', ['annulla'], premi({ tagName: 'INPUT', type: 'range', value: '50' }).chiamate);

process.exit(esito());
