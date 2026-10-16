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

/* ITALIANO: ANCHE SENZA PERCORSI, E CON LA FOTO APERTA CHE COMBACIA
   Una cartella di rete scritta per esteso (\\server\condivisione) aperta con "Carica cartella" non
   da' percorsi: ne' alle foto in arrivo ne' a quelle gia' in galleria. La sola regola dei percorsi non
   scartava niente e riaprendo ogni foto entrava due volte. Quando una delle due foto non ha il
   percorso decide la CARTELLA: stesso nome del file (senza maiuscole) e stessa cartella sul disco
   (isSameEntry sugli handle, che riconosce la stessa cartella anche scelta due volte). Se tutte e
   due hanno il percorso decide il percorso, come prima. Un errore di isSameEntry vuol dire "non e'
   la stessa": si importa, come prima.
   `aperte` sono le foto del progetto e quelle di un import ancora in corso; torna, per ogni foto
   in arrivo gia' aperta, la foto aperta con cui combacia (serve a riusarne il lotto di import).

   ENGLISH: ALSO WITHOUT PATHS, AND WITH THE MATCHING OPEN PHOTO
   A network folder written out in full (\\server\share) opened with "Load folder" gives no paths:
   neither to the incoming photos nor to those in the gallery. The path rule alone dropped nothing and on
   reopening every photo came in twice. When one of the two photos has no path the FOLDER decides:
   same file name (case-insensitive) and same folder on disk (isSameEntry on the handles, which
   recognises the same folder even when picked twice). When both have a path the path decides, as
   before. An isSameEntry error means "not the same": the photo is imported, as before.
   `aperte` are the project's photos and those of an import still running; for every incoming photo
   already open it returns the open photo it matches (used to reuse its import batch). */
export type FotoAperta = { percorso: string; nome: string; cartella: any };

export const fotoGiaAperte = async <F, A extends FotoAperta>(inArrivo: F[], descrivi: (f: F) => FotoAperta, aperte: A[]): Promise<Map<F, A>> => {
    const doppi = new Map<F, A>();
    if (aperte.length === 0) return doppi;
    const perPercorso = new Map<string, A>();
    const perNome = new Map<string, A[]>();
    for (const a of aperte) {
        if (a.percorso && !perPercorso.has(chiave(a.percorso))) perPercorso.set(chiave(a.percorso), a);
        const n = String(a.nome || '').toLowerCase();
        if (!n || !a.cartella) continue;
        if (!perNome.has(n)) perNome.set(n, []);
        perNome.get(n)!.push(a);
    }
    // ITALIANO: una sola domanda per coppia di cartelle: le foto della stessa cartella la condividono.
    // ENGLISH: one question per pair of folders: the photos of the same folder share it.
    const risposte = new Map<any, Map<any, Promise<boolean>>>();
    const stessaCartella = (x: any, y: any): Promise<boolean> => {
        if (x === y) return Promise.resolve(true);
        let perX = risposte.get(x);
        if (!perX) { perX = new Map(); risposte.set(x, perX); }
        let r = perX.get(y);
        if (!r) {
            r = (async () => {
                try { return typeof x.isSameEntry === 'function' && (await x.isSameEntry(y)) === true; } catch (_) { return false; }
            })();
            perX.set(y, r);
        }
        return r;
    };
    for (const f of inArrivo) {
        const d = descrivi(f);
        const perP = d.percorso ? perPercorso.get(chiave(d.percorso)) : undefined;
        if (perP) { doppi.set(f, perP); continue; }
        if (!d.cartella) continue;
        for (const a of perNome.get(String(d.nome || '').toLowerCase()) || []) {
            if (d.percorso && a.percorso) continue;
            if (await stessaCartella(d.cartella, a.cartella)) { doppi.set(f, a); break; }
        }
    }
    return doppi;
};
