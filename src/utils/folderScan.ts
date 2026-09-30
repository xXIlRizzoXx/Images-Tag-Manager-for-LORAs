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
export const scanDirectoryHandle = async (handle: any, maxDepth = 8): Promise<{ imgFiles: any[]; txtFiles: any[]; folderOf: Map<any, any>; relPathOf: Map<any, string>; skipped: number }> => {
    const imgFiles: any[] = [];
    const txtFiles: any[] = [];
    const folderOf = new Map<any, any>();
    const relPathOf = new Map<any, string>();
    let skipped = 0;

    const scan = async (dir: any, depth: number, prefix: string) => {
        for await (const entry of dir.values()) {
            try {
                if (entry.kind === 'file') {
                    const file = await entry.getFile();
                    if (file.type.startsWith('image/')) {
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
