/******************************************************************************
*******************************************************************************
**                                                                            **
**  ITALIANO: ABBINAMENTO E LETTURA DEI .txt DEI TAG (import)                 **
**  Regole pure, senza React e senza disco: come una foto trova il SUO .txt,  **
**  come si legge il testo di un .txt, quali tag sono davvero su disco.       **
**  Stanno fuori da App.tsx perche' le prove (scripts/test-*.mjs) le possano  **
**  eseguire da sole.                                                         **
**                                                                            **
**  ENGLISH: PAIRING AND READING OF THE TAG .txt FILES (import)               **
**  Pure rules, no React and no disk: how a photo finds ITS .txt, how a       **
**  .txt's text is read, which tags are really on disk. They live outside     **
**  App.tsx so the tests (scripts/test-*.mjs) can run them on their own.      **
**                                                                            **
*******************************************************************************
*******************************************************************************/

// ITALIANO: Nome-base di un file, senza estensione (foto.jpg -> foto). Stessa regola usata
//           storicamente dall'import, estratta qui per usarla in un solo posto.
// ENGLISH: A file's base name, without extension (photo.jpg -> photo). Same rule the import
//          has always used, pulled out here so it lives in one place.
export const fileBaseName = (name: string): string => name.split('.').slice(0, -1).join('.');

// ITALIANO: CHIAVE "CARTELLA + NOME" per abbinare ogni immagine al SUO .txt.
//   Due foto con lo STESSO nome in sottocartelle diverse (es. 10_viso\img_001.png e
//   20_corpo\img_001.png, la disposizione tipica dei dataset LoRA) NON devono scambiarsi
//   i tag. Prima l'abbinamento usava solo il nome-base: la seconda cartella sovrascriveva
//   la prima e ogni foto con quel nome riceveva i tag della cartella letta per ultima —
//   poi, al salvataggio, quei tag stranieri finivano scritti sul .txt vero dell'altra foto.
//   La chiave unisce l'IDENTITA' DELLA CARTELLA al nome-base. La cartella puo' essere:
//     - un handle (oggetto) dalla scelta cartella  -> gli si assegna un id stabile
//     - un percorso (stringa) dal caricamento di singole immagini / dal fallback
//     - assente (nessuna info cartella)            -> un unico spazio, come prima
//   Il nome-base si confronta SENZA maiuscole, come fa Windows: IMG_001.JPG e img_001.txt per
//   Windows (e per Kohya) sono una coppia. Prima la foto arrivava senza tag e il primo
//   salvataggio scriveva IMG_001.txt, che su NTFS E' img_001.txt, coi soli tag nuovi. Il .txt
//   scritto al salvataggio tiene comunque il nome della foto. La cartella NON si confronta cosi':
//   foto e .txt la prendono dalla stessa lettura del disco, quindi e' gia' scritta uguale.
//   Limite accettato: in una cartella con le maiuscole distinte (si crea solo apposta, per esempio
//   da WSL) a.txt e A.txt avrebbero la stessa chiave; con i normali strumenti di Windows non esiste.
// ENGLISH: "FOLDER + NAME" KEY to pair each image with ITS OWN .txt.
//   Two photos with the SAME name in different subfolders (e.g. 10_face\img_001.png and
//   20_body\img_001.png, the typical LoRA dataset layout) must NOT swap tags. Matching used
//   to key on the base name alone: the second folder overwrote the first and every photo
//   with that name got the last-scanned folder's tags — which the save then wrote onto the
//   OTHER photo's real .txt. The key joins the FOLDER IDENTITY to the base name. The folder
//   may be: a handle (object) from the folder picker -> given a stable id; a path (string)
//   from the individual-image / fallback load; or absent (no folder info) -> one namespace,
//   exactly as before.
//   The base name is compared WITHOUT case, as Windows does: to Windows (and to Kohya)
//   IMG_001.JPG and img_001.txt are a pair. The photo used to arrive with no tags and the first
//   save wrote IMG_001.txt, which on NTFS IS img_001.txt, with the new tags alone. The .txt
//   written on save still carries the photo's own name. The folder is NOT compared this way:
//   photo and .txt take it from the same read of the disk, so it is already spelled the same.
//   Accepted limit: in a case-sensitive folder (only made on purpose, e.g. from WSL) a.txt and
//   A.txt would share a key; with the normal Windows tools such a folder does not exist.
export const makeFolderKeyer = (folderOf: Map<any, any> | null | undefined) => {
    const dirIds = new Map<any, number>();
    let next = 0;
    return (file: any): string => {
        const dir = folderOf ? folderOf.get(file) : null;
        let ns = '';
        if (typeof dir === 'string') {
            ns = dir ? 'p:' + dir : '';
        } else if (dir) {
            if (!dirIds.has(dir)) dirIds.set(dir, next++);
            ns = 'h:' + dirIds.get(dir);
        }
        return ns + '\x1f' + fileBaseName(file.name).toLowerCase();
    };
};

// ITALIANO: Cartella di un file dal suo percorso ("Carica immagini", trascinamento): per la foto
//   la ricava la pagina, per il .txt la manda il processo principale. Le due parti passano per
//   la STESSA regola, senza separatore finale: per una foto alla RADICE di un'unita' (chiavetta,
//   scheda SD: E:\img_001.jpg) il processo principale manda la cartella del .txt come
//   path.dirname, che alla radice TIENE il separatore ("E:\"), mentre qui si tagliava prima
//   ("E:"). Le due chiavi non si incontravano: la foto arrivava senza tag e il primo salvataggio
//   riscriveva il suo .txt coi soli tag nuovi. Si toglie il separatore, non lo si aggiunge: la
//   cartella della foto resta quella di prima, e con lei la chiave del backup anti-crash.
// ENGLISH: A file's folder from its path ("Load images", drag and drop): the page works it out for
//   the photo, the main process sends it for the .txt. Both sides go through the SAME rule, with
//   no trailing separator: for a photo at the ROOT of a drive (USB stick, SD card: E:\img_001.jpg)
//   the main process sends the .txt's folder as path.dirname, which KEEPS the separator at a root
//   ("E:\"), while here it was cut before it ("E:"). The two keys never met: the photo arrived with
//   no tags and the first save rewrote its .txt with the new tags alone. The separator is removed,
//   not added: the photo's folder stays what it was, and so does the crash backup's key.
const senzaSeparatoreFinale = (d: string): string => d.replace(/[\\/]+$/, '');

export const cartellaImmagine = (p: string): string => {
    const cut = Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/'));
    return senzaSeparatoreFinale(cut > 0 ? p.slice(0, cut) : '');
};

export const cartellaTesto = (dir: string): string => senzaSeparatoreFinale(dir);

// ITALIANO: Un .txt mandato dal processo principale ("Carica immagini", trascinamento) diventa un
//   file che l'import legge come quelli di "Carica cartella". Un .txt che c'e' ma il processo
//   principale non ha letto (oltre 1 MB, bloccato, un file di OneDrive solo in rete) arriva
//   segnato `skipped`, senza testo: diventa un file che non si lascia leggere, cosi' l'import lo
//   conta fra i .txt saltati e lo dice con la frase che usa gia' per "Carica cartella". Prima la
//   foto sembrava senza tag senza nessun avviso, e un file costruito dal testo mancante avrebbe
//   dato il tag "undefined".
// ENGLISH: A .txt sent by the main process ("Load images", drag and drop) becomes a file the
//   import reads like the ones from "Load Folder". A .txt that exists but the main process did
//   not read (over 1 MB, locked, a OneDrive online-only file) arrives marked `skipped`, with no
//   text: it becomes a file that refuses to be read, so the import counts it among the skipped
//   .txt files and says so with the sentence it already uses for "Load Folder". The photo used
//   to look untagged with no notice, and a file built from the missing text would have given
//   the tag "undefined".
export const fileDaSidecar = (s: { name: string; content?: string; skipped?: boolean }): File => {
    if (s.skipped) {
        const saltato = new File([], s.name, { type: 'text/plain' });
        Object.defineProperty(saltato, 'text', { value: () => Promise.reject(new Error('sidecar .txt not read: ' + s.name)) });
        return saltato;
    }
    return new File([typeof s.content === 'string' ? s.content : ''], s.name, { type: 'text/plain' });
};

// ITALIANO: Limiti sui .txt letti all'import (un dataset scaricato e' input non fidato). Il limite
//   vero di sicurezza e' la dimensione del file (1 MB, in App.tsx); questi due tengono solo a bada
//   la galleria davanti a un file ostile. Prima erano 100 caratteri per tag e 200 tag per file:
//   una didascalia in frase (Flux/SDXL, 120-300 caratteri senza virgole) veniva TAGLIATA in
//   silenzio, e il primo salvataggio scriveva su disco la frase monca.
// ENGLISH: Caps on the .txt read at import (a downloaded dataset is untrusted input). The real
//   safety limit is the file size (1 MB, in App.tsx); these two only keep the gallery safe from a
//   hostile file. They used to be 100 characters per tag and 200 tags per file: a sentence caption
//   (Flux/SDXL, 120-300 characters with no commas) was CUT silently, and the first save wrote the
//   truncated sentence to disk.
export const TXT_MAX_TAGS_PER_FILE = 2000;
export const TXT_TAG_MAX_CHARS = 4000;

// ITALIANO: Legge il testo di un .txt: tag separati da virgole o a capo, caratteri di controllo
//   tolti, niente vuoti ne' doppioni. `truncated` dice se un limite qui sopra ha tagliato
//   qualcosa, cosi' l'import lo puo' dire invece di tacerlo.
// ENGLISH: Reads a .txt's text: tags separated by commas or newlines, control characters
//   removed, no empties or duplicates. `truncated` says whether a cap above cut something, so
//   the import can say so instead of keeping quiet.
export const parseSidecarText = (text: string): { tags: string[]; truncated: boolean } => {
    let truncated = false;
    const tags = [...new Set(text.split(/[,\n\r]+/)
        .map((tag: string) => tag.replace(/[\x00-\x1F\x7F]/g, ' ').trim())
        .filter((tag: string) => tag.length > 0)
        .map((tag: string) => {
            if (tag.length <= TXT_TAG_MAX_CHARS) return tag;
            truncated = true;
            return tag.slice(0, TXT_TAG_MAX_CHARS);
        }))];
    if (tags.length > TXT_MAX_TAGS_PER_FILE) truncated = true;
    return { tags: tags.slice(0, TXT_MAX_TAGS_PER_FILE), truncated };
};

// ITALIANO: I tag di una foto appena importata. `tags` = le trigger word attive davanti, poi quelli
//   del .txt. `originalTags` = SOLO cio' che c'e' DAVVERO nel .txt (le trigger che il file
//   contiene davanti, nello stesso ordine, cosi' un .txt che le ha gia' non risulta modificato).
//   Prima era la stessa lista di `tags`: una foto aggiunta con una trigger word gia' attiva la
//   mostrava, ma "Salva modifiche" rispondeva "Nessuna modifica" e il suo .txt restava senza.
// ENGLISH: The tags of a freshly imported photo. `tags` = the active trigger words first, then the
//   .txt's own. `originalTags` = ONLY what is REALLY in the .txt (the triggers the file holds
//   first, same order, so a .txt that already has them does not count as modified). It used to be
//   the same list as `tags`: a photo added while a trigger word was active showed it, but "Save
//   changes" answered "No changes" and its .txt stayed without it.
// ITALIANO: `txtNonLetto` = il .txt c'e' ma non si e' potuto leggere (oltre 1 MB, bloccato, un file
//   di OneDrive solo in rete): cosa contiene non si sa, quindi originalTags = tags e la foto non
//   risulta modificata. Contata come "senza .txt", il primo "Salva modifiche" scriveva la sola
//   trigger SOPRA il file vero. Solo una modifica fatta apposta la fa salvare, come prima.
// ENGLISH: `txtNonLetto` = the .txt exists but could not be read (over 1 MB, locked, a OneDrive
//   online-only file): its content is unknown, so originalTags = tags and the photo does not count
//   as modified. Counted as "no .txt", the first "Save changes" wrote the trigger alone OVER the real
//   file. Only an edit made on purpose gets it saved, as before.
export const tagDiImport = (globalTriggers: string[], sidecarTags: string[], txtNonLetto = false): { tags: string[]; originalTags: string[] } => {
    const combinedTags = [...new Set([...globalTriggers, ...sidecarTags])];
    const orderedTags = [
        ...globalTriggers.filter(t => combinedTags.includes(t)),
        ...combinedTags.filter(t => !globalTriggers.includes(t))
    ];
    if (txtNonLetto) return { tags: orderedTags, originalTags: [...orderedTags] };
    const suDisco = [
        ...globalTriggers.filter(t => sidecarTags.includes(t)),
        ...sidecarTags.filter(t => !globalTriggers.includes(t))
    ];
    return { tags: orderedTags, originalTags: [...new Set(suDisco)] };
};
