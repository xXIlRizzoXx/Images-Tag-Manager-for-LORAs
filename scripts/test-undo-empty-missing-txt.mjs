/* ITALIANO: PROVA DI "ANNULLA LO SVUOTAMENTO" PER UNA FOTO CHE NON AVEVA IL .txt
   Il processo principale risponde 'ok' anche per un file che non c'e' (il .txt di una foto senza
   tag), e solo il conto `trashed` dice se qualcosa si e' mosso davvero. L'app annotava il .txt di
   ogni foto svuotata e, annullando, lo chiedeva indietro al Cestino di Windows: se li' c'era un
   .txt con lo stesso percorso lasciato da uno svuotamento VECCHIO (cartelle riusate, nomi come
   0001.png), finiva accanto alla foto nuova, che si ritrovava in silenzio i tag di un'altra foto.
   Lo stesso per l'immagine gia' sparita dal disco al momento dello svuotamento. La regola: si
   ripesca solo cio' che questo svuotamento ha spostato davvero.
   Si eseguono i testi VERI presi da src/App.tsx (vedi trash-harness.mjs).
   Uso:  node scripts/test-undo-empty-missing-txt.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF "UNDO THE EMPTYING" FOR A PHOTO THAT HAD NO .txt
   The main process answers 'ok' also for a file that is not there (the .txt of a photo with no
   tags), and only the `trashed` count says whether something really moved. The app recorded the
   .txt of every emptied photo and, on undo, asked the Windows Recycle Bin for it: if the bin held
   a .txt with the same path left by an OLDER emptying (reused folders, names like 0001.png), it
   landed beside the new photo, which silently got another photo's tags. The same for an image
   already gone from disk when the trash was emptied. The rule: only what this emptying really
   moved is fished back.
   The REAL code taken from src/App.tsx is run (see trash-harness.mjs).
   Usage:  node scripts/test-undo-empty-missing-txt.mjs      (exits with code 1 if anything is off) */

import { creaApp, apiFinta, foto, percorsoImg, percorsoTxt } from './trash-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();

// ITALIANO: come il vero shell:trash-files: un file assente risponde 'ok' ma non conta in `trashed`.
// ENGLISH: like the real shell:trash-files: a missing file answers 'ok' but does not count in `trashed`.
const apiConAssenti = (assenti) => {
    const api = apiFinta();
    api.trashFiles = async (percorsi) => {
        api.chiamate.push([...percorsi]);
        await new Promise(ok => setTimeout(ok, 0));
        const trashed = percorsi.filter(p => !assenti.includes(p)).length;
        return { ok: true, trashed, failed: 0, results: percorsi.map(() => 'ok') };
    };
    return api;
};

console.log('\n--- A senza .txt: annullando non si chiede nessun .txt al Cestino di Windows ---');
{
    const api = apiConAssenti([percorsoTxt('A')]);
    const app = creaApp([foto('A')], { api });
    await app.render().handleEmptyTrash();
    await app.attendi();
    dice('A esce dal progetto come prima', [], app.vista());
    await app.render().annullaSvuotamento();
    await app.attendi();
    dice('si chiede indietro solo l\'immagine', [[percorsoImg('A')]], api.ripristini);
    dice('A torna nel cestino dell\'app', ['A(cestino)'], app.vista());
}

console.log('\n--- l\'immagine di A era gia\' sparita dal disco: niente da annullare per lei ---');
{
    const api = apiConAssenti([percorsoImg('A'), percorsoTxt('A')]);
    const app = creaApp([foto('A')], { api });
    await app.render().handleEmptyTrash();
    await app.attendi();
    dice('A esce dal progetto come prima', [], app.vista());
    dice('niente da ripescare: il tasto "Annulla lo svuotamento" non compare', null, app.stato.ultimoSvuotamento);
    await app.render().annullaSvuotamento();
    await app.attendi();
    dice('il Cestino di Windows non viene interrogato', [], api.ripristini);
}

console.log('\n--- quello che NON deve cambiare: B col suo .txt, C senza ---');
{
    const api = apiConAssenti([percorsoTxt('C')]);
    const app = creaApp([foto('B'), foto('C')], { api });
    await app.render().handleEmptyTrash();
    await app.attendi();
    await app.render().annullaSvuotamento();
    await app.attendi();
    dice('prima le due immagini, poi il solo .txt di B', [[percorsoImg('B'), percorsoImg('C')], [percorsoTxt('B')]], api.ripristini);
    dice('B e C tornano nel cestino dell\'app', ['B(cestino)', 'C(cestino)'], app.vista());
}

process.exit(esito());
