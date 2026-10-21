/* ITALIANO: PROVA DEI CASI RIMASTI DEL .TXT CONDIVISO (a.png e a.jpg con un solo a.txt)
   Il ciclo del 15/10/2026 ha fatto restare a.txt sul disco finche' un'altra foto del progetto lo
   usa. I revisori avevano lasciato quattro casi in cui il .txt andava perso o una foto tornava
   "salvata" senza didascalia:
   - una foto chiusa con la X della scheda (ancora sul disco, Ctrl+Z la riporta) non contava: il
     .txt condiviso se ne andava con l'altra;
   - svuotata a.png da sola (a.txt resta per a.jpg), la X su a.jpg portava via a.txt: "Annulla lo
     svuotamento" riportava a.png come salvata, senza .txt sul disco, e Salva non lo riscriveva;
   - lo stesso quando l'altra foto non ha una voce di annullamento (copia doppia, file gia' tolto);
   - dopo uno svuotamento TOTALE, un Ctrl+Z subito dopo "Annulla lo svuotamento" toglieva dall'app
     tutte le foto appena tornate.
   Si eseguono le funzioni VERE di src/App.tsx con un Cestino di Windows finto (trash-harness).
   Uso:  node scripts/test-shared-txt-leftovers.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE REMAINING SHARED .TXT CASES (a.png and a.jpg with a single a.txt)
   The 15/10/2026 cycle kept a.txt on disk while another photo of the project uses it. The
   reviewers left four cases where the .txt was lost or a photo came back "saved" with no caption:
   a photo closed with the card's X did not count; after emptying a.png alone, the X on a.jpg took
   a.txt and "Undo the emptying" brought a.png back as saved with no .txt; the same when the other
   photo has no undo entry; and after a TOTAL emptying one Ctrl+Z right after "Undo the emptying"
   took every returned photo out of the app. The REAL functions of src/App.tsx run with a fake
   Windows Recycle Bin (trash-harness). */

import { creaApp, apiFinta, t } from './trash-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();

const foto = (id, nome, { cestinata = true } = {}) => ({
    id, file: { name: nome, percorso: 'E:\\dataset\\' + nome }, thumb: 'blob:finto/' + id,
    tags: ['smile', 'red dress'], originalTags: ['smile', 'red dress'], isTrashed: cestinata, dirHandle: null,
});
const TXT = 'E:\\dataset\\a.txt';
const inviati = (api) => api.chiamate.flat();
const fotoCon = (app, id) => app.stato.images.find(i => i.id === id);

console.log('\n--- a.jpg chiusa con la X della scheda, a.png nel cestino: Svuota cestino ---');
{
    const api = apiFinta();
    const jpg = foto('JPG', 'a.jpg', { cestinata: false });
    const app = creaApp([foto('PNG', 'a.png')], { api });
    app.refs.fotoChiuseRef.current.set('JPG', { id: 'JPG', name: 'a.jpg', lotto: '', cartella: '', foto: jpg });
    await app.render().handleEmptyTrash();
    await app.attendi();
    dice('nel Cestino di Windows va solo a.png: a.txt serve ancora ad a.jpg chiusa', ['E:\\dataset\\a.png'], inviati(api));
}

console.log('\n--- svuotata a.png da sola, poi la X su a.jpg, poi "Annulla lo svuotamento" ---');
{
    // ITALIANO: a.txt e' andato nel Cestino di Windows con a.jpg: accanto ad a.png non c'e' piu'.
    // ENGLISH: a.txt went to the Windows Recycle Bin with a.jpg: it is no longer beside a.png.
    let txtCe = true;
    const api = apiFinta({ txtSulDisco: () => txtCe });
    const app = creaApp([foto('PNG', 'a.png'), foto('JPG', 'a.jpg', { cestinata: false })], { api });
    await app.render().handleEmptyTrash();
    await app.attendi();
    dice('premessa: con a.png va solo l\'immagine', ['E:\\dataset\\a.png'], inviati(api));
    app.cestina('JPG');
    await app.attendi();
    await app.render().handleDeletePermanently('JPG');
    await app.attendi();
    txtCe = false;
    dice('premessa: con a.jpg, ultima a usarlo, va anche a.txt', true, inviati(api).includes(TXT));
    const prima = app.notifiche.length;
    await app.render().annullaSvuotamento();
    await app.attendi();
    const png = fotoCon(app, 'PNG');
    dice('a.png torna nel cestino dell\'app', true, !!png && png.isTrashed === true);
    dice('ma resta DA SALVARE (originalTags vuoto): Salva riscrivera\' a.txt dai tag in memoria', [[], ['smile', 'red dress']], [png?.originalTags, png?.tags]);
    const messaggi = app.notifiche.slice(prima).map(([m]) => m).join(' | ');
    dice('il messaggio dice che il file di tag non e\' tornato', true, messaggi.includes(t.undoEmptyTxtNotBackOne));
}

console.log('\n--- quello che NON deve cambiare: a.txt e\' ancora sul disco ---');
{
    const api = apiFinta({ txtSulDisco: () => true });
    const app = creaApp([foto('PNG', 'a.png'), foto('JPG', 'a.jpg', { cestinata: false })], { api });
    await app.render().handleEmptyTrash();
    await app.attendi();
    await app.render().annullaSvuotamento();
    await app.attendi();
    const png = fotoCon(app, 'PNG');
    dice('a.png torna salvata (originalTags come prima)', ['smile', 'red dress'], png?.originalTags);
}

console.log('\n--- svuotamento TOTALE, "Annulla lo svuotamento", poi un Ctrl+Z ---');
{
    const api = apiFinta();
    const app = creaApp([foto('A', 'a.png', { cestinata: false }), foto('B', 'b.png', { cestinata: false })], { api });
    app.cestina('A');
    await app.attendi();
    app.cestina('B');
    await app.attendi();
    await app.render().handleEmptyTrash();
    await app.attendi();
    dice('premessa: galleria e cestino vuoti', [], app.vista());
    await app.render().annullaSvuotamento();
    await app.attendi();
    dice('premessa: le due foto tornano nel cestino dell\'app', ['A(cestino)', 'B(cestino)'], app.vista());
    app.render().handleUndo();
    await app.attendi();
    dice('un Ctrl+Z subito dopo NON toglie le foto tornate dall\'app', ['A(cestino)', 'B(cestino)'], app.vista());
}

process.exit(esito());
