/* ITALIANO: PROVA DI "SALVA MODIFICHE" MENTRE UN'ESPORTAZIONE SCRIVE
   "Esporta" -> "Tag e immagini" su qualche GB di foto scrive per minuti. Nel frattempo "Salva
   modifiche" ed "Esporta" restavano premibili: premendo Salva, alla fine del salvataggio (mezzo
   secondo) la barra di avanzamento spariva, anche se dataset.zip si stava ancora scrivendo.
   L'utente credeva l'esportazione finita e poteva chiudere il programma, perdendo l'archivio a
   meta'. E un secondo "Esporta" ne faceva partire un altro sulla stessa barra. La barra e i due
   tasti sono di una sola operazione per volta: mentre una scrive (isSaving), gli altri due tasti
   sono disattivati, e "Esporta" non riparte.
   Si eseguono i testi VERI di handleExportAll e formatoPeso presi da src/App.tsx, e si leggono i
   due tasti della barra in src/App.tsx.
   Uso:  node scripts/test-save-during-export.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF "SAVE CHANGES" WHILE AN EXPORT IS WRITING
   "Export" -> "Tags and images" on a few GB of photos writes for minutes. Meanwhile "Save changes"
   and "Export" stayed clickable: pressing Save, at the end of the save (half a second) the
   progress bar vanished, although dataset.zip was still being written. The user believed the
   export had finished and could quit the program, losing the half-written archive. And a second
   "Export" started another one on the same bar. The bar and the two buttons belong to one
   operation at a time: while one writes (isSaving), the two buttons are disabled, and "Export"
   does not start again.
   The REAL text of handleExportAll and formatoPeso taken from src/App.tsx is run, and the two
   toolbar buttons are read from src/App.tsx.
   Usage:  node scripts/test-save-during-export.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';
import { applySort, t } from './export-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();
const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const ritaglia = async (intestazione) => {
    const inizio = sorgente.indexOf(intestazione);
    const chiusura = /\r?\n    \};\r?\n/g;
    chiusura.lastIndex = Math.max(inizio, 0);
    const fine = inizio < 0 ? null : chiusura.exec(sorgente);
    if (inizio < 0 || !fine) {
        console.log('NO  non trovato in src/App.tsx: ' + intestazione.trim());
        process.exit(1);
    }
    return (await esbuild.transform(sorgente.slice(inizio, fine.index + fine[0].length), { loader: 'ts' })).code;
};

console.log('\n--- i due tasti della barra mentre un salvataggio o un\'esportazione scrive ---');
for (const gestore of ['handleSaveChanges', 'handleExportAll']) {
    const m = sorgente.match(new RegExp(`<button onClick=\\{${gestore}\\}[^>]*?disabled=\\{([^}]*)\\}`));
    dice(`il tasto di ${gestore} si disattiva con isSaving`, true, !!m && /\bisSaving\b/.test(m[1]));
}

console.log('\n--- "Esporta" premuto mentre un\'altra scrittura e\' in corso ---');
{
    const codice = (await ritaglia('    const formatoPeso = (byte: number): string => {')) + '\n' + (await ritaglia('    const handleExportAll = () => {'));
    const prova = (isSaving) => {
        const r = { scelta: null, notifiche: [] };
        const f = new Function('images', 'applySort', 'sortOrder', 'showNotification', 't', 'getOrderedTagString', 'setExportChoice', 'isSaving',
            codice + '\nreturn handleExportAll;')(
            [{ id: '1', file: { name: 'a.png', size: 10 }, tags: ['x'], isTrashed: false }], applySort, 'name-asc',
            (m, tipo) => r.notifiche.push([m, tipo]), t, (tags) => tags.join(', ') + ',', (v) => { r.scelta = v; }, isSaving);
        f();
        return r;
    };
    dice('con una scrittura in corso la finestra di scelta non si apre', null, prova(true).scelta);
    dice('senza scritture in corso si apre, come prima', true, prova(false).scelta !== null);
}

process.exit(esito());
