/* ITALIANO: PROVA DI Ctrl+Z / Ctrl+Shift+Z CON UNA FINESTRA APERTA SOPRA IL PROGETTO
   Nell'editor di tag si toglieva una pillola con la sua X e si premeva Ctrl+Z aspettandosi di
   riaverla: l'editor restava uguale, compariva "Azione annullata" e dietro la finestra veniva
   annullata l'ultima modifica del PROGETTO, senza vederla. Lo stesso con una conferma aperta (su
   "Svuota cestino" Ctrl+Z rimetteva in galleria una foto prima di confermare), con le statistiche,
   la finestra della chiave API, il riepilogo dell'import, la scelta dell'esportazione e le domande
   sugli aggiornamenti. La regola: con una di queste finestre aperta, Ctrl+Z e Ctrl+Shift+Z non
   toccano il progetto. Restano attivi dove il progetto si vede e si modifica: galleria,
   visualizzatore, cestino e gestione dei tag del progetto.
   Si esegue il testo VERO del gestore dei tasti preso da src/App.tsx (compilato con esbuild).
   Uso:  node scripts/test-undo-shortcut-modals.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF Ctrl+Z / Ctrl+Shift+Z WITH A DIALOG OPEN OVER THE PROJECT
   In the tag editor a pill was removed with its X and Ctrl+Z pressed to get it back: the editor
   stayed the same, "Action undone" appeared, and behind the dialog the PROJECT's last edit was
   undone, out of sight. The same with a confirmation open (on "Empty trash" Ctrl+Z put a photo back
   in the gallery before confirming), with the statistics, the API key dialog, the import summary,
   the export choice and the update questions. The rule: with one of these dialogs open, Ctrl+Z and
   Ctrl+Shift+Z leave the project alone. They stay active where the project is seen and edited:
   gallery, viewer, trash and project tag manager.
   The REAL text of the key handler taken from src/App.tsx is run (compiled with esbuild).
   Usage:  node scripts/test-undo-shortcut-modals.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');

// ITALIANO: il gestore dei tasti che chiama handleUndo, dalla sua intestazione al suo "};".
// ENGLISH: the key handler that calls handleUndo, from its header to its "};".
const iUndo = sorgente.indexOf('handleUndo();');
const inizio = iUndo < 0 ? -1 : sorgente.lastIndexOf('const handleKeyDown = (e: KeyboardEvent) => {', iUndo);
const chiusura = /\r?\n        \};\r?\n/g;
chiusura.lastIndex = Math.max(inizio, 0);
const fine = inizio < 0 ? null : chiusura.exec(sorgente);
if (!fine) { console.log('NO  gestore dei tasti di Ctrl+Z non trovato in src/App.tsx'); process.exit(1); }
const js = (await esbuild.transform(sorgente.slice(inizio, fine.index + fine[0].length), { loader: 'ts' })).code;
// ITALIANO: la regola dei tasti (src/utils/shortcuts.ts); il codice di prima non l'aveva.
// ENGLISH: the key rule (src/utils/shortcuts.ts); the previous code did not have it.
let R = {};
const modulo = path.join(radice, 'src/utils/shortcuts.ts');
if (fs.existsSync(modulo)) {
    const uscita = await esbuild.build({ entryPoints: [modulo], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
    R = await import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
}
const REGOLE = Object.keys(R);

// ITALIANO: ogni stato di finestra che il gestore puo' leggere, tutto chiuso.
// ENGLISH: every dialog state the handler may read, all closed.
const chiuse = () => ({
    isTagEditorOpen: false, confirmDialog: { isOpen: false }, saveCloseDialog: { isOpen: false }, importSummary: { isOpen: false },
    isApiKeyDialogOpen: false, isStatsOpen: false, exportChoice: null, updateAskOpen: false, updateFound: null,
    selectedImageId: null, isTrashOpen: false, isGlobalTagManagerOpen: false, isTagSuggestionsOpen: false,
});
const NOMI = Object.keys(chiuse());
const premi = (stato, { fuoco = 'BODY', maiuscolo = false } = {}) => {
    const chiamate = [];
    const f = new Function('document', 'handleUndo', 'handleRedo', ...NOMI, ...REGOLE, js + '\nreturn handleKeyDown;')(
        { activeElement: { tagName: fuoco } }, () => chiamate.push('annulla'), () => chiamate.push('ripeti'), ...NOMI.map(n => stato[n]),
        ...REGOLE.map(n => R[n]));
    f({ ctrlKey: true, shiftKey: maiuscolo, key: maiuscolo ? 'Z' : 'z', code: 'KeyZ', preventDefault() { } });
    return chiamate;
};
const con = (cambi) => ({ ...chiuse(), ...cambi });

console.log('\n--- finestre sopra il progetto: Ctrl+Z e Ctrl+Shift+Z non lo toccano ---');
for (const [nome, cambi, fuoco] of [
    ['editor di tag (fuoco tornato alla pagina dopo la X su una pillola)', { isTagEditorOpen: true }, 'BODY'],
    ['conferma "Svuota cestino" (fuoco sul tasto)', { confirmDialog: { isOpen: true } }, 'BUTTON'],
    ['finestra "salva prima di chiudere"', { saveCloseDialog: { isOpen: true } }, 'BUTTON'],
    ['riepilogo dell\'import', { importSummary: { isOpen: true } }, 'BUTTON'],
    ['finestra della chiave API', { isApiKeyDialogOpen: true }, 'BUTTON'],
    ['statistiche', { isStatsOpen: true }, 'BODY'],
    ['scelta dell\'esportazione', { exportChoice: { riepilogo: {} } }, 'BUTTON'],
    ['domanda sul controllo degli aggiornamenti', { updateAskOpen: true }, 'BUTTON'],
    ['versione nuova trovata', { updateFound: { versione: '9.9.9', pagina: '' } }, 'BUTTON'],
]) {
    dice(`${nome}: Ctrl+Z e Ctrl+Shift+Z non fanno niente`, [[], []], [premi(con(cambi), { fuoco }), premi(con(cambi), { fuoco, maiuscolo: true })]);
}

console.log('\n--- quello che NON deve cambiare ---');
dice('galleria: Ctrl+Z annulla, Ctrl+Shift+Z ripete', [['annulla'], ['ripeti']], [premi(chiuse()), premi(chiuse(), { maiuscolo: true })]);
dice('visualizzatore aperto: Ctrl+Z annulla la modifica dei tag della foto', ['annulla'], premi(con({ selectedImageId: 'P' })));
dice('cestino aperto: Ctrl+Z annulla', ['annulla'], premi(con({ isTrashOpen: true })));
dice('gestione dei tag del progetto aperta: Ctrl+Z riporta un tag tolto da tutte le foto', ['annulla'], premi(con({ isGlobalTagManagerOpen: true })));
dice('mentre si scrive in una casella, Ctrl+Z resta della casella', [], premi(chiuse(), { fuoco: 'INPUT' }));

process.exit(esito());
