/******************************************************************************
*******************************************************************************
**                                                                            **
**  ITALIANO: BACKUP ANTI-CRASH DEI TAG (localStorage 'tagBackup')            **
**  Regole pure, senza React: cosa entra nel backup, a quale cartella         **
**  appartiene, e quando una voce si puo' rimettere sopra i .txt letti.       **
**  Stanno fuori da App.tsx perche' le prove le possano eseguire da sole.     **
**                                                                            **
**  ENGLISH: CRASH BACKUP OF THE TAGS (localStorage 'tagBackup')              **
**  Pure rules, no React: what goes into the backup, which folder it          **
**  belongs to, and when an entry may be put back over the .txt just read.    **
**  They live outside App.tsx so the tests can run them on their own.         **
**                                                                            **
*******************************************************************************
*******************************************************************************/

import { parseSidecarText, fotoDaSalvare, TXT_MAX_TAGS_PER_FILE, TXT_TAG_MAX_CHARS } from './sidecarTags';
import { uniqueTagsIgnoringCase } from './tagCase';

// ITALIANO: separatore fra cartella e nome nelle chiavi del backup (vedi makeBackupKeyer in App.tsx).
// ENGLISH: separator between folder and name in the backup keys (see makeBackupKeyer in App.tsx).
export const BACKUP_KEY_SEP = '\x1f';

// ITALIANO: "Impronta" di una cartella: nome + quante immagini + la prima e l'ultima in ordine
//           alfabetico. Serve a riconoscere che il backup anti-crash appartiene DAVVERO alla
//           cartella che si sta aprendo. Col solo nome, due dataset chiamati entrambi "dataset"
//           risultavano lo stesso progetto.
// ENGLISH: A folder "fingerprint": name + how many images + the alphabetically first and last
//          one. It tells whether the crash backup REALLY belongs to the folder being opened.
//          With the name alone, two datasets both called "dataset" looked like the same project.
export const folderSignature = (folderName: string, fileNames: string[]): string => {
    const sorted = [...fileNames].sort();
    return `${folderName}|${sorted.length}|${sorted[0] || ''}|${sorted[sorted.length - 1] || ''}`;
};

// ITALIANO: Impronta dei tag che una foto ha SU DISCO (i suoi originalTags), letti come li
//           rileggerebbe l'import: senza ordine, senza doppioni. Ogni voce del backup se la porta
//           dietro: se alla riapertura il .txt non ha piu' quei tag, e' cambiato DOPO il backup
//           (un altro programma, Blocco note, una copia della cartella con altri tag) e la voce non
//           si applica: vince il disco, che e' piu' recente. Decide il contenuto e non la data del
//           file, che su un disco di rete o in una copia non e' affidabile.
// ENGLISH: Fingerprint of the tags a photo has ON DISK (its originalTags), read the way the import
//          would read them back: no order, no duplicates. Every backup entry carries it: if on
//          reopening the .txt no longer holds those tags, it changed AFTER the backup (another
//          program, Notepad, a copy of the folder with other tags) and the entry is not applied:
//          the disk wins, being newer. The content decides, not the file date, which is not
//          reliable on a network drive or in a copy.
export const improntaTag = (tags: string[]): string => {
    const lista = parseSidecarText(tags.join(',')).tags.sort();
    const testo = lista.join('\n');
    let h = 0x811c9dc5;
    for (let i = 0; i < testo.length; i++) {
        h ^= testo.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return lista.length + ':' + h.toString(36);
};

// ITALIANO: una foto CHIUSA con la "x" sulla scheda: tolta dalla vista, ma il file e' ancora su
//           disco, quindi conta ancora nell'impronta della sua cartella.
// ENGLISH: a photo CLOSED with the "x" on its card: out of view, but the file is still on disk, so
//          it still counts in its folder's fingerprint.
// ITALIANO: `foto` = la foto com'era alla chiusura: serve a txtUsatoDaAltre (un .txt condiviso con una
//   foto chiusa, che Ctrl+Z puo' riportare, non va via). Il backup legge solo gli altri campi.
// ENGLISH: `foto` = the photo as it was when closed: used by txtUsatoDaAltre (a .txt shared with a
//   closed photo, which Ctrl+Z can bring back, does not leave). The backup reads only the other fields.
export type FotoChiusa = { id: string; name: string; lotto: string; cartella: string; foto?: unknown };

type VoceBackup = { tags: string[]; base: string };

// ITALIANO: una sorgente del backup = le voci di una cartella. `visto` = l'ultima volta che l'hanno
//   scritta le foto in memoria (la data generale `ts` non serve: ogni scrittura la rinnova); `lotto`
//   = l'import che l'ha scritta (lottoImport). Tutti e due mancano nei backup scritti prima.
// ENGLISH: a backup source = one folder's entries. `visto` = the last time the photos in memory
//   wrote it (the top-level `ts` cannot be used: every write refreshes it); `lotto` = the import that
//   wrote it (lottoImport). Both are missing in backups written earlier.
type SorgenteBackup = { signature: string; data: Record<string, VoceBackup>; visto?: number; lotto?: string };

// ITALIANO: quanto vive la sorgente di una cartella non riaperta: 14 giorni dall'ultima volta che e'
//   stata scritta. Prima non scadeva mai: settimane dopo un crash un'altra cartella con lo stesso
//   nome, gli stessi nomi di file e nessun tag (le chiavi e la `base` sono le stesse) riceveva la
//   vecchia modifica come "recuperata", e "Salva" la scriveva nel suo .txt.
// ENGLISH: how long the source of a folder not reopened lives: 14 days from the last time it was
//   written. It used to never expire: weeks after a crash another folder with the same name, the
//   same file names and no tags (same keys and same `base`) received the old edit as "recovered",
//   and "Save" wrote it into its .txt.
export const DURATA_SORGENTE_MS = 14 * 24 * 60 * 60 * 1000;
const scaduta = (s: any, ora: number): boolean => typeof s.visto === 'number' && ora - s.visto > DURATA_SORGENTE_MS;

// ITALIANO: Cosa scrivere nel backup. Null = niente da tenere: il backup va cancellato.
//   1) Dentro ci sono SOLO le foto con modifiche non salvate (tag diversi da originalTags, la
//      stessa prova di "Salva modifiche"). Prima c'erano TUTTE, e il backup restava anche dopo una
//      chiusura normale con tutto salvato: se poi i .txt cambiavano fuori dal programma, alla
//      riapertura i tag vecchi tornavano sopra quelli nuovi e il primo salvataggio li scriveva su
//      disco. Ora, finito di salvare, il backup sparisce da solo. Le foto nel cestino non entrano:
//      il loro .txt non si scrive.
//   2) Un'impronta PER OGNI IMPORT (un "lotto": una cartella aperta), non una sola per tutta la
//      lista. Prima si calcolava sulla lista in memoria col nome dell'ultima cartella aperta:
//      bastava chiudere UNA foto con la "x", aprire una seconda cartella o aggiungere foto con
//      "Carica immagini", e il backup non combaciava piu' con nessuna cartella: dopo un crash le
//      modifiche non salvate andavano perse in silenzio. L'impronta conta le foto ancora su disco,
//      come le trovera' l'import: quelle in memoria (anche nel cestino, che restano su disco finche'
//      non si svuota) piu' quelle chiuse. Le foto senza cartella ("Carica immagini",
//      trascinamento, ripiego del browser) fanno un lotto come gli altri, col nome di cartella
//      vuoto: prima restavano fuori e dopo un crash le loro modifiche andavano perse, mentre il
//      README promette il recupero per tutte. Le riconosce la stessa impronta (numero, prima e
//      ultima foto); in Electron la chiave di ogni foto porta anche il suo percorso vero (anche
//      trascinandole senza nessun .txt accanto), e ogni voce l'impronta dei tag su disco (`base`),
//      quindi non possono finire su un'altra serie. Una foto la cui chiave non ha la cartella (nel
//      browser, dove il percorso non si conosce) resta fuori: la `base` di due serie senza tag e'
//      la stessa, e i nomi da soli non le distinguono.
//      Vanno riaperte allo stesso modo e tutte insieme, come erano state caricate.
//   3) Due lotti con la STESSA impronta (la stessa cartella aperta due volte, o due copie identiche
//      nei nomi) non si possono distinguere alla riapertura: si lasciano fuori entrambi, perche'
//      i tag dell'uno potrebbero finire sull'altro. E' il lato sicuro, ed e' quello che succedeva
//      gia' prima con due cartelle aperte. Un lotto di sole foto chiuse con la "x" (nessuna
//      foto in vista) non e' un gemello: non ha niente da scrivere, e la sua cartella riaperta e'
//      l'unica copia in vista. Prima lo era, e da quel momento nessuna modifica entrava piu' nel
//      backup.
//   4) `precedente` = il backup gia' salvato. Le sue sorgenti di cartelle che NON sono aperte in
//      memoria restano: dopo un crash appartengono a cartelle non ancora riaperte. Prima, riaprendo
//      la prima cartella, il backup si riscriveva con quella sola e le altre perdevano le modifiche;
//      aprendo per prima una cartella senza modifiche si cancellava tutto. Una sorgente di una
//      cartella aperta lascia il posto a quella in memoria (salvata, modificata o gemella). Chiudi
//      progetto toglie solo quelle delle cartelle in memoria (vedi backupDopoChiusura in
//      closeGuard.ts); le toglie tutte solo Reset. Una sorgente non riaperta scade dopo
//      DURATA_SORGENTE_MS.
// ENGLISH: What to write into the backup. Null = nothing to keep: the backup must be removed.
//   1) It holds ONLY the photos with unsaved edits (tags different from originalTags, the same test
//      "Save changes" uses). It used to hold ALL of them, and it survived a normal quit with
//      everything saved: if the .txt files then changed outside the program, reopening put the old
//      tags back over the new ones and the first save wrote them to disk. Now, once everything is
//      saved, the backup goes away by itself. Trashed photos stay out: their .txt is not written.
//   2) One fingerprint PER IMPORT (a "batch": one opened folder), not one for the whole list. It
//      used to be computed on the in-memory list with the last opened folder's name: closing ONE
//      photo with the "x", opening a second folder or adding photos with "Load images" was enough
//      for the backup to match no folder at all: after a crash the unsaved edits were lost
//      silently. The fingerprint counts the photos still on disk, the way the import will find
//      them: those in memory (trashed ones too, they stay on disk until the trash is emptied) plus
//      the closed ones. Photos with no folder ("Load images", drag and drop, the browser fallback)
//      make a batch like any other, with an empty folder name: they used to stay out and after a
//      crash their edits were lost, while the README promises recovery for all of them. The same
//      fingerprint recognises them (count, first and last photo); in Electron each photo's key also
//      carries its real path (when dropped with no .txt beside them too), and each entry the
//      fingerprint of the tags on disk (`base`), so they cannot land on another set. A photo whose
//      key has no folder (in the browser, where the path is unknown) stays out: two untagged sets
//      share the same `base`, and the names alone cannot tell them apart.
//      They must be reopened the same way and all together, as loaded.
//   3) Two batches with the SAME fingerprint (the same folder opened twice, or two copies with the
//      same names) cannot be told apart on reopening: both are left out, since one's tags could
//      land on the other. That is the safe side, and it is what already happened before with two
//      folders open. A batch made only of photos closed with the "x" (no photo in view) is not a
//      twin: it has nothing to write, and its reopened folder is the only copy in view. It used to
//      be one, and from then on no edit reached the backup any more.
//   4) `precedente` = the backup already stored. Its sources for folders NOT open in memory stay:
//      after a crash they belong to folders not reopened yet. Reopening the first folder used to
//      rewrite the backup with that one alone and the others lost their edits; opening a folder with
//      no edits first deleted everything. A source of an open folder gives way to the one in memory
//      (saved, edited or twin). Close project removes only those of the folders in memory (see
//      backupDopoChiusura in closeGuard.ts); only Reset removes them all. A source not reopened
//      expires after DURATA_SORGENTE_MS.
// ITALIANO: `triggers` = le trigger word attive, per la regola di fotoDaSalvare: una foto col .txt non
//   letto all'import non entra per una sola trigger. Le trigger non restano da una sessione all'altra:
//   ripresa dal backup, quella trigger diventava un tag suo e "Salva" la scriveva sopra il file vero.
// ENGLISH: `triggers` = the active trigger words, for fotoDaSalvare's rule: a photo whose .txt was not
//   read at import does not enter for a trigger alone. Triggers do not last from one session to the
//   next: taken back from the backup, that trigger became a tag of its own and "Save" wrote it over the
//   real file.
// ITALIANO: `lottiSessione` = i lotti di import entrati in memoria in questa sessione (vedi
//   scriviBackupSubito e sorgentiDaTenere); null = nessuno noto, come prima.
// ENGLISH: `lottiSessione` = the import batches that entered memory in this session (see
//   scriviBackupSubito and sorgentiDaTenere); null = none known, as before.
export const costruisciBackup = (images: any[], chiuse: Iterable<FotoChiusa>, cartellaCorrente: string, precedente: string | null = null, triggers: string[] = [], lottiSessione: Set<string> | null = null): { folder: string; sources: SorgenteBackup[] } | null => {
    const ora = Date.now();
    const lotti = new Map<string, { cartella: string; nomi: string[]; data: Record<string, VoceBackup>; voci: number; vivi: number }>();
    const lottoDi = (lotto: string, cartella: string) => {
        let l = lotti.get(lotto);
        if (!l) { l = { cartella: '', nomi: [], data: {}, voci: 0, vivi: 0 }; lotti.set(lotto, l); }
        if (cartella) l.cartella = cartella;
        return l;
    };
    const presenti = new Set<string>();
    const chiaviPresenti = new Set<string>();
    for (const img of images) {
        presenti.add(img.id);
        chiaviPresenti.add(String(img.lottoImport || '') + BACKUP_KEY_SEP + (img.backupKey || (BACKUP_KEY_SEP + img.file.name)));
        const l = lottoDi(String(img.lottoImport || ''), String(img.cartellaImport || ''));
        l.nomi.push(img.file.name);
        l.vivi++;
        if (img.isTrashed) continue;
        if (!fotoDaSalvare(img, triggers)) continue;
        // ITALIANO: chiave cartella+nome assegnata all'import (vedi makeBackupKeyer): due foto
        //           omonime in sottocartelle diverse restano separate.
        // ENGLISH: folder+name key assigned at import (see makeBackupKeyer): two same-named photos
        //          in different subfolders stay separate.
        // ITALIANO: una chiave senza cartella (solo il nome: nel browser, dove il percorso non si
        //           conosce) non entra: due serie con gli stessi nomi e senza tag avrebbero la stessa
        //           impronta, le stesse chiavi e la stessa `base`, e le modifiche dell'una finirebbero
        //           sull'altra.
        // ENGLISH: a key with no folder (the name alone: in the browser, where the path is unknown)
        //          stays out: two untagged sets with the same names would have the same fingerprint,
        //          the same keys and the same `base`, and one's edits would land on the other.
        const chiave = img.backupKey || (BACKUP_KEY_SEP + img.file.name);
        if (chiave.startsWith(BACKUP_KEY_SEP)) continue;
        l.data[chiave] = { tags: img.tags, base: improntaTag(img.originalTags || []) };
        l.voci++;
    }
    // ITALIANO: una foto chiusa e poi riportata con Ctrl+Z e' di nuovo in `images`: si conta una volta.
    // ENGLISH: a photo closed and then brought back with Ctrl+Z is in `images` again: counted once.
    // ITALIANO: lo stesso per una foto chiusa e poi ripresa riaprendo la sua cartella: la copia
    //           riaperta ha un id nuovo ma la stessa chiave (cartella + nome) nello stesso lotto, che
    //           l'import riusa. Prima contava due volte: l'impronta diventava "img|4|..." per una
    //           cartella di 3 foto, e dopo un crash nessuna modifica non salvata di quella cartella
    //           tornava.
    // ENGLISH: the same for a photo closed and then taken back by reopening its folder: the reopened
    //          copy has a new id but the same key (folder + name) in the same batch, which the import
    //          reuses. It used to count twice: the fingerprint became "img|4|..." for a folder of 3
    //          photos, and after a crash no unsaved edit of that folder came back.
    for (const c of chiuse) {
        if (presenti.has(c.id)) continue;
        const fotoChiusa: any = c.foto;
        const chiaveChiusa = (fotoChiusa && typeof fotoChiusa.backupKey === 'string' && fotoChiusa.backupKey) || (BACKUP_KEY_SEP + c.name);
        const chiaveCompleta = String(c.lotto || '') + BACKUP_KEY_SEP + chiaveChiusa;
        if (chiaviPresenti.has(chiaveCompleta)) continue;
        lottoDi(String(c.lotto || ''), String(c.cartella || '')).nomi.push(c.name);
        // ITALIANO: una foto chiusa, ripresa riaprendo la cartella e chiusa di nuovo lascia fra le
        //           chiuse due voci (id vecchio e id nuovo) con lo stesso lotto e la stessa chiave: e'
        //           lo stesso file e si conta una volta. Solo per le chiavi con la cartella: senza
        //           (nel browser) due foto omonime di sottocartelle diverse avrebbero la stessa chiave.
        // ENGLISH: a photo closed, taken back by reopening the folder and closed again leaves two
        //          closed entries (old id and new id) with the same batch and key: it is the same file
        //          and counts once. Only for keys with the folder: without it (in the browser) two
        //          same-named photos of different subfolders would share the key.
        if (!chiaveChiusa.startsWith(BACKUP_KEY_SEP)) chiaviPresenti.add(chiaveCompleta);
    }
    const firme = new Map<string, number>();
    const aperte = new Set<string>();
    const conFirma: { firma: string; lotto: string; data: Record<string, VoceBackup>; voci: number }[] = [];
    for (const [lotto, l] of lotti) {
        const firma = folderSignature(l.cartella, l.nomi);
        aperte.add(firma);
        if (l.vivi > 0) firme.set(firma, (firme.get(firma) || 0) + 1);
        conFirma.push({ firma, lotto, data: l.data, voci: l.voci });
    }
    const sources: SorgenteBackup[] = conFirma
        .filter(l => l.voci > 0 && firme.get(l.firma) === 1)
        .map(l => ({ signature: l.firma, data: l.data, visto: ora, ...(l.lotto ? { lotto: l.lotto } : {}) }));
    sources.unshift(...sorgentiDaTenere(precedente, aperte, new Set([...lotti.keys()].filter(Boolean)), ora, lottiSessione));
    return sources.length > 0 ? { folder: cartellaCorrente, sources } : null;
};

// ITALIANO: le sorgenti del backup salvato che appartengono a cartelle non aperte in memoria (vedi
//   il punto 4 qui sopra). Si tengono solo le voci scritte da questa versione (con `base`, che
//   alla riapertura protegge da un .txt cambiato nel frattempo); il formato precedente, a impronta
//   unica, non si porta avanti, come gia' prima. Cade anche una sorgente scritta da un import
//   ancora in memoria (`lotto`): ora la scrivono le sue foto (per esempio una cartella la cui
//   impronta e' cambiata perche' si e' svuotato il cestino). Prima cadeva ogni voce la cui CHIAVE
//   era di una foto in memoria: con "Carica cartella" la chiave e' solo nome della cartella + nome
//   del file, e due cartelle chiamate "img" con i soliti 0001.png... si cancellavano a vicenda le
//   modifiche da recuperare. Cade anche una sorgente scaduta (DURATA_SORGENTE_MS); una senza
//   `visto` (scritta prima di questa regola) comincia a contare da adesso.
// ENGLISH: the stored backup's sources that belong to folders not open in memory (see point 4
//   above). Only entries written by this version are kept (with `base`, which on reopening guards
//   against a .txt changed meanwhile); the previous single-fingerprint format is not carried
//   forward, as before. A source written by an import still in memory (`lotto`) is dropped too: its
//   photos write it now (for example a folder whose fingerprint changed because the trash was
//   emptied). Every entry whose KEY belonged to a photo in memory used to be dropped: with "Load
//   folder" the key is only the folder name + the file name, and two folders called "img" with the
//   usual 0001.png... deleted each other's edits to recover. An expired source is dropped too
//   (DURATA_SORGENTE_MS); one with no `visto` (written before this rule) starts counting now.
// ITALIANO: cade anche una sorgente scritta da un import di QUESTA sessione (`lottiSessione`) che in
//   memoria non c'e' piu': le sue foto le ha tolte l'utente (Ctrl+Z oltre l'import), non un crash.
//   Prima restava, e alla riapertura della cartella tornavano come "recuperate" le modifiche
//   annullate, o la trigger di allora come tag di ogni foto. Le sorgenti di sessioni precedenti (il
//   recupero dopo un crash) non sono fra questi lotti e restano.
// ENGLISH: a source written by an import of THIS session (`lottiSessione`) that is no longer in
//   memory is dropped too: its photos were removed by the user (Ctrl+Z past the import), not by a
//   crash. It used to stay, and on reopening the folder the undone edits came back as "recovered",
//   or that time's trigger as a tag on every photo. The sources of earlier sessions (the recovery
//   after a crash) are not among these batches and stay.
const sorgentiDaTenere = (precedente: string | null, aperte: Set<string>, lottiAperti: Set<string>, ora: number, lottiSessione: Set<string> | null = null): SorgenteBackup[] => {
    if (!precedente) return [];
    let parsed: any = null;
    try { parsed = JSON.parse(precedente); } catch (_) { return []; }
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.sources)) return [];
    const tenute: SorgenteBackup[] = [];
    for (const s of parsed.sources) {
        if (!s || typeof s.signature !== 'string' || aperte.has(s.signature) || !s.data || typeof s.data !== 'object') continue;
        if (typeof s.lotto === 'string' && (lottiAperti.has(s.lotto) || (lottiSessione !== null && lottiSessione.has(s.lotto)))) continue;
        if (scaduta(s, ora)) continue;
        const data: Record<string, VoceBackup> = {};
        for (const [chiave, v] of Object.entries(s.data as Record<string, any>)) {
            if (chiave.startsWith(BACKUP_KEY_SEP)) continue;
            if (v && Array.isArray(v.tags) && typeof v.base === 'string') data[chiave] = { tags: v.tags, base: v.base };
        }
        if (Object.keys(data).length > 0) {
            tenute.push({ signature: s.signature, data, visto: typeof s.visto === 'number' ? s.visto : ora, ...(typeof s.lotto === 'string' && s.lotto ? { lotto: s.lotto } : {}) });
        }
    }
    return tenute;
};

// ITALIANO: Le voci del backup che appartengono alla cartella che si sta importando, o null.
//   Si applica SOLO se l'IMPRONTA coincide: col solo nome della cartella, siccome i dataset LoRA
//   si chiamano quasi tutti uguale ("dataset", "img"), i tag di un progetto potevano essere
//   ripristinati su un altro e poi scritti su disco. Legge anche il formato della versione
//   precedente (una sola impronta, `signature` + `data`); i backup ancora piu' vecchi, senza
//   impronta, non si applicano, che e' il lato sicuro. Un import senza cartella ("Carica
//   immagini", trascinamento) ha il nome vuoto nell'impronta: combacia solo con un altro import
//   senza cartella delle stesse foto, mai con una cartella scelta, e viceversa.
// ENGLISH: The backup entries belonging to the folder being imported, or null.
//   Applied ONLY when the FINGERPRINT matches: with the folder name alone, since LoRA datasets are
//   nearly all named the same ("dataset", "img"), one project's tags could be restored onto another
//   and then written to disk. It also reads the previous version's format (a single fingerprint,
//   `signature` + `data`); even older backups, with no fingerprint, are not applied, which is the
//   safe side. An import with no folder ("Load images", drag and drop) has an empty name in its
//   fingerprint: it only matches another folder-less import of the same photos, never a picked
//   folder, and the other way round.
export const backupDellImport = (grezzo: string | null, importFolder: string, importSignature: string): { voci: Record<string, any>; ts: number | null; visto?: number } | null => {
    if (!grezzo) return null;
    let parsed: any = null;
    try { parsed = JSON.parse(grezzo); } catch (_) { return null; }
    if (!parsed || typeof parsed !== 'object') return null;
    const ts = typeof parsed.ts === 'number' ? parsed.ts : null;
    if (Array.isArray(parsed.sources)) {
        // ITALIANO: una sorgente scaduta (vedi DURATA_SORGENTE_MS) non si applica, anche se il backup
        //           non e' stato riscritto da allora.
        // ENGLISH: an expired source (see DURATA_SORGENTE_MS) is not applied, even if the backup has
        //          not been rewritten since.
        const ora = Date.now();
        const uguali = parsed.sources.filter((s: any) => s && typeof s.signature === 'string' && s.signature === importSignature && s.data && typeof s.data === 'object' && !scaduta(s, ora));
        if (uguali.length !== 1) return null;
        // ITALIANO: le voci con la chiave senza cartella (scritte prima che restassero fuori, vedi
        //           costruisciBackup) non si applicano: potrebbero essere di un'altra serie.
        // ENGLISH: entries with a folder-less key (written before they were left out, see
        //          costruisciBackup) are not applied: they could belong to another set.
        const voci: Record<string, any> = {};
        for (const [chiave, v] of Object.entries(uguali[0].data as Record<string, any>)) {
            if (!chiave.startsWith(BACKUP_KEY_SEP)) voci[chiave] = v;
        }
        return { voci, ts, ...(typeof uguali[0].visto === 'number' ? { visto: uguali[0].visto } : {}) };
    }
    // ITALIANO: il formato precedente vale solo per una cartella scelta, come allora.
    // ENGLISH: the previous format only applies to a picked folder, as back then.
    const firma = typeof parsed.signature === 'string' ? parsed.signature : '';
    if (importFolder !== '' && firma !== '' && firma === importSignature && parsed.data && typeof parsed.data === 'object') return { voci: parsed.data, ts };
    return null;
};

// ITALIANO: cosa c'e' da recuperare per l'import che sta per partire (quante foto e di quando), o null.
//   Lo usa il riepilogo dell'importazione per chiedere prima di applicare il backup: stessa impronta
//   di processImportData (nome della cartella scelta + nomi delle immagini).
// ENGLISH: what there is to recover for the import about to start (how many photos and from when), or
//   null. The import summary uses it to ask before applying the backup: same fingerprint as
//   processImportData (picked folder's name + image names).
export const recuperoDellImport = (grezzo: string | null, cartellaScelta: { name?: string } | null, immagini: Array<{ name: string }>): { n: number; ts: number | null } | null => {
    try {
        const nome = cartellaScelta && cartellaScelta.name ? String(cartellaScelta.name) : '';
        const b = backupDellImport(grezzo, nome, folderSignature(nome, immagini.map(f => f.name)));
        const n = b ? Object.keys(b.voci).length : 0;
        // ITALIANO: la data della SORGENTE di questa cartella (visto), non quella generale del backup, che
        //           ogni scrittura rinnova (aprire un'altra cartella la faceva diventare "adesso").
        // ENGLISH: the date of THIS folder's SOURCE (visto), not the backup's overall one, which every
        //          write renews (opening another folder made it "now").
        return b && n > 0 ? { n, ts: typeof b.visto === 'number' ? b.visto : b.ts } : null;
    } catch (_) {
        return null;
    }
};

// ITALIANO: I tag da rimettere su una foto appena importata, o null = restano quelli del .txt.
//   Una voce scritta da questa versione porta l'impronta dei tag su disco di quel momento (`base`):
//   se il .txt ora e' diverso, e' cambiato dopo il backup e vince lui. Le voci della versione
//   precedente non ce l'hanno (e quel backup conteneva TUTTE le foto, anche quelle senza
//   modifiche): per quelle decide la data del .txt, e se e' stato riscritto dopo il backup (2
//   secondi di tolleranza per i dischi FAT e di rete) vince il .txt.
// ENGLISH: The tags to put back on a freshly imported photo, or null = the .txt's own stay.
//   An entry written by this version carries the fingerprint of the tags on disk at that time
//   (`base`): if the .txt is now different, it changed after the backup and it wins. The previous
//   version's entries lack it (and that backup held ALL photos, unedited ones too): for those the
//   .txt's date decides, and if it was rewritten after the backup (2 seconds of slack for FAT and
//   network drives) the .txt wins.
// ITALIANO: La versione precedente leggeva al massimo 100 caratteri per tag e 200 tag per file, e il
//   suo backup aveva i tag gia' tagliati. Una didascalia piu' lunga tornava tagliata, contata come
//   modifica, e il primo "Salva modifiche" scriveva su disco la frase monca. Per le sue voci un tag
//   di 100 caratteri che e' l'inizio di un tag piu' lungo del .txt si rimette INTERO: se era
//   l'unica differenza la voce non si applica, se c'era una modifica vera torna con la frase intera.
//   Con piu' di 200 tag nel .txt la versione precedente non li vedeva tutti: vince il .txt.
// ENGLISH: The previous version read at most 100 characters per tag and 200 tags per file, and its
//   backup held the tags already cut. A longer caption came back cut, counted as an edit, and the
//   first "Save changes" wrote the truncated sentence to disk. For its entries a 100-character tag
//   that is the start of a longer tag in the .txt is put back WHOLE: if that was the only difference
//   the entry is not applied, if there was a real edit it comes back with the whole sentence. With
//   more than 200 tags in the .txt the previous version did not see them all: the .txt wins.
const VECCHIO_MAX_CARATTERI = 100;
const VECCHIO_MAX_TAG = 200;

export const tagDaRipristinare = (entry: any, orderedTags: string[], originalTags: string[], globalTriggers: string[], sidecarMtime?: number, backupTs?: number | null): string[] | null => {
    if (!entry || !Array.isArray(entry.tags)) return null;
    const vecchiaVersione = typeof entry.base !== 'string';
    if (!vecchiaVersione) {
        if (entry.base !== improntaTag(originalTags)) return null;
    } else if (typeof backupTs === 'number' && typeof sidecarMtime === 'number' && sidecarMtime > backupTs + 2000) {
        return null;
    } else if (originalTags.length > VECCHIO_MAX_TAG) {
        return null;
    }
    let letti = (entry.tags as unknown[]).filter((x): x is string => typeof x === 'string');
    if (vecchiaVersione) {
        letti = [...new Set(letti.flatMap(x => {
            if (x.length !== VECCHIO_MAX_CARATTERI) return [x];
            const interi = originalTags.filter(d => d.length > VECCHIO_MAX_CARATTERI && d.slice(0, VECCHIO_MAX_CARATTERI) === x);
            return interi.length > 0 ? interi : [x];
        }))];
    }
    const backupTags = letti
        .map(x => x.slice(0, TXT_TAG_MAX_CHARS))
        .slice(0, TXT_MAX_TAGS_PER_FILE);
    // ITALIANO: le trigger attive all'import vanno TUTTE davanti, come sulle foto senza backup
    //           (tagDiImport), una volta sola e con la grafia del riquadro. Prima restavano solo
    //           quelle gia' nel backup: con la trigger scritta prima di riaprire la cartella, le foto
    //           recuperate la perdevano e "Salva" scriveva i loro .txt senza. Il confronto si fa sulla
    //           lista unita: un backup uguale al disco, a parte la trigger, non e' un recupero.
    // ENGLISH: the triggers active at import ALL go first, as on photos with no backup
    //          (tagDiImport), once and with the box's spelling. Only those already in the backup
    //          used to stay: with the trigger typed before reopening the folder, the recovered photos
    //          lost it and "Save" wrote their .txt without it. The comparison uses the merged list: a
    //          backup equal to the disk, apart from the trigger, is not a recovery.
    const unite = uniqueTagsIgnoringCase([...globalTriggers, ...backupTags], globalTriggers);
    const differs = JSON.stringify([...unite].sort()) !== JSON.stringify([...orderedTags].sort());
    // ITALIANO: una lista vuota non si applica solo nelle voci della versione precedente, dove voleva
    //           dire "foto senza tag" (quel backup aveva TUTTE le foto). In questa versione il backup
    //           ha solo le foto con modifiche: la lista vuota e' una foto a cui l'utente ha tolto tutti
    //           i tag, e torna come le altre. Prima tornava coi vecchi tag senza una parola.
    // ENGLISH: an empty list is not applied only in the previous version's entries, where it meant
    //          "untagged photo" (that backup held EVERY photo). In this version the backup holds only
    //          the edited photos: an empty list is a photo the user removed every tag from, and it
    //          comes back like the others. It used to come back with its old tags without a word.
    if (!differs || (vecchiaVersione && backupTags.length === 0)) return null;
    return unite;
};
