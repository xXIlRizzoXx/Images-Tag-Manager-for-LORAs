/* ITALIANO: PROVA DEL .txt NELLO SVUOTAMENTO DEL CESTINO: "MAI ESISTITO" E "FOTO CHIUSA E RIAPERTA"
   Due casi in cui lo svuotamento del cestino (e il suo annullamento) sbagliava il .txt.
   1) Foto senza .txt sul disco, con i tag solo in memoria (una trigger scritta su un dataset nuovo):
      dopo "Svuota cestino" e "Annulla lo svuotamento" l'avviso diceva «File di tag non ripresi dal
      Cestino di Windows: 2», non verde, per .txt che non sono mai esistiti. Il controllo dei .txt
      rimasti sul disco valeva per ogni foto senza .txt spostato, non solo per quelle il cui .txt era
      rimasto perche' serviva a un'altra foto (a.png e a.jpg con un solo a.txt).
   2) a.png chiusa con la X e poi riaperta con "Carica cartella" (id nuovo): svuotando la copia nuova,
      la foto chiusa (lo STESSO file) contava come "un'altra foto che usa a.txt", e a.txt restava
      nella cartella, orfano, mentre l'avviso diceva «File spostati nel Cestino di Windows».
   Si eseguono le funzioni VERE di src/App.tsx con il banco scripts/trash-harness.mjs.
   Uso:  node scripts/test-trash-txt-owner.mjs      (esce con codice 1 se qualcosa non torna)

   ENGLISH: TEST OF THE .txt WHEN EMPTYING THE TRASH: "NEVER THERE" AND "PHOTO CLOSED AND REOPENED"
   Two cases where emptying the trash (and undoing it) got the .txt wrong.
   1) Photos with no .txt on disk and tags in memory only (a trigger typed on a new dataset): after
      "Empty trash" and "Undo the emptying" the notice said «Tag files not taken back out of the
      Windows Recycle Bin: 2», not green, for .txt files that never existed.
   2) a.png closed with the X and reopened with "Load folder" (new id): emptying the new copy, the
      closed photo (the SAME file) counted as "another photo using a.txt", and a.txt stayed in the
      folder, orphaned, while the notice said «Files moved to the Windows Recycle Bin».
   The REAL functions of src/App.tsx run in the scripts/trash-harness.mjs bench.
   Usage:  node scripts/test-trash-txt-owner.mjs      (exits with code 1 if anything is off) */

import { creaApp, apiFinta, t } from './trash-harness.mjs';
import { creaControlli } from './main-harness.mjs';

const { dice, esito } = creaControlli();
const foto = (id, nome, { cestinata = true, tags = ['ohwx'], originalTags = [], cartella = 'E:\\dataset\\' } = {}) => ({
    id, file: { name: nome, percorso: cartella + nome }, thumb: 'blob:finto/' + id,
    tags, originalTags, isTrashed: cestinata, dirHandle: null,
});
// ITALIANO: come il vero shell:trash-files: un file che non c'e' risponde 'ok' ma con trashed 0.
// ENGLISH: like the real shell:trash-files: a file that is not there answers 'ok' but trashed 0.
const senzaTxtSulDisco = (api) => {
    const vero = api.trashFiles;
    api.trashFiles = async (p) => {
        const r = await vero(p);
        if (p[0].endsWith('.txt')) return { ok: true, trashed: 0, failed: 0, results: ['ok'] };
        return r;
    };
    return api;
};
const svuotaEAnnulla = async (app) => {
    await app.render().handleEmptyTrash();
    await app.attendi();
    const n = app.notifiche.length;
    await app.render().annullaSvuotamento();
    await app.attendi();
    return app.notifiche.slice(n);
};

console.log('\n--- 1) foto senza .txt sul disco (tag solo in memoria), svuota e annulla ---');
{
    const api = senzaTxtSulDisco(apiFinta({ txtSulDisco: () => false }));
    const app = creaApp([foto('A', 'a.png'), foto('B', 'b.png')], { api });
    const avvisi = await svuotaEAnnulla(app);
    dice('premessa: tornano solo le due immagini, nessun .txt chiesto indietro', [['E:\\dataset\\a.png', 'E:\\dataset\\b.png']], api.ripristini);
    dice('l\'avviso e\' il verde "tutto a posto", senza .txt "non ripresi"', [[t.undoEmptyDone.replace('{n}', '2'), 'success']], avvisi);
    dice('...e le foto tornano coi loro tag (restano da salvare)', [['ohwx'], ['ohwx']], app.stato.images.map(i => i.tags));
}

console.log('\n--- quello che NON deve cambiare: a.png e a.jpg con un solo a.txt ---');
{
    // ITALIANO: a.png nel cestino, a.jpg in galleria: a.txt resta per a.jpg. Poi a.jpg se ne va
    //           (con a.txt) e lo svuotamento si annulla: a.txt non c'e' piu', l'avviso lo dice.
    // ENGLISH: a.png in the trash, a.jpg in the gallery: a.txt stays for a.jpg. Then a.jpg leaves
    //          (with a.txt) and the emptying is undone: a.txt is gone, the notice says so.
    let c = true;
    const api = apiFinta({ txtSulDisco: () => c });
    const app = creaApp([foto('P', 'a.png', { tags: ['cat'], originalTags: ['cat'] }), foto('J', 'a.jpg', { cestinata: false, tags: ['cat'], originalTags: ['cat'] })], { api });
    await app.render().handleEmptyTrash();
    await app.attendi();
    dice('premessa: a.txt non parte con a.png (serve ad a.jpg)', [['E:\\dataset\\a.png']], api.chiamate);
    c = false;
    app.modifica(prev => prev.filter(i => i.id !== 'J'));
    await app.attendi();
    const n = app.notifiche.length;
    await app.render().annullaSvuotamento();
    await app.attendi();
    dice('a.txt sparito con a.jpg: l\'avviso dice ancora il .txt non ripreso', [[[t.undoEmptyDone.replace('{n}', '1'), t.undoEmptyTxtNotBack.replace('{n}', '1')].join(' · '), 'info']],
        app.notifiche.slice(n));
    dice('...e a.png resta da salvare (originalTags vuoto)', [[]], app.stato.images.filter(i => i.id === 'P').map(i => i.originalTags));
}
{
    // ITALIANO: foto col suo .txt spostato e ripreso: verde come sempre.
    // ENGLISH: a photo with its .txt moved and taken back: green as always.
    const api = apiFinta({ txtSulDisco: () => true });
    const app = creaApp([foto('A', 'a.png', { tags: ['cat'], originalTags: ['cat'] })], { api });
    const avvisi = await svuotaEAnnulla(app);
    dice('foto col suo .txt: immagine e .txt ripresi, avviso verde', [[['E:\\dataset\\a.png'], ['E:\\dataset\\a.txt']], [[t.undoEmptyDone.replace('{n}', '1'), 'success']]],
        [api.ripristini, avvisi]);
}

console.log('\n--- 2) a.png chiusa con la X, riaperta (id nuovo), cestinata e svuotata ---');
{
    const api = apiFinta();
    const vecchia = foto('VECCHIA', 'a.png', { cestinata: false, tags: ['smile'], originalTags: ['smile'] });
    const nuova = foto('NUOVA', 'a.png', { tags: ['smile'], originalTags: ['smile'] });
    const app = creaApp([nuova], { api });
    app.refs.fotoChiuseRef.current.set('VECCHIA', { id: 'VECCHIA', name: 'a.png', lotto: '', cartella: '', foto: vecchia });
    await app.render().handleEmptyTrash();
    await app.attendi();
    dice('vanno nel Cestino di Windows sia a.png sia a.txt', [['E:\\dataset\\a.png'], ['E:\\dataset\\a.txt']], api.chiamate);
    dice('...e "Annulla lo svuotamento" li chiederebbe indietro tutti e due', 'E:\\dataset\\a.txt', app.stato.ultimoSvuotamento?.voci?.[0]?.txtPath);
}
{
    // ITALIANO: lo stesso senza percorsi (cartella aperta nell'anteprima, "Elimina per sempre"): la
    //           foto chiusa ha lo stesso nome e la stessa cartella, quindi e' lo stesso file.
    // ENGLISH: the same without paths (folder opened in the preview, "Delete forever"): the closed
    //          photo has the same name and the same folder, so it is the same file.
    const cartella = { name: 'dataset', rimossi: [], async removeEntry(n) { this.rimossi.push(n); } };
    const vecchia = { ...foto('VECCHIA', 'a.png', { cestinata: false }), file: { name: 'a.png' }, dirHandle: cartella };
    const nuova = { ...foto('NUOVA', 'a.png'), file: { name: 'a.png' }, dirHandle: cartella };
    const app = creaApp([nuova]);
    app.refs.fotoChiuseRef.current.set('VECCHIA', { id: 'VECCHIA', name: 'a.png', lotto: '', cartella: '', foto: vecchia });
    await app.render().eliminaPerSempre([nuova]);
    await app.attendi();
    dice('"Elimina per sempre" toglie a.png e anche a.txt', ['a.png', 'a.txt'], cartella.rimossi);
}

console.log('\n--- quello che NON deve cambiare: un\'altra foto che usa davvero a.txt ---');
{
    const api = apiFinta();
    const app = creaApp([foto('P', 'a.png', { tags: ['cat'], originalTags: ['cat'] })], { api });
    app.refs.fotoChiuseRef.current.set('J', { id: 'J', name: 'a.jpg', lotto: '', cartella: '', foto: foto('J', 'a.jpg', { cestinata: false }) });
    await app.render().handleEmptyTrash();
    await app.attendi();
    dice('a.jpg chiusa con la X usa a.txt: a.txt resta', [['E:\\dataset\\a.png']], api.chiamate);
}
{
    const api = apiFinta();
    const app = creaApp([foto('P', 'a.png', { tags: ['cat'], originalTags: ['cat'] }), foto('J', 'a.jpg', { cestinata: false })], { api });
    await app.render().handleEmptyTrash();
    await app.attendi();
    dice('a.jpg in galleria usa a.txt: a.txt resta', [['E:\\dataset\\a.png']], api.chiamate);
}
{
    const api = apiFinta();
    const app = creaApp([foto('P', 'a.png', { tags: ['cat'], originalTags: ['cat'] })], { api });
    app.refs.fotoChiuseRef.current.set('Q', { id: 'Q', name: 'a.png', lotto: '', cartella: '', foto: foto('Q', 'a.png', { cestinata: false, cartella: 'E:\\altra\\' }) });
    await app.render().handleEmptyTrash();
    await app.attendi();
    dice('una a.png chiusa di un\'altra cartella non conta: a.txt parte', [['E:\\dataset\\a.png'], ['E:\\dataset\\a.txt']], api.chiamate);
}

process.exit(esito());
