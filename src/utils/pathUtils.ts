/******************************************************************************
*******************************************************************************
**                                                                            **
**  ITALIANO: UTILITY PER NOMI FILE SICURI                                    **
**  Sanitizza i nomi dei file per impedire path traversal (../../...)         **
**  e caratteri illegali su Windows/macOS/Linux quando salviamo .txt o ZIP.   **
**                                                                            **
**  ENGLISH: SAFE FILENAME HELPERS                                            **
**  Sanitize file names to prevent path traversal (../../...) and reject      **
**  characters that are illegal on Windows/macOS/Linux when writing .txt/ZIP. **
**                                                                            **
*******************************************************************************
*******************************************************************************/

import { fileBaseName } from './sidecarTags';

const MAX_FILENAME_LENGTH = 200;
const ILLEGAL_VISIBLE_CHARS = /[<>:"/\\|?*]/g;
const RESERVED_WINDOWS_NAMES = new Set([
    'con', 'prn', 'aux', 'nul',
    'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9',
    'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9',
]);

const replaceControlChars = (input: string, replacement: string = '_'): string => {
    let out = '';
    for (let i = 0; i < input.length; i++) {
        const code = input.charCodeAt(i);
        // ITALIANO: Salta C0 controls (0-31) e DEL (127)
        // ENGLISH: Skip C0 controls (0-31) and DEL (127)
        out += code < 32 || code === 127 ? replacement : input.charAt(i);
    }
    return out;
};

export const sanitizeFileName = (name: string, fallback: string = 'file'): string => {
    if (typeof name !== 'string' || !name) return fallback;
    // ITALIANO: Tieni solo l'ultimo segmento del path (rimuove ../, ..\, sottocartelle)
    // ENGLISH: Keep only the last path segment (strips ../, ..\\, subfolders)
    const lastSeparator = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
    let base = lastSeparator >= 0 ? name.slice(lastSeparator + 1) : name;

    base = replaceControlChars(base, '_');
    base = base.replace(ILLEGAL_VISIBLE_CHARS, '_');
    // ITALIANO: Rimuove sequenze ".." superstiti
    // ENGLISH: Remove residual ".." sequences
    base = base.replace(/\.\.+/g, '.');
    // ITALIANO: Niente nomi che iniziano/terminano con punti o spazi (Windows li rifiuta)
    // ENGLISH: No names starting/ending with dots or spaces (Windows rejects them)
    base = base.replace(/^[.\s]+|[.\s]+$/g, '');

    if (!base) return fallback;

    const lower = base.split('.')[0].toLowerCase();
    if (RESERVED_WINDOWS_NAMES.has(lower)) {
        base = `_${base}`;
    }

    if (base.length > MAX_FILENAME_LENGTH) {
        const dot = base.lastIndexOf('.');
        if (dot > 0 && dot > base.length - 12) {
            const ext = base.slice(dot);
            base = base.slice(0, MAX_FILENAME_LENGTH - ext.length) + ext;
        } else {
            base = base.slice(0, MAX_FILENAME_LENGTH);
        }
    }

    return base || fallback;
};

export const stripExtension = (name: string): string => {
    const sanitized = sanitizeFileName(name);
    const dot = sanitized.lastIndexOf('.');
    return dot > 0 ? sanitized.slice(0, dot) : sanitized;
};

export const buildTagFileName = (imageFileName: string): string => {
    const base = stripExtension(imageFileName);
    return `${base || 'image'}.txt`;
};

// ITALIANO: Nome del .txt scritto ACCANTO a una foto che e' gia' su disco, e del .txt da togliere
//           con lei. E' la stessa regola con cui l'import abbina i due file (fileBaseName: tutto
//           prima dell'ultimo punto) e con cui Kohya cerca la didascalia, SENZA ripulire il nome.
//           Con buildTagFileName una foto "photo..v2.png" (nome valido su Windows) riceveva
//           "photo.v2.txt": un file che nessuno rilegge, mentre il .txt vero restava coi tag
//           vecchi. Ripulire qui non serve: la foto esiste gia' con quel nome, e getFileHandle /
//           removeEntry rifiutano da soli '.', '..' e i separatori. buildTagFileName resta solo per i
//           download dal browser, dove il nome arriva nel sistema di un altro; anche il .txt dentro
//           l'archivio (.zip) usa questa regola, perche' estratto accanto alla foto deve abbinarsi.
//           Una foto senza nome prima del punto (".png") tiene la regola di prima.
// ENGLISH: Name of the .txt written NEXT TO a photo that is already on disk, and of the .txt removed
//          with it. It is the same rule the import pairs the two files with (fileBaseName: all
//          before the last dot) and Kohya looks for the caption with, WITHOUT cleaning the name.
//          With buildTagFileName a "photo..v2.png" photo (a valid Windows name) got "photo.v2.txt":
//          a file nobody reads back, while the real .txt kept the old tags. Cleaning is not needed
//          here: the photo already exists under that name, and getFileHandle / removeEntry refuse
//          '.', '..' and separators on their own. buildTagFileName stays only for browser
//          downloads, where the name lands on someone else's system; the .txt inside the archive
//          (.zip) uses this rule too, because once extracted next to the photo it must pair with it.
//          A photo with no name before the dot (".png") keeps the previous rule.
export const sidecarTagFileName = (imageFileName: string): string => {
    const base = fileBaseName(String(imageFileName || ''));
    return base ? `${base}.txt` : buildTagFileName(imageFileName);
};
