/* ITALIANO: PROVA DI "ANNULLA LO SVUOTAMENTO" QUANDO TORNA L'IMMAGINE MA NON IL SUO .txt
   Le immagini si ripescano dal Cestino di Windows per prime, i .txt con una seconda chiamata. Se
   quella seconda chiamata non riusciva (PowerShell che non parte, il Cestino che non risponde, un
   file con lo stesso nome al suo posto) restava solo una riga nel registro: il messaggio diceva
   "Foto rimesse al loro posto: 1" in verde, e la foto risultava salvata (tag uguali a
   originalTags), quindi "Salva Modifiche" non riscriveva mai il .txt. Nel dataset restava una foto
   senza didascalia mentre l'app mostrava i suoi tag come salvati. La regola: una foto la cui
   immagine e' tornata ma il cui .txt no (qualunque risposta che non sia 'ok', o nessuna risposta)
   resta da salvare, e il messaggio lo dice nominando il pulsante vero.
   Si eseguono i testi VERI presi da src/App.tsx (vedi trash-harness.mjs).
   Uso:  node scripts/test-undo-empty-txt-not-back.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF "UNDO THE EMPTYING" WHEN THE IMAGE COMES BACK BUT ITS .txt DOES NOT
   Images are fished out of the Windows Recycle Bin first, the .txt files with a second call. When
   that second call failed (PowerShell not starting, the bin not answering, a file with the same
   name in its place) only a log line was left: the message said "Photos put back where they
   were: 1" in green, and the photo counted as saved (tags equal to originalTags), so "Save
   Changes" never rewrote the .txt. The dataset kept a photo with no caption while the app showed
   its tags as saved. The rule: a photo whose image came back but whose .txt did not (any answer
   other than 'ok', or no answer) stays to be saved, and the message says so naming the real
   button.
   The REAL code taken from src/App.tsx is run (see trash-harness.mjs).
   Usage:  node scripts/test-undo-empty-txt-not-back.mjs      (exits with code 1 if anything is off) */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { creaApp, apiFinta, foto, percorsoImg, percorsoTxt, lingue, t } from './trash-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();
const S = await import('data:text/javascript;base64,' + Buffer.from((await esbuild.build({
    entryPoints: [path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src/utils/sidecarTags.ts')],
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
})).outputFiles[0].text).toString('base64'));

const fraseTesti = (n) => (typeof t.undoEmptyTxtNotBack === 'string' ? (n === 1 ? t.undoEmptyTxtNotBackOne : t.undoEmptyTxtNotBack.replace('{n}', String(n))) : '(manca undoEmptyTxtNotBack)');
// ITALIANO: la foto, come la vedrebbe "Salva Modifiche" dopo "Ripristina": va scritta?
// ENGLISH: the photo, as "Save Changes" would see it after "Restore": does it need writing?
const daScrivere = (app, id) => {
    const f = app.stato.images.find(i => i.id === id);
    return Boolean(f) && JSON.stringify(f.tags) !== JSON.stringify(f.originalTags);
};

// ITALIANO: A e B svuotate (immagine e .txt nel Cestino di Windows), poi "Annulla lo svuotamento":
//           le immagini rispondono 'ok', i .txt come dice `esitoTesto` (o la chiamata si rompe).
// ENGLISH: A and B emptied (image and .txt in the Windows Recycle Bin), then "Undo the emptying":
//          the images answer 'ok', the .txt files as `esitoTesto` says (or the call breaks).
const prova = async (esitoTesto, ids = ['A', 'B']) => {
    const api = apiFinta({
        ripristino: (percorsi) => {
            if (!percorsi[0].endsWith('.txt')) return { results: percorsi.map(p => ({ percorso: p, esito: 'ok' })) };
            if (esitoTesto === 'eccezione') throw new Error('PowerShell non parte');
            if (esitoTesto === 'nessuna') return { results: [] };
            return { results: percorsi.map(p => ({ percorso: p, esito: typeof esitoTesto === 'function' ? esitoTesto(p) : esitoTesto })) };
        },
    });
    const app = creaApp(ids.map(id => foto(id)), { api });
    await app.render().handleEmptyTrash();
    await app.attendi();
    app.notifiche.length = 0;
    await app.render().annullaSvuotamento();
    await app.attendi();
    const vistaDopoAnnulla = app.vista();
    for (const id of ids) { app.render().handleRestore(id); await app.attendi(); }
    return { app, api, vistaDopoAnnulla, messaggio: app.notifiche[0] };
};

console.log('\n--- l\'immagine torna, il suo .txt no ("fallito") ---');
{
    const r = await prova('fallito', ['A']);
    dice('si chiedono indietro prima l\'immagine, poi il .txt', [[percorsoImg('A')], [percorsoTxt('A')]], r.api.ripristini);
    dice('A torna nel cestino dell\'app', ['A(cestino)'], r.vistaDopoAnnulla);
    dice('dopo "Ripristina", "Salva Modifiche" riscrive il .txt di A', true, daScrivere(r.app, 'A'));
    dice('il messaggio non e\' il verde "tutto a posto": dice del .txt e di "Salva Modifiche"',
        [[t.undoEmptyDone.replace('{n}', '1'), fraseTesti(1)].join(' · '), 'info'], r.messaggio);
    dice('il tasto "Annulla lo svuotamento" sparisce: l\'immagine e\' tornata', null, r.app.stato.ultimoSvuotamento);
}

console.log('\n--- gli altri modi in cui il .txt non torna ---');
for (const [nome, esitoTesto] of [['un file con lo stesso nome al suo posto ("occupato")', 'occupato'],
    ['non piu\' nel Cestino di Windows ("nonTrovato")', 'nonTrovato'],
    ['nessuna risposta per il .txt', 'nessuna'],
    ['la seconda chiamata si rompe', 'eccezione']]) {
    const r = await prova(esitoTesto);
    dice(nome + ': A e B tornano comunque nel cestino dell\'app', ['A(cestino)', 'B(cestino)'], r.vistaDopoAnnulla);
    dice(nome + ': tutte e due restano da salvare', [true, true], [daScrivere(r.app, 'A'), daScrivere(r.app, 'B')]);
    dice(nome + ': il messaggio conta i .txt non tornati', [[t.undoEmptyDone.replace('{n}', '2'), fraseTesti(2)].join(' · '), 'info'], r.messaggio);
}

console.log('\n--- solo il .txt di B non torna ---');
{
    const r = await prova((p) => (p === percorsoTxt('B') ? 'fallito' : 'ok'));
    dice('A col suo .txt tornato resta salvata, B no', [false, true], [daScrivere(r.app, 'A'), daScrivere(r.app, 'B')]);
    dice('il messaggio conta un .txt', [[t.undoEmptyDone.replace('{n}', '2'), fraseTesti(1)].join(' · '), 'info'], r.messaggio);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    const r = await prova('ok');
    dice('tutto torna: nessuna foto da salvare', [false, false], [daScrivere(r.app, 'A'), daScrivere(r.app, 'B')]);
    dice('e il messaggio resta quello verde di prima', [t.undoEmptyDone.replace('{n}', '2'), 'success'], r.messaggio);
}

console.log('\n--- chi segue il messaggio alla lettera ---');
{
    // ITALIANO: la foto torna nel cestino dell'app, e "Salva Modifiche" salta le foto nel cestino
    //           (si esegue il filtro VERO di handleSaveChanges): premuto subito, non scrive niente.
    //           Per questo il messaggio deve dire di premere prima "Ripristina".
    // ENGLISH: the photo comes back into the app's trash, and "Save Changes" skips trashed photos
    //          (the REAL filter of handleSaveChanges is run): pressed right away, it writes nothing.
    //          That is why the message must say to press "Restore" first.
    const sorgente = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src/App.tsx'), 'utf8');
    const salva = sorgente.slice(sorgente.indexOf('    const handleSaveChanges = async ('));
    const riga = /const modifiedImages = (images\.filter\([^\r\n]*\));/.exec(salva);
    dice('premessa: trovato il filtro di "Salva Modifiche"', true, !!riga);
    const filtro = new Function('images', 'fotoDaSalvare', 'globalTriggers', 'return ' + (riga ? riga[1] : '[]') + '.map(i => i.id);');
    const app = (await prova('fallito', ['A'])).app;
    const nelCestino = app.stato.images.map(i => ({ ...i, isTrashed: true }));
    dice('"Salva Modifiche" premuto prima di "Ripristina": la foto non si scrive', [], filtro(nelCestino, S.fotoDaSalvare, []));
    dice('dopo "Ripristina": si scrive', ['A'], filtro(app.stato.images, S.fotoDaSalvare, []));
}

console.log('\n--- la frase nuova nelle nove lingue ---');
{
    const mancanti = Object.keys(lingue).filter(l => typeof lingue[l].undoEmptyTxtNotBack !== 'string'
        || !lingue[l].undoEmptyTxtNotBack.includes('{n}') || !lingue[l].undoEmptyTxtNotBack.includes(lingue[l].saveChanges));
    dice('undoEmptyTxtNotBack c\'e\' in tutte e nove, con {n} e il nome vero di "Salva Modifiche"', [], mancanti);
    const senzaRipristina = Object.keys(lingue).filter(l => typeof lingue[l].undoEmptyTxtNotBack !== 'string'
        || !lingue[l].undoEmptyTxtNotBack.includes(lingue[l].restore)
        || lingue[l].undoEmptyTxtNotBack.indexOf(lingue[l].restore) > lingue[l].undoEmptyTxtNotBack.indexOf(lingue[l].saveChanges));
    dice('...e prima il nome vero di "Ripristina" (le foto sono nel cestino dell\'app)', [], senzaRipristina);
}

process.exit(esito());
