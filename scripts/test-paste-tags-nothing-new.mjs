/* ITALIANO: PROVA DI "Incolla tag" SU UNA FOTO CHE HA GIA' QUEI TAG
   Copiati i tag di una foto (1girl, smile) e premuto Incolla sulla stessa foto, o su un'altra che
   li ha gia', compariva l'avviso verde "Tag incollati" con il suono, ma non entrava niente. Succedeva
   dalla miniatura (handlePasteThumbTags in src/App.tsx) e dal visualizzatore (handlePasteTags in
   src/components/Lightbox.tsx). L'aggiunta in blocco lo dice gia' (bulkTagsNothingNew): ora anche
   l'incolla dice che la foto ha gia' tutto, e non tocca i tag.
   Si eseguono i testi VERI dei due gestori, con il vero countNewTagsIgnoringCase (src/utils/tagCase.ts)
   e i testi veri di src/constants.ts.
   Casi vicini che non devono cambiare: con almeno un tag nuovo i tag si incollano con l'avviso verde,
   senza tag copiati non succede niente.
   Uso:  node scripts/test-paste-tags-nothing-new.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF "Paste tags" ON A PHOTO THAT ALREADY HAS THOSE TAGS
   With a photo's tags copied (1girl, smile) and Paste pressed on the same photo, or on another one
   that already has them, the green "Tags pasted" notice appeared with the sound, but nothing went
   in. It happened from the thumbnail (handlePasteThumbTags in src/App.tsx) and from the viewer
   (handlePasteTags in src/components/Lightbox.tsx). The bulk add already says so
   (bulkTagsNothingNew): now paste too says the photo already has everything, and leaves the tags alone.
   The REAL text of both handlers runs, with the real countNewTagsIgnoringCase (src/utils/tagCase.ts)
   and the real strings of src/constants.ts.
   Neighbouring cases that must not change: with at least one new tag the tags are pasted with the
   green notice, with no copied tags nothing happens.
   Usage:  node scripts/test-paste-tags-nothing-new.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const carica = async (rel) => {
    const uscita = await esbuild.build({
        entryPoints: [path.join(radice, rel)],
        bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
    });
    return import('data:text/javascript;base64,' + Buffer.from(uscita.outputFiles[0].text).toString('base64'));
};
const TC = await carica('src/utils/tagCase.ts');
const lingue = (await carica('src/constants.ts')).translations;
const t = lingue.en;
const { dice, esito } = creaControlli();

const ritaglia = async (rel, intestazione) => {
    const sorgente = fs.readFileSync(path.join(radice, rel), 'utf8');
    const inizio = sorgente.indexOf(intestazione);
    if (inizio < 0) return null;
    const chiusura = /\r?\n    \}(, \[[^\]]*\])?\)?;\r?\n/g;
    chiusura.lastIndex = inizio;
    const fine = chiusura.exec(sorgente);
    if (!fine) return null;
    return (await esbuild.transform(sorgente.slice(inizio, fine.index + fine[0].length), { loader: 'tsx' })).code;
};
const codiceMiniatura = await ritaglia('src/App.tsx', '    const handlePasteThumbTags = useCallback((img: any) => {');
const codiceVisore = await ritaglia('src/components/Lightbox.tsx', '    const handlePasteTags = () => {');
if (!codiceMiniatura || !codiceVisore) { console.log('NO  handlePasteThumbTags o handlePasteTags non trovati'); process.exit(1); }

const suono = (r) => ({ pop() { r.suoni++; }, click() { r.suoni++; } });
const miniatura = (tagsFoto, copiedTags) => {
    const r = { scritti: [], notifiche: [], suoni: 0 };
    const fn = new Function('useCallback', 'copiedTags', 'updateImageTags', 'showNotification', 't', 'soundManager', 'countNewTagsIgnoringCase',
        codiceMiniatura + '\nreturn handlePasteThumbTags;')(
        (f) => f, copiedTags, (id, tags) => r.scritti.push([id, tags]), (m, tipo) => r.notifiche.push([m, tipo]), t, suono(r), TC.countNewTagsIgnoringCase);
    fn({ id: 'a', tags: tagsFoto });
    return r;
};
const visore = (tagsFoto, copiedTags) => {
    const r = { scritti: [], notifiche: [], suoni: 0 };
    const fn = new Function('copiedTags', 'updateTags', 'image', 'currentTags', 'showNotification', 't', 'soundManager', 'countNewTagsIgnoringCase',
        codiceVisore + '\nreturn handlePasteTags;')(
        copiedTags, (id, tags) => r.scritti.push([id, tags]), { id: 'a' }, tagsFoto, (m, tipo) => r.notifiche.push([m, tipo]), t, suono(r), TC.countNewTagsIgnoringCase);
    fn();
    return r;
};

for (const [nome, prova] of [['miniatura', miniatura], ['visualizzatore', visore]]) {
    console.log(`\n--- ${nome}: Incolla su una foto che ha gia' quei tag ---`);
    const stessa = prova(['1girl', 'smile'], ['1girl', 'smile']);
    dice(`${nome}: i tag della foto non si toccano`, [], stessa.scritti);
    dice(`${nome}: avviso informativo "ha gia' tutto", non "Tag incollati"`, [[t.tagsPasteNothingNew, 'info']], stessa.notifiche);
    dice(`${nome}: nessun suono di aggiunta`, 0, stessa.suoni);
    const maiuscole = prova(['Smile', '1girl', 'hat'], ['smile', '1GIRL']);
    dice(`${nome}: con grafie diverse nelle maiuscole e' lo stesso`, [[], [[t.tagsPasteNothingNew, 'info']]], [maiuscole.scritti, maiuscole.notifiche]);

    console.log(`\n--- ${nome}: quello che NON deve cambiare ---`);
    const nuovo = prova(['1girl'], ['1girl', 'smile']);
    dice(`${nome}: con un tag nuovo i tag si incollano`, [['a', ['1girl', 'smile']]], nuovo.scritti);
    dice(`${nome}: ...con l'avviso verde e il suono`, [[[t.tagsPastedNotif, 'success']], 1], [nuovo.notifiche, nuovo.suoni]);
    const vuoto = prova(['1girl'], []);
    dice(`${nome}: senza tag copiati non succede niente`, [[], [], 0], [vuoto.scritti, vuoto.notifiche, vuoto.suoni]);
    const nulla = prova(['1girl'], null);
    dice(`${nome}: appunti mai riempiti, non succede niente`, [[], [], 0], [nulla.scritti, nulla.notifiche, nulla.suoni]);
}

console.log('\n--- la frase nuova nelle nove lingue ---');
for (const l of ['it', 'en', 'fr', 'es', 'de', 'zh', 'ja', 'pt', 'ru']) {
    dice(`${l}: tagsPasteNothingNew c'e'`, true, typeof lingue[l].tagsPasteNothingNew === 'string' && lingue[l].tagsPasteNothingNew.length > 10);
}

process.exit(esito());
