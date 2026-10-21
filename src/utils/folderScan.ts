/******************************************************************************
*******************************************************************************
**                                                                            **
**  ITALIANO: LETTURA DI UNA CARTELLA SCELTA CON "Carica cartella"            **
**  Scende nelle sottocartelle e raccoglie immagini e .txt, con la            **
**  cartella di ciascuno. Fuori da App.tsx perche' le prove la possano        **
**  eseguire su cartelle finte.                                               **
**                                                                            **
**  ENGLISH: READING A FOLDER PICKED WITH "Load folder"                       **
**  Walks down the subfolders and collects images and .txt files, with the    **
**  folder of each. Outside App.tsx so the tests can run it on fake folders.  **
**                                                                            **
*******************************************************************************
*******************************************************************************/

import { eFileImmagine } from './imageFile';

// ITALIANO: Ogni immagine ricorda la SOTTOCARTELLA in cui si trova (folderOf), cosi' il suo .txt
//           viene riscritto li' dentro e non nella cartella principale. I dataset LoRA sono spesso
//           divisi in sottocartelle (es. "10_soggetto"). Il .txt la ricorda anche lui, cosi' viene
//           abbinato SOLO all'immagine della stessa sottocartella.
//           relPathOf = percorso RELATIVO completo di ogni file (es. "anna_bea/char_anna/10_face").
//           L'handle di una cartella conosce solo il proprio nome, non da dove viene: il percorso
//           lo devo costruire io mentre scendo, ed e' cio' che rende univoca la chiave del backup
//           anti-crash fra sottocartelle omonime.
//           UNA VOCE ILLEGGIBILE NON FERMA TUTTO: un file sparito fra l'elenco e la lettura (una
//           cartella sincronizzata, un programma che scrive file temporanei), una sottocartella che
//           non si lascia elencare o un disco di rete che singhiozza facevano fallire l'intera
//           scansione, e non si importava niente. Ora quella voce si salta e si conta (`skipped`);
//           una sottocartella illeggibile si salta tutta insieme. Solo se non si riesce a leggere
//           la cartella scelta stessa la scansione fallisce.
// ENGLISH: Each image remembers the SUBFOLDER it lives in (folderOf), so its .txt is written back
//          there and not into the top folder. LoRA datasets are often split into subfolders (e.g.
//          "10_subject"). The .txt remembers it too, so it pairs ONLY with the image in the same
//          subfolder.
//          relPathOf = each file's full RELATIVE path (e.g. "anna_bea/char_anna/10_face"). A
//          directory handle only knows its own name, not where it came from: the path must be built
//          while descending, and it is what makes the crash-backup key unique across same-named
//          subfolders.
//          ONE UNREADABLE ENTRY NO LONGER STOPS EVERYTHING: a file gone between the listing and the
//          read (a synced folder, a program writing temp files), a subfolder that refuses to be
//          listed or a flaky network drive made the whole scan fail, and nothing was imported. Now
//          that entry is skipped and counted (`skipped`); an unreadable subfolder is skipped as a
//          whole. Only when the picked folder itself cannot be read does the scan fail.
// ITALIANO: file nascosti del Mac: la cartella __MACOSX degli .zip fatti col Finder e i file "._nome"
//           (dati del Finder di pochi KB, non immagini) che un Mac lascia anche accanto ai file veri
//           su chiavette e dischi di rete. Prima entravano come foto ("._0001.png" e' image/png per
//           l'estensione): conteggio doppio, anteprime rotte, "tag" binari da "._0001.txt", richieste
//           AI sprecate e .txt scritti dentro __MACOSX. `percorsoRelativo` = il percorso nella
//           cartella scelta, quando c'e' (selettore di riserva).
// ENGLISH: Mac hidden files: the __MACOSX folder of .zip files made with the Finder and the "._name"
//          files (a few KB of Finder data, not images) that a Mac also leaves next to the real files
//          on USB sticks and network drives. They used to come in as photos ("._0001.png" is
//          image/png by its extension): double count, broken thumbnails, binary "tags" from
//          "._0001.txt", wasted AI requests and .txt files written into __MACOSX. `percorsoRelativo`
//          = the path inside the picked folder, when known (fallback picker).
// ITALIANO: anche le cartelle di servizio dei NAS e di Windows, per NOME ESATTO: @eaDir di Synology
//           (in ogni cartella indicizzata, con 3 miniature .jpg per foto, visibile via rete), i cestini
//           e le istantanee dei NAS, $RECYCLE.BIN e System Volume Information. Niente regola per
//           prefisso: una cartella dell'utente "#train" o "@anna" deve restare. Nel percorso del
//           selettore di riserva il primo pezzo e' la cartella scelta, che non si filtra.
// ENGLISH: also the NAS and Windows service folders, by EXACT NAME: Synology's @eaDir (in every
//          indexed folder, with 3 .jpg thumbnails per photo, visible over the network), the NAS
//          recycle bins and snapshots, $RECYCLE.BIN and System Volume Information. No prefix rule: a
//          user folder "#train" or "@anna" must stay. In the fallback picker's path the first part is
//          the picked folder, which is not filtered.
const CARTELLE_DI_SERVIZIO = new Set(['@eadir', '@recycle', '#recycle', '#snapshot', '.@__thumb', '$recycle.bin', 'system volume information']);
export const fileDiMac = (nome: string, percorsoRelativo = ''): boolean => {
    if (String(nome || '').startsWith('._')) return true;
    const pezzi = String(percorsoRelativo || '').split(/[\\/]/).map(p => p.toLowerCase());
    return pezzi.includes('__macosx') || pezzi.slice(pezzi.length > 1 ? 1 : 0).some(p => CARTELLE_DI_SERVIZIO.has(p));
};

export const scanDirectoryHandle = async (handle: any, maxDepth = 8): Promise<{ imgFiles: any[]; txtFiles: any[]; folderOf: Map<any, any>; relPathOf: Map<any, string>; skipped: number }> => {
    const imgFiles: any[] = [];
    const txtFiles: any[] = [];
    const folderOf = new Map<any, any>();
    const relPathOf = new Map<any, string>();
    let skipped = 0;

    const scan = async (dir: any, depth: number, prefix: string) => {
        for await (const entry of dir.values()) {
            try {
                // ITALIANO: i file nascosti del Mac non si leggono nemmeno (vedi fileDiMac).
                // ENGLISH: the Mac hidden files are not even read (see fileDiMac).
                if (entry.kind === 'file' ? fileDiMac(entry.name) : fileDiMac('', entry.name)) continue;
                if (entry.kind === 'file') {
                    const file = await entry.getFile();
                    // ITALIANO: anche le HEIC dell'iPhone, che arrivano con il tipo vuoto (vedi imageFile.ts).
                    // ENGLISH: iPhone HEIC photos too, which arrive with an empty type (see imageFile.ts).
                    if (eFileImmagine(file)) {
                        imgFiles.push(file);
                        folderOf.set(file, dir);
                        relPathOf.set(file, prefix);
                    } else if (file.name.toLowerCase().endsWith('.txt')) {
                        txtFiles.push(file);
                        folderOf.set(file, dir);
                        relPathOf.set(file, prefix);
                    }
                } else if (entry.kind === 'directory' && depth < maxDepth) {
                    await scan(entry, depth + 1, prefix ? prefix + '/' + entry.name : entry.name);
                }
            } catch (e) {
                skipped++;
                console.warn('[Import] Voce non leggibile saltata / unreadable entry skipped:', entry?.name, e);
            }
        }
    };
    await scan(handle, 0, String(handle.name || ''));
    return { imgFiles, txtFiles, folderOf, relPathOf, skipped };
};
