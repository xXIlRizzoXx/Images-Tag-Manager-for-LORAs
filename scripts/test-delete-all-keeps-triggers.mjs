/* ITALIANO: PROVA DI "ELIMINA TUTTI I TAG" CON LE TRIGGER WORD ATTIVE
   Con la trigger word "mychar" nel riquadro delle trigger word globali, "Elimina tutti i tag"
   toglieva a tutte le foto ANCHE la trigger, mentre il riquadro continuava a mostrarla: nessuno la
   rimetteva (le si aggiunge solo quando si scrive nel riquadro), quindi ritaggando e salvando
   tutti i .txt uscivano senza la trigger, e le foto importate dopo la ricevevano. Un dataset LoRA
   con la trigger solo su una parte delle didascalie. La regola: le trigger word restano sulle foto
   che le avevano (una foto a cui era stata tolta a mano non la riprende) e la finestra di conferma
   lo dice, in tutte e nove le lingue.
   Si esegue il testo VERO di handleDeleteAllTags e di getOrderedTagString preso da src/App.tsx
   (compilato con esbuild), con i testi veri di src/constants.ts.
   Uso:  node scripts/test-delete-all-keeps-triggers.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF "DELETE ALL TAGS" WITH TRIGGER WORDS ACTIVE
   With the trigger word "mychar" in the global trigger words box, "Delete all tags" stripped the
   trigger from every photo TOO, while the box kept showing it: nothing put it back (it is only
   added when typed into the box), so after re-tagging and saving every .txt came out without the
   trigger, and photos imported later did get it. A LoRA dataset with the trigger on only part of
   its captions. The rule: trigger words stay on the photos that had them (a photo it was removed
   from by hand does not get it back) and the confirmation says so, in all nine languages.
   The REAL text of handleDeleteAllTags and getOrderedTagString taken from src/App.tsx is run
   (compiled with esbuild), with the real strings of src/constants.ts.
   Usage:  node scripts/test-delete-all-keeps-triggers.mjs      (exits with code 1 if anything is off) */

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
const lingue = (await import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'))).translations;
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
const fabbrica = new Function('globalTriggers', 'setConfirmDialog', 'setImages', 'setCustomProjectTags', 'soundManager', 'showNotification', 't',
    (await ritaglia('    const handleDeleteAllTags = () => {')) + '\n' + (await ritaglia('    const getOrderedTagString = ')) +
    '\nreturn { handleDeleteAllTags, getOrderedTagString };');

// ITALIANO: preme "Elimina tutti i tag" e conferma; torna le foto e cosa mostrava la conferma.
// ENGLISH: presses "Delete all tags" and confirms; returns the photos and what the confirmation showed.
const eliminaTutti = (foto, trigger) => {
    let immagini = foto, dialogo = null, palette = ['x'];
    const f = fabbrica(trigger,
        (d) => { dialogo = typeof d === 'function' ? d(dialogo) : d; },
        (fn) => { immagini = fn(immagini); },
        (fn) => { palette = typeof fn === 'function' ? fn(palette) : fn; },
        { pop() { } }, () => { }, lingue.en);
    f.handleDeleteAllTags();
    const messaggio = dialogo.message;
    dialogo.onConfirm();
    return { immagini, messaggio, palette, testo: (img) => f.getOrderedTagString(img.tags) };
};

console.log('\n--- trigger "mychar" attiva, "Elimina tutti i tag" ---');
{
    const r = eliminaTutti([
        { id: '1', tags: ['mychar', 'red hair', 'smile'] },
        { id: '2', tags: ['mychar', 'outdoors'] },
        { id: '3', tags: ['blue eyes'] },
    ], ['mychar']);
    dice('la trigger resta sulle foto che l\'avevano; gli altri tag se ne vanno', [['mychar'], ['mychar'], []], r.immagini.map(i => i.tags));
    dice('una foto a cui la trigger era stata tolta a mano non la riprende', [], r.immagini[2].tags);
    dice('il .txt che si salvera\' comincia con la trigger', 'mychar,', r.testo(r.immagini[0]));
    dice('l\'elenco dei tag del progetto si svuota come prima', [], r.palette);
}

console.log('\n--- due trigger, nell\'ordine scelto dall\'utente ---');
{
    const r = eliminaTutti([{ id: '1', tags: ['zeta', 'smile', 'alfa'] }], ['zeta', 'alfa']);
    dice('restano tutte e due, nell\'ordine delle trigger', ['zeta', 'alfa'], r.immagini[0].tags);
}

console.log('\n--- senza trigger: tutto come prima ---');
{
    const r = eliminaTutti([{ id: '1', tags: ['a', 'b'] }], []);
    dice('tutti i tag se ne vanno', [[]], r.immagini.map(i => i.tags));
}

console.log('\n--- la conferma lo dice, in tutte e nove le lingue ---');
{
    const r = eliminaTutti([{ id: '1', tags: ['a'] }], []);
    dice('la conferma usa confirmDeleteAllTagsMsg', lingue.en.confirmDeleteAllTagsMsg, r.messaggio);
    // ITALIANO: il nome delle trigger word come lo scrive ogni lingua nel riquadro (segnaposto).
    // ENGLISH: the trigger words' name as each language writes it in the box (placeholder).
    const nomi = { it: 'trigger word', en: 'trigger words', fr: 'mots déclencheurs', es: 'palabras desencadenantes', de: 'Trigger-Wörter',
        zh: '触发词', ja: 'トリガーワード', pt: 'palavras-gatilho', ru: 'триггеры' };
    for (const [codice, nome] of Object.entries(nomi)) {
        const testo = String((lingue[codice] || {}).confirmDeleteAllTagsMsg || '');
        dice(`[${codice}] la conferma nomina le trigger word ("${nome}")`, true, testo.toLowerCase().includes(nome.toLowerCase()));
    }
}

// ITALIANO: la X su una pillola del gestore dei tag del progetto (handleDeleteTagFromProject). Sulla
//           trigger "mychar" la toglieva da tutte le foto mentre il riquadro delle trigger continuava
//           a mostrarla: i .txt salvati dopo uscivano senza, le foto importate dopo la ricevevano. Ora
//           la X su una trigger la toglie anche dal riquadro, come toglierla dal riquadro a mano.
// ENGLISH: the X on a pill of the project tag manager (handleDeleteTagFromProject). On the trigger
//          "mychar" it stripped it from every photo while the trigger box kept showing it: .txt
//          files saved afterwards came out without it, photos imported later got it. Now the X on a
//          trigger also takes it out of the box, like removing it from the box by hand.
const caso = await esbuild.build({
    entryPoints: [path.join(radice, 'src/utils/tagCase.ts')],
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const C = await import('data:text/javascript;base64,' + Buffer.from(caso.outputFiles[0].text).toString('base64'));
const fabbricaX = new Function('globalTriggers', 'setGlobalTriggers', 'globalTriggersRef', 'images', 'setImages', 'setCustomProjectTags', 'soundManager', 'uniqueTagsIgnoringCase',
    (await ritaglia('    const handleDeleteTagFromProject = (')) + '\n' + (await ritaglia('    const handleGlobalTagsChange = (')) +
    '\nreturn { handleDeleteTagFromProject };');
// ITALIANO: preme la X sul tag `tag`; torna le foto, il riquadro delle trigger e l'elenco del progetto.
// ENGLISH: presses the X on tag `tag`; returns the photos, the trigger box and the project list.
const premiX = (foto, trigger, tag) => {
    let immagini = foto, riquadro = trigger, palette = ['smile', 'altro'];
    fabbricaX(trigger,
        (v) => { riquadro = typeof v === 'function' ? v(riquadro) : v; }, { current: trigger }, foto,
        (fn) => { immagini = typeof fn === 'function' ? fn(immagini) : fn; },
        (fn) => { palette = typeof fn === 'function' ? fn(palette) : fn; },
        { click() { }, pop() { } }, C.uniqueTagsIgnoringCase).handleDeleteTagFromProject(tag);
    return { immagini: immagini.map(i => i.tags), riquadro, palette };
};

console.log('\n--- gestore dei tag del progetto: X sulla trigger "mychar" ---');
{
    const r = premiX([{ id: '1', tags: ['mychar', 'red hair'] }, { id: '2', tags: ['mychar', 'smile'] }], ['mychar'], 'mychar');
    dice('la trigger lascia anche il riquadro: le foto importate dopo non la ricevono', [], r.riquadro);
    dice('e lascia tutte le foto, come chiesto', [['red hair'], ['smile']], r.immagini);
    const due = premiX([{ id: '1', tags: ['alfa', 'beta', 'smile'] }], ['alfa', 'beta'], 'alfa');
    dice('con due trigger resta l\'altra, nel riquadro e sulle foto', [['beta'], [['beta', 'smile']]], [due.riquadro, due.immagini]);
}

console.log('\n--- gestore dei tag del progetto: X su un tag che non e\' una trigger ---');
{
    const r = premiX([{ id: '1', tags: ['mychar', 'red hair'] }, { id: '2', tags: ['mychar', 'smile'] }], ['mychar'], 'smile');
    dice('il riquadro delle trigger non cambia', ['mychar'], r.riquadro);
    dice('il tag lascia ogni foto, la trigger resta', [['mychar', 'red hair'], ['mychar']], r.immagini);
    dice('e lascia l\'elenco dei tag del progetto', ['altro'], r.palette);
}

process.exit(esito());
