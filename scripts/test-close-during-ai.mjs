/* ITALIANO: PROVA: "CHIUDI PROGETTO" MENTRE UN'AI CAMBIA ANCORA I TAG (LOTTO "TAGGA TUTTE CON AI" O MCP)
   Il tasto "Chiudi progetto" resta attivo durante il lotto AI, e un'AI via MCP cambia i tag quando vuole.
   Caso A: "Chiudi progetto" -> "Salva e chiudi"; mentre i .txt si scrivono l'AI tagga un'altra foto.
   Salva scriveva le foto com'erano al clic, poi closeProjectNow chiudeva il progetto e i tag arrivati
   dopo sparivano per sempre (il backup anti-crash prende originalTags), con "Modifiche salvate con
   successo!" a schermo. Caso B: al clic niente da salvare -> conferma semplice; l'AI tagga mentre e'
   aperta; "Conferma" chiudeva senza chiedere di salvare. Ora il progetto resta aperto, torna la
   finestra a tre scelte e un avviso (closeNewChangesMeanwhile) dice perche'.
   Casi vicini che non devono cambiare: "Salva e chiudi" senza AI chiude anche se imagesRef non ha
   ancora visto l'originalTags nuovo (si aggiorna dopo il render); la conferma semplice senza
   cambiamenti chiude; dopo il primo giro un secondo "Salva e chiudi" salva il resto e chiude.
   Si eseguono i testi VERI di handleCloseProject, handleSaveChanges, performSave e
   handleSaveAndCloseProject presi da src/App.tsx (compilati con esbuild).
   Uso:  node scripts/test-close-during-ai.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST: "CLOSE PROJECT" WHILE AN AI IS STILL CHANGING TAGS ("AI TAG ALL" BATCH OR MCP)
   The "Close project" button stays enabled during the AI batch, and an AI over MCP changes tags at
   any time. Case A: "Close project" -> "Save and close"; while the .txt files are written the AI tags
   another photo. Save wrote the photos as they were at the click, then closeProjectNow closed the
   project and the tags that arrived later were lost for good (the crash backup takes originalTags),
   with "Changes saved successfully!" on screen. Case B: nothing to save at the click -> simple
   confirmation; the AI tags while it is open; "Confirm" closed without asking to save. Now the
   project stays open, the three-choice dialog comes back and a notice (closeNewChangesMeanwhile)
   says why.
   Neighbouring cases that must not change: "Save and close" with no AI closes even when imagesRef
   has not yet seen the new originalTags (it updates after the render); the simple confirmation with
   no change closes; after the first round a second "Save and close" saves the rest and closes.
   The REAL texts of handleCloseProject, handleSaveChanges, performSave and handleSaveAndCloseProject
   taken from src/App.tsx are run (compiled with esbuild).
   Usage:  node scripts/test-close-during-ai.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const carica = async (rel) => {
    const u = await esbuild.build({ entryPoints: [path.join(radice, rel)], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
    return import('data:text/javascript;base64,' + Buffer.from(u.outputFiles[0].text).toString('base64'));
};
const t = (await carica('src/constants.ts')).translations.en;
const G = await carica('src/utils/closeGuard.ts');
const S = await carica('src/utils/sidecarTags.ts');
const P = await carica('src/utils/pathUtils.ts');
const { dice, esito } = creaControlli();

const sorgente = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
const ritaglia = async (intestazione) => {
    const inizio = sorgente.indexOf(intestazione);
    const chiusura = /\r?\n    \};\r?\n/g;
    chiusura.lastIndex = Math.max(inizio, 0);
    const fine = inizio < 0 ? null : chiusura.exec(sorgente);
    if (inizio < 0 || !fine) { console.log('NO  non trovato in src/App.tsx: ' + intestazione.trim()); process.exit(1); }
    return (await esbuild.transform(sorgente.slice(inizio, fine.index + fine[0].length), { loader: 'ts' })).code;
};
const codice = [
    await ritaglia('    const performSave = async (imagesToSave: any[]'),
    await ritaglia('    const handleSaveChanges = async (): Promise<boolean> => {'),
    await ritaglia('    const handleCloseProject = () => {'),
    await ritaglia('    const handleSaveAndCloseProject = async '),
].join('\n');
const NOMI = ['images', 'imagesRef', 'globalTriggers', 'globalTriggersRef', 'setImages', 't', 'showNotification', 'setSaveCloseDialog', 'setConfirmDialog',
    'closeProjectNow', 'fotoDaSalvare', 'txtNonLettoInVigore', 'avvisoSalvataggioRef', 'isSavingRef', 'console', 'chiusuraFinestraRef', 'permettiChiusuraRef',
    'window', 'chiudiFinestraSeRichiesto', 'setIsSaving', 'setImportProgress', 'getOrderedTagString', 'soundManager', 'buildTagFileName',
    'sanitizeFileName', 'sidecarTagFileName', 'isUndoRedoAction', 'gemelliDelTxt'];
const fabbrica = new Function(...NOMI, codice + '\nreturn { handleCloseProject, handleSaveAndCloseProject };');
// ITALIANO: updateImageTags e' un useCallback: si ritaglia fino a "}, [globalTriggers]);".
// ENGLISH: updateImageTags is a useCallback: it is cut up to "}, [globalTriggers]);".
const TC = await carica('src/utils/tagCase.ts');
const inizioTag = sorgente.indexOf('    const updateImageTags = useCallback(');
const fineTag = sorgente.indexOf('}, [globalTriggers]);', inizioTag);
if (inizioTag < 0 || fineTag < 0) { console.log('NO  updateImageTags non trovata in src/App.tsx'); process.exit(1); }
const codiceTag = (await esbuild.transform(sorgente.slice(inizioTag, fineTag + '}, [globalTriggers]);'.length), { loader: 'ts' })).code;
const creaUpdateImageTags = new Function('useCallback', 'uniqueTagsIgnoringCase', 'globalTriggers', 'setImages', 'imagesRef', codiceTag + '\nreturn updateImageTags;');
const muto = { log() { }, warn() { }, error() { } };
const pausa = (ms) => new Promise(r => setTimeout(r, ms));

/* ITALIANO: l'app finta. setImages cambia lo stato subito; imagesRef lo vede solo "dopo il render"
   (un giro dell'orologio), come l'effetto di App.tsx. La cartella finta scrive ogni .txt in 40 ms;
   `durante` gira a meta' della scrittura: e' l'AI che applica un risultato. closeProjectNow annota
   le foto con modifiche non salvate che butterebbe via.
   ENGLISH: the fake app. setImages changes the state at once; imagesRef sees it only "after the
   render" (one clock tick), like App.tsx's effect. The fake folder writes each .txt in 40 ms;
   `durante` runs halfway through the write: it is the AI applying a result. closeProjectNow records
   the photos with unsaved changes it would throw away. */
const creaApp = (immagini) => {
    const a = { stato: immagini, disco: {}, notifiche: [], tre: false, conferma: null, chiusure: 0, buttate: null, durante: null };
    const imagesRef = { current: immagini };
    a.imagesRef = imagesRef;
    a.setImages = (f) => { a.stato = typeof f === 'function' ? f(a.stato) : f; const s = a.stato; setTimeout(() => { imagesRef.current = s; }, 0); };
    const cartella = { getFileHandle: async (nome) => ({ createWritable: async () => {
        let testo = '';
        return { write: async (x) => { testo += x; await pausa(20); if (a.durante) { const d = a.durante; a.durante = null; d(); } await pausa(20); },
            close: async () => { a.disco[nome] = testo; if (a.allaFine) { const d = a.allaFine; a.allaFine = null; d(); } } };
    } }) };
    a.foto = (id, tags, originalTags) => ({ id, file: { name: id + '.png' }, tags, originalTags, isTrashed: false, dirHandle: cartella });
    a.render = () => fabbrica(a.stato, imagesRef, [], { current: [] }, a.setImages, t,
        (m, tipo) => a.notifiche.push([m, tipo]),
        (d) => { a.tre = !!(d && d.isOpen); },
        (d) => { a.conferma = d && d.isOpen ? d : null; },
        () => { a.chiusure++; a.buttate = a.stato.filter(i => !i.isTrashed && G.fotoDaSalvare(i, [])).map(i => i.id); a.stato = []; },
        G.fotoDaSalvare, S.txtNonLettoInVigore, { current: '' }, { current: false }, muto, { current: false }, { current: false },
        {}, () => { }, () => { }, () => { }, (tags) => (tags.length ? tags.join(', ') + ',' : ''), { chime() { } }, P.buildTagFileName,
        P.sanitizeFileName, P.sidecarTagFileName, { current: false }, async () => () => { });
    a.aiTagga = (id, tags) => a.setImages(p => p.map(i => i.id === id ? { ...i, tags } : i));
    // ITALIANO: come il lotto AI e "Tagga con AI" di una foto: passa dalla updateImageTags VERA.
    // ENGLISH: like the AI batch and single-photo "Tag with AI": goes through the REAL updateImageTags.
    a.aiTaggaVero = (id, tags) => creaUpdateImageTags((f) => f, TC.uniqueTagsIgnoringCase, [], a.setImages, imagesRef)(id, tags);
    return a;
};
const ultima = (a) => (a.notifiche[a.notifiche.length - 1] || [''])[0];

console.log('\n--- caso A: "Salva e chiudi" mentre l\'AI tagga un\'altra foto durante la scrittura ---');
{
    const a = creaApp([]);
    a.stato = [a.foto('a', ['cat', 'dog'], ['cat']), a.foto('b', [], [])]; a.imagesRef.current = a.stato;
    a.render().handleCloseProject();
    dice('premessa: compare la finestra a tre scelte', true, a.tre);
    a.durante = () => a.aiTagga('b', ['1girl', 'smile']);
    await a.render().handleSaveAndCloseProject();
    await pausa(5);
    dice('a.txt scritto', 'cat, dog,', a.disco['a.txt']);
    dice('il progetto NON si chiude: b.png ha tag arrivati dopo il clic', 0, a.chiusure);
    dice('la finestra a tre scelte torna aperta', true, a.tre);
    dice('l\'avviso dice perche\'', t.closeNewChangesMeanwhile, ultima(a));
    dice('i tag di b.png sono ancora nel programma', ['1girl', 'smile'], (a.stato.find(i => i.id === 'b') || {}).tags);
    // ITALIANO: secondo "Salva e chiudi", dal render di adesso: salva b.png e chiude.
    // ENGLISH: second "Save and close", from the current render: saves b.png and closes.
    await a.render().handleSaveAndCloseProject();
    await pausa(5);
    dice('secondo giro: b.txt scritto', '1girl, smile,', a.disco['b.txt']);
    dice('secondo giro: il progetto si chiude senza buttare niente', [1, []], [a.chiusure, a.buttate]);
}
{
    const a = creaApp([]);
    a.stato = [a.foto('a', ['cat', 'dog'], ['cat'])]; a.imagesRef.current = a.stato;
    a.render().handleCloseProject();
    a.durante = () => a.aiTagga('a', ['cat', 'dog', 'smile']);
    await a.render().handleSaveAndCloseProject();
    await pausa(5);
    dice('l\'AI ritocca proprio la foto che si sta salvando: il progetto resta aperto', [0, true], [a.chiusure, a.tre]);
}

console.log('\n--- caso B: conferma semplice aperta, l\'AI tagga, poi "Conferma" ---');
{
    const a = creaApp([]);
    a.stato = [a.foto('c', [], [])]; a.imagesRef.current = a.stato;
    a.render().handleCloseProject();
    dice('premessa: niente da salvare, conferma semplice', [true, false], [!!a.conferma, a.tre]);
    a.aiTagga('c', ['1girl', 'red hair']);
    await pausa(5);
    a.conferma.onConfirm();
    await pausa(5);
    dice('il progetto NON si chiude', 0, a.chiusure);
    dice('si apre la finestra a tre scelte al posto della conferma', [true, null], [a.tre, a.conferma]);
    dice('l\'avviso dice perche\'', t.closeNewChangesMeanwhile, ultima(a));
}

console.log('\n--- casi vicini che non devono cambiare ---');
{
    const a = creaApp([]);
    a.stato = [a.foto('a', ['cat', 'dog'], ['cat']), a.foto('b', ['x'], ['x'])]; a.imagesRef.current = a.stato;
    a.render().handleCloseProject();
    await a.render().handleSaveAndCloseProject();
    await pausa(5);
    dice('"Salva e chiudi" senza AI: salva e chiude (imagesRef ancora indietro non conta)', [1, [], 'cat, dog,'], [a.chiusure, a.buttate, a.disco['a.txt']]);
    dice('"Salva e chiudi" senza AI: nessun avviso di tag arrivati', false, a.notifiche.some(([m]) => m === t.closeNewChangesMeanwhile));
}
{
    const a = creaApp([]);
    a.stato = [a.foto('c', ['x'], ['x'])]; a.imagesRef.current = a.stato;
    a.render().handleCloseProject();
    a.conferma.onConfirm();
    dice('conferma semplice senza cambiamenti: chiude', [1, null, false], [a.chiusure, a.conferma, a.tre]);
}
{
    const a = creaApp([]);
    const d = a.foto('d', ['x'], ['x']);
    a.stato = [d, { ...a.foto('e', ['nuovo'], []), isTrashed: true }]; a.imagesRef.current = a.stato;
    a.render().handleCloseProject();
    a.conferma.onConfirm();
    dice('conferma semplice: una modifica solo su una foto nel cestino non ferma la chiusura', 1, a.chiusure);
}

// ITALIANO: il risultato dell'AI arriva proprio alla fine dell'ultima scrittura, prima del render: il
//           controllo legge imagesRef subito dopo il salvataggio. updateImageTags deve aggiornarlo
//           subito (come il percorso MCP), altrimenti il progetto si chiude e quei tag si perdono.
// ENGLISH: the AI result arrives right at the end of the last write, before the render: the check
//          reads imagesRef right after the save. updateImageTags must update it at once (like the MCP
//          path), otherwise the project closes and those tags are lost.
console.log('\n--- caso A2: il risultato dell\'AI arriva alla fine della scrittura (updateImageTags vera) ---');
{
    const a = creaApp([]);
    a.stato = [a.foto('a', ['cat', 'dog'], ['cat']), a.foto('b', [], [])]; a.imagesRef.current = a.stato;
    a.render().handleCloseProject();
    a.allaFine = () => a.aiTaggaVero('b', ['smile', '1girl']);
    await a.render().handleSaveAndCloseProject();
    await pausa(5);
    dice('il progetto NON si chiude: b.png ha tag arrivati alla fine della scrittura', 0, a.chiusure);
    dice('l\'avviso dice perche\'', t.closeNewChangesMeanwhile, ultima(a));
    dice('i tag di b.png sono ancora nel programma, in ordine', ['1girl', 'smile'], (a.stato.find(i => i.id === 'b') || {}).tags);
}

process.exit(esito());
