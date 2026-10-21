/* ITALIANO: LA FOTO COM'E' ADESSO SUL DISCO
   Il File preso all'importazione e' un'istantanea: se la foto viene ritoccata in un altro programma,
   Chromium rifiuta di leggerlo (NotReadableError). Per le foto aperte con una cartella si rilegge
   la foto dalla SUA cartella; senza cartella ("Carica immagini") o se non c'e' piu', resta
   l'istantanea, e chi la legge dice che non si legge piu'. La usano l'esportazione e l'AI.

   ENGLISH: THE PHOTO AS IT IS ON DISK NOW
   The File taken at import is a snapshot: if the photo is retouched in another program, Chromium
   refuses to read it (NotReadableError). For photos opened with a folder the photo is re-read from
   ITS folder; with no folder ("Load images") or if it is gone, the snapshot stays, and whoever
   reads it says it can no longer be read. Used by the export and by the AI. */

export type FotoConCartella = { file: File; dirHandle?: { getFileHandle?: (nome: string) => Promise<{ getFile: () => Promise<File> }> } | null };

export const fileDiAdesso = async (img: FotoConCartella): Promise<File> => {
    const dir = img.dirHandle;
    if (dir && typeof dir.getFileHandle === 'function') {
        try { return await (await dir.getFileHandle(img.file.name)).getFile(); }
        catch (_) { /* spostata o cancellata: si prova l'istantanea / moved or deleted: try the snapshot */ }
    }
    return img.file;
};
