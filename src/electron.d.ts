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
}

export interface ElectronAPI {
    isElectron: true;
    getAppVersion: () => Promise<string>;
    persistLang: (lang: string) => Promise<boolean>;
    secureStorage: ElectronSecureStorage;
    getPathForFile: (file: File) => string;
    readSidecarTags: (paths: string[]) => Promise<Array<{ name: string; content: string; dir?: string }>>;
    trashFiles: (paths: string[]) => Promise<TrashResult>;
    openExternal: (url: string) => Promise<boolean>;
}

declare global {
    interface Window {
        electronAPI?: ElectronAPI;
        showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
    }
}

export {};
