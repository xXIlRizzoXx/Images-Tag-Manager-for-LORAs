/* ITALIANO: FOTO GIA' APERTE
   Riaprire la stessa cartella (o trascinare di nuovo le stesse foto) caricava un'altra volta le foto
   gia' aperte: due card per lo stesso file, e due salvataggi sullo stesso .txt (visto: 5 -> 10 -> 24).
   Una foto in arrivo e' "gia' aperta" quando il suo percorso su disco e' quello di una foto del
   progetto (in galleria o nel cestino dell'app). Senza percorsi (anteprima del browser) non si sa:
   non si scarta niente, come prima. Maiuscole e barre non contano (Windows).

   ENGLISH: PHOTOS ALREADY OPEN
   Reopening the same folder (or dropping the same photos again) loaded the open photos once more: two
   cards for the same file, and two saves to the same .txt. An incoming photo is "already open" when
   its path on disk is the one of a project photo (in the gallery or in the app's trash). Without paths
   (browser preview) nothing is known: nothing is dropped, as before. Case and slashes do not count. */

const chiave = (p: string): string => String(p || '').replace(/\//g, '\\').toLowerCase();

export const fileGiaAperti = <F>(inArrivo: F[], percorsoDi: (f: F) => string, percorsiAperti: string[]): Set<F> => {
    const aperti = new Set(percorsiAperti.filter(Boolean).map(chiave));
    const doppi = new Set<F>();
    if (aperti.size === 0) return doppi;
    for (const f of inArrivo) {
        const p = percorsoDi(f);
        if (p && aperti.has(chiave(p))) doppi.add(f);
    }
    return doppi;
};
