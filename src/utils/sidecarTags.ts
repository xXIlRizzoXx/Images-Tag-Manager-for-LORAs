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

import { hasTagIgnoringCase, hasTagsBeyondTriggers, uniqueTagsIgnoringCase } from './tagCase';

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

// ITALIANO: Quanti tag al massimo entrano da un file di tag del progetto (JSON o TXT).
// ENGLISH: How many tags at most come in from a project tags file (JSON or TXT).
export const PROJECT_TAGS_MAX = 5000;

// ITALIANO: Ripulisce i tag letti da un file di tag del progetto: caratteri di controllo tolti,
//   niente vuoti ne' doppioni, ogni tag al massimo TXT_TAG_MAX_CHARS come nei .txt, al massimo
//   PROJECT_TAGS_MAX in tutto. Prima ogni tag si tagliava a 100 caratteri: una didascalia in frase
//   esportata intera tornava monca, a meta' parola, senza un avviso. `truncated` dice se qualcosa
//   e' stato accorciato o lasciato fuori, cosi' lo si puo' dire.
// ENGLISH: Cleans the tags read from a project tags file: control characters removed, no empties
//   or duplicates, each tag at most TXT_TAG_MAX_CHARS as in the .txt files, at most
//   PROJECT_TAGS_MAX in all. Each tag used to be cut at 100 characters: a sentence caption
//   exported whole came back cut, mid-word, with no notice. `truncated` says whether anything was
//   shortened or left out, so it can be said.
export const pulisciTagProgetto = (voci: unknown[]): { tags: string[]; truncated: boolean } => {
    let truncated = false;
    const tags = [...new Set(voci
        .map((s: unknown) => String(s).replace(/[\x00-\x1F\x7F]/g, ' ').trim())
        .filter((tag: string) => tag.length > 0)
        .map((tag: string) => {
            if (tag.length <= TXT_TAG_MAX_CHARS) return tag;
            truncated = true;
            return tag.slice(0, TXT_TAG_MAX_CHARS);
        }))];
    if (tags.length > PROJECT_TAGS_MAX) truncated = true;
    return { tags: tags.slice(0, PROJECT_TAGS_MAX), truncated };
};

// ITALIANO: I tag di una foto appena importata. `tags` = le trigger word attive davanti, poi quelli
//   del .txt. `originalTags` = SOLO cio' che c'e' DAVVERO nel .txt, nel suo ordine: un .txt che ha
//   gia' le trigger davanti, nell'ordine del riquadro, non risulta modificato; uno che le ha in
//   mezzo (o in un altro ordine) si', e "Salva modifiche" lo riscrive con le trigger davanti, come
//   quando la trigger si scrive dopo l'import. Prima il ricordo del disco le spostava davanti anche
//   lui, e quel .txt restava con la trigger in mezzo (con keep_tokens restava fisso un altro tag).
//   Prima ancora era la stessa lista di `tags`: una foto aggiunta con una trigger word gia' attiva
//   la mostrava, ma "Salva modifiche" rispondeva "Nessuna modifica" e il suo .txt restava senza.
// ENGLISH: The tags of a freshly imported photo. `tags` = the active trigger words first, then the
//   .txt's own. `originalTags` = ONLY what is REALLY in the .txt, in its own order: a .txt that
//   already has the triggers first, in the box's order, does not count as modified; one that has
//   them in the middle (or in another order) does, and "Save changes" rewrites it trigger-first, as
//   when the trigger is typed after the import. The disk record used to move them first too, and
//   that .txt kept the trigger in the middle (with keep_tokens another tag stayed fixed). Before
//   that it was the same list as `tags`: a photo added while a trigger word was active showed it,
//   but "Save changes" answered "No changes" and its .txt stayed without it.
// ITALIANO: `txtNonLetto` = il .txt c'e' ma non si e' potuto leggere (oltre 1 MB, bloccato, un file
//   di OneDrive solo in rete): cosa contiene non si sa, quindi originalTags = tags e la foto non
//   risulta modificata. Contata come "senza .txt", il primo "Salva modifiche" scriveva la sola
//   trigger SOPRA il file vero. Solo una modifica fatta apposta la fa risultare da salvare, e
//   "Salva modifiche" non ci scrive comunque sopra (vedi txtNonLettoInVigore).
// ENGLISH: `txtNonLetto` = the .txt exists but could not be read (over 1 MB, locked, a OneDrive
//   online-only file): its content is unknown, so originalTags = tags and the photo does not count
//   as modified. Counted as "no .txt", the first "Save changes" wrote the trigger alone OVER the real
//   file. Only an edit made on purpose makes it count as unsaved, and "Save changes" still does not
//   write over it (see txtNonLettoInVigore).
// ITALIANO: in `tags` due grafie dello stesso tag ("ohwx" del .txt e la trigger "OHWX", o "smile,
//   Smile" nel .txt) diventano una sola, con la grafia della trigger o la prima (vedi tagCase):
//   prima entravano tutte e due e Salva scriveva "OHWX, ohwx, smile,". `originalTags` resta il
//   contenuto vero del .txt, quindi la foto risulta da salvare e il salvataggio scrive il .txt pulito.
// ENGLISH: in `tags` two spellings of the same tag ("ohwx" from the .txt and the trigger "OHWX", or
//   "smile, Smile" in the .txt) become one, with the trigger's spelling or the first one (see
//   tagCase): both used to come in and Save wrote "OHWX, ohwx, smile,". `originalTags` stays the
//   real content of the .txt, so the photo counts as unsaved and saving writes the .txt clean.
export const tagDiImport = (globalTriggers: string[], sidecarTags: string[], txtNonLetto = false): { tags: string[]; originalTags: string[] } => {
    const combinedTags = uniqueTagsIgnoringCase([...globalTriggers, ...sidecarTags], globalTriggers);
    const orderedTags = [
        ...globalTriggers.filter(t => combinedTags.includes(t)),
        ...combinedTags.filter(t => !globalTriggers.includes(t))
    ];
    if (txtNonLetto) return { tags: orderedTags, originalTags: [...orderedTags] };
    return { tags: orderedTags, originalTags: [...new Set(sidecarTags)] };
};

// ITALIANO: questa foto ha modifiche che "Salva" deve scrivere? Di solito basta che i tag siano
//           diversi da originalTags. Una foto il cui .txt c'e' ma all'import non si e' potuto
//           leggere (oltre 1 MB, bloccato, un file di OneDrive solo in rete) porta
//           `baseTxtNonLetto` = i tag che aveva all'import (solo le trigger di allora): finche' il
//           suo ricordo del disco e' ancora quello, contano solo i tag messi apposta su di lei, non
//           le trigger word. Prima una trigger scritta dopo l'import, o tolta dopo averla messa
//           prima, la faceva risultare modificata, e "Salva" scriveva la sola trigger (o un file
//           vuoto) SOPRA il .txt vero mai letto. Quando il suo .txt viene scritto (Salva, il
//           visualizzatore, l'editor dei file di tag) originalTags cambia e la regola torna quella
//           di sempre, anche dopo un Ctrl+Z (vedi withLiveOriginalTags).
// ENGLISH: does this photo have edits "Save" must write? Usually it is enough that the tags differ
//          from originalTags. A photo whose .txt exists but could not be read at import (over 1 MB,
//          locked, a OneDrive online-only file) carries `baseTxtNonLetto` = the tags it had at import
//          (only the triggers of that time): while its disk record is still that one, only the tags
//          put on it on purpose count, not the trigger words. A trigger typed after the import, or
//          removed after setting it before, used to make it count as modified, and "Save" wrote the
//          trigger alone (or an empty file) OVER the real .txt that was never read. Once its .txt is
//          written (Save, the viewer, the tag file editor) originalTags changes and the usual rule
//          applies again, after a Ctrl+Z too (see withLiveOriginalTags).
export const fotoDaSalvare = (img: any, triggers: string[] = []): boolean => {
    if (JSON.stringify(img.tags) === JSON.stringify(img.originalTags)) return false;
    if (!txtNonLettoInVigore(img)) return true;
    return hasTagsBeyondTriggers(Array.isArray(img.tags) ? img.tags : [], [...(Array.isArray(triggers) ? triggers : []), ...img.baseTxtNonLetto]);
};

// ITALIANO: il .txt di questa foto c'e' ma all'import non si e' potuto leggere, e da allora non e'
//           stato scritto (il ricordo del disco e' ancora quello dell'import, vedi fotoDaSalvare):
//           cosa contiene non si sa. "Salva modifiche" non ci scrive sopra (lo dice, con i nomi) e
//           "Salta foto gia' taggate" la conta fra quelle con dei tag. Prima bastava un tag aggiunto
//           a tutte, un Incolla o l'AI (che non la saltava, perche' sembrava senza tag) e "Salva"
//           sostituiva il .txt vero, mai letto, con i soli tag nuovi.
// ENGLISH: this photo's .txt exists but could not be read at import, and has not been written since
//          (the disk record is still the import's, see fotoDaSalvare): its content is unknown. "Save
//          changes" does not write over it (it says so, with the names) and "Skip already-tagged
//          photos" counts it among those with tags. A tag added to all photos, a Paste or the AI
//          (which did not skip it, as it looked untagged) used to be enough for "Save" to replace
//          the real .txt, never read, with the new tags alone.
export const txtNonLettoInVigore = (img: any): boolean =>
    !!img && Array.isArray(img.baseTxtNonLetto) && JSON.stringify(img.originalTags) === JSON.stringify(img.baseTxtNonLetto);

// ITALIANO: I tag di una foto dopo che l'editor dei file di tag ha salvato il suo .txt. L'editor
//   mostra solo il file su disco, quindi non ha mai visto una trigger word ancora da salvare (sulla
//   card ma non nel .txt): quella resta davanti e fuori da `originalTags`, cosi' "Salva modifiche"
//   la scrive, come dopo l'import. Prima la foto prendeva il file sia come tag sia come disco: la
//   trigger spariva e il .txt restava senza, mentre il riquadro la mostrava attiva. Una trigger che
//   il file aveva e che l'utente ha tolto nell'editor resta tolta. `originalTags` = il file scritto.
//   Anche le altre modifiche non salvate della card (tag aggiunti o tolti rispetto a originalTags,
//   senza badare alle maiuscole) si rimettono sopra il file salvato, e la foto resta da salvare.
//   Prima lasciavano il posto al file: un tag aggiunto in galleria spariva, uno tolto tornava, e la
//   foto risultava salvata senza nessun avviso.
// ENGLISH: A photo's tags after the tag file editor saved its .txt. The editor only shows the file
//   on disk, so it never saw a trigger word still to be saved (on the card but not in the .txt):
//   that one stays first and out of `originalTags`, so "Save changes" writes it, as after the
//   import. The photo used to take the file both as tags and as disk: the trigger vanished and the
//   .txt stayed without it, while the box showed it active. A trigger the file had and the user
//   removed in the editor stays removed. `originalTags` = the file written.
//   The card's other unsaved edits (tags added or removed against originalTags, regardless of
//   case) are put back on top of the saved file too, and the photo stays to be saved. They used to
//   give way to the file: a tag added in the gallery vanished, a removed one came back, and the
//   photo counted as saved with no notice.
export const tagDopoEditor = (tags: string[], originalTags: string[], savedTags: string[], globalTriggers: string[]): { tags: string[]; originalTags: string[] } => {
    const aggiunti = tags.filter(tg => !hasTagIgnoringCase(originalTags, tg));
    const tolti = originalTags.filter(tg => !hasTagIgnoringCase(tags, tg));
    // ITALIANO: una trigger tolta a mano da questa card resta tolta anche se il file la contiene.
    // ENGLISH: a trigger removed by hand from this card stays removed even if the file holds it.
    const daTenere = globalTriggers.filter(tg => (hasTagIgnoringCase(savedTags, tg) && !hasTagIgnoringCase(tolti, tg))
        || (hasTagIgnoringCase(tags, tg) && !hasTagIgnoringCase(originalTags, tg)));
    const conCard = savedTags.filter(tg => !hasTagIgnoringCase(tolti, tg));
    for (const tg of aggiunti) if (!hasTagIgnoringCase(conCard, tg)) conCard.push(tg);
    return { tags: tagDiImport(daTenere, conCard).tags, originalTags: [...new Set(savedTags)] };
};
