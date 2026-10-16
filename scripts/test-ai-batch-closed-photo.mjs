/* ITALIANO: PROVA DI UNA FOTO CHIUSA MENTRE "TAGGA TUTTE CON AI" LA STA TAGGANDO
   Chiudendo una foto con la X della sua card mentre la sua richiesta era in volo, la risposta di
   Google veniva scartata (la foto non c'e' piu'), ma la foto si contava fra le "Foto taggate" del
   riepilogo, anche se non aveva ricevuto nessun tag. Una foto tolta PRIMA della sua richiesta si
   contava invece fra le saltate. La regola: una foto tolta durante la sua richiesta e' saltata,
   come quella tolta prima; mai taggata, mai non riuscita.
   Si eseguono i testi VERI presi da src/App.tsx (vedi ai-batch-harness.mjs).
   Uso:  node scripts/test-ai-batch-closed-photo.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF A PHOTO CLOSED WHILE "AUTO-TAG ALL WITH AI" IS TAGGING IT
   Closing a photo with the X on its card while its request was in flight, Google's answer was
   discarded (the photo is gone), but the photo counted among the summary's "Photos tagged", although
   it got no tag. A photo removed BEFORE its request counted as skipped instead. The rule: a photo
   removed during its request is skipped, like one removed before; never tagged, never failed.
   The REAL code taken from src/App.tsx is run (see ai-batch-harness.mjs).
   Usage:  node scripts/test-ai-batch-closed-photo.mjs      (exits with code 1 if anything is off) */

import { nuovaApp, BUONA, t } from './ai-batch-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();
const TRE = ['f1', 'f2', 'f3'].map(id => ({ id }));
const riepilogo = (n) => t.aiBatchDone.replace('{ok}', String(n.ok)).replace('{err}', String(n.err)).replace('{skip}', String(n.skip)).replace('{n}', String(n.tag));

console.log('\n--- 3 foto: la seconda si chiude mentre la sua richiesta e\' in volo ---');
{
    let app;
    app = nuovaApp(TRE, (n) => {
        // ITALIANO: la X della card: la foto esce dall'elenco vivo (handleCloseImage), non va nel cestino.
        // ENGLISH: the card's X: the photo leaves the live list (handleCloseImage), it is not trashed.
        if (n === 2) app.imagesRef.current = app.imagesRef.current.filter(f => f.id !== 'f2');
        return BUONA;
    });
    await app.tutte();
    dice('tre richieste partite', 3, app.chiamate());
    dice('il riepilogo conta la foto chiusa fra le saltate, non fra le taggate',
        [[riepilogo({ ok: 2, err: 0, skip: 1, tag: 4 }), 'success']], app.notifiche);
}

console.log('\n--- quello che NON deve cambiare ---');
{
    let app;
    app = nuovaApp(TRE, (n) => {
        // ITALIANO: la terza si chiude durante la PRIMA richiesta: non parte nemmeno, ed e' saltata.
        // ENGLISH: the third is closed during the FIRST request: it is not even sent, and it is skipped.
        if (n === 1) app.imagesRef.current = app.imagesRef.current.filter(f => f.id !== 'f3');
        return BUONA;
    });
    await app.tutte();
    dice('foto chiusa prima della sua richiesta: saltata, due richieste', [2, [[riepilogo({ ok: 2, err: 0, skip: 1, tag: 4 }), 'success']]],
        [app.chiamate(), app.notifiche]);
}
{
    const app = nuovaApp(TRE, () => BUONA);
    await app.tutte();
    dice('nessuna foto chiusa: tre taggate', [[riepilogo({ ok: 3, err: 0, skip: 0, tag: 6 }), 'success']], app.notifiche);
}

process.exit(esito());
