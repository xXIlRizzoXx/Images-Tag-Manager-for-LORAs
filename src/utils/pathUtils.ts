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
