/* ITALIANO: PROVA DI "RIMUOVI TUTTI" DEL VISUALIZZATORE CON LE TRIGGER WORD ATTIVE
   Con la trigger word "ohwx" nel riquadro delle trigger, "Rimuovi tutti" nel visualizzatore
   toglieva dalla foto ANCHE la trigger, mentre il riquadro continuava a mostrarla attiva: niente la
   rimetteva, quindi dopo nuovi tag (a mano o con "Genera tag con AI") il .txt salvato usciva senza
   la parola chiave. Il comando gemello "Elimina tutti i tag del progetto" la lascia apposta (vedi
   test-delete-all-keeps-triggers.mjs). La regola: le trigger che la foto aveva restano (confronto
   senza maiuscole, come hasTagsBeyondTriggers), gli altri tag se ne vanno. Togliere una trigger da
   una sola foto resta possibile con un clic sulla sua pillola (toggleTag).
   Si esegue il testo VERO di handleRemoveAll, handleAddAll e toggleTag preso da
   src/components/Lightbox.tsx, con updateImageTags e getOrderedTagString veri di src/App.tsx
   (compilati con esbuild).
   Uso:  node scripts/test-lightbox-remove-all-triggers.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE VIEWER'S "REMOVE ALL" WITH TRIGGER WORDS ACTIVE
   With the trigger word "ohwx" in the trigger box, "Remove all" in the viewer stripped the trigger
   from the photo TOO, while the box kept showing it as active: nothing put it back, so after new
   tags (by hand or with "Generate tags with AI") the saved .txt came out without the keyword. The
   twin command "Delete all project tags" keeps it on purpose (see
   test-delete-all-keeps-triggers.mjs). The rule: the triggers the photo had stay (compared
   regardless of case, like hasTagsBeyondTriggers), the other tags go. Removing a trigger from one
   photo stays possible with a click on its pill (toggleTag).
   The REAL text of handleRemoveAll, handleAddAll and toggleTag taken from
   src/components/Lightbox.tsx is run, with the real updateImageTags and getOrderedTagString of
   src/App.tsx (compiled with esbuild).
   Usage:  node scripts/test-lightbox-remove-all-triggers.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaControlli } from './main-harness.mjs';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { dice, esito } = creaControlli();

const caso = await esbuild.build({
    entryPoints: [path.join(radice, 'src/utils/tagCase.ts')],
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
});
const C = await import('data:text/javascript;base64,' + Buffer.from(caso.outputFiles[0].text).toString('base64'));

const lightbox = fs.readFileSync(path.join(radice, 'src/components/Lightbox.tsx'), 'utf8');
const app = fs.readFileSync(path.join(radice, 'src/App.tsx'), 'utf8');
// ITALIANO: una riga sola (le due funzioni brevi stanno su una riga).
// ENGLISH: a single line (the two short functions sit on one line).
const riga = async (sorgente, intestazione, file) => {
    const inizio = sorgente.indexOf(intestazione);
    if (inizio < 0) { console.log('NO  non trovato in ' + file + ': ' + intestazione.trim()); process.exit(1); }
    const fine = sorgente.indexOf('\n', inizio);
    return (await esbuild.transform(sorgente.slice(inizio, fine).replace(/\r$/, ''), { loader: 'ts' })).code;
};
// ITALIANO: fino alla prima riga "    };" o "    }, [...]);" allo stesso rientro.
// ENGLISH: up to the first "    };" or "    }, [...]);" line at the same indent.
const blocco = async (sorgente, intestazione, file) => {
    const inizio = sorgente.indexOf(intestazione);
    const chiusura = /\r?\n    \}(, \[[^\]]*\]\))?;\r?\n/g;
    chiusura.lastIndex = Math.max(inizio, 0);
    const fine = inizio < 0 ? null : chiusura.exec(sorgente);
    if (inizio < 0 || !fine) { console.log('NO  non trovato in ' + file + ': ' + intestazione.trim()); process.exit(1); }
    return (await esbuild.transform(sorgente.slice(inizio, fine.index + fine[0].length), { loader: 'ts' })).code;
};

const codiceLightbox = (await riga(lightbox, '    const handleAddAll = ', 'Lightbox.tsx')) + '\n' +
    (await riga(lightbox, '    const handleRemoveAll = ', 'Lightbox.tsx')) + '\n' +
    (await blocco(lightbox, '    const toggleTag = (tag: string) => {', 'Lightbox.tsx'));
const codiceApp = (await blocco(app, '    const updateImageTags = useCallback(', 'App.tsx')) + '\n' +
    (await blocco(app, '    const getOrderedTagString = ', 'App.tsx'));

// ITALIANO: il visualizzatore aperto su una foto, collegato all'updateImageTags vero di App.
//           Le prove nuove passano tutti gli identificatori che il componente ha in vista.
// ENGLISH: the viewer open on a photo, wired to App's real updateImageTags. The tests pass every
//          identifier the component has in scope.
const apri = (tags, globalTriggers, allTags = []) => {
    let images = [{ id: 'a', tags: [...tags], originalTags: [...tags] }];
    const setImages = (f) => { images = typeof f === 'function' ? f(images) : f; };
    const a = new Function('useCallback', 'globalTriggers', 'setImages', 'uniqueTagsIgnoringCase',
        'const imagesRef = { current: [] };\n' + codiceApp + '\nreturn { updateImageTags, getOrderedTagString };')((f) => f, globalTriggers, setImages, C.uniqueTagsIgnoringCase);
    const visore = () => {
        const image = images[0];
        return new Function('updateTags', 'image', 'currentTags', 'allTags', 'globalTriggers', 'soundManager',
            'hasTagIgnoringCase', 'uniqueTagsIgnoringCase',
            codiceLightbox + '\nreturn { handleAddAll, handleRemoveAll, toggleTag };')(
            a.updateImageTags, image, image.tags || [], allTags, globalTriggers, { pop() { }, chime() { }, click() { } },
            C.hasTagIgnoringCase, C.uniqueTagsIgnoringCase);
    };
    return { visore, tags: () => images[0].tags, txt: () => a.getOrderedTagString(images[0].tags), scrivi: (t) => a.updateImageTags('a', t) };
};

console.log('\n--- trigger "ohwx" attiva, "Rimuovi tutti" nel visualizzatore ---');
{
    const v = apri(['ohwx', 'blue eyes', 'smile'], ['ohwx']);
    v.visore().handleRemoveAll();
    dice('la trigger resta sulla foto, gli altri tag se ne vanno', ['ohwx'], v.tags());
    v.scrivi([...v.tags(), 'red hair', 'outdoors']);
    dice('dopo due tag nuovi il .txt che si salva comincia con la trigger', 'ohwx, outdoors, red hair,', v.txt());
}

console.log('\n--- due trigger, nell\'ordine scelto dall\'utente ---');
{
    const v = apri(['alfa', 'smile', 'zeta'], ['zeta', 'alfa']);
    v.visore().handleRemoveAll();
    dice('restano tutte e due, nell\'ordine delle trigger', ['zeta', 'alfa'], v.tags());
}

console.log('\n--- la foto ha la trigger scritta con altre maiuscole ---');
{
    const v = apri(['ohwx', 'smile'], ['OHWX']);
    v.visore().handleRemoveAll();
    dice('la trigger resta (confronto senza maiuscole), scritta come nel riquadro', ['OHWX'], v.tags());
}

console.log('\n--- una trigger che la foto non ha non viene aggiunta ---');
{
    const v = apri(['ohwx', 'smile'], ['ohwx', 'altra']);
    v.visore().handleRemoveAll();
    dice('resta solo la trigger che la foto aveva', ['ohwx'], v.tags());
    const w = apri(['smile', 'blue eyes'], ['ohwx']);
    w.visore().handleRemoveAll();
    dice('foto a cui la trigger era stata tolta a mano: non la riprende', [], w.tags());
}

console.log('\n--- senza trigger: tutto come prima ---');
{
    const v = apri(['a', 'b'], []);
    v.visore().handleRemoveAll();
    dice('tutti i tag se ne vanno', [], v.tags());
    dice('il .txt e\' vuoto', '', v.txt());
}

console.log('\n--- casi vicini che non cambiano ---');
{
    const v = apri(['ohwx', 'smile'], ['ohwx']);
    v.visore().toggleTag('ohwx');
    dice('un clic sulla pillola della trigger la toglie ancora da questa foto', ['smile'], v.tags());
    const w = apri(['smile'], ['ohwx'], ['ohwx', 'smile', 'red hair']);
    w.visore().handleAddAll();
    dice('"Aggiungi tutti" mette ancora tutti i tag del progetto, trigger prima', ['ohwx', 'red hair', 'smile'], w.tags());
}

process.exit(esito());
