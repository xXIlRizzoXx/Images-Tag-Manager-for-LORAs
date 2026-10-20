/******************************************************************************
*******************************************************************************
**                                                                            **
**  ITALIANO: COPIA SU FILE DEL BACKUP ANTI-CRASH                             **
**  Chromium scrive il localStorage sul disco qualche secondo dopo: se il     **
**  programma muore di colpo (processo ucciso, corrente che salta) l'ultima   **
**  modifica non c'e' nel backup. Ogni scrittura del backup va anche in un    **
**  file di userData, scritto subito dal processo principale; all'avvio, se   **
**  il file e' piu' recente, torna nel localStorage prima che l'app parta.    **
**                                                                            **
**  ENGLISH: FILE COPY OF THE CRASH BACKUP                                    **
**  Chromium writes localStorage to disk a few seconds later: if the program  **
**  dies suddenly (process killed, power cut) the last edit is not in the     **
**  backup. Every backup write also goes to a userData file, written at once  **
**  by the main process; at start-up, if the file is newer, it goes back into **
**  localStorage before the app starts.                                       **
**                                                                            **
*******************************************************************************
*******************************************************************************/

export const CHIAVE_BACKUP = 'tagBackup';

export type ApiBackupFile = {
    readCrashBackup?: () => Promise<string | null>;
    writeCrashBackup?: (valore: string | null) => Promise<boolean>;
};

// ITALIANO: la data di una voce (il backup o la "lapide" scritta quando il backup si toglie); 0 se non si legge.
// ENGLISH: the date of an entry (the backup or the "tombstone" written when the backup is removed); 0 if unreadable.
const dataDi = (grezzo: string | null): number => {
    if (!grezzo) return 0;
    try {
        const d = JSON.parse(grezzo);
        return d && typeof d.ts === 'number' && Number.isFinite(d.ts) ? d.ts : 0;
    } catch (_) { return 0; }
};
const eLapide = (grezzo: string | null): boolean => {
    try { const d = JSON.parse(String(grezzo)); return Boolean(d && d.vuoto === true); } catch (_) { return false; }
};

// ITALIANO: il localStorage come lo vede l'app: tutto passa al vero; il backup va anche nel file.
//           Togliere il backup scrive una lapide con la data, non cancella il file: cosi' all'avvio
//           un backup vecchio rimasto nel localStorage (la rimozione non ancora scritta da Chromium)
//           non torna. Il file si scrive solo dopo che il localStorage ha accettato il valore.
// ENGLISH: localStorage as the app sees it: everything goes to the real one; the backup also goes to
//          the file. Removing the backup writes a dated tombstone instead of deleting the file: so at
//          start-up an old backup left in localStorage (the removal not yet written by Chromium) does
//          not come back. The file is written only after localStorage accepted the value.
export const archivioConCopiaSuFile = (sorgente: Storage | (() => Storage), api?: ApiBackupFile | null): Storage => {
    // ITALIANO: il vero si chiede a ogni chiamata: leggere window.localStorage puo' fallire (SecurityError)
    //           e deve fallire dentro i try di chi lo usa, non al caricamento del modulo.
    // ENGLISH: the real one is asked for on every call: reading window.localStorage can fail (SecurityError)
    //          and must fail inside the callers' try blocks, not when the module loads.
    const vero = () => (typeof sorgente === 'function' ? sorgente() : sorgente);
    const copia = (valore: string | null) => {
        try {
            if (api && typeof api.writeCrashBackup === 'function') {
                Promise.resolve(api.writeCrashBackup(valore)).catch(() => { /* best-effort */ });
            }
        } catch (_) { /* best-effort: il backup nel localStorage resta / the localStorage backup stays */ }
    };
    return {
        get length() { return vero().length; },
        key: (i: number) => vero().key(i),
        clear: () => { vero().clear(); copia(JSON.stringify({ ts: Date.now(), vuoto: true })); },
        getItem: (chiave: string) => vero().getItem(chiave),
        setItem: (chiave: string, valore: string) => {
            vero().setItem(chiave, valore);
            if (chiave === CHIAVE_BACKUP) copia(String(valore));
        },
        removeItem: (chiave: string) => {
            vero().removeItem(chiave);
            if (chiave === CHIAVE_BACKUP) copia(JSON.stringify({ ts: Date.now(), vuoto: true }));
        },
    } as Storage;
};

// ITALIANO: all'avvio, prima che l'app legga il backup: vince la voce piu' recente fra file e
//           localStorage. Un file illeggibile, vecchio o assente lascia il localStorage com'e'.
// ENGLISH: at start-up, before the app reads the backup: the newer entry between file and
//          localStorage wins. An unreadable, old or missing file leaves localStorage as it is.
export const allineaBackupDaFile = async (vero: Storage, api?: ApiBackupFile | null): Promise<'file' | 'tolto' | 'invariato'> => {
    if (!api || typeof api.readCrashBackup !== 'function') return 'invariato';
    let daFile: string | null = null;
    try { daFile = await api.readCrashBackup(); } catch (_) { return 'invariato'; }
    if (typeof daFile !== 'string' || !daFile) return 'invariato';
    const tsFile = dataDi(daFile);
    if (!tsFile) return 'invariato';
    let locale: string | null = null;
    try { locale = vero.getItem(CHIAVE_BACKUP); } catch (_) { return 'invariato'; }
    if (tsFile <= dataDi(locale)) return 'invariato';
    try {
        if (eLapide(daFile)) {
            if (locale === null) return 'invariato';
            vero.removeItem(CHIAVE_BACKUP);
            return 'tolto';
        }
        vero.setItem(CHIAVE_BACKUP, daFile);
        return 'file';
    } catch (_) { return 'invariato'; }
};
