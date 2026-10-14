/* ITALIANO: PROVA DI Ctrl+Z / Ctrl+Shift+Z CON LE TASTIERE NON LATINE
   Con la tastiera russa attiva (il russo e' una delle nove lingue del programma) Ctrl+Z e
   Ctrl+Shift+Z non facevano niente: il browser manda come tasto la lettera della tastiera attiva
   ("я"), e il gestore cercava solo "z". Annulla e Ripeti non hanno un pulsante, quindi non
   restava nessuna strada. La regola: vale la lettera scritta sul tasto quando e' una lettera
   latina (cosi' AZERTY e QWERTZ restano come sono: la Z e' dove la tastiera la mette); con una
   tastiera non latina vale il tasto fisico Z.
   Si esegue il testo VERO del gestore dei tasti preso da src/App.tsx (compilato con esbuild),
   con la regola vera di src/utils/shortcuts.ts se c'e'.
   Uso:  node scripts/test-undo-shortcut-layouts.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF Ctrl+Z / Ctrl+Shift+Z WITH NON-LATIN KEYBOARDS
   With the Russian keyboard active (Russian is one of the program's nine languages) Ctrl+Z and
   Ctrl+Shift+Z did nothing: the browser sends the active keyboard's letter as the key ("я"), and
   the handler only looked for "z". Undo and Redo have no button, so there was no other way. The
   rule: the letter printed on the key counts when it is a Latin letter (so AZERTY and QWERTZ stay
   as they are: Z is wherever the keyboard puts it); with a non-Latin keyboard the physical Z key
   counts.
   The REAL text of the key handler taken from src/App.tsx is run (compiled with esbuild), with
   the real rule of src/utils/shortcuts.ts when it exists.
   Usage:  node scripts/test-undo-shortcut-layouts.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');

// ITALIANO: la regola dei tasti; il codice di prima non l'aveva, e allora resta vuota.
// ENGLISH: the key rule; the previous code did not have it, and then it stays empty.
let R = {};
const modulo = path.join(radice, 'src/utils/shortcuts.ts');
if (fs.existsSync(modulo)) {
    const uscita = await esbuild.build({ entryPoints: [modulo], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
    R = await import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
}

// ITALIANO: il gestore dei tasti che chiama handleUndo, dalla sua intestazione al suo "};".
// ENGLISH: the key handler that calls handleUndo, from its header to its "};".
const iUndo = sorgente.indexOf('handleUndo();');
const inizio = iUndo < 0 ? -1 : sorgente.lastIndexOf('const handleKeyDown = (e: KeyboardEvent) => {', iUndo);
const chiusura = /\r?\n        \};\r?\n/g;
chiusura.lastIndex = Math.max(inizio, 0);
const fine = inizio < 0 ? null : chiusura.exec(sorgente);
if (!fine) { console.log('NO  gestore dei tasti di Ctrl+Z non trovato in src/App.tsx'); process.exit(1); }
const js = (await esbuild.transform(sorgente.slice(inizio, fine.index + fine[0].length), { loader: 'ts' })).code;

const chiuse = {
    isTagEditorOpen: false, confirmDialog: { isOpen: false }, saveCloseDialog: { isOpen: false }, importSummary: { isOpen: false },
    isApiKeyDialogOpen: false, isStatsOpen: false, exportChoice: null, updateAskOpen: false, updateFound: null,
};
const NOMI = Object.keys(chiuse);
const REGOLE = Object.keys(R);
const premi = (key, code, shift = false) => {
    const chiamate = [];
    const f = new Function('document', 'handleUndo', 'handleRedo', ...NOMI, ...REGOLE, js + '\nreturn handleKeyDown;')(
        { activeElement: { tagName: 'BODY' } }, () => chiamate.push('annulla'), () => chiamate.push('ripeti'),
        ...NOMI.map(n => chiuse[n]), ...REGOLE.map(n => R[n]));
    f({ ctrlKey: true, shiftKey: shift, key, code, preventDefault() { } });
    return chiamate;
};

console.log('\n--- tastiera russa: il tasto fisico Z ---');
dice('Ctrl+Z ("я") annulla', ['annulla'], premi('я', 'KeyZ'));
dice('Ctrl+Shift+Z ("Я") ripete', ['ripeti'], premi('Я', 'KeyZ', true));
dice('Ctrl con un altro tasto russo ("ч", tasto X) non fa niente', [], premi('ч', 'KeyX'));

console.log('\n--- quello che NON deve cambiare ---');
dice('tastiera italiana o inglese: Ctrl+Z annulla', ['annulla'], premi('z', 'KeyZ'));
dice('con il blocco maiuscole: Ctrl+Z annulla', ['annulla'], premi('Z', 'KeyZ'));
dice('tastiera italiana o inglese: Ctrl+Shift+Z ripete', ['ripeti'], premi('Z', 'KeyZ', true));
dice('tastiera francese (AZERTY): il tasto con la Z (fisico W) annulla', ['annulla'], premi('z', 'KeyW'));
dice('tastiera francese (AZERTY): il tasto con la W (fisico Z) non annulla', [], premi('w', 'KeyZ'));
dice('tastiera tedesca (QWERTZ): il tasto con la Z (fisico Y) annulla', ['annulla'], premi('z', 'KeyY'));
dice('tastiera tedesca (QWERTZ): il tasto con la Y (fisico Z) non annulla', [], premi('y', 'KeyZ'));
dice('un evento senza il tasto fisico (code) con "z" annulla ancora', ['annulla'], premi('z', undefined));

process.exit(esito());
