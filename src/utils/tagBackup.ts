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

import { parseSidecarText, TXT_MAX_TAGS_PER_FILE, TXT_TAG_MAX_CHARS } from './sidecarTags';

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
export type FotoChiusa = { id: string; name: string; lotto: string; cartella: string };

type VoceBackup = { tags: string[]; base: string };

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
//      trascinamento) non si possono riconoscere alla riapertura: restano fuori, come prima.
//   3) Due lotti con la STESSA impronta (la stessa cartella aperta due volte, o due copie identiche
//      nei nomi) non si possono distinguere alla riapertura: si lasciano fuori entrambi, perche'
//      i tag dell'uno potrebbero finire sull'altro. E' il lato sicuro, ed e' quello che succedeva
//      gia' prima con due cartelle aperte.
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
//      the closed ones. Photos with no folder ("Load images", drag and drop) cannot be recognised
//      on reopening: they stay out, as before.
//   3) Two batches with the SAME fingerprint (the same folder opened twice, or two copies with the
//      same names) cannot be told apart on reopening: both are left out, since one's tags could
//      land on the other. That is the safe side, and it is what already happened before with two
//      folders open.
export const costruisciBackup = (images: any[], chiuse: Iterable<FotoChiusa>, cartellaCorrente: string): { folder: string; sources: { signature: string; data: Record<string, VoceBackup> }[] } | null => {
    const lotti = new Map<string, { cartella: string; nomi: string[]; data: Record<string, VoceBackup>; voci: number }>();
    const lottoDi = (lotto: string, cartella: string) => {
        let l = lotti.get(lotto);
        if (!l) { l = { cartella: '', nomi: [], data: {}, voci: 0 }; lotti.set(lotto, l); }
        if (cartella) l.cartella = cartella;
        return l;
    };
    const presenti = new Set<string>();
    for (const img of images) {
        presenti.add(img.id);
        const l = lottoDi(String(img.lottoImport || ''), String(img.cartellaImport || ''));
        l.nomi.push(img.file.name);
        if (img.isTrashed) continue;
        if (JSON.stringify(img.tags) === JSON.stringify(img.originalTags)) continue;
        // ITALIANO: chiave cartella+nome assegnata all'import (vedi makeBackupKeyer): due foto
        //           omonime in sottocartelle diverse restano separate.
        // ENGLISH: folder+name key assigned at import (see makeBackupKeyer): two same-named photos
        //          in different subfolders stay separate.
        l.data[img.backupKey || (BACKUP_KEY_SEP + img.file.name)] = { tags: img.tags, base: improntaTag(img.originalTags || []) };
        l.voci++;
    }
    // ITALIANO: una foto chiusa e poi riportata con Ctrl+Z e' di nuovo in `images`: si conta una volta.
    // ENGLISH: a photo closed and then brought back with Ctrl+Z is in `images` again: counted once.
    for (const c of chiuse) {
        if (!presenti.has(c.id)) lottoDi(String(c.lotto || ''), String(c.cartella || '')).nomi.push(c.name);
    }
    const firme = new Map<string, number>();
    const conFirma: { firma: string; data: Record<string, VoceBackup>; voci: number }[] = [];
    for (const l of lotti.values()) {
        if (l.cartella === '') continue;
        const firma = folderSignature(l.cartella, l.nomi);
        firme.set(firma, (firme.get(firma) || 0) + 1);
        conFirma.push({ firma, data: l.data, voci: l.voci });
    }
    const sources = conFirma
        .filter(l => l.voci > 0 && firme.get(l.firma) === 1)
        .map(l => ({ signature: l.firma, data: l.data }));
    return sources.length > 0 ? { folder: cartellaCorrente, sources } : null;
};

// ITALIANO: Le voci del backup che appartengono alla cartella che si sta importando, o null.
//   Si applica SOLO se l'IMPRONTA coincide: col solo nome della cartella, siccome i dataset LoRA
//   si chiamano quasi tutti uguale ("dataset", "img"), i tag di un progetto potevano essere
//   ripristinati su un altro e poi scritti su disco. Legge anche il formato della versione
//   precedente (una sola impronta, `signature` + `data`); i backup ancora piu' vecchi, senza
//   impronta, non si applicano, che e' il lato sicuro.
// ENGLISH: The backup entries belonging to the folder being imported, or null.
//   Applied ONLY when the FINGERPRINT matches: with the folder name alone, since LoRA datasets are
//   nearly all named the same ("dataset", "img"), one project's tags could be restored onto another
//   and then written to disk. It also reads the previous version's format (a single fingerprint,
//   `signature` + `data`); even older backups, with no fingerprint, are not applied, which is the
//   safe side.
export const backupDellImport = (grezzo: string | null, importFolder: string, importSignature: string): { voci: Record<string, any>; ts: number | null } | null => {
    if (!grezzo || importFolder === '') return null;
    let parsed: any = null;
    try { parsed = JSON.parse(grezzo); } catch (_) { return null; }
    if (!parsed || typeof parsed !== 'object') return null;
    const ts = typeof parsed.ts === 'number' ? parsed.ts : null;
    if (Array.isArray(parsed.sources)) {
        const uguali = parsed.sources.filter((s: any) => s && typeof s.signature === 'string' && s.signature === importSignature && s.data && typeof s.data === 'object');
        return uguali.length === 1 ? { voci: uguali[0].data, ts } : null;
    }
    const firma = typeof parsed.signature === 'string' ? parsed.signature : '';
    if (firma !== '' && firma === importSignature && parsed.data && typeof parsed.data === 'object') return { voci: parsed.data, ts };
    return null;
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
export const tagDaRipristinare = (entry: any, orderedTags: string[], originalTags: string[], globalTriggers: string[], sidecarMtime?: number, backupTs?: number | null): string[] | null => {
    if (!entry || !Array.isArray(entry.tags)) return null;
    if (typeof entry.base === 'string') {
        if (entry.base !== improntaTag(originalTags)) return null;
    } else if (typeof backupTs === 'number' && typeof sidecarMtime === 'number' && sidecarMtime > backupTs + 2000) {
        return null;
    }
    const backupTags = (entry.tags as unknown[])
        .filter((x): x is string => typeof x === 'string')
        .map(x => x.slice(0, TXT_TAG_MAX_CHARS))
        .slice(0, TXT_MAX_TAGS_PER_FILE);
    const differs = JSON.stringify([...backupTags].sort()) !== JSON.stringify([...orderedTags].sort());
    if (!differs || backupTags.length === 0) return null;
    return [
        ...globalTriggers.filter(t => backupTags.includes(t)),
        ...backupTags.filter(t => !globalTriggers.includes(t))
    ];
};
