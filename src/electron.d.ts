/******************************************************************************
*******************************************************************************
**                                                                            **
**  ITALIANO: TIPI PER IL BRIDGE ELECTRON                                     **
**  Dichiarazioni TypeScript per le API esposte da preload.cjs su window.     **
**                                                                            **
**  ENGLISH: TYPES FOR THE ELECTRON BRIDGE                                    **
**  TypeScript declarations for the APIs preload.cjs exposes on window.       **
**                                                                            **
*******************************************************************************
*******************************************************************************/

export interface ElectronSecureStorage {
    get: (key: string) => Promise<string>;
    set: (key: string, value: string) => Promise<boolean>;
    delete: (key: string) => Promise<boolean>;
}

// ITALIANO: rispecchia ESATTAMENTE ciò che preload.cjs espone su window.electronAPI. Prima
//           dichiarava solo 3 dei 6 metodi, quindi cestino, lettura .txt e apertura link erano
//           completamente senza tipi.
// ENGLISH: mirrors EXACTLY what preload.cjs exposes on window.electronAPI. It used to declare only
//          3 of the 6 methods, so trash, sidecar reading and link opening were completely untyped.
export interface TrashResult {
    ok: boolean;
    trashed: number;
    failed: number;
    // ITALIANO: esito FILE PER FILE, nello stesso ordine dei percorsi passati.
    //   'ok' nel Cestino di Windows (o gia' assente) · 'rifiutato' canale non applicabile
    //   (cartella di rete o estensione non ammessa) · 'errore' c'e' ma non si e' spostato.
    // ENGLISH: outcome FILE BY FILE, in the same order as the paths passed in.
    //   'ok' in the Windows Recycle Bin (or already gone) · 'rifiutato' channel not applicable
    //   (network folder or extension not allowed) · 'errore' present but could not be moved.
    results: Array<'ok' | 'rifiutato' | 'errore'>;
}

export interface WriteSidecarResult {
    ok: boolean;
    written: number;
    failed: number;
    // ITALIANO: esito per ogni file, NELLO STESSO ORDINE degli item passati (true = scritto)
    // ENGLISH: per-file outcome, IN THE SAME ORDER as the passed items (true = written)
    results: boolean[];
}

export interface ElectronAPI {
    isElectron: true;
    getAppVersion: () => Promise<string>;
    persistLang: (lang: string) => Promise<boolean>;
    secureStorage: ElectronSecureStorage;
    getPathForFile: (file: File) => string;
    readSidecarTags: (paths: string[]) => Promise<Array<{ name: string; content: string; dir?: string }>>;
    writeSidecarTags: (items: Array<{ imagePath: string; content: string }>) => Promise<WriteSidecarResult>;
    trashFiles: (paths: string[]) => Promise<TrashResult>;
    beginFolderPick: () => Promise<boolean>;
    // ITALIANO: le prove di cosa la pagina ha appena letto. Il processo principale risponde con un
    //           percorso solo se una cartella contiene davvero quei file. Un elenco vuoto chiude la
    //           finestra di registrazione senza chiedere niente (scelta annullata).
    // ENGLISH: proof of what the page just read. The main process answers with a path only if a
    //          folder really holds those files. An empty list closes the recording window without
    //          asking for anything (pick aborted).
    takePickedFolderPath: (proofs: Array<{ rel: string; name: string; size: number; mtime: number }>) => Promise<string>;
    openExternal: (url: string) => Promise<boolean>;

    /** ITALIANO: null = niente di nuovo, nessuna rete, o controllo non acconsentito.
     *  ENGLISH: null = nothing new, no network, or the check was never agreed to. */
    checkForUpdate: () => Promise<{ versione: string; pagina: string } | null>;
}

declare global {
    interface Window {
        electronAPI?: ElectronAPI;
        showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
    }
}

export {};
