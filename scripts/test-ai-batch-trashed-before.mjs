/* ITALIANO: PROVA DELLE FOTO GIA' NEL CESTINO QUANDO PARTE "TAGGA TUTTE CON AI"
   Con 3 foto aperte, una gia' nel cestino dell'app e "Salta foto gia' taggate" spento, la barra
   partiva da 0/3 e il riepilogo diceva "Foto taggate: 2. Non riuscite: 0. Saltate: 1": la foto
   scartata dal dataset contava nel totale e fra le saltate, anche se l'utente non aveva chiesto di
   saltare niente (Statistiche e contatori non contano le foto nel cestino). La regola: il lavoro
   comincia dalle sole foto in galleria; una foto messa nel cestino DURANTE il lavoro resta contata
   fra le saltate, come prima.
   Si eseguono i testi VERI presi da src/App.tsx (vedi ai-batch-harness.mjs).
   Uso:  node scripts/test-ai-batch-trashed-before.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE PHOTOS ALREADY IN THE TRASH WHEN "AUTO-TAG ALL WITH AI" STARTS
   With 3 photos open, one already in the app's trash and "Skip already tagged photos" off, the bar
   started at 0/3 and the summary said "Photos tagged: 2. Failed: 0. Skipped: 1": the photo dropped
   from the dataset counted in the total and among the skipped ones, although the user had asked to
   skip nothing (Statistics and counters do not count the photos in the trash). The rule: the run
   starts from the gallery photos only; a photo moved to the trash DURING the run still counts as
   skipped, as before.
   The REAL code taken from src/App.tsx is run (see ai-batch-harness.mjs).
   Usage:  node scripts/test-ai-batch-trashed-before.mjs      (exits with code 1 if anything is off) */

import { nuovaApp, BUONA, t } from './ai-batch-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();
const TRE = ['f1', 'f2', 'f3'].map(id => ({ id }));
const riepilogo = (n) => t.aiBatchDone.replace('{ok}', String(n.ok)).replace('{err}', String(n.err)).replace('{skip}', String(n.skip)).replace('{n}', String(n.tag));
const totali = (app) => [...new Set(app.progressi.map(p => p.total))];

console.log('\n--- 3 foto, la terza gia\' nel cestino dell\'app, "salta gia\' taggate" spento ---');
{
    const app = nuovaApp(TRE, () => BUONA);
    app.foto[2].isTrashed = true;
    await app.tutte();
    dice('due richieste a Google', 2, app.chiamate());
    dice('il riepilogo non conta la foto nel cestino fra le saltate', [[riepilogo({ ok: 2, err: 0, skip: 0, tag: 4 }), 'success']], app.notifiche);
    dice('la barra conta 2 foto, non 3', [2], totali(app));
    dice('la barra finisce a 2/2', { done: 2, total: 2 }, (({ done, total }) => ({ done, total }))(app.progressi[app.progressi.length - 1]));
    dice('la foto nel cestino non riceve tag', [], app.foto[2].tags);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    let app;
    app = nuovaApp(TRE, (n) => {
        // ITALIANO: la terza va nel cestino durante la PRIMA richiesta: non parte ed e' saltata.
        // ENGLISH: the third goes to the trash during the FIRST request: it is not sent and is skipped.
        if (n === 1) app.foto[2].isTrashed = true;
        return BUONA;
    });
    await app.tutte();
    dice('foto messa nel cestino durante il lavoro: saltata, due richieste, totale 3',
        [2, [[riepilogo({ ok: 2, err: 0, skip: 1, tag: 4 }), 'success']], [3]], [app.chiamate(), app.notifiche, totali(app)]);
}
{
    const app = nuovaApp(TRE, () => BUONA);
    await app.tutte();
    dice('nessuna foto nel cestino: tre taggate, totale 3', [[[riepilogo({ ok: 3, err: 0, skip: 0, tag: 6 }), 'success']], [3]], [app.notifiche, totali(app)]);
}
{
    const app = nuovaApp(TRE, () => BUONA, { skip: true });
    app.foto[0].tags = ['dog'];
    app.foto[2].isTrashed = true;
    await app.tutte();
    dice('"salta gia\' taggate" acceso: salta solo la foto taggata in galleria',
        [1, [[riepilogo({ ok: 1, err: 0, skip: 1, tag: 2 }), 'success']], [2]], [app.chiamate(), app.notifiche, totali(app)]);
}
{
    const app = nuovaApp(TRE, () => BUONA);
    app.foto.forEach(f => { f.isTrashed = true; });
    await app.tutte();
    dice('tutte nel cestino: nessuna richiesta, riepilogo a zero', [0, [[riepilogo({ ok: 0, err: 0, skip: 0, tag: 0 }), 'success']]], [app.chiamate(), app.notifiche]);
}

process.exit(esito());
