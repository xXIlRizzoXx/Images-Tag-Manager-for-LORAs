/* ITALIANO: PROVA DI DOVE COMPARE LA DOMANDA DI CHIUSURA DELLA FINESTRA
   Con delle modifiche non salvate e l'editor dei file di tag aperto (o la finestra della API key, o
   il riepilogo dell'importazione), premendo la X della finestra la domanda "Salva e chiudi /
   Chiudi senza salvare / Annulla" si apriva SOTTO l'altra finestra: non si vedeva niente, e una
   seconda X non faceva niente perche' la domanda era gia' aperta. La X sembrava morta. La regola:
   la domanda di chiusura sta sopra tutte le altre finestre del programma (sotto restano solo la
   scelta della lingua al primo avvio, la schermata di avvio e i messaggi a comparsa).
   Si leggono i valori z-index veri dai sorgenti (src/components/ui.tsx, TagFileEditor.tsx, App.tsx).
   Uso:  node scripts/test-close-dialog-zindex.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF WHERE THE WINDOW-CLOSE QUESTION APPEARS
   With unsaved edits and the Tag file editor open (or the API key dialog, or the import summary),
   pressing the window X opened the "Save and close / Close without saving / Cancel" question
   UNDER the other window: nothing could be seen, and a second X did nothing because the question
   was already open. The X looked dead. The rule: the close question sits above every other window
   of the program (only the first-run language picker, the splash screen and the toasts stay above).
   The real z-index values are read from the sources (src/components/ui.tsx, TagFileEditor.tsx, App.tsx).
   Usage:  node scripts/test-close-dialog-zindex.mjs      (exits with code 1 if anything is off) */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const leggi = (rel) => fs.readFileSync(path.join(radice, rel), 'utf8');
const ui = leggi('src/components/ui.tsx');
const editor = leggi('src/components/TagFileEditor.tsx');
const app = leggi('src/App.tsx');

// ITALIANO: lo z-index del primo `fixed inset-0 z-[N]` dopo il testo `da`. Dopo la parentesi deve
//           finire la classe: `z-[500]flex` (spazio perso) non e' una classe Tailwind, la finestra
//           restava senza z-index e senza flex, sotto tutto il programma, e la prova passava lo stesso.
// ENGLISH: the z-index of the first `fixed inset-0 z-[N]` after the text `da`. The class must end
//          after the bracket: `z-[500]flex` (lost space) is not a Tailwind class, the dialog had no
//          z-index and no flex, under the whole program, and the test still passed.
const Z_CLASSE = /fixed inset-0 z-\[(\d+)\](?=[\s"'`])/;
const zDopo = (testo, da, nome) => {
    const i = testo.indexOf(da);
    const m = i < 0 ? null : Z_CLASSE.exec(testo.slice(i));
    if (!m) { console.log(`NO  ${nome} non trovato`); process.exit(1); }
    return Number(m[1]);
};

// ITALIANO: la radice della domanda di chiusura ha le sue classi separate (centrata e sopra il resto).
// ENGLISH: the close question's root has its classes as separate tokens (centred and above the rest).
{
    const corpo = ui.slice(ui.indexOf('export const SaveBeforeCloseDialog'));
    const m = /className="(fixed inset-0[^"]*)"/.exec(corpo);
    const classi = m ? m[1].split(/\s+/) : [];
    for (const c of ['fixed', 'inset-0', 'z-[500]', 'flex', 'items-center', 'justify-center'])
        dice(`la radice di SaveBeforeCloseDialog ha la classe "${c}"`, true, classi.includes(c));
}

// ITALIANO: in nessun sorgente un valore tra parentesi quadre e' attaccato alla classe dopo.
// ENGLISH: in no source file is a bracketed value glued to the next class.
{
    const incollate = [];
    const giro = (cartella) => {
        for (const voce of fs.readdirSync(path.join(radice, cartella), { withFileTypes: true })) {
            const rel = cartella + '/' + voce.name;
            if (voce.isDirectory()) giro(rel);
            else if (/\.tsx$/.test(voce.name))
                for (const x of leggi(rel).matchAll(/[a-z][a-z0-9:-]*-\[[^\]\s"'`]*\][A-Za-z0-9]/g)) incollate.push(`${rel}: ${x[0]}`);
        }
    };
    giro('src');
    dice(`nessuna classe incollata alla successiva${incollate.length ? ' (' + incollate.join(', ') + ')' : ''}`, 0, incollate.length);
}

const chiusura = zDopo(ui, 'export const SaveBeforeCloseDialog', 'SaveBeforeCloseDialog');
const altre = {
    'editor dei file di tag (TagFileEditor)': Math.max(...[...editor.matchAll(new RegExp(Z_CLASSE.source, 'g'))].map(m => Number(m[1]))),
    'finestra della API key': zDopo(app, '{isApiKeyDialogOpen && (', 'finestra della API key'),
    'riepilogo dell\'importazione (ImportSummaryDialog)': zDopo(ui, 'export const ImportSummaryDialog', 'ImportSummaryDialog'),
    'finestra di conferma (CustomConfirmDialog)': zDopo(ui, 'export const CustomConfirmDialog', 'CustomConfirmDialog'),
    'area di rilascio dei file': zDopo(app, '{isDragging && (', 'area di rilascio'),
};
for (const [nome, z] of Object.entries(altre)) dice(`la domanda di chiusura (z ${chiusura}) sta sopra: ${nome} (z ${z})`, true, chiusura > z);

console.log('\n--- quello che NON deve cambiare ---');
dice('la schermata di avvio resta sopra', true, zDopo(app, '{showSplash && (', 'schermata di avvio') > chiusura);
dice('la scelta della lingua al primo avvio resta sopra', true, zDopo(app, '{showLangPicker && (', 'scelta della lingua') > chiusura);
const toast = /z-\[(\d+)\]/.exec(ui.slice(ui.indexOf('export const Toast')));
dice('i messaggi a comparsa restano sopra', true, !!toast && Number(toast[1]) > chiusura);

process.exit(esito());
