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
    isAvailable: () => Promise<boolean>;
}

export interface ElectronAPI {
    isElectron: true;
    getAppVersion: () => Promise<string>;
    secureStorage: ElectronSecureStorage;
}

declare global {
    interface Window {
        electronAPI?: ElectronAPI;
        showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
    }
}

export {};
