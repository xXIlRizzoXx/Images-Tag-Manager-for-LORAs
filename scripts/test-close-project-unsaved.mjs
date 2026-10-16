/* ITALIANO: PROVA DI "CHIUDI PROGETTO" CON MODIFICHE SOLO SU FOTO NEL CESTINO
   Si modificavano i tag di una foto, la si metteva nel cestino e si premeva "Chiudi progetto":
   compariva la finestra "Ci sono modifiche non salvate" a tre scelte, e "Salva e chiudi"
   rispondeva subito "Nessuna modifica da salvare." Le due frasi si smentivano a un secondo di
   distanza: la chiusura contava anche le foto nel cestino, il salvataggio (giustamente) no.
   Si eseguono i testi VERI di handleCloseProject e handleSaveChanges presi da src/App.tsx
   (compilati con esbuild), con i testi veri di src/constants.ts e foto finte in memoria. La
   regola: la finestra a tre scelte compare SE E SOLO SE "Salva" scriverebbe qualcosa.
   Uso:  node scripts/test-close-project-unsaved.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF "CLOSE PROJECT" WITH EDITS ONLY ON TRASHED PHOTOS
   Editing a photo's tags, trashing it and pressing "Close project" showed the three-choice
   "There are unsaved changes" dialog, and "Save and close" answered straight away "No changes to
   save." The two sentences contradicted each other a second apart: closing counted the trashed
   photos, saving (rightly) did not.
   The REAL text of handleCloseProject and handleSaveChanges taken from src/App.tsx is run
   (compiled with esbuild), with the real strings of src/constants.ts and fake in-memory photos.
   The rule: the three-choice dialog appears IF AND ONLY IF "Save" would write something.
   Usage:  node scripts/test-close-project-unsaved.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const uscita = await esbuild.build({
    entryPoints: [path.join(radice, 'src/constants.ts')],
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const t = (await import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'))).translations.en;
const uscitaG = await esbuild.build({
    entryPoints: [path.join(radice, 'src/utils/closeGuard.ts')],
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const G = await import('data:text/javascript;base64,' + Buffer.from(uscitaG.outputFiles[0].text).toString('base64'));
const uscitaS = await esbuild.build({
    entryPoints: [path.join(radice, 'src/utils/sidecarTags.ts')],
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const S = await import('data:text/javascript;base64,' + Buffer.from(uscitaS.outputFiles[0].text).toString('base64'));
const { dice, esito } = creaControlli();

// ITALIANO: una funzione vera, ritagliata dal sorgente fino alla sua riga di chiusura.
// ENGLISH: a real function, cut out of the source up to its closing line.
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
const jsChiudi = await ritaglia('    const handleCloseProject = () => {');
const jsSalva = await ritaglia('    const handleSaveChanges = async (): Promise<boolean> => {');
const fabbrica = new Function('images', 't', 'showNotification', 'performSave', 'setSaveCloseDialog', 'setConfirmDialog', 'closeProjectNow', 'fotoDaSalvare', 'globalTriggers', 'txtNonLettoInVigore',
    jsChiudi + '\n' + jsSalva + '\nreturn { handleCloseProject, handleSaveChanges };');

// ITALIANO: preme "Chiudi progetto" e poi, se compare la finestra a tre scelte, "Salva e chiudi".
// ENGLISH: presses "Close project" and then, if the three-choice dialog shows, "Save and close".
const prova = async (images) => {
    const r = { finestra: 'nessuna', notifiche: [], scritte: [] };
    const f = fabbrica(images, t,
        (m, tipo) => r.notifiche.push([m, tipo]),
        async (lista) => { r.scritte.push(...lista.map(i => i.file.name)); return true; },
        (d) => { if (d && d.isOpen) r.finestra = 'tre scelte'; },
        (d) => { if (d && d.isOpen) r.finestra = 'conferma semplice'; },
        () => { }, G.fotoDaSalvare, [], S.txtNonLettoInVigore);
    f.handleCloseProject();
    if (r.finestra === 'tre scelte') await f.handleSaveChanges();
    return r;
};
const foto = (name, tags, originalTags, isTrashed = false) => ({ id: name, file: { name }, tags, originalTags, isTrashed });

console.log('\n--- l\'unica modifica e\' su una foto nel cestino ---');
{
    const r = await prova([foto('a.png', ['x', 'nuovo'], ['x'], true), foto('b.png', ['y'], ['y'])]);
    dice('compare la conferma semplice, non "ci sono modifiche non salvate"', 'conferma semplice', r.finestra);
    dice('nessun "Nessuna modifica da salvare." subito dopo', [], r.notifiche);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const r = await prova([foto('a.png', ['x', 'nuovo'], ['x']), foto('b.png', ['y'], ['y'])]);
    dice('una foto attiva modificata: finestra a tre scelte, e "Salva e chiudi" la scrive', ['tre scelte', ['a.png']], [r.finestra, r.scritte]);
    const misto = await prova([foto('a.png', ['x', 'nuovo'], ['x'], true), foto('b.png', ['y', 'nuovo'], ['y'])]);
    dice('attiva e cestinata modificate: si scrive solo quella attiva', ['tre scelte', ['b.png']], [misto.finestra, misto.scritte]);
    const niente = await prova([foto('a.png', ['x'], ['x'])]);
    dice('niente di modificato: conferma semplice', 'conferma semplice', niente.finestra);
}

process.exit(esito());
