/* ITALIANO: PROVA: LA X DELLA FINESTRA CON LA FINESTRA A TRE SCELTE GIA' APERTA DA "CHIUDI PROGETTO"
   "Chiudi progetto" con modifiche non salvate apre la finestra a tre scelte con la frase del
   progetto. Se a quel punto si preme la X della finestra (o Alt+F4), la chiusura si ferma e da li'
   i tasti chiudono il PROGRAMMA (chiusuraFinestraRef), ma nessuno ridisegnava la finestra: titolo e
   testo restavano "Chiudere il progetto attuale?", e "Chiudi senza salvare" chiudeva il programma.
   Titolo e testo leggono il ref solo quando la finestra si ridisegna: ora la X, con la finestra
   gia' aperta, la fa ridisegnare (stesso contenuto, oggetto nuovo). Caso vicino che non cambia:
   con la finestra chiusa la X la apre come prima (e mette via l'editor).
   Si esegue il testo VERO del gestore della X (allaChiusura) preso da src/App.tsx.
   Uso:  node scripts/test-close-window-title-open.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST: THE WINDOW'S X WITH THE THREE-CHOICE DIALOG ALREADY OPEN FROM "CLOSE PROJECT"
   "Close project" with unsaved changes opens the three-choice dialog with the project sentence. If
   the window's X (or Alt+F4) is pressed then, the closing stops and from there the buttons close
   the PROGRAM (chiusuraFinestraRef), but nothing redrew the dialog: title and text stayed "Close
   the current project?", and "Close without saving" closed the program. Title and text read the
   ref only when the dialog redraws: now the X, with the dialog already open, makes it redraw (same
   content, new object). Neighbouring case that does not change: with the dialog closed the X opens
   it as before (and puts the editor away).
   The REAL text of the X handler (allaChiusura) taken from src/App.tsx is run.
   Usage:  node scripts/test-close-window-title-open.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const lingue = (await import('data:text/javascript;base64,' + Buffer.from((await esbuild.build({
    entryPoints: [path.join(radice, 'src/constants.ts')], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
})).outputFiles[0].text).toString('base64'))).translations;
const t = lingue.it;

const inizio = sorgente.indexOf('        const allaChiusura = (e: BeforeUnloadEvent) => {');
const fineRe = /\r?\n        \};\r?\n        window\.addEventListener\('beforeunload', allaChiusura\);/g;
fineRe.lastIndex = Math.max(inizio, 0);
const fine = inizio < 0 ? null : fineRe.exec(sorgente);
if (!fine) { console.log('NO  allaChiusura non trovato in src/App.tsx'); process.exit(1); }
const codice = (await esbuild.transform(sorgente.slice(inizio, fine.index) + '\n        };', { loader: 'ts' })).code;
const NOMI = ['permettiChiusuraRef', 'imagesRef', 'tagEditorDirtyRef', 'backupConFotoRef', 'dirHandle', 'scriviBackupSubito', 'localStorage',
    'fotoChiuseRef', 'globalTriggersRef', 'lottiSessioneRef', 'window', 'isSavingRef', 'chiusuraInScritturaRef', 'setTimeout', 'showNotification', 't',
    'ripristinoInCorsoRef', 'chiusuraInRipristinoRef', 'setIsTagEditorOpen', 'modificheNonSalvate', 'chiusuraFinestraRef', 'saveCloseDialogRef',
    'setSaveCloseDialog', 'svuotamentoInCorsoRef', 'chiusuraInSvuotamentoRef'];
const fabbrica = new Function(...NOMI, codice + '\nreturn allaChiusura;');

// ITALIANO: un'app finta con modifiche non salvate. `disegni` conta i ridisegni della finestra a tre
//           scelte (un oggetto di stato nuovo); `titolo()` e' quello che mostrerebbe adesso.
// ENGLISH: a fake app with unsaved changes. `disegni` counts the three-choice dialog's redraws (a new
//          state object); `titolo()` is what it would show now.
const app = (finestraAperta) => {
    const a = { dialogo: { isOpen: finestraAperta, isSaving: false }, disegni: 0, editor: true, timer: [] };
    a.refs = { chiusuraFinestraRef: { current: false }, saveCloseDialogRef: { current: a.dialogo } };
    const imposta = (v) => {
        const nuovo = typeof v === 'function' ? v(a.dialogo) : v;
        if (nuovo !== a.dialogo) a.disegni++;
        a.dialogo = nuovo;
        a.refs.saveCloseDialogRef.current = nuovo;
    };
    const nulla = () => { };
    const gestore = fabbrica({ current: false }, { current: [{ id: 'a' }] }, { current: false }, { current: true }, null, nulla, {},
        { current: new Map() }, { current: [] }, { current: [] }, { electronAPI: {} }, { current: false }, { current: false },
        (f) => { a.timer.push(f); return 0; }, nulla, t, { current: false }, { current: false }, (v) => { a.editor = v; }, () => true,
        a.refs.chiusuraFinestraRef, a.refs.saveCloseDialogRef, imposta, { current: false }, { current: false });
    a.x = () => {
        const e = { fermata: false, preventDefault() { this.fermata = true; }, returnValue: undefined };
        gestore(e);
        for (const f of a.timer.splice(0)) f();
        return e;
    };
    a.titolo = () => (a.refs.chiusuraFinestraRef.current ? t.closeAppTitle : t.closeAllTitle);
    return a;
};

console.log('\n--- finestra gia\' aperta da "Chiudi progetto", poi la X della finestra ---');
{
    const a = app(true);
    dice('prima della X la finestra parla del progetto', t.closeAllTitle, a.titolo());
    const e = a.x();
    dice('la X ferma la chiusura', true, e.fermata);
    dice('la finestra si ridisegna (cosi\' titolo e testo cambiano)', true, a.disegni >= 1);
    dice('...e dopo il ridisegno parla del programma', t.closeAppTitle, a.titolo());
    dice('...restando aperta e con lo stesso stato', { isOpen: true, isSaving: false }, a.dialogo);
}

console.log('\n--- finestra chiusa, la X: la apre come prima ---');
{
    const a = app(false);
    a.x();
    dice('la X apre la finestra a tre scelte', { isOpen: true, isSaving: false }, a.dialogo);
    dice('...che parla del programma', t.closeAppTitle, a.titolo());
    dice('...e mette via l\'editor che la copriva', false, a.editor);
}

process.exit(esito());
