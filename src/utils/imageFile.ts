/******************************************************************************
**  ITALIANO: "E' UN'IMMAGINE?" PER LE STRADE DI IMPORT E PER L'AI            **
**  ENGLISH: "IS IT AN IMAGE?" FOR THE IMPORT ROADS AND FOR THE AI            **
******************************************************************************/

// ITALIANO: Chromium da' a un file il tipo dalla sua tabella interna e poi dal registro di Windows
//           (valore "Content Type"). Nella tabella di Electron mancano .heic e .heif, e su molti PC il
//           registro ha solo "ContentType" senza spazio, che Chromium non legge: le foto dell'iPhone
//           arrivano con il tipo VUOTO, e le strade che guardavano solo `type.startsWith('image/')`
//           le scartavano tutte (trascinamento, "Carica immagini", "Carica Cartella", l'AI). Con il tipo
//           vuoto decide l'estensione, con lo STESSO elenco del processo principale (SIDECAR_IMAGE_EXT
//           in electron/main.cjs: una prova controlla che coincidano). Con un tipo dichiarato decide il
//           tipo, come prima.
// ENGLISH: Chromium gives a file its type from its internal table and then from the Windows registry
//          ("Content Type" value). Electron's table lacks .heic and .heif, and on many PCs the registry
//          only has "ContentType" without the space, which Chromium does not read: iPhone photos arrive
//          with an EMPTY type, and the roads that only looked at `type.startsWith('image/')` dropped them
//          all (drag and drop, "Load images", "Load Folder", the AI). With an empty type the extension
//          decides, with the SAME list as the main process (SIDECAR_IMAGE_EXT in electron/main.cjs: a
//          test checks they match). With a declared type the type decides, as before.
export const ESTENSIONI_IMMAGINE: readonly string[] = ['.jpg', '.jpeg', '.jfif', '.jpe', '.pjpeg', '.pjp', '.png', '.webp', '.gif', '.bmp', '.avif', '.tif', '.tiff',
    '.apng', '.ico', '.svg', '.svgz', '.xbm', '.heic', '.heif'];
const estensioni = new Set(ESTENSIONI_IMMAGINE);

export const eFileImmagine = (f: { name?: string; type?: string } | null | undefined): boolean => {
    if (!f) return false;
    const tipo = String(f.type || '');
    if (tipo) return tipo.startsWith('image/');
    const nome = String(f.name || '').toLowerCase();
    const punto = nome.lastIndexOf('.');
    return punto > 0 && estensioni.has(nome.slice(punto));
};
