/******************************************************************************
*******************************************************************************
**                                                                            **
**  ITALIANO: COMPONENTE PRINCIPALE DELL'APP                                  **
**  Questo è il cuore del programma. Gestisce il caricamento delle immagini,  **
**  la lista dei tag e l'aspetto generale della finestra principale.          **
**                                                                            **
**  ENGLISH: MAIN APPLICATION COMPONENT                                       **
**  This is the heart of the program. It handles image loading,               **
**  the tag list, and the overall appearance of the main window.              **
**                                                                            **
*******************************************************************************
*******************************************************************************/
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import JSZip from 'jszip';
import { Folder, Trash, Trash2, RefreshCw, Tag, Tags, Save, SaveAll, ImageIcon, Settings, Volume2, VolumeX, Globe, LayoutGrid, Grid3X3, ZoomOut, ZoomIn, X, Check, ArrowDownUp, Sun, Moon, PieChart, BarChart3, AlertTriangle, Sparkles, Loader2, Wand2, KeyRound, BookOpen, ChevronUp, ChevronDown, ExternalLink, Download, Upload } from 'lucide-react';
import { getTagCategory, getCategoryColor, getActiveCategoryColor } from './utils/tagCategorization';
import { getGeminiTags, verifyGeminiApiKey, GEMINI_MODELS, DEFAULT_GEMINI_MODEL, getModelTier, classifyGeminiError } from './services/geminiService';
import { getSecret, setSecret, deleteSecret } from './utils/secureStorage';
import {
    PieChart as RechartsPieChart,
    Pie,
    Cell,
    Tooltip,
    ResponsiveContainer,
    BarChart as RechartsBarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid
} from 'recharts';
import { translations } from './constants';
import { soundManager } from './utils/soundManager';
import { generateThumbnail } from './utils/imageUtils';
import { AppleToggle, TagInput, Toast, CustomConfirmDialog, ImportSummaryDialog } from './components/ui';
import { Lightbox } from './components/Lightbox';
import { TagSuggestionsPanel } from './components/TagSuggestionsPanel';
import { sanitizeFileName, buildTagFileName } from './utils/pathUtils';

// ITALIANO: Lingue dell'interfaccia — usate sia dal selettore nelle impostazioni
//           sia dalla schermata di scelta lingua al primo avvio.
// ENGLISH: UI languages — used by both the settings selector and the first-run picker.
const APP_LANGUAGES = [
    { code: 'it', label: 'Italiano', flag: 'it' },
    { code: 'en', label: 'English', flag: 'gb' },
    { code: 'fr', label: 'Français', flag: 'fr' },
    { code: 'es', label: 'Español', flag: 'es' },
    { code: 'de', label: 'Deutsch', flag: 'de' },
    { code: 'zh', label: '中文 (简体)', flag: 'cn' },
    { code: 'ja', label: '日本語', flag: 'jp' },
    { code: 'pt', label: 'Português', flag: 'br' },
    { code: 'ru', label: 'Русский', flag: 'ru' },
];
const LANG_CODES = APP_LANGUAGES.map(l => l.code);

// ITALIANO: Lingua iniziale: quella già scelta, altrimenti quella del sistema operativo,
//           altrimenti inglese (così un PC tedesco parte in tedesco).
// ENGLISH: Initial language: the saved choice, else the OS language, else English.
const detectInitialLang = (): string => {
    try {
        const saved = localStorage.getItem('lang');
        if (saved && LANG_CODES.includes(saved)) return saved;
    } catch (_) { /* ignore */ }
    try {
        const sys = (navigator.language || '').slice(0, 2).toLowerCase();
        if (LANG_CODES.includes(sys)) return sys;
    } catch (_) { /* ignore */ }
    return 'en';
};

export default function App() {
    const [lang, setLang] = useState<string>(detectInitialLang);
    const t = translations[lang as keyof typeof translations];
    // ITALIANO: Al primissimo avvio (nessuna scelta salvata) mostra la schermata di scelta lingua.
    // ENGLISH: On the very first launch (no saved choice) show the language picker screen.
    const [showLangPicker, setShowLangPicker] = useState<boolean>(() => {
        try { return !localStorage.getItem('langChosen'); } catch (_) { return false; }
    });
    // ITALIANO: Lingua solo EVIDENZIATA nella schermata iniziale: non si applica da sola,
    //           serve premere il tasto di conferma.
    // ENGLISH: Language only HIGHLIGHTED in the first-run screen: it is not applied on click,
    //          the user must press the confirm button.
    const [pendingLang, setPendingLang] = useState<string>(lang);
    // ITALIANO: Testi della schermata di scelta lingua: seguono la lingua EVIDENZIATA, non
    //           quella attiva, cosi' tutta la finestra cambia lingua a ogni clic (anteprima).
    // ENGLISH: First-run screen texts: they follow the HIGHLIGHTED language, not the active
    //          one, so the whole window switches language on every click (live preview).
    const tPending = translations[pendingLang as keyof typeof translations] ?? translations.en;
    // ITALIANO: La lingua scelta viene ricordata tra un avvio e l'altro (prima si perdeva).
    // ENGLISH: The chosen language is remembered across launches (it used to be lost).
    useEffect(() => { try { localStorage.setItem('lang', lang); } catch (_) { /* ignore */ } }, [lang]);
    const [images, setImages] = useState<any[]>([]);
    const [globalTriggers, setGlobalTriggers] = useState<string[]>([]);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [sortOrder, setSortOrder] = useState<'name-asc' | 'name-desc' | 'date-asc' | 'date-desc'>('name-asc');
    
    const [saveAsZip, setSaveAsZip] = useState(false); 
    const [dirHandle, setDirHandle] = useState<any>(null);
    
    const [imageWidth, setImageWidth] = useState(300);
    const [trashImageWidth, setTrashImageWidth] = useState(250);
    const [trashSortOrder, setTrashSortOrder] = useState('date-desc'); 
    
    const [viewMode, setViewMode] = useState('square'); 
    const [selectedImageId, setSelectedImageId] = useState<string | null>(null); 
    const [slideDirection, setSlideDirection] = useState('right');
    const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, onCancel: () => {} });
    const [importSummary, setImportSummary] = useState<{ isOpen: boolean, summary: any, pendingData: any }>({ isOpen: false, summary: null, pendingData: null });
    const [selectedForBulk, setSelectedForBulk] = useState<string[]>([]);
    const [stagedBulkTags, setStagedBulkTags] = useState<string[]>([]);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isTrashOpen, setIsTrashOpen] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);

    const [isStatsOpen, setIsStatsOpen] = useState(false);
    // ITALIANO: "Appunti" dei tag: copiati da una foto, incollabili su un'altra.
    // ENGLISH: Tag "clipboard": copied from one photo, pasteable onto another.
    const [copiedTags, setCopiedTags] = useState<string[] | null>(null);

    // ITALIANO: Pulizia della sola chiave legacy 'customPrompt' (vecchia AI locale).
    //           NON rimuovere 'geminiApiKey' (getSecret la migra in safeStorage) né 'aiModel' (chiave viva).
    // ENGLISH: Cleanup of the legacy 'customPrompt' key only (old local AI).
    //          Do NOT remove 'geminiApiKey' (getSecret migrates it into safeStorage) nor 'aiModel' (live key).
    useEffect(() => {
        try {
            localStorage.removeItem('customPrompt');
        } catch (_) { /* ignore */ }
    }, []);

    // ITALIANO: Configurazione AI cloud (Gemini), persistente
    // ENGLISH: Cloud AI config (Gemini), persistent
    const [aiEnabled, setAiEnabled] = useState<boolean>(() => localStorage.getItem('aiEnabled') === 'true');
    const [aiModel, setAiModel] = useState<string>(() => localStorage.getItem('aiModel') || DEFAULT_GEMINI_MODEL);
    const [aiMaxTags, setAiMaxTags] = useState<number>(() => {
        const v = parseInt(localStorage.getItem('aiMaxTags') || '30', 10);
        return Number.isFinite(v) ? Math.max(1, Math.min(80, v)) : 30;
    });
    const [aiCustomPrompt, setAiCustomPrompt] = useState<string>(() => localStorage.getItem('aiCustomPrompt') || '');
    const [aiRpm, setAiRpm] = useState<number>(() => {
        const v = parseInt(localStorage.getItem('aiRpm') || '14', 10);
        return Number.isFinite(v) ? Math.max(5, Math.min(60, v)) : 14;
    });
    const [aiSkipTagged, setAiSkipTagged] = useState<boolean>(() => localStorage.getItem('aiSkipTagged') !== 'false');
    const aiCancelRequestedRef = useRef<boolean>(false);
    // ITALIANO: Stato gemello del ref aiCancelRequestedRef — solo per aggiornare l'UI del pulsante Annulla
    // ENGLISH: Mirror state of aiCancelRequestedRef — UI-only signal for the Cancel button
    const [aiCancelRequested, setAiCancelRequested] = useState<boolean>(false);
    // ITALIANO: AbortController del batch AI in corso — permette di interrompere anche la richiesta HTTP appesa
    // ENGLISH: AbortController of the running AI batch — lets Cancel interrupt even a hung HTTP request
    const aiAbortControllerRef = useRef<AbortController | null>(null);
    const [geminiApiKey, setGeminiApiKey] = useState<string>('');
    const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = useState<boolean>(false);
    const [tempApiKey, setTempApiKey] = useState<string>('');
    const [isApiKeyGuideOpen, setIsApiKeyGuideOpen] = useState<boolean>(false);
    const [isVerifyingApiKey, setIsVerifyingApiKey] = useState<boolean>(false);
    const [apiKeyError, setApiKeyError] = useState<string>('');
    const [isAIBusy, setIsAIBusy] = useState<boolean>(false);
    const [isGlobalAITagging, setIsGlobalAITagging] = useState<boolean>(false);
    const [globalAIProgress, setGlobalAIProgress] = useState<{ done: number; total: number; ok: number; errors: number; skipped: number }>({ done: 0, total: 0, ok: 0, errors: 0, skipped: 0 });
    const apiKeyLoadedRef = useRef<boolean>(false);

    // ITALIANO: Versione mostrata nelle impostazioni — letta da package.json tramite Electron,
    //           così nell'exe è SEMPRE aggiornata senza doverla cambiare a mano. In browser/dev
    //           usa il valore di riserva qui sotto.
    // ENGLISH: Version shown in settings — read from package.json via Electron, so the built app
    //          is ALWAYS current without a manual edit. In browser/dev it uses the fallback below.
    const [appVersion, setAppVersion] = useState<string>('1.0.0');
    useEffect(() => {
        const api = (window as any).electronAPI;
        if (api && typeof api.getAppVersion === 'function') {
            api.getAppVersion().then((v: string) => { if (v) setAppVersion(v); }).catch(() => {});
        }
    }, []);

    useEffect(() => { localStorage.setItem('aiEnabled', String(aiEnabled)); }, [aiEnabled]);
    useEffect(() => { localStorage.setItem('aiModel', aiModel); }, [aiModel]);
    useEffect(() => { localStorage.setItem('aiMaxTags', String(aiMaxTags)); }, [aiMaxTags]);
    useEffect(() => { localStorage.setItem('aiCustomPrompt', aiCustomPrompt); }, [aiCustomPrompt]);
    useEffect(() => { localStorage.setItem('aiRpm', String(aiRpm)); }, [aiRpm]);
    useEffect(() => { localStorage.setItem('aiSkipTagged', String(aiSkipTagged)); }, [aiSkipTagged]);

    // ITALIANO: Carico la API key dallo storage cifrato all'avvio
    // ENGLISH: Load the API key from encrypted storage on mount
    useEffect(() => {
        let cancelled = false;
        getSecret('geminiApiKey').then((value) => {
            if (cancelled) return;
            if (value) setGeminiApiKey(value);
            apiKeyLoadedRef.current = true;
        }).catch(() => { apiKeyLoadedRef.current = true; });
        return () => { cancelled = true; };
    }, []);

    // ITALIANO: Persisti la API key in safeStorage (cifrata) appena cambia
    // ENGLISH: Persist the API key in safeStorage (encrypted) on every change
    useEffect(() => {
        if (!apiKeyLoadedRef.current) return;
        setSecret('geminiApiKey', geminiApiKey).then((ok) => {
            // ITALIANO: Fail-closed: se lo storage cifrato non è disponibile la chiave NON viene
            //           salvata in chiaro — avvisiamo l'utente che resterà valida solo per la sessione
            // ENGLISH: Fail-closed: if encrypted storage is unavailable the key is NOT saved in
            //          cleartext — warn the user it will only last for this session
            if (!ok && geminiApiKey) {
                showNotification(`${t.aiError || 'AI Error'}: secure storage unavailable — API key NOT saved (session only)`, 'error');
            }
        }).catch(err => console.error('Failed to persist API key', err));
    }, [geminiApiKey]);

    useEffect(() => {
        if (isApiKeyDialogOpen) {
            setTempApiKey(geminiApiKey);
            setApiKeyError('');
        }
    }, [isApiKeyDialogOpen, geminiApiKey]);

    // ITALIANO: Cancella la API key cifrata e termina sessione AI
    // ENGLISH: Wipe the encrypted API key and end AI session
    const handleClearApiKey = useCallback(async () => {
        try {
            // ITALIANO: Ferma SUBITO un eventuale batch in corso — altrimenti continuerebbe
            //           invisibile (e non annullabile) con la vecchia chiave catturata nella closure
            // ENGLISH: Stop any running batch IMMEDIATELY — otherwise it would keep running
            //          invisibly (and uncancellably) with the old key captured in its closure
            aiCancelRequestedRef.current = true;
            setAiCancelRequested(true);
            aiAbortControllerRef.current?.abort();
            await deleteSecret('geminiApiKey');
            setGeminiApiKey('');
            setIsAIBusy(false);
            setIsGlobalAITagging(false);
            setGlobalAIProgress({ done: 0, total: 0, ok: 0, errors: 0, skipped: 0 });
            soundManager.chime();
            showNotification(t.aiKeyCleared || 'API Key removed', 'success');
        } catch (e: any) {
            console.error('Failed to clear API key', e);
            showNotification(`${t.aiError || 'AI Error'}: ${e?.message || ''}`.trim(), 'error');
        }
    }, [t]);

    const [isGlobalTagManagerOpen, setIsGlobalTagManagerOpen] = useState(false);
    const [isTagSuggestionsOpen, setIsTagSuggestionsOpen] = useState(false);
    const [customProjectTags, setCustomProjectTags] = useState<string[]>([]);
    const [showSplash, setShowSplash] = useState(true);
    const [splashProgress, setSplashProgress] = useState(0);

    const folderInputRef = useRef<HTMLInputElement>(null);
    const settingsRef = useRef<HTMLDivElement>(null);
    // ITALIANO: Specchio sempre aggiornato di `images` per i loop async (evita snapshot stantii che sovrascrivono le modifiche manuali)
    // ENGLISH: Always-fresh mirror of `images` for async loops (avoids stale snapshots that overwrite manual edits)
    const imagesRef = useRef<any[]>([]);

    const [history, setHistory] = useState<any[][]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    const handleSuggestedTagClick = (tag: string) => {
        if (selectedImageId) {
            // Siamo nella Lightbox
            const image = images.find(img => img.id === selectedImageId);
            if (image && !image.tags.includes(tag)) {
                updateImageTags(selectedImageId, [...image.tags, tag]);
                soundManager.pop();
            }
        } else if (selectedForBulk.length > 0) {
            // Siamo nella vista principale con immagini selezionate
            if (!stagedBulkTags.includes(tag)) {
                setStagedBulkTags(prev => [...prev, tag]);
                soundManager.pop();
            }
        } else {
            showNotification(t.selectImagesFirst || "Seleziona una o più immagini per aggiungere tag", "info");
        }
    };
    const isUndoRedoAction = useRef(false);

    useEffect(() => {
        if (isUndoRedoAction.current) {
            isUndoRedoAction.current = false;
            return;
        }
        setHistory(prev => {
            const newHistory = prev.slice(0, historyIndex + 1);
            newHistory.push(images);
            if (newHistory.length > 50) newHistory.shift();
            return newHistory;
        });
        setHistoryIndex(prev => Math.min(prev + 1, 49));
    }, [images]);

    useEffect(() => { imagesRef.current = images; }, [images]);

    // ITALIANO: Backup automatico (debounce 1s) di tag e didascalie in localStorage —
    //           rete anti-crash: al re-import della cartella le modifiche non salvate vengono ripristinate.
    //           Non si svuota mai da solo: viene cancellato solo dal Reset progetto.
    // ENGLISH: Debounced (1s) automatic backup of tags and captions to localStorage —
    //          crash safety net: re-importing the folder restores unsaved edits.
    //          Never auto-cleared: only Project Reset removes it.
    useEffect(() => {
        if (images.length === 0) return undefined;
        const handle = setTimeout(() => {
            try {
                const data: Record<string, { tags: string[] }> = {};
                for (const img of images) {
                    if (img.isTrashed) continue;
                    data[img.file.name] = { tags: img.tags };
                }
                // ITALIANO: Salviamo anche il nome cartella: il ripristino avviene SOLO se si reimporta
                //           la stessa cartella, così i tag non finiscono su immagini omonime di un'altra
                //           cartella (nei dataset LoRA nomi come '01.png' sono comunissimi).
                // ENGLISH: Store the folder name too: restore happens ONLY when re-importing the same
                //          folder, so tags never land on same-named images from a different folder
                //          (in LoRA datasets names like '01.png' are very common).
                const folder = (dirHandle && dirHandle.name) ? String(dirHandle.name) : '';
                localStorage.setItem('tagBackup', JSON.stringify({ ts: Date.now(), folder, data }));
            } catch (_) { /* best-effort: quota piena o storage assente non devono rompere l'app */ }
        }, 1000);
        return () => clearTimeout(handle);
    }, [images, dirHandle]);

    const handleUndo = useCallback(() => {
        if (historyIndex > 0) {
            isUndoRedoAction.current = true;
            setHistoryIndex(prev => prev - 1);
            setImages(history[historyIndex - 1]);
            setToast({ show: true, message: t.undoSuccess || "Azione annullata", type: 'info' });
        }
    }, [history, historyIndex, t]);

    const handleRedo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            isUndoRedoAction.current = true;
            setHistoryIndex(prev => prev + 1);
            setImages(history[historyIndex + 1]);
            setToast({ show: true, message: t.redoSuccess || "Azione ripristinata", type: 'info' });
        }
    }, [history, historyIndex, t]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
                return;
            }
            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                handleRedo();
            } else if (e.ctrlKey && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                handleUndo();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleUndo, handleRedo]);

    const allUniqueTags = useMemo(() => {
        const imgTags = images.flatMap(img => img.tags);
        return [...new Set([...imgTags, ...customProjectTags])].sort((a, b) => a.localeCompare(b));
    }, [images, customProjectTags]);

    const displayedImages = useMemo(() => {
        let sorted = [...images].filter(img => !img.isTrashed);
        if (sortOrder === 'name-asc') {
            sorted.sort((a, b) => a.file.name.localeCompare(b.file.name));
        } else if (sortOrder === 'name-desc') {
            sorted.sort((a, b) => b.file.name.localeCompare(a.file.name));
        } else if (sortOrder === 'date-asc') {
            sorted.sort((a, b) => a.file.lastModified - b.file.lastModified);
        } else if (sortOrder === 'date-desc') {
            sorted.sort((a, b) => b.file.lastModified - a.file.lastModified);
        }
        return sorted;
    }, [images, sortOrder]);

    const trashedImages = useMemo(() => images.filter(img => img.isTrashed), [images]);

    const sortedTrashedImages = useMemo(() => {
        let sorted = [...trashedImages];
        if (trashSortOrder === 'name-asc') {
            sorted.sort((a, b) => a.file.name.localeCompare(b.file.name));
        } else if (trashSortOrder === 'name-desc') {
            sorted.sort((a, b) => b.file.name.localeCompare(a.file.name));
        } else if (trashSortOrder === 'date-asc') {
            sorted.sort((a, b) => a.file.lastModified - b.file.lastModified);
        } else if (trashSortOrder === 'date-desc') {
            sorted.sort((a, b) => b.file.lastModified - a.file.lastModified);
        }
        return sorted;
    }, [trashedImages, trashSortOrder]);

    const showNotification = (message: string, type = 'info') => setToast({ show: true, message, type });

    const handleDeleteAllTags = () => {
        setConfirmDialog({
            isOpen: true,
            title: t.deleteAllTags,
            message: t.confirmDeleteAllTagsMsg,
            onConfirm: () => {
                setImages(prev => prev.map(img => ({ ...img, tags: [] })));
                setCustomProjectTags([]);
                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                soundManager.pop();
                showNotification(t.allTagsDeleted, "success");
            },
            onCancel: () => setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        });
    };

    const handleCleanUnusedTags = () => {
        const usedTags = new Set(images.flatMap(img => img.tags));
        setCustomProjectTags(prev => prev.filter(tag => usedTags.has(tag)));
        showNotification(t.completed, 'success');
        soundManager.pop();
    };

    const handleDeleteTagFromProject = (tagToDelete: string) => {
        setImages(prev => prev.map(img => ({
            ...img,
            tags: img.tags.filter(t => t !== tagToDelete)
        })));
        setCustomProjectTags(prev => prev.filter(t => t !== tagToDelete));
        soundManager.click();
    };

    const handleMoveToTrash = (id: string) => {
        setImages(prev => prev.map(img => img.id === id ? { ...img, isTrashed: true } : img));
        if (selectedImageId === id) setSelectedImageId(null);
        soundManager.pop();
    };

    // ITALIANO: Cestina la foto APERTA nel visualizzatore e passa direttamente alla
    //           successiva (o alla precedente se era l'ultima), senza chiudere la finestra.
    //           Chiude solo se non resta piu' nessuna foto. Il "prossimo" si calcola PRIMA
    //           di cestinare, sulla lista visibile in quel momento.
    // ENGLISH: Trash the OPEN photo in the viewer and jump straight to the next one (or the
    //          previous if it was the last), without closing the window. Closes only if no
    //          photo is left. "Next" is computed BEFORE trashing, on the currently shown list.
    const handleTrashFromLightbox = (id: string) => {
        const idx = displayedImages.findIndex(img => img.id === id);
        const nextImg = idx === -1 ? null : (displayedImages[idx + 1] || displayedImages[idx - 1] || null);
        setImages(prev => prev.map(img => img.id === id ? { ...img, isTrashed: true } : img));
        setSelectedImageId(nextImg ? nextImg.id : null);
        soundManager.pop();
    };

    const handleRestore = (id: string) => {
        setImages(prev => prev.map(img => img.id === id ? { ...img, isTrashed: false } : img));
        soundManager.pop();
    };

    const handleDeletePermanently = async (id: string) => {
        const img = images.find(i => i.id === id);
        if (!img) return;

        if (dirHandle) {
            try {
                // ITALIANO: removeEntry accetta solo nomi senza separatori di path
                // ENGLISH: removeEntry only accepts names without path separators
                const safeName = sanitizeFileName(img.file.name);
                await dirHandle.removeEntry(safeName);
                const txtName = buildTagFileName(img.file.name);
                try { await dirHandle.removeEntry(txtName); } catch (e) { /* ignore if txt doesn't exist */ }
            } catch (error) {
                console.error(error);
                showNotification(t.deleteError, 'error');
                return;
            }
        }

        setImages(prev => prev.filter(i => i.id !== id));
        showNotification(t.deleteSuccess, 'success');
        soundManager.pop();
    };

    const handleEmptyTrash = async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        setIsTrashOpen(false);

        if (dirHandle) {
            for (const img of trashedImages) {
                try {
                    const safeName = sanitizeFileName(img.file.name);
                    await dirHandle.removeEntry(safeName);
                    const txtName = buildTagFileName(img.file.name);
                    try { await dirHandle.removeEntry(txtName); } catch (e) { /* ignore */ }
                } catch (error) {
                    console.error("Failed to delete", img.file.name);
                }
            }
        }

        setImages(prev => prev.filter(i => !i.isTrashed));
        showNotification(t.deleteSuccess, 'success');
        soundManager.pop();
    };

    const handleRestoreAll = () => {
        setImages(prev => prev.map(img => ({ ...img, isTrashed: false })));
        showNotification(t.allPhotosRestored, "success");
        setIsTrashOpen(false);
        soundManager.pop();
    };

    // ITALIANO: Limiti di sicurezza sull'ingestione dei .txt sidecar (un dataset scaricato è input non fidato)
    // ENGLISH: Safety caps on sidecar .txt ingestion (a downloaded dataset is untrusted input)
    const TXT_MAX_BYTES = 1024 * 1024;
    const TXT_MAX_TAGS_PER_FILE = 200;
    const TXT_TAG_MAX_CHARS = 100;

    const processImportData = async (imgFiles: any[], txtFiles: any[], handle: any = null) => {
        setImportSummary({ isOpen: false, summary: null, pendingData: null });
        setDirHandle(handle);
        setIsImporting(true);
        setImportProgress(0);
        let skippedTxtCount = 0;
        let restoredCount = 0;
        try {
            await new Promise(r => setTimeout(r, 300));

            // ITALIANO: Eventuale backup automatico dei tag (recupero post-crash) — vedi effetto 'tagBackup'.
            //           Lo applichiamo SOLO se la cartella reimportata è la stessa del backup (match per nome):
            //           evita di ripristinare tag su immagini omonime di un'altra cartella.
            // ENGLISH: Automatic tag backup, if any (post-crash recovery) — see the 'tagBackup' effect.
            //          Apply it ONLY when the re-imported folder matches the backup's folder (by name):
            //          prevents restoring tags onto same-named images from a different folder.
            let backupMap: Record<string, { tags?: unknown; caption?: unknown }> | null = null;
            const importFolder = (handle && handle.name) ? String(handle.name) : '';
            try {
                const raw = localStorage.getItem('tagBackup');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    const backupFolder = parsed && typeof parsed.folder === 'string' ? parsed.folder : '';
                    const sameFolder = importFolder !== '' && backupFolder === importFolder;
                    if (sameFolder && parsed && typeof parsed === 'object' && parsed.data && typeof parsed.data === 'object') {
                        backupMap = parsed.data;
                    }
                }
            } catch (_) { backupMap = null; }

            const textMap = new Map();
            for (let i = 0; i < txtFiles.length; i++) {
                try {
                    if (txtFiles[i].size > TXT_MAX_BYTES) {
                        // ITALIANO: Un sidecar legittimo pesa pochi KB: oltre 1 MB è sospetto, lo saltiamo
                        // ENGLISH: A legit sidecar weighs a few KB: over 1 MB is suspicious, skip it
                        console.warn(`[Import] Skipped oversized .txt (${txtFiles[i].size} bytes):`, txtFiles[i].name);
                        skippedTxtCount++;
                    } else {
                        const text = await txtFiles[i].text();
                        const parsedTags = text.split(/[,\n\r]+/)
                            .map((tag: string) => tag.replace(/[\x00-\x1F\x7F]/g, ' ').trim().slice(0, TXT_TAG_MAX_CHARS))
                            .filter((tag: string) => tag.length > 0)
                            .slice(0, TXT_MAX_TAGS_PER_FILE);
                        textMap.set(txtFiles[i].name.split('.').slice(0, -1).join('.'), [...new Set(parsedTags)]);
                    }
                } catch (e) {
                    // ITALIANO: File illeggibile (lockato/spostato): si salta, l'import non deve bloccarsi
                    // ENGLISH: Unreadable file (locked/moved): skip it, the import must not get stuck
                    console.warn('[Import] Unreadable .txt skipped:', txtFiles[i]?.name, e);
                    skippedTxtCount++;
                }
                setImportProgress(Math.round(((i + 1) / (imgFiles.length + txtFiles.length)) * 50));
            }

            const newImages = [];
            for (let i = 0; i < imgFiles.length; i++) {
                const base = imgFiles[i].name.split('.').slice(0, -1).join('.');
                let thumbData: any = null;
                try {
                    thumbData = await generateThumbnail(imgFiles[i]);
                } catch (e) {
                    console.warn('[Import] Thumbnail failed for', imgFiles[i]?.name, e);
                }
                const combinedTags = [...new Set([...globalTriggers, ...(textMap.get(base) || [])])];
                const orderedTags = [
                    ...globalTriggers.filter(t => combinedTags.includes(t)),
                    ...combinedTags.filter(t => !globalTriggers.includes(t))
                ];
                // ITALIANO: Se il backup anti-crash ha tag diversi dai sidecar, ripristina le modifiche non salvate
                // ENGLISH: If the crash backup differs from the sidecar tags, restore the unsaved edits
                let finalTags = orderedTags;
                const entry = backupMap && Object.prototype.hasOwnProperty.call(backupMap, imgFiles[i].name)
                    ? backupMap[imgFiles[i].name]
                    : undefined;
                if (entry) {
                    if (Array.isArray(entry.tags)) {
                        const backupTags = (entry.tags as unknown[])
                            .filter((x): x is string => typeof x === 'string')
                            .map(x => x.slice(0, TXT_TAG_MAX_CHARS))
                            .slice(0, 500);
                        const differs = JSON.stringify([...backupTags].sort()) !== JSON.stringify([...orderedTags].sort());
                        if (differs && backupTags.length > 0) {
                            finalTags = [
                                ...globalTriggers.filter(t => backupTags.includes(t)),
                                ...backupTags.filter(t => !globalTriggers.includes(t))
                            ];
                            restoredCount++;
                        }
                    }
                }
                newImages.push({
                    id: Math.random().toString(36).substring(7),
                    file: imgFiles[i],
                    thumb: thumbData?.url || '',
                    width: thumbData?.width || 0,
                    height: thumbData?.height || 0,
                    tags: finalTags,
                    originalTags: [...orderedTags],
                });
                setImportProgress(50 + Math.round(((i + 1) / imgFiles.length) * 50));
                if (i % 5 === 0) await new Promise(r => setTimeout(r, 10));
            }

            setImages(prev => {
                const combined = [...prev, ...newImages];
                return combined.sort((a, b) => a.file.name.localeCompare(b.file.name));
            });
            soundManager.chime();
            const extras = `${restoredCount > 0 ? ` · ↻ ${restoredCount}` : ''}${skippedTxtCount > 0 ? ` · ⊘ ${skippedTxtCount} .txt` : ''}`;
            showNotification(`${newImages.length} ${t.successImport}${extras}`, "success");
        } catch (error: any) {
            console.error('[Import] Failed', error);
            showNotification(`${t.aiError || 'Error'}: ${String(error?.message || error || '').slice(0, 150)}`, 'error');
        } finally {
            // ITALIANO: Comunque vada, l'UI di import non deve restare bloccata
            // ENGLISH: No matter what, the import UI must never stay stuck
            setIsImporting(false);
            if (folderInputRef.current) folderInputRef.current.value = '';
        }
    };

    const calculateImportSummary = (imgFiles: any[], txtFiles: any[], handle: any = null) => {
        const txtBases = new Set(txtFiles.map(f => f.name.split('.').slice(0, -1).join('.')));
        let withText = 0;
        let withoutText = 0;
        
        imgFiles.forEach(f => {
            const base = f.name.split('.').slice(0, -1).join('.');
            if (txtBases.has(base)) {
                withText++;
            } else {
                withoutText++;
            }
        });

        setImportSummary({
            isOpen: true,
            summary: {
                imagesCount: imgFiles.length,
                textFilesCount: txtFiles.length,
                imagesWithText: withText,
                imagesWithoutText: withoutText
            },
            pendingData: { imgFiles, txtFiles, handle }
        });
    };

    const handleLoadFolderClick = async () => {
        if ('showDirectoryPicker' in window) {
            try {
                // ITALIANO: l'id fa ricordare al sistema l'ULTIMA cartella usata: la volta dopo
                //           il selettore si riapre lì. startIn come riserva al primo utilizzo.
                // ENGLISH: the id makes the system remember the LAST used folder: next time the
                //          picker reopens there. startIn as a fallback on first use.
                const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite', id: 'itm-project', startIn: 'pictures' });
                
                const imgFiles = [];
                const txtFiles = [];
                
                for await (const entry of handle.values()) {
                    if (entry.kind === 'file') {
                        const file = await entry.getFile();
                        if (file.type.startsWith('image/')) {
                            imgFiles.push(file);
                        } else if (file.name.toLowerCase().endsWith('.txt')) {
                            txtFiles.push(file);
                        }
                    }
                }
                
                if (imgFiles.length === 0) {
                    return showNotification(t.noImagesTitle, "info");
                }

                calculateImportSummary(imgFiles, txtFiles, handle);
                
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    console.warn("Accesso diretto alla cartella bloccato (SecurityError nell'iframe). Uso il fallback standard.", err);
                    if (folderInputRef.current) folderInputRef.current.click();
                }
            }
        } else {
            if (folderInputRef.current) folderInputRef.current.click();
        }
    };

    const handleFolderUploadFallback = async (e: any) => {
        const files = Array.from(e.target.files as FileList);
        const imgFiles = files.filter(f => f.type.startsWith('image/'));
        const txtFiles = files.filter(f => f.name.toLowerCase().endsWith('.txt'));
        if (imgFiles.length === 0) return;

        calculateImportSummary(imgFiles, txtFiles, null);
    };

    // ITALIANO: Carica SINGOLE immagini (una o piu'), non l'intera cartella. Se selezioni
    //           anche i loro file .txt, i tag vengono abbinati per nome. Senza una cartella
    //           collegata, il salvataggio avviene come download del .txt.
    // ENGLISH: Load INDIVIDUAL images (one or more), not the whole folder. If you also pick
    //          their .txt files, tags are matched by name. With no folder attached, saving
    //          happens as a .txt download.
    const imagesInputRef = useRef<HTMLInputElement>(null);
    const handleImagesUpload = async (e: any) => {
        const files = Array.from(e.target.files as FileList);
        const imgFiles = files.filter(f => f.type.startsWith('image/'));
        const txtFiles = files.filter(f => f.name.toLowerCase().endsWith('.txt'));
        if (imgFiles.length === 0) { showNotification(t.noImagesTitle, 'info'); return; }
        calculateImportSummary(imgFiles, txtFiles, null);
        if (imagesInputRef.current) imagesInputRef.current.value = '';
    };

    // ITALIANO: ESPORTA / IMPORTA i tag del progetto (punto 16). Il JSON serve a
    //           reimportare tutto in modo pulito in un nuovo progetto; il TXT e' una
    //           lista leggibile. L'import accetta entrambi e AGGIUNGE i tag alla palette
    //           del progetto (senza doppioni).
    // ENGLISH: EXPORT / IMPORT project tags (item 16). JSON re-imports cleanly into a
    //          new project; TXT is a readable list. Import accepts both and ADDS the tags
    //          to the project palette (no duplicates).
    const projectTagsImportRef = useRef<HTMLInputElement>(null);

    const downloadTextFile = (content: string, mime: string, fileName: string) => {
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        try {
            const a = document.createElement('a');
            a.href = url; a.download = fileName;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
        } finally { URL.revokeObjectURL(url); }
    };

    const handleExportProjectTags = (format: 'json' | 'txt') => {
        // ITALIANO: trigger prima, poi il resto in ordine alfabetico (coerente col resto dell'app)
        // ENGLISH: triggers first, then the rest alphabetical (consistent with the rest of the app)
        const orderedTags = [
            ...globalTriggers.filter(tag => allUniqueTags.includes(tag)),
            ...allUniqueTags.filter(tag => !globalTriggers.includes(tag))
        ];
        if (orderedTags.length === 0) { showNotification(t.noTagsInProject, 'info'); return; }
        if (format === 'json') {
            const data = { app: 'Images Tag Manager for LORAs', type: 'project-tags', version: 1, globalTriggers: [...globalTriggers], tags: orderedTags };
            downloadTextFile(JSON.stringify(data, null, 2), 'application/json', 'project-tags.json');
        } else {
            downloadTextFile(orderedTags.join('\n') + '\n', 'text/plain', 'project-tags.txt');
        }
        soundManager.chime();
        showNotification(t.projectTagsExported, 'success');
    };

    const handleImportProjectTags = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = (await file.text()).trim();
            let tags: string[] = [];
            let triggers: string[] = [];
            if (text.startsWith('{')) {
                const data = JSON.parse(text);
                if (Array.isArray(data.tags)) tags = data.tags;
                if (Array.isArray(data.globalTriggers)) triggers = data.globalTriggers;
            } else {
                // ITALIANO: TXT: un tag per riga (accetto anche le virgole come separatore).
                // ENGLISH: TXT: one tag per line (commas are also accepted as separators).
                tags = text.split(/[\r\n,]+/);
            }
            // ITALIANO: i trigger del file entrano comunque nella palette del progetto.
            // ENGLISH: the file's triggers also go into the project palette.
            const clean = [...new Set([...tags, ...triggers].map((s: any) => String(s).trim()).filter(Boolean))];
            if (clean.length === 0) { showNotification(t.importTagsError, 'error'); return; }
            setCustomProjectTags(prev => [...new Set([...prev, ...clean])]);
            soundManager.chime();
            showNotification(`${t.projectTagsImported} (${clean.length})`, 'success');
        } catch (err) {
            showNotification(t.importTagsError, 'error');
        } finally {
            if (projectTagsImportRef.current) projectTagsImportRef.current.value = '';
        }
    };

    const handleResetProject = () => {
        setConfirmDialog({ isOpen: true, title: t.confirmResetTitle, message: t.confirmResetMsg, onConfirm: () => {
            // ITALIANO: Ferma un eventuale batch AI in corso e svuota il backup automatico dei tag
            // ENGLISH: Stop any running AI batch and clear the automatic tag backup
            aiCancelRequestedRef.current = true;
            setAiCancelRequested(true);
            aiAbortControllerRef.current?.abort();
            try { localStorage.removeItem('tagBackup'); } catch (_) { /* ignore */ }
            setImages([]); setGlobalTriggers([]); setSelectedForBulk([]); setStagedBulkTags([]); setCustomProjectTags([]); setDirHandle(null);
            soundManager.chime(); showNotification(t.successReset, "success");
            setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, onCancel: () => {} });
        }, onCancel: () => setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, onCancel: () => {} }) });
    };

    // Helper function to order tags with global triggers first
    const getOrderedTagString = (tags: string[]) => {
        const orderedTags = [
            ...globalTriggers.filter(t => tags.includes(t)),
            ...tags.filter(t => !globalTriggers.includes(t))
        ];
        return orderedTags.length > 0 ? orderedTags.join(', ') + ',' : '';
    };

    // ITALIANO: Funzione per salvare i file (sovrascrive o crea ZIP)
    // ENGLISH: Function to save files (overwrite or create ZIP)
    const performSave = async (imagesToSave: any[], isExportAll = false) => {
        // ITALIANO: Se abbiamo un riferimento alla cartella e stiamo salvando le modifiche (non esportando tutto), sovrascriviamo i file originali
        // ENGLISH: If we have a folder handle and we are saving changes (not exporting all), overwrite original files
        if (dirHandle && !saveAsZip && !isExportAll) {
            try {
                showNotification(t.processingFiles, "info");
                for (const img of imagesToSave) {
                    const tagString = getOrderedTagString(img.tags);
                    const fileName = buildTagFileName(img.file.name);

                    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(tagString);
                    await writable.close();
                }
                
                setImages(prev => prev.map(img => {
                    if (imagesToSave.some(savedImg => savedImg.id === img.id)) return { ...img, originalTags: [...img.tags] };
                    return img;
                }));
                
                soundManager.chime();
                showNotification(t.successSaveChanges, "success");
            } catch (err) {
                console.error(err);
                showNotification(t.dirError, "error");
            }
            return; 
        }

        // ITALIANO: Se l'utente vuole esportare in una cartella specifica (non quella originale)
        // ENGLISH: If the user wants to export to a specific folder (not the original one)
        if (!saveAsZip && isExportAll) {
            if ('showDirectoryPicker' in window) {
                try {
                    const exportHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite', id: 'itm-export', startIn: 'itm-project' });
                    showNotification(t.processingFiles, "info");
                    
                    for (const img of imagesToSave) {
                        const tagString = getOrderedTagString(img.tags);
                        const fileName = buildTagFileName(img.file.name);

                        const fileHandle = await exportHandle.getFileHandle(fileName, { create: true });
                        const writable = await fileHandle.createWritable();
                        await writable.write(tagString);
                        await writable.close();
                    }
                    
                    soundManager.chime();
                    showNotification(t.exportFolderSuccess, "success");
                    return;
                } catch (err: any) {
                    if (err.name !== 'AbortError') {
                        console.error(err);
                        showNotification(t.exportFolderError, "error");
                    }
                    return;
                }
            }
        }

        // ITALIANO: Se vogliamo salvare come archivio ZIP
        // ENGLISH: If we want to save as a ZIP archive
        if (saveAsZip) {
            try {
                showNotification(t.zipProcessing, "info");
                const zip = new JSZip();
                
                imagesToSave.forEach((img) => {
                    const tagString = getOrderedTagString(img.tags);
                    // ITALIANO: Nome sanitizzato per prevenire zip-slip e caratteri illegali su Windows
                    // ENGLISH: Sanitized name to prevent zip-slip and illegal Windows characters
                    zip.file(buildTagFileName(img.file.name), tagString);
                });
                
                const blob = await zip.generateAsync({ type: "blob" });
                const url = URL.createObjectURL(blob);
                try {
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = isExportAll ? "tags_tutti.zip" : "tags_modificati.zip";
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                } finally {
                    URL.revokeObjectURL(url);
                }
                
                setImages(prev => prev.map(img => {
                    if (imagesToSave.some(savedImg => savedImg.id === img.id)) return { ...img, originalTags: [...img.tags] };
                    return img;
                }));
                
                soundManager.chime();
                showNotification(t.zipSuccess, "success");
            } catch (err) {
                console.error(err);
                showNotification(t.zipError, "error");
            }
            return;
        }

        // ITALIANO: Metodo di salvataggio di emergenza (download multipli nel browser)
        // ENGLISH: Fallback save method (multiple downloads in the browser)
        showNotification(t.infoSaveFallback, "info");
        imagesToSave.forEach((img, i) => setTimeout(() => {
            const tagString = getOrderedTagString(img.tags);
            const blob = new Blob([tagString], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            try {
                const a = document.createElement('a');
                a.href = url;
                a.download = buildTagFileName(img.file.name);
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            } finally {
                URL.revokeObjectURL(url);
            }
        }, i * 300));
        
        setImages(prev => prev.map(img => {
            if (imagesToSave.some(savedImg => savedImg.id === img.id)) return { ...img, originalTags: [...img.tags] };
            return img;
        }));
        
        soundManager.chime();
        showNotification(isExportAll ? t.successSave : t.successSaveChanges, "success");
    };

    // ITALIANO: Salva solo le immagini che hanno subito modifiche
    // ENGLISH: Save only the images that have undergone changes
    const handleSaveChanges = () => {
        const modifiedImages = images.filter(img => JSON.stringify(img.tags) !== JSON.stringify(img.originalTags));
        if (modifiedImages.length === 0) { showNotification(t.noChanges, "info"); return; }
        performSave(modifiedImages, false);
    };

    // ITALIANO: Esporta i tag di tutte le immagini del progetto
    // ENGLISH: Export tags for all images in the project
    const handleExportAll = () => {
        const imagesWithTags = images.filter(img => img.tags && img.tags.length > 0);
        
        if (imagesWithTags.length === 0) {
            return showNotification(t.errorNoTagsToExport, "info");
        }
        
        performSave(imagesWithTags, true);
    };

    const updateImageTags = (id: string, newTags: string[]) => {
        // ITALIANO: Deduplica alla fonte — incollando "sunset, sunset" o simili non si creano tag
        //           doppi (che finirebbero nel .txt esportato e darebbero due pillole con la stessa key React).
        // ENGLISH: Dedupe at the source — pasting "sunset, sunset" etc. must not create duplicate tags
        //          (they would end up in the exported .txt and render two pills with the same React key).
        const uniqueTags = [...new Set(newTags)];
        // ITALIANO: Ordine dei tag: prima le trigger word (nell'ordine impostato dall'utente,
        //           convenzione LoRA), poi tutti gli altri in ORDINE ALFABETICO. Vale ovunque,
        //           perche' questo e' l'unico punto in cui i tag di un'immagine vengono scritti.
        // ENGLISH: Tag order: trigger words first (in the user's configured order, LoRA
        //          convention), then everything else ALPHABETICALLY. Applies everywhere, since
        //          this is the single place an image's tags are written.
        const orderedTags = [
            ...globalTriggers.filter(t => uniqueTags.includes(t)),
            ...uniqueTags.filter(t => !globalTriggers.includes(t)).sort((a, b) => a.localeCompare(b))
        ];
        setImages(prev => prev.map(img => img.id === id ? { ...img, tags: orderedTags } : img));
    };
    const updateOriginalTags = (id: string, newTags: string[]) => setImages(prev => prev.map(img => img.id === id ? { ...img, originalTags: [...newTags] } : img));
    const toggleImageSelection = (id: string) => setSelectedForBulk(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id]);

    // ITALIANO: Seleziona TUTTE le foto visibili; se sono gia' tutte selezionate, le deseleziona.
    // ENGLISH: Select ALL visible photos; if they are all already selected, deselect them.
    const toggleSelectAll = () => {
        const visibleIds = displayedImages.map(img => img.id);
        const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedForBulk.includes(id));
        setSelectedForBulk(allSelected ? [] : visibleIds);
        soundManager.pop();
    };

    // ITALIANO: Chiude il PROGETTO ATTUALE: toglie tutte le foto E cancella tutti i tag,
    //           riportando l'app come appena aperta. Se ci sono modifiche non salvate lo
    //           segnala prima. Non tocca i file su disco (le foto e i .txt restano dove sono).
    // ENGLISH: Closes the CURRENT PROJECT: removes all photos AND clears all tags, bringing
    //          the app back to its just-opened state. Warns first if there are unsaved
    //          changes. Does not touch files on disk (photos and .txt stay where they are).
    const handleCloseProject = () => {
        if (images.length === 0) return;
        const hasUnsaved = images.some(img => JSON.stringify(img.tags) !== JSON.stringify(img.originalTags));
        setConfirmDialog({
            isOpen: true,
            title: t.closeAllTitle,
            message: hasUnsaved ? t.closeAllUnsavedMsg : t.closeAllMsg,
            onConfirm: () => {
                // ITALIANO: ferma un eventuale batch AI in corso, poi azzera TUTTO
                // ENGLISH: stop any running AI batch, then clear EVERYTHING
                aiCancelRequestedRef.current = true;
                setAiCancelRequested(true);
                aiAbortControllerRef.current?.abort();
                try { localStorage.removeItem('tagBackup'); } catch (_) { /* ignore */ }
                setImages([]);
                setGlobalTriggers([]);
                setSelectedForBulk([]);
                setStagedBulkTags([]);
                setCustomProjectTags([]);
                setDirHandle(null);
                setSelectedImageId(null);
                setCopiedTags(null);
                soundManager.chime();
                showNotification(t.closeAllDone, 'success');
                setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, onCancel: () => {} });
            },
            onCancel: () => setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, onCancel: () => {} })
        });
    };

    // ITALIANO: Tagga la singola immagine via Gemini API
    // ENGLISH: Tag a single image via Gemini API
    const handleAITagSingle = useCallback(async (imageId: string): Promise<number> => {
        if (!aiEnabled) return 0;
        if (!geminiApiKey) { setIsApiKeyDialogOpen(true); return 0; }
        const img = images.find(i => i.id === imageId);
        if (!img) return 0;
        setIsAIBusy(true);
        try {
            const tags = await getGeminiTags(img.file, {
                apiKey: geminiApiKey,
                modelName: aiModel,
                maxTags: aiMaxTags,
                customPrompt: aiCustomPrompt,
            });
            // ITALIANO: Merge sui tag LIVE (via imagesRef), non sullo snapshot pre-richiesta:
            //           i tag modificati a mano durante l'attesa non vengono persi
            // ENGLISH: Merge against LIVE tags (via imagesRef), not the pre-request snapshot:
            //          tags edited manually while waiting are not lost
            const live = imagesRef.current.find(i => i.id === imageId);
            const baseTags: string[] = live ? live.tags : img.tags;
            const merged = [...new Set([...baseTags, ...tags])];
            const added = merged.length - baseTags.length;
            updateImageTags(imageId, merged);
            soundManager.chime();
            showNotification(`${added} ${t.aiTagsGenerated || 'tags generated'}`, 'success');
            return added;
        } catch (e: any) {
            console.error('AI tag failed', e);
            const { kind } = classifyGeminiError(e);
            if (kind === 'invalid_key') setIsApiKeyDialogOpen(true);
            const friendly = kind === 'billing_required'
                ? (t.aiBillingRequired || 'This model requires billing enabled on your Google Cloud project.')
                : kind === 'rate_limit'
                ? (t.aiRateLimit || 'Rate limit exceeded. Wait a moment or upgrade tier.')
                : kind === 'model_unavailable'
                ? (t.aiModelUnavailable || 'Model unavailable for your account.')
                : String(e?.message || e || '').slice(0, 200);
            showNotification(`${t.aiError || 'AI Error'}: ${friendly}`, 'error');
            return 0;
        } finally {
            setIsAIBusy(false);
        }
    }, [aiEnabled, geminiApiKey, aiModel, aiMaxTags, aiCustomPrompt, images, t, updateImageTags]);

    // ITALIANO: Richiesta di annullamento del bulk tagging — viene letta dai cicli e dagli sleep.
    //           Aggiorna sia il ref (per il loop async) che lo state (per re-render del pulsante).
    // ENGLISH: Cancel request for bulk tagging — read by loops and sleeps.
    //          Updates both the ref (for the async loop) and state (to re-render the button).
    const handleCancelAITagging = useCallback(() => {
        aiCancelRequestedRef.current = true;
        setAiCancelRequested(true);
        // ITALIANO: Abortisce anche l'eventuale richiesta HTTP in volo (altrimenti su rete bloccata si resterebbe appesi)
        // ENGLISH: Also aborts any in-flight HTTP request (otherwise a stalled connection would hang forever)
        aiAbortControllerRef.current?.abort();
    }, []);

    // ITALIANO: Tagga tutte le immagini con throttle adattivo (mira aiRpm) + retry su rate-limit.
    //           Supporta skip immagini già taggate e annullamento via aiCancelRequestedRef.
    // ENGLISH: Tag every image with adaptive throttle (targets aiRpm) + retry on rate-limit.
    //          Supports skipping already-tagged images and cancel via aiCancelRequestedRef.
    const handleAITagAll = useCallback(async () => {
        if (!aiEnabled || images.length === 0 || isGlobalAITagging) return;
        if (!geminiApiKey) { setIsApiKeyDialogOpen(true); return; }
        aiCancelRequestedRef.current = false;
        setAiCancelRequested(false);
        // ITALIANO: Controller per abortire le richieste HTTP in volo quando l'utente annulla
        // ENGLISH: Controller to abort in-flight HTTP requests when the user cancels
        aiAbortControllerRef.current = new AbortController();
        const batchSignal = aiAbortControllerRef.current.signal;
        setIsGlobalAITagging(true);
        setGlobalAIProgress({ done: 0, total: images.length, ok: 0, errors: 0, skipped: 0 });
        // ITALIANO: Intervallo minimo tra le richieste in base alla RPM target dell'utente
        // ENGLISH: Minimum interval between requests based on user's target RPM
        const minIntervalMs = Math.max(1000, Math.floor(60000 / Math.max(1, aiRpm)));
        // ITALIANO: Sleep cancellabile — controlla aiCancelRequestedRef ad intervalli di 200ms
        // ENGLISH: Cancellable sleep — checks aiCancelRequestedRef every 200ms
        const cancellableSleep = async (ms: number): Promise<void> => {
            const step = 200;
            const end = Date.now() + ms;
            while (Date.now() < end) {
                if (aiCancelRequestedRef.current) return;
                const remaining = end - Date.now();
                if (remaining <= 0) return;
                await new Promise(r => setTimeout(r, Math.min(step, remaining)));
            }
        };
        let totalTagsAdded = 0;
        let okCount = 0;
        let errorCount = 0;
        let skippedCount = 0;
        let fatalAbort = false;
        let cancelled = false;
        try {
            for (let i = 0; i < images.length; i++) {
                if (aiCancelRequestedRef.current) { cancelled = true; break; }
                // ITALIANO: Lo snapshot fornisce solo l'ID; lo stato VIVO arriva da imagesRef —
                //           così skip e merge vedono le modifiche fatte dall'utente durante il batch
                // ENGLISH: The snapshot only provides the ID; LIVE state comes from imagesRef —
                //          so skip and merge see edits the user made during the batch
                const snapshotItem = images[i];
                const current = snapshotItem ? imagesRef.current.find(im => im.id === snapshotItem.id) : null;
                if (!current || current.isTrashed) {
                    // ITALIANO: Eliminata o nel cestino nel frattempo: non sprecare quota
                    // ENGLISH: Deleted or trashed meanwhile: don't waste quota
                    skippedCount++;
                    setGlobalAIProgress({ done: i + 1, total: images.length, ok: okCount, errors: errorCount, skipped: skippedCount });
                    continue;
                }
                // ITALIANO: Skip se richiesto e l'immagine ha già almeno un tag (stato live)
                // ENGLISH: Skip if requested and the image already has at least one tag (live state)
                if (aiSkipTagged && Array.isArray(current.tags) && current.tags.length > 0) {
                    skippedCount++;
                    console.log(`[AI] ${i + 1}/${images.length} ${current.file.name}: skipped (already tagged)`);
                    setGlobalAIProgress({ done: i + 1, total: images.length, ok: okCount, errors: errorCount, skipped: skippedCount });
                    continue;
                }

                const requestStart = Date.now();
                let success = false;
                // ITALIANO: Retry su rate-limit, max 2 tentativi extra con attesa progressiva
                // ENGLISH: Retry on rate-limit, max 2 extra attempts with progressive wait
                for (let attempt = 0; attempt < 3; attempt++) {
                    if (aiCancelRequestedRef.current) { cancelled = true; break; }
                    try {
                        const tags = await getGeminiTags(current.file, {
                            apiKey: geminiApiKey,
                            modelName: aiModel,
                            maxTags: aiMaxTags,
                            customPrompt: aiCustomPrompt,
                            signal: batchSignal,
                        });
                        // ITALIANO: Merge sui tag LIVE letti ORA — le modifiche manuali fatte
                        //           durante la richiesta (secondi) non vengono sovrascritte
                        // ENGLISH: Merge against LIVE tags read NOW — manual edits made during
                        //          the request (seconds) are not overwritten
                        const liveNow = imagesRef.current.find(im => im.id === current.id);
                        if (!liveNow) {
                            // ITALIANO: Rimossa durante la richiesta: ignora il risultato
                            // ENGLISH: Removed during the request: discard the result
                            console.log(`[AI] ${i + 1}/${images.length} ${current.file.name}: removed mid-batch, result discarded`);
                            success = true;
                            break;
                        }
                        const baseTags: string[] = Array.isArray(liveNow.tags) ? liveNow.tags : [];
                        const merged = [...new Set([...baseTags, ...tags])];
                        totalTagsAdded += merged.length - baseTags.length;
                        updateImageTags(current.id, merged);
                        success = true;
                        console.log(`[AI] ${i + 1}/${images.length} ${current.file.name}: ${tags.length} tags`);
                        break;
                    } catch (err: any) {
                        // ITALIANO: Se l'errore deriva dall'annullamento (abort), esci subito senza contarlo come errore
                        // ENGLISH: If the error comes from cancellation (abort), exit immediately without counting it as an error
                        if (aiCancelRequestedRef.current) { cancelled = true; break; }
                        const { kind, message } = classifyGeminiError(err);
                        console.warn(`[AI] ${i + 1}/${images.length} ${current.file.name} (attempt ${attempt + 1}): ${kind} — ${message}`);
                        if (kind === 'invalid_key') {
                            setIsApiKeyDialogOpen(true);
                            fatalAbort = true;
                            break;
                        }
                        if (kind === 'billing_required' || kind === 'model_unavailable') {
                            const friendly = kind === 'billing_required'
                                ? (t.aiBillingRequired || 'Model requires billing on your Google Cloud project.')
                                : (t.aiModelUnavailable || 'Model unavailable for your account.');
                            showNotification(`${t.aiError || 'AI Error'}: ${friendly}`, 'error');
                            fatalAbort = true;
                            break;
                        }
                        if (kind === 'rate_limit' && attempt < 2) {
                            // ITALIANO: Backoff progressivo: 15s, 45s — cancellabile
                            // ENGLISH: Progressive backoff: 15s, 45s — cancellable
                            const backoff = attempt === 0 ? 15000 : 45000;
                            console.warn(`[AI] Rate limit, retry in ${backoff / 1000}s...`);
                            await cancellableSleep(backoff);
                            if (aiCancelRequestedRef.current) { cancelled = true; break; }
                            continue;
                        }
                        // ITALIANO: Errore non-fatale o ultimo tentativo fallito → segna come errore e prosegui
                        // ENGLISH: Non-fatal error or last attempt failed → record error and continue
                        break;
                    }
                }

                if (fatalAbort || cancelled) break;
                if (success) okCount++;
                else errorCount++;
                setGlobalAIProgress({ done: i + 1, total: images.length, ok: okCount, errors: errorCount, skipped: skippedCount });

                // ITALIANO: Throttle adattivo — aspetta solo se la richiesta è stata più veloce del minimo
                // ENGLISH: Adaptive throttle — only wait if the request was faster than the minimum
                if (i < images.length - 1) {
                    const elapsed = Date.now() - requestStart;
                    const waitMs = Math.max(0, minIntervalMs - elapsed);
                    if (waitMs > 0) await cancellableSleep(waitMs);
                }
            }
            soundManager.chime();
            const successType: 'success' | 'info' | 'error' = cancelled
                ? 'info'
                : errorCount === 0 ? 'success' : (okCount > 0 ? 'info' : 'error');
            const prefix = cancelled ? `${t.aiCancelled || 'Cancelled'} · ` : '';
            const skippedSuffix = skippedCount > 0 ? ` · ⊘ ${skippedCount}` : '';
            const summary = `${prefix}${t.completed || 'Done'} · ✓ ${okCount} · ✗ ${errorCount}${skippedSuffix} · +${totalTagsAdded} ${t.aiTagsGenerated || 'tags'}`;
            showNotification(summary, successType);
        } finally {
            aiCancelRequestedRef.current = false;
            setAiCancelRequested(false);
            setIsGlobalAITagging(false);
            aiAbortControllerRef.current = null;
        }
    }, [aiEnabled, geminiApiKey, aiModel, aiMaxTags, aiCustomPrompt, aiRpm, aiSkipTagged, images, isGlobalAITagging, t, updateImageTags]);

    // ITALIANO: Verifica la API key. Usa SEMPRE 2.5 Flash (free tier) per la verifica,
    //           così non confondiamo "key invalida" con "modello a pagamento".
    // ENGLISH: Verify the API key. ALWAYS uses 2.5 Flash (free tier) for verification
    //          so we don't confuse "invalid key" with "paid-only model".
    const handleVerifyApiKey = useCallback(async () => {
        const key = tempApiKey.trim();
        if (!key) { setApiKeyError(t.aiKeyEmpty || 'Please enter a key'); return; }
        setIsVerifyingApiKey(true);
        setApiKeyError('');
        try {
            const result = await verifyGeminiApiKey(key, DEFAULT_GEMINI_MODEL);
            if (result.ok) {
                setGeminiApiKey(key);
                setIsApiKeyDialogOpen(false);
                soundManager.chime();
                showNotification(t.aiKeySaved || 'API Key verified and saved', 'success');
            } else {
                const friendly = result.errorKind === 'billing_required'
                    ? (t.aiBillingRequired || 'Billing required on your Google Cloud project.')
                    : result.errorKind === 'rate_limit'
                    ? (t.aiRateLimit || 'Rate limit (key valid but throttled).')
                    : result.errorKind === 'model_unavailable'
                    ? (t.aiModelUnavailable || 'Model unavailable for your account.')
                    : (result.error || (t.aiKeyInvalid || 'API Key invalid'));
                setApiKeyError(friendly);
            }
        } catch (e: any) {
            setApiKeyError(e?.message || (t.aiKeyInvalid || 'API Key invalid'));
        } finally {
            setIsVerifyingApiKey(false);
        }
    }, [tempApiKey, t]);
    
    const applyBulkTags = () => {
        setImages(prev => prev.map(img => {
            if (selectedForBulk.includes(img.id)) {
                const combinedTags = [...new Set([...img.tags, ...stagedBulkTags])];
                const orderedTags = [
                    ...globalTriggers.filter(t => combinedTags.includes(t)),
                    ...combinedTags.filter(t => !globalTriggers.includes(t))
                ];
                return { ...img, tags: orderedTags };
            }
            return img;
        }));
        soundManager.chime();
        showNotification(`${t.added} ${stagedBulkTags.length} ${t.tagsTo} ${selectedForBulk.length} ${t.imagesLabel}!`, "success");
        setStagedBulkTags([]);
        setSelectedForBulk([]); 
    };

    const currentIndex = displayedImages.findIndex(img => img.id === selectedImageId);
    const handleNext = () => { if (currentIndex < displayedImages.length - 1) { setSlideDirection('left'); setSelectedImageId(displayedImages[currentIndex + 1].id); } };
    const handlePrev = () => { if (currentIndex > 0) { setSlideDirection('right'); setSelectedImageId(displayedImages[currentIndex - 1].id); } };

    const handleGlobalTagsChange = (newGlobalTags: string[]) => {
        const added = newGlobalTags.filter(t => !globalTriggers.includes(t));
        const removed = globalTriggers.filter(t => !newGlobalTags.includes(t));
        setGlobalTriggers(newGlobalTags);
        if (images.length > 0) {
            setImages(prev => prev.map(img => {
                let updatedTags = [...img.tags];
                added.forEach(tag => { if (!updatedTags.includes(tag)) updatedTags.unshift(tag); });
                removed.forEach(tag => { updatedTags = updatedTags.filter(t => t !== tag); });
                
                const orderedTags = [
                    ...newGlobalTags.filter(t => updatedTags.includes(t)),
                    ...updatedTags.filter(t => !newGlobalTags.includes(t))
                ];
                
                return { ...img, tags: orderedTags };
            }));
        }
    };

    useEffect(() => { soundManager.enabled = soundEnabled; }, [soundEnabled]);
    useEffect(() => {
        const initAudio = () => { soundManager.init(); document.removeEventListener('click', initAudio); };
        document.addEventListener('click', initAudio);
        return () => document.removeEventListener('click', initAudio);
    }, []);
    useEffect(() => {
        function handleClickOutside(event: any) {
            if (settingsRef.current && !settingsRef.current.contains(event.target)) setIsSettingsOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (!showSplash) return undefined;
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                setTimeout(() => setShowSplash(false), 500);
            }
            setSplashProgress(progress);
        }, 100);
        return () => clearInterval(interval);
    }, [showSplash]);

    return (
        <div className={`h-screen transition-colors duration-500 overflow-hidden w-full ${isDarkMode ? 'dark' : ''}`}>
            {/* ITALIANO: Scelta lingua al PRIMO avvio — sta sopra a tutto (anche allo splash).
                          Usa i nomi nelle lingue native: niente immagini remote, funziona offline. */}
            {/* ENGLISH: FIRST-run language picker — sits above everything (splash included).
                         Uses native language names: no remote images, works offline. */}
            {showLangPicker && (
                <div className={`fixed inset-0 z-[10000] flex items-center justify-center p-6 transition-colors duration-500 ${isDarkMode ? 'bg-gradient-to-br from-gray-900 via-purple-950 to-slate-900' : 'bg-gradient-to-br from-gray-100 via-indigo-50 to-white'}`}>
                    <div className={`absolute inset-0 opacity-20 ${isDarkMode ? 'bg-[radial-gradient(circle_at_50%_50%,_rgba(255,255,255,0.2)_0%,_transparent_100%)]' : 'bg-[radial-gradient(circle_at_50%_50%,_rgba(0,0,0,0.05)_0%,_transparent_100%)]'}`}></div>
                    <div className={`relative w-full max-w-xl p-8 ${isDarkMode ? 'bg-gray-900/70 border-gray-700/50' : 'bg-white/80 border-gray-200'} backdrop-blur-xl border shadow-2xl rounded-3xl flex flex-col gap-7 animate-in fade-in zoom-in duration-500`}>
                        <div className="flex flex-col items-center gap-3 text-center">
                            <img src="./logo.png" alt="" className="w-16 h-16 object-contain drop-shadow-md" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                            <h1 className={`text-2xl font-bold bg-clip-text text-transparent ${isDarkMode ? 'bg-gradient-to-r from-white to-gray-300' : 'bg-gradient-to-r from-gray-900 to-gray-600'}`}>Images Tag Manager for LORAs</h1>
                            <p className={`text-[10px] uppercase tracking-widest font-semibold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>{tPending.langPickerTitle}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-2.5">
                            {APP_LANGUAGES.map((l) => (
                                <button
                                    key={l.code}
                                    onClick={() => { setPendingLang(l.code); soundManager.pop(); }}
                                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${pendingLang === l.code
                                        ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-transparent shadow-lg scale-105'
                                        : (isDarkMode ? 'bg-gray-800/60 border-gray-700/50 text-gray-300 hover:bg-gray-700/60 hover:border-indigo-500/50' : 'bg-white/70 border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-indigo-300')}`}
                                >
                                    <img src={`https://flagcdn.com/w40/${l.flag}.png`} alt="" className="w-5 h-5 rounded-full object-cover shadow-sm shrink-0" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                    <span className="truncate">{l.label}</span>
                                </button>
                            ))}
                        </div>
                        {/* ITALIANO: Conferma esplicita — l'etichetta è già nella lingua selezionata.
                            ENGLISH: Explicit confirmation — the label is already in the selected language. */}
                        <button
                            onClick={() => {
                                setLang(pendingLang);
                                try { localStorage.setItem('langChosen', '1'); } catch (_) { /* ignore */ }
                                setShowLangPicker(false);
                                soundManager.chime();
                            }}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold shadow-lg transition-all active:scale-95"
                        >
                            <Check size={18} />
                            {tPending.confirm}
                        </button>
                        <p className={`text-[11px] text-center ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                            {tPending.langPickerHint}
                        </p>
                    </div>
                </div>
            )}
            {showSplash && (
                <div className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-500 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
                    <div className="flex flex-col items-center gap-6 animate-in zoom-in duration-700">
                        <div className="relative flex items-center justify-center">
                            <img src="./logo.png" alt="Logo" className="w-32 h-32 object-contain drop-shadow-2xl relative z-10" onError={(e) => { e.currentTarget.src = './icon.png'; e.currentTarget.onerror = (e2) => { const target = (e2 as Event).currentTarget as HTMLImageElement | null; if (target) target.style.display = 'none'; const fallback = document.getElementById('fallback-splash-logo'); if (fallback) fallback.classList.remove('hidden'); } }} />
                            <div id="fallback-splash-logo" className={`p-6 rounded-3xl hidden relative z-10 ${isDarkMode ? 'bg-indigo-500/10 shadow-[0_0_40px_rgba(99,102,241,0.2)]' : 'bg-indigo-50 shadow-xl'}`}>
                                <Tag size={80} className="text-indigo-500" strokeWidth={1.5} />
                            </div>
                        </div>
                        <div className="text-center">
                            <h1 className={`text-4xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                {t.appTitle}
                            </h1>
                            <p className={`mt-2 text-sm font-medium tracking-widest uppercase ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                AI Image Tagging
                            </p>
                        </div>
                        <div className="w-64 h-1.5 mt-8 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-indigo-500 transition-all duration-100 ease-out"
                                style={{ width: `${splashProgress}%` }}
                            />
                        </div>
                    </div>
                </div>
            )}
            
            {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />}
            {/* ITALIANO: Finestre di dialogo per conferme e riepilogo importazione */}
            {/* ENGLISH: Dialog boxes for confirmations and import summary */}
            <CustomConfirmDialog isOpen={confirmDialog.isOpen} title={confirmDialog.title} message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={confirmDialog.onCancel} t={t} isDarkMode={isDarkMode} />
            <ImportSummaryDialog isOpen={importSummary.isOpen} summary={importSummary.summary} onConfirm={() => processImportData(importSummary.pendingData.imgFiles, importSummary.pendingData.txtFiles, importSummary.pendingData.handle)} onCancel={() => { setImportSummary({ isOpen: false, summary: null, pendingData: null }); if (folderInputRef.current) folderInputRef.current.value = ''; }} t={t} isDarkMode={isDarkMode} />

            {/* ITALIANO: Dialog inserimento / verifica API Key Gemini */}
            {/* ENGLISH: Gemini API Key entry / verification dialog */}
            {isApiKeyDialogOpen && (
                <div className={`fixed inset-0 z-[400] flex items-center justify-center p-4 ${isDarkMode ? 'bg-black/80' : 'bg-gray-900/50'} backdrop-blur-sm animate-in fade-in`}>
                    <div className={`w-full max-w-md p-6 rounded-3xl shadow-2xl border ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} flex flex-col gap-4`}>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-500 rounded-xl">
                                <KeyRound size={24} />
                            </div>
                            <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{t.apiKeyTitle || 'API Key Gemini'}</h2>
                        </div>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{t.apiKeyDesc || 'Per usare Gemini è necessaria una API key gratuita di Google AI Studio.'}</p>
                        <div className={`p-3 rounded-xl text-xs ${isDarkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-50 text-gray-500'}`}>
                            <p className="mb-2"><strong>{t.apiKeyHowTo || 'Come ottenerla:'}</strong></p>
                            <ol className="list-decimal pl-4 space-y-1">
                                <li><a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline">{t.apiKeyStep1 || 'Vai su Google AI Studio'}</a></li>
                                <li>{t.apiKeyStep2 || 'Accedi col tuo account Google'}</li>
                                <li>{t.apiKeyStep3 || 'Clicca su "Create API key"'}</li>
                                <li>{t.apiKeyStep4 || 'Copia e incolla qui sotto'}</li>
                            </ol>
                        </div>
                        <input
                            type="password"
                            value={tempApiKey}
                            onChange={(e) => { setTempApiKey(e.target.value); setApiKeyError(''); }}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !isVerifyingApiKey) handleVerifyApiKey(); }}
                            placeholder={t.apiKeyPlaceholder || 'Incolla qui la tua API Key...'}
                            autoComplete="off"
                            spellCheck={false}
                            className={`w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-indigo-500 ${isDarkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                        />
                        {apiKeyError && (
                            <div className={`text-xs rounded-lg px-3 py-2 ${isDarkMode ? 'bg-red-900/30 text-red-400 border border-red-800/50' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                                {apiKeyError}
                            </div>
                        )}
                        <div className="flex justify-end gap-3 mt-1">
                            <button
                                onClick={() => { setIsApiKeyDialogOpen(false); if (!geminiApiKey) setAiEnabled(false); }}
                                disabled={isVerifyingApiKey}
                                className={`px-4 py-2 rounded-xl font-medium transition-colors ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                            >
                                {t.cancel || 'Annulla'}
                            </button>
                            <button
                                onClick={handleVerifyApiKey}
                                disabled={isVerifyingApiKey || tempApiKey.trim().length < 20}
                                className="px-4 py-2 rounded-xl font-medium bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white transition-colors shadow-md flex items-center gap-2"
                            >
                                {isVerifyingApiKey && <Loader2 size={14} className="animate-spin" />}
                                {isVerifyingApiKey ? (t.aiKeyVerifying || 'Verifica in corso…') : (t.apiKeySaveButton || 'Verifica e salva')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <input type="file" {...{webkitdirectory: "true", directory: "true"} as any} multiple ref={folderInputRef} className="hidden" onChange={handleFolderUploadFallback} />
            {/* ITALIANO: Selettore per singole immagini + relativi .txt (punto 12) */}
            {/* ENGLISH: Picker for individual images + their .txt files (item 12) */}
            <input type="file" accept="image/*,.txt,text/plain" multiple ref={imagesInputRef} className="hidden" onChange={handleImagesUpload} />
            
            {isTrashOpen && (
                <div className={`fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-6 ${isDarkMode ? 'bg-black/80' : 'bg-gray-900/50'} backdrop-blur-sm animate-in fade-in`}>
                    <div className={`w-full max-w-5xl h-[80vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden border ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
                        <div className={`p-4 md:p-6 border-b flex justify-between items-center ${isDarkMode ? 'border-gray-800 bg-gray-800/50' : 'border-gray-100 bg-gray-50/50'}`}>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-xl">
                                    <Trash2 size={24} />
                                </div>
                                <div>
                                    <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{t.trash}</h2>
                                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{trashedImages.length} {t.imagesFound}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {trashedImages.length > 0 && (
                                    <>
                                        <button 
                                            onClick={handleRestoreAll}
                                            className={`flex items-center gap-2 px-4 py-2 ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700' : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'} border rounded-xl font-medium transition-colors shadow-sm`}
                                        >
                                            <RefreshCw size={18} />
                                            <span className="hidden sm:inline">{t.restoreAll}</span>
                                        </button>
                                        <button 
                                            onClick={() => {
                                                setConfirmDialog({
                                                    isOpen: true,
                                                    title: t.emptyTrash,
                                                    message: t.confirmEmptyTrash,
                                                    onConfirm: handleEmptyTrash,
                                                    onCancel: () => setConfirmDialog(prev => ({ ...prev, isOpen: false }))
                                                });
                                            }}
                                            className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors shadow-sm"
                                        >
                                            <Trash size={18} />
                                            <span className="hidden sm:inline">{t.emptyTrash}</span>
                                        </button>
                                    </>
                                )}
                                <button onClick={() => setIsTrashOpen(false)} className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                                    <X size={24} />
                                </button>
                            </div>
                        </div>
                        
                        <div className={`flex-1 flex flex-col min-h-0 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
                            {trashedImages.length > 0 && (
                                <div className={`p-4 border-b flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0 ${isDarkMode ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white/50'}`}>
                                    <div className="flex items-center gap-2">
                                        <ArrowDownUp size={16} className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} />
                                        <select value={trashSortOrder} onChange={(e) => setTrashSortOrder(e.target.value)} className={`text-sm rounded-lg border-none focus:ring-0 cursor-pointer font-medium ${isDarkMode ? 'bg-transparent text-gray-300' : 'bg-transparent text-gray-700'}`}>
                                            <option value="name-asc" className={isDarkMode ? 'bg-gray-800' : 'bg-white'}>{t.sortNameAsc}</option>
                                            <option value="name-desc" className={isDarkMode ? 'bg-gray-800' : 'bg-white'}>{t.sortNameDesc}</option>
                                            <option value="date-asc" className={isDarkMode ? 'bg-gray-800' : 'bg-white'}>{t.sortDateAsc}</option>
                                            <option value="date-desc" className={isDarkMode ? 'bg-gray-800' : 'bg-white'}>{t.sortDateDesc}</option>
                                        </select>
                                    </div>
                                    <div className={`flex items-center gap-3 px-4 py-2 rounded-xl border shadow-sm ${isDarkMode ? 'bg-gray-800/50 border-gray-700/50' : 'bg-white border-gray-200'}`}>
                                        <ZoomOut size={14} className="text-gray-400" />
                                        <input type="range" min="150" max="400" value={trashImageWidth} onChange={(e) => setTrashImageWidth(Number(e.target.value))} className="w-24 md:w-32 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-indigo-500" />
                                        <ZoomIn size={14} className="text-gray-400" />
                                    </div>
                                </div>
                            )}
                            <div className="flex-1 overflow-y-auto p-4 md:p-6 relative">
                                {trashedImages.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center">
                                        <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 ${isDarkMode ? 'bg-gray-800 text-gray-600' : 'bg-gray-100 text-gray-300'}`}>
                                            <Trash2 size={48} />
                                        </div>
                                        <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{t.trashEmpty}</h3>
                                    </div>
                                ) : (
                                    <div className="grid gap-4 md:gap-6 transition-all duration-300 items-start" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${trashImageWidth}px, 1fr))` }}>
                                        {sortedTrashedImages.map(img => (
                                            <div key={img.id} className={`group ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all border flex flex-col h-full`}>
                                                <div className={`relative ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} overflow-hidden shrink-0 flex justify-center items-center ${viewMode === 'square' ? 'aspect-square' : ''}`} style={viewMode === 'original' ? { height: 'auto', minHeight: '120px' } : {}}>
                                                    <img src={img.thumb} alt="Trash preview" loading="lazy" className={`w-full ${viewMode === 'square' ? 'h-full object-cover' : 'h-auto object-contain'} opacity-70`} />
                                                    
                                                    {img.width * img.height < 1048576 && (
                                                        <div className="absolute top-2 right-2 z-30 group/alert">
                                                            <div className="p-1.5 bg-yellow-500 text-white rounded-lg shadow-md cursor-help">
                                                                <AlertTriangle size={16} strokeWidth={2.5} />
                                                            </div>
                                                            <div className="absolute right-0 top-full mt-2 w-64 p-2.5 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover/alert:opacity-100 group-hover/alert:visible transition-all duration-200 pointer-events-none whitespace-pre-line border border-gray-700">
                                                                {`${t.minQualityWarning}\n${t.imageQualityLabel}: ${img.width}x${img.height} (${(img.width * img.height / 1000000).toFixed(2)} MP)`}
                                                            </div>
                                                        </div>
                                                    )}
                                                    
                                                    <button onClick={() => handleRestore(img.id)} className="absolute top-2 left-2 p-1.5 bg-black/50 hover:bg-green-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all z-20" title={t.restore}><RefreshCw size={14} /></button>
                                                    <button onClick={() => {
                                                        setConfirmDialog({
                                                            isOpen: true,
                                                            title: t.deletePermanently,
                                                            message: t.confirmDelete,
                                                            onConfirm: () => {
                                                                handleDeletePermanently(img.id);
                                                                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                                                            },
                                                            onCancel: () => setConfirmDialog(prev => ({ ...prev, isOpen: false }))
                                                        });
                                                    }} className={`absolute top-2 ${img.width * img.height < 1048576 ? 'right-10' : 'right-2'} p-1.5 bg-black/50 hover:bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all z-20`} title={t.deletePermanently}><X size={14} /></button>
                                                </div>
                                                <div className={`p-3 flex-1 flex flex-col ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                                                    <div className={`flex-1 rounded-xl border p-1 ${isDarkMode ? 'bg-gray-900/30 border-gray-700/50' : 'bg-gray-50 border-gray-100'}`}>
                                                        <TagInput tags={img.tags} setTags={() => {}} placeholder="" maxHeight={viewMode === 'original' ? 'flex-1 h-full max-h-none' : 'max-h-[180px]'} readOnly={true} isDarkMode={isDarkMode} />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {selectedImageId && (
                <Lightbox
                    globalTriggers={globalTriggers}
                    image={displayedImages.find(img => img.id === selectedImageId)}
                    onClose={() => setSelectedImageId(null)}
                    updateTags={updateImageTags}
                    allTags={allUniqueTags}
                    addProjectTag={(tag: string) => setCustomProjectTags(prev => prev.includes(tag) ? prev : [...prev, tag])}
                    t={t}
                    onNext={handleNext}
                    onPrev={handlePrev}
                    hasNext={(displayedImages.length - 1) > currentIndex}
                    hasPrev={currentIndex > 0}
                    slideDirection={slideDirection}
                    showNotification={showNotification}
                    updateOriginalTags={updateOriginalTags}
                    dirHandle={dirHandle}
                    isDarkMode={isDarkMode}
                    onMoveToTrash={handleTrashFromLightbox}
                    imageIndex={currentIndex}
                    imageCount={displayedImages.length}
                    copiedTags={copiedTags}
                    onCopyTags={(tags: string[]) => { setCopiedTags([...tags]); showNotification(t.tagsCopiedNotif, 'success'); }}
                    lang={lang}
                    aiEnabled={aiEnabled}
                    aiBusy={isAIBusy}
                    onAITagSingle={handleAITagSingle}
                />
            )}

            <div className={`fixed inset-0 z-0 transition-colors duration-500 ${isDarkMode ? 'bg-gradient-to-br from-gray-900 via-purple-950 to-slate-900' : 'bg-gradient-to-br from-gray-100 via-indigo-50 to-white'}`}>
                <div className={`absolute inset-0 opacity-20 ${isDarkMode ? 'bg-[radial-gradient(circle_at_50%_50%,_rgba(255,255,255,0.2)_0%,_transparent_100%)]' : 'bg-[radial-gradient(circle_at_50%_50%,_rgba(0,0,0,0.05)_0%,_transparent_100%)]'}`}></div>
            </div>

            {/* ITALIANO: Rientro UGUALE su tutti i lati (p-4/p-6) e nessun tetto di larghezza,
                          così su schermi larghi la finestra interna non lascia grandi fasce ai lati.
                ENGLISH: EQUAL inset on every side (p-4/p-6) and no width cap, so on wide screens
                         the inner window doesn't leave big empty bands left and right. */}
            <div className="relative z-10 w-full p-4 md:p-6 mx-auto h-full">
                <div className={`${isDarkMode ? 'bg-gray-900/70 border-gray-700/50' : 'bg-white/80 border-gray-200'} backdrop-blur-xl border shadow-2xl rounded-3xl overflow-hidden transition-all duration-500 flex flex-col relative h-full max-h-[calc(100vh-2rem)] md:max-h-[calc(100vh-3rem)]`}>
                    
                    <div className={`border-b ${isDarkMode ? 'border-gray-800/50 bg-black/20' : 'border-gray-200 bg-gray-50/50'} p-4 md:p-5 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 z-20`}>
                        <div className="flex-1 flex justify-start w-full md:w-auto">
                        </div>
                        <div className="flex-1 flex justify-center items-center gap-3 w-full md:w-auto">
                            <div className="hidden sm:block relative">
                                <img src="./logo.png" alt="Logo" className="w-12 h-12 object-contain drop-shadow-md" onError={(e) => { e.currentTarget.src = './icon.png'; e.currentTarget.onerror = (e2) => { const target = (e2 as Event).currentTarget as HTMLImageElement | null; if (target) target.style.display = 'none'; const fallback = document.getElementById('fallback-header-logo'); if (fallback) fallback.classList.remove('hidden'); } }} />
                                <div id="fallback-header-logo" className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-md hidden"><Tag className="text-white" size={20} /></div>
                            </div>
                            <h1 className={`text-lg md:text-xl font-bold bg-clip-text text-transparent ${isDarkMode ? 'bg-gradient-to-r from-white to-gray-300' : 'bg-gradient-to-r from-gray-900 to-gray-600'} whitespace-nowrap`}>{t.appTitle}</h1>
                        </div>
                        <div className="flex-1 flex justify-end w-full md:w-auto gap-2">
                            <button onClick={() => setIsTrashOpen(true)} className={`flex items-center gap-2 p-2 md:px-3 md:py-2 rounded-xl ${isDarkMode ? 'bg-gray-800/50 hover:bg-gray-700 border-gray-700/50 text-gray-300' : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-600'} border shadow-sm transition-colors focus:outline-none`}>
                                <span className="font-semibold text-sm hidden sm:inline-block">{t.trash}</span>
                                <div className="relative">
                                    <Trash2 size={20} />
                                    {trashedImages.length > 0 && (
                                        <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                                            {trashedImages.length}
                                        </span>
                                    )}
                                </div>
                            </button>
                            <div className="relative" ref={settingsRef}>
                                <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className={`flex items-center gap-2 p-2 md:px-3 md:py-2 rounded-xl ${isDarkMode ? 'bg-gray-800/50 hover:bg-gray-700 border-gray-700/50 text-gray-300' : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-600'} border shadow-sm transition-colors focus:outline-none`}><span className="font-semibold text-sm hidden sm:inline-block">{t.settings}</span><Settings size={20} className={isSettingsOpen ? "rotate-45 transition-transform duration-300" : "transition-transform duration-300"} /></button>
                                
                                {isSettingsOpen && <div className={`absolute right-0 mt-2 w-80 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-2xl shadow-xl border p-4 z-50 animate-in fade-in slide-in-from-top-2`}>
                                    <h3 className={`text-xs font-semibold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} uppercase mb-4 tracking-wider`}>{t.settings}</h3>
                                    <div className="flex flex-col gap-4">
                                        <div className="flex items-center justify-between">
                                            <div className={`flex items-center gap-2 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} font-medium`}>{soundEnabled ? <Volume2 size={16} className="text-indigo-500"/> : <VolumeX size={16} className={isDarkMode ? 'text-gray-400' : 'text-gray-400'}/>} {t.uiSounds}</div>
                                            <AppleToggle checked={soundEnabled} onChange={setSoundEnabled} colorClass="bg-indigo-500" />
                                        </div>
                                        <div className={`w-full h-px ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}></div>
                                        <div className="flex items-center justify-between">
                                            <div className={`flex items-center gap-2 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} font-medium`}>{isDarkMode ? <Moon size={16} className="text-purple-400"/> : <Sun size={16} className="text-amber-500"/>} {t.theme}</div>
                                            <AppleToggle checked={isDarkMode} onChange={setIsDarkMode} colorClass="bg-indigo-500" iconOn={<Moon size={10}/>} iconOff={<Sun size={10}/>} />
                                        </div>
                                        <div className={`w-full h-px ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}></div>
                                        <button
                                            onClick={() => { setIsSettingsOpen(false); setIsStatsOpen(true); }}
                                            className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${isDarkMode ? 'bg-indigo-900/30 text-indigo-400 hover:bg-indigo-900/50' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                                        >
                                            <LayoutGrid size={16} />
                                            {t.projectStats}
                                        </button>
                                        <div className={`w-full h-px ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}></div>
                                        {/* ITALIANO: Sezione strumenti AI cloud (Gemini) */}
                                        {/* ENGLISH: Cloud AI tools section (Gemini) */}
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center justify-between">
                                                <div className={`flex items-center gap-2 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} font-medium`}>
                                                    <Sparkles size={16} className="text-purple-500"/>
                                                    {t.aiSettings || 'AI Tools'}
                                                    {/* ITALIANO: Badge che segnala la funzione AI come sperimentale (beta) — ENGLISH: Badge marking the AI feature as experimental (beta) */}
                                                    <span
                                                        title={t.aiBetaHint || 'Experimental feature — may change or give imperfect results.'}
                                                        className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider leading-none ${isDarkMode ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30' : 'bg-amber-100 text-amber-700 ring-1 ring-amber-200'}`}
                                                    >
                                                        {t.aiBeta || 'Beta'}
                                                    </span>
                                                </div>
                                                <AppleToggle checked={aiEnabled} onChange={(v: boolean) => { setAiEnabled(v); if (v && !geminiApiKey) setIsApiKeyDialogOpen(true); }} colorClass="bg-purple-500" />
                                            </div>
                                            {aiEnabled && (
                                                <div className={`flex flex-col gap-2 p-2 rounded-lg text-[10px] ${isDarkMode ? 'bg-gray-900/60 text-gray-400' : 'bg-purple-50/50 text-gray-600'}`}>
                                                    <p className="leading-relaxed">{t.aiCloudInfo || ''}</p>
                                                    <div className="flex flex-col gap-1">
                                                        <label className="font-medium text-[11px]">{t.aiKeyLabel || 'API Key Gemini'}</label>
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => setIsApiKeyDialogOpen(true)}
                                                                className={`flex-1 flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-md text-[10px] font-mono transition-colors border ${isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                                                            >
                                                                <span className="truncate">{geminiApiKey ? `${'•'.repeat(8)}${geminiApiKey.slice(-4)}` : (t.aiKeyMissing || 'Click to enter your key')}</span>
                                                                <KeyRound size={11} className="shrink-0" />
                                                            </button>
                                                            {geminiApiKey && (
                                                                <button
                                                                    onClick={() => {
                                                                        setConfirmDialog({
                                                                            isOpen: true,
                                                                            title: t.aiKeyClearTitle || 'Cancella API Key',
                                                                            message: t.aiKeyClearMsg || 'Vuoi davvero rimuovere la API key salvata?',
                                                                            onConfirm: async () => {
                                                                                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                                                                                await handleClearApiKey();
                                                                            },
                                                                            onCancel: () => setConfirmDialog(prev => ({ ...prev, isOpen: false })),
                                                                        });
                                                                    }}
                                                                    className={`p-1.5 rounded-md transition-colors ${isDarkMode ? 'text-red-400 hover:bg-red-900/40' : 'text-red-500 hover:bg-red-50'}`}
                                                                    title={t.aiKeyClear || 'Rimuovi'}
                                                                >
                                                                    <X size={11} />
                                                                </button>
                                                            )}
                                                        </div>
                                                        {/* ITALIANO: Pulsante guida espandibile */}
                                                        {/* ENGLISH: Expandable guide button */}
                                                        <button
                                                            onClick={() => setIsApiKeyGuideOpen(v => !v)}
                                                            className={`mt-1 flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-md text-[10px] font-bold transition-colors ${isDarkMode ? 'bg-indigo-900/30 text-indigo-300 hover:bg-indigo-900/50' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}
                                                        >
                                                            <span className="flex items-center gap-1.5">
                                                                <BookOpen size={11} />
                                                                {t.aiKeyGuideToggle || 'Come ottenere una API key'}
                                                            </span>
                                                            {isApiKeyGuideOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                                        </button>
                                                        {isApiKeyGuideOpen && (
                                                            <div className={`mt-1 p-3 rounded-md text-[10.5px] leading-relaxed flex flex-col gap-2 ${isDarkMode ? 'bg-gray-900/80 text-gray-300 border border-gray-700' : 'bg-white text-gray-700 border border-gray-200'}`}>
                                                                <p className="font-bold text-[11px]">{t.aiKeyGuideIntro || 'La key è gratis. Servono ~30 secondi:'}</p>
                                                                <ol className="list-decimal pl-4 space-y-2">
                                                                    <li>
                                                                        <span className="font-medium">{t.aiKeyGuideStep1Title || 'Apri Google AI Studio'}</span>
                                                                        <p className="opacity-80 mt-0.5">{t.aiKeyGuideStep1Desc || 'Clicca il link qui sotto, il sito si aprirà nel browser predefinito.'}</p>
                                                                        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 mt-1 px-2 py-1 rounded text-[10px] font-bold ${isDarkMode ? 'bg-indigo-700 text-white hover:bg-indigo-600' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                                                                            <ExternalLink size={10} /> aistudio.google.com/app/apikey
                                                                        </a>
                                                                    </li>
                                                                    <li>
                                                                        <span className="font-medium">{t.aiKeyGuideStep2Title || 'Accedi col tuo account Google'}</span>
                                                                        <p className="opacity-80 mt-0.5">{t.aiKeyGuideStep2Desc || 'Va bene un qualsiasi account Gmail (anche personale). Accetta i termini se richiesto.'}</p>
                                                                    </li>
                                                                    <li>
                                                                        <span className="font-medium">{t.aiKeyGuideStep3Title || 'Clicca "Create API key" o "Get API key"'}</span>
                                                                        <p className="opacity-80 mt-0.5">{t.aiKeyGuideStep3Desc || "Il pulsante blu in alto a destra. Se chiede di scegliere un progetto, lascia quello suggerito di default."}</p>
                                                                    </li>
                                                                    <li>
                                                                        <span className="font-medium">{t.aiKeyGuideStep4Title || 'Copia la stringa generata'}</span>
                                                                        <p className="opacity-80 mt-0.5">{t.aiKeyGuideStep4Desc || 'Inizia con "AIza..." ed è lunga 39 caratteri. Usa l\'icona di copia accanto alla key.'}</p>
                                                                    </li>
                                                                    <li>
                                                                        <span className="font-medium">{t.aiKeyGuideStep5Title || 'Incollala qui'}</span>
                                                                        <p className="opacity-80 mt-0.5">{t.aiKeyGuideStep5Desc || 'Clicca il campo "API Key Gemini" sopra, incolla, conferma. L\'app la verifica e la salva cifrata.'}</p>
                                                                    </li>
                                                                </ol>
                                                                <div className={`mt-1 p-2 rounded text-[10px] flex items-start gap-1.5 ${isDarkMode ? 'bg-emerald-900/30 text-emerald-300 border border-emerald-800/50' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                                                                    <Check size={11} className="shrink-0 mt-0.5" />
                                                                    <span><strong>{t.aiKeyGuideFreeTitle || 'È gratis'}</strong> — {t.aiKeyGuideFreeBody || 'Il free tier copre ~15 richieste/minuto, sufficiente per dataset fino a centinaia di foto.'}</span>
                                                                </div>
                                                                <div className={`p-2 rounded text-[10px] flex items-start gap-1.5 ${isDarkMode ? 'bg-amber-900/30 text-amber-300 border border-amber-800/50' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                                                    <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                                                                    <span><strong>{t.aiKeyGuideRecoverTitle || 'L\'hai persa?'}</strong> {t.aiKeyGuideRecoverBody || 'Apri di nuovo aistudio.google.com/app/apikey: troverai tutte le tue key (puoi crearne di nuove o eliminare le vecchie).'}</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <label className="font-medium text-[11px]">{t.aiModelLabel || 'Modello'}</label>
                                                        <select
                                                            value={aiModel}
                                                            onChange={(e) => setAiModel(e.target.value)}
                                                            className={`w-full text-[11px] rounded-md border px-2 py-1.5 outline-none focus:ring-2 focus:ring-purple-500 ${isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-300 text-gray-800'}`}
                                                        >
                                                            {GEMINI_MODELS.map(m => {
                                                                const tierBadge = m.tier === 'free' ? ' ✓' : m.tier === 'limited' ? ' ◐' : ' $';
                                                                return (
                                                                    <option key={m.id} value={m.id}>
                                                                        {m.label}{tierBadge}{m.recommended ? ' ★' : ''}
                                                                    </option>
                                                                );
                                                            })}
                                                        </select>
                                                        {getModelTier(aiModel) === 'limited' && (
                                                            <div className={`text-[10px] rounded-md px-2 py-1.5 mt-1 flex items-start gap-1.5 ${isDarkMode ? 'bg-blue-900/30 text-blue-300 border border-blue-800/50' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                                                                <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                                                                <span>{t.aiModelLimitedWarning || 'Free tier limitato (rate limit più bassi). Per uso intenso serve billing attivo.'}</span>
                                                            </div>
                                                        )}
                                                        {getModelTier(aiModel) === 'paid' && (
                                                            <div className={`text-[10px] rounded-md px-2 py-1.5 mt-1 flex items-start gap-1.5 ${isDarkMode ? 'bg-amber-900/30 text-amber-300 border border-amber-800/50' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                                                <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                                                                <span>{t.aiModelPaidWarning || 'Questo modello richiede billing attivo sul tuo progetto Google Cloud (no free tier).'}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <label className="flex items-center justify-between font-medium text-[11px]">
                                                            <span>{t.aiMaxTags || 'Max tags'}</span>
                                                            <span className="font-bold tabular-nums">{aiMaxTags}</span>
                                                        </label>
                                                        <input
                                                            type="range"
                                                            min={1} max={80} step={1}
                                                            value={aiMaxTags}
                                                            onChange={(e) => setAiMaxTags(parseInt(e.target.value, 10))}
                                                            className="w-full h-1.5 bg-gray-300 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <label className="flex items-center justify-between font-medium text-[11px]">
                                                            <span>{t.aiRpmLabel || 'Velocità (req/min)'}</span>
                                                            <span className="font-bold tabular-nums">{aiRpm}</span>
                                                        </label>
                                                        <input
                                                            type="range"
                                                            min={5} max={60} step={1}
                                                            value={aiRpm}
                                                            onChange={(e) => setAiRpm(parseInt(e.target.value, 10))}
                                                            className="w-full h-1.5 bg-gray-300 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                                        />
                                                        <p className="text-[9px] italic opacity-80">{t.aiRpmHint || 'Free tier: max 15. Più alto = più veloce ma rischio rate-limit.'}</p>
                                                    </div>
                                                    <div className={`flex items-start justify-between gap-3 px-2 py-1.5 rounded-md ${isDarkMode ? 'bg-gray-800/50' : 'bg-gray-100/70'}`}>
                                                        <div className="flex flex-col gap-0.5 min-w-0">
                                                            <span className="font-medium text-[11px]">{t.aiSkipTagged || 'Salta foto già taggate'}</span>
                                                            <span className="text-[9px] italic opacity-75 leading-snug">{t.aiSkipTaggedHint || 'Se attivo, le immagini che hanno già almeno un tag vengono saltate durante "Tagga tutte con AI".'}</span>
                                                        </div>
                                                        <AppleToggle checked={aiSkipTagged} onChange={(v: boolean) => setAiSkipTagged(v)} colorClass="bg-purple-500" />
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <label className="font-medium text-[11px]">{t.aiCustomPromptLabel || 'Prompt personalizzato (opzionale)'}</label>
                                                        <textarea
                                                            value={aiCustomPrompt}
                                                            onChange={(e) => setAiCustomPrompt(e.target.value)}
                                                            maxLength={500}
                                                            placeholder={t.aiCustomPromptPlaceholder || "Es. focalizzati su vestiti e ambientazione, niente NSFW…"}
                                                            className={`w-full text-[11px] rounded-md border px-2 py-1.5 outline-none focus:ring-2 focus:ring-purple-500 min-h-[60px] resize-none ${isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-200 placeholder-gray-600' : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400'}`}
                                                        />
                                                    </div>
                                                    <p className={`text-[9px] italic mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                                                        ✓ free · ◐ limitato · $ pagamento · ★ consigliato
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                        <div className={`w-full h-px ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}></div>
                                        <div className="flex items-center justify-between">
                                            <div className={`flex items-center gap-2 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} font-medium`}>
                                                <Globe size={16} className="text-blue-500"/>
                                                {t.language}
                                            </div>
                                            <div className="relative group">
                                                <div className={`flex items-center gap-2 px-2 py-1 rounded-lg border cursor-pointer ${isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                                                    <img src={`https://flagcdn.com/w40/${lang === 'en' ? 'gb' : lang === 'zh' ? 'cn' : lang === 'ja' ? 'jp' : lang === 'pt' ? 'br' : lang}.png`} alt={lang} className="w-5 h-5 rounded-full object-cover" />
                                                    <span className="text-xs font-medium uppercase">{lang}</span>
                                                </div>
                                                <div className={`absolute right-0 top-full mt-1 w-36 py-1 rounded-xl border shadow-xl overflow-hidden z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                                                    {APP_LANGUAGES.map((l) => (
                                                        <div 
                                                            key={l.code} 
                                                            onClick={() => setLang(l.code)}
                                                            className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${lang === l.code ? (isDarkMode ? 'bg-indigo-900/30 text-indigo-400' : 'bg-indigo-50 text-indigo-600') : (isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-50 text-gray-700')}`}
                                                        >
                                                            <img src={`https://flagcdn.com/w40/${l.flag}.png`} alt={l.label} className="w-5 h-5 rounded-full object-cover shadow-sm" />
                                                            <span className="text-xs font-medium">{l.label}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`w-full h-px ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'} my-1`}></div>
                                        <div className="flex flex-col items-center gap-1">
                                            <span className={`text-[10px] ${isDarkMode ? 'text-gray-500' : 'text-gray-400'} font-semibold tracking-widest uppercase`}>{t.versionLabel} {appVersion}</span>
                                            <span className={`text-[9px] ${isDarkMode ? 'text-gray-600' : 'text-gray-400'} font-medium italic`}>{t.copyrightLabel} xXIlRizzoXx</span>
                                        </div>
                                    </div>
                                </div>}
                            </div>
                        </div>
                    </div>

                    <div className={`transition-all duration-500 ease-in-out overflow-hidden flex justify-center shrink-0 ${isDarkMode ? 'bg-gray-800/20 border-gray-800/50' : 'bg-gray-100/50 border-gray-200'} ${isImporting ? 'max-h-32 opacity-100 border-b' : 'max-h-0 opacity-0'}`}>
                        <div className="w-full max-w-4xl p-4">
                            <div className={`p-4 rounded-2xl flex items-center gap-4 shadow-inner border ${isDarkMode ? 'bg-indigo-900/30 border-indigo-700/50' : 'bg-white border-indigo-200'}`}>
                                <div className="w-6 h-6 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin shrink-0"></div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-center mb-1.5">
                                        <span className={`text-sm font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>{importProgress === 100 ? t.completed : t.processingFiles}</span>
                                        <span className="text-sm font-bold text-indigo-500">{importProgress}%</span>
                                    </div>
                                    <div className={`w-full rounded-full h-2 overflow-hidden shadow-sm ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                                        <div className="bg-indigo-500 h-full rounded-full transition-all duration-200" style={{width: `${importProgress}%`}}></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={`p-4 md:p-5 flex flex-col lg:flex-row lg:items-center gap-6 border-b ${isDarkMode ? 'border-gray-800/50 bg-gray-800/20' : 'border-gray-200 bg-gray-100/30'} shrink-0`}>
                        
                        <div className={`w-full lg:w-[300px] flex flex-col gap-3 shrink-0 ${isDarkMode ? 'bg-gray-900/50 border-gray-700/50' : 'bg-white border-gray-200'} p-4 rounded-2xl border shadow-inner`}>
                            <button onClick={handleLoadFolderClick} className={`w-full h-[42px] flex justify-center items-center gap-2 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-md font-semibold transition-all active:scale-95 whitespace-nowrap text-sm`}>
                                <Folder size={16} />
                                <span>{t.loadFolder}</span>
                            </button>
                            {/* ITALIANO: Carica singole immagini (con eventuali .txt) invece della cartella intera */}
                            {/* ENGLISH: Load individual images (with optional .txt) instead of the whole folder */}
                            <button onClick={() => imagesInputRef.current?.click()} className={`w-full h-[42px] flex justify-center items-center gap-2 px-4 ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-100' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'} rounded-xl shadow-md font-semibold transition-all active:scale-95 whitespace-nowrap text-sm`}>
                                <ImageIcon size={16} />
                                <span>{t.loadImages}</span>
                            </button>
                            {/* ITALIANO: Chiude il progetto attuale (foto + tag), come app appena aperta — arancione */}
                            {/* ENGLISH: Closes the current project (photos + tags), like a freshly opened app — orange */}
                            <button onClick={handleCloseProject} disabled={images.length === 0} className={`w-full h-[42px] flex justify-center items-center gap-2 px-4 rounded-xl shadow-md font-semibold transition-all active:scale-95 whitespace-nowrap text-sm ${images.length === 0 ? (isDarkMode ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed') : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white'}`} title={t.closeAllImages}>
                                <X size={16} />
                                <span>{t.closeAllImages}</span>
                            </button>
                            <button onClick={handleResetProject} className={`w-full h-[42px] flex justify-center items-center gap-2 px-4 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white rounded-xl shadow-md font-semibold transition-all active:scale-95 whitespace-nowrap text-sm`}>
                                <Trash size={16} />
                                <span>{t.resetProject}</span>
                            </button>
                        </div>
                        
                        <div className="flex-1 w-full flex flex-col justify-center relative min-w-0 pt-1">
                            {/* ITALIANO: Input per le trigger words globali */}
                            {/* ENGLISH: Input for global trigger words */}
                            {/* ITALIANO: stessa larghezza (600px, centrato) del riquadro "Tag Suggeriti" qui sotto */}
                            {/* ENGLISH: same width (600px, centered) as the "Suggested Tags" box below */}
                            <div className="w-[600px] max-w-full mx-auto">
                                <TagInput tags={globalTriggers} setTags={handleGlobalTagsChange} placeholder={t.globalTriggersPlaceholder} isGlobal={true} maxHeight="max-h-[140px]" isDarkMode={isDarkMode} />
                            </div>
                            
                            {/* ITALIANO: Toolbar Tag Suggeriti + Auto-Tag AI (se abilitato) */}
                            {/* ENGLISH: Toolbar with Suggested Tags + AI Auto-Tag (if enabled) */}
                            <div className={`mt-3 p-2 rounded-xl border ${isDarkMode ? 'bg-gray-900/50 border-gray-700/50' : 'bg-white border-gray-200'} flex flex-col gap-2 w-[600px] max-w-full mx-auto`}>
                                <div className="flex items-center justify-center gap-3 flex-wrap">
                                    {aiEnabled && (
                                        <button
                                            onClick={handleAITagAll}
                                            disabled={isGlobalAITagging || images.length === 0}
                                            className={`flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${isGlobalAITagging || images.length === 0 ? (isDarkMode ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed') : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-md active:scale-95'}`}
                                        >
                                            {isGlobalAITagging ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                                            {isGlobalAITagging ? `${globalAIProgress.done}/${globalAIProgress.total}` : (t.aiAutoTagAll || 'Auto-tag all with AI')}
                                        </button>
                                    )}
                                    {aiEnabled && isGlobalAITagging && (
                                        <button
                                            onClick={handleCancelAITagging}
                                            disabled={aiCancelRequested}
                                            title={t.aiCancel || t.cancel || 'Cancel'}
                                            className={`flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${aiCancelRequested ? (isDarkMode ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed') : 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-md active:scale-95'}`}
                                        >
                                            <X size={14} />
                                            {aiCancelRequested ? (t.aiCancelling || 'Cancelling…') : (t.aiCancel || t.cancel || 'Cancel')}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setIsTagSuggestionsOpen(!isTagSuggestionsOpen)}
                                        className={`flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white shadow-md active:scale-95`}
                                    >
                                        <Tags size={14} />
                                        {t.suggestedTags}
                                    </button>
                                </div>
                                {isGlobalAITagging && (() => {
                                    const errSuffix = globalAIProgress.errors > 0 ? ` · ✗ ${globalAIProgress.errors}` : '';
                                    const skipSuffix = globalAIProgress.skipped > 0 ? ` · ⊘ ${globalAIProgress.skipped}` : '';
                                    const label = `${t.aiTaggingInProgress || 'Tagging…'} ${globalAIProgress.done}/${globalAIProgress.total}${errSuffix}${skipSuffix}`;
                                    const pct = globalAIProgress.total > 0 ? Math.round((globalAIProgress.done / globalAIProgress.total) * 100) : 0;
                                    return (
                                        <div className="w-full flex flex-col gap-1 px-2 pb-1">
                                            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                                                <span className={isDarkMode ? 'text-purple-400' : 'text-purple-600'}>{label}</span>
                                                <span className={isDarkMode ? 'text-purple-400' : 'text-purple-600'}>{pct}%</span>
                                            </div>
                                            <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
                                                <div
                                                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                        
                        <div className={`w-full lg:w-[420px] flex flex-col gap-3 shrink-0 ${isDarkMode ? 'bg-gray-900/50 border-gray-700/50' : 'bg-white border-gray-200'} p-4 rounded-2xl border shadow-inner`}>
                            <div className="flex gap-2">
                                {/* ITALIANO: Pulsante per visualizzare tutti i tag del progetto */}
                                {/* ENGLISH: Button to view all project tags */}
                                <button
                                    onClick={() => setIsGlobalTagManagerOpen(true)}
                                    className="w-full h-[42px] flex justify-center items-center gap-2 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 text-white rounded-xl shadow-md font-semibold transition-all active:scale-95 whitespace-nowrap text-sm"
                                >
                                    <Tag size={16} />
                                    <span>{t.allTagsButton}</span>
                                </button>
                            </div>
                            {/* ITALIANO: Statistiche del progetto — sulla pagina principale, sotto "Visualizza tutti i tag" */}
                            {/* ENGLISH: Project statistics — on the main page, below "View all project tags" */}
                            <button onClick={() => { setIsStatsOpen(true); soundManager.pop(); }} disabled={images.length === 0} className={`w-full h-[42px] flex justify-center items-center gap-2 px-4 rounded-xl shadow-md font-semibold transition-all active:scale-95 whitespace-nowrap text-sm ${images.length === 0 ? (isDarkMode ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed') : 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white'}`} title={t.projectStats}>
                                <BarChart3 size={16} />
                                <span>{t.projectStats}</span>
                            </button>
                            <div className="w-full flex flex-col gap-1.5">
                                <div className="w-full flex gap-3 items-start">
                                    {/* ITALIANO: Pulsante Salva Modifiche */}
                                    {/* ENGLISH: Save Changes button */}
                                    <button onClick={handleSaveChanges} disabled={images.length === 0} className="flex-1 h-[42px] flex justify-center items-center gap-2 px-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-400 text-white rounded-xl shadow-md font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm">
                                        <Save size={16} />
                                        <span className="hidden sm:inline">{t.saveChanges}</span>
                                        <span className="sm:hidden">{t.saveShort}</span>
                                    </button>
                                    
                                    {/* ITALIANO: Sezione Esporta con opzione ZIP sotto */}
                                    {/* ENGLISH: Export section with ZIP option below */}
                                    <div className="flex-1 flex flex-col gap-2">
                                        <button onClick={handleExportAll} disabled={images.length === 0} className="w-full h-[42px] flex justify-center items-center gap-2 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-400 text-white rounded-xl shadow-md font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm">
                                            <SaveAll size={16} />
                                            <span className="hidden sm:inline">{t.exportAllTxt}</span>
                                            <span className="sm:hidden">{t.exportShort}</span>
                                        </button>
                                        <div className="flex items-center justify-end gap-2 px-1">
                                            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{t.exportAsZip}</span>
                                            <AppleToggle checked={saveAsZip} onChange={setSaveAsZip} colorClass="bg-indigo-500" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={`px-6 py-2.5 ${isDarkMode ? 'bg-gray-800/40 border-gray-800/50' : 'bg-gray-50 border-gray-200'} border-b flex justify-between items-center shrink-0`}>
                        <div className={`flex-1 flex items-center gap-3 text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            <div className="flex items-center gap-2"><ImageIcon size={16} /><span>{images.length} {images.length === 1 ? t.imgOpenedSingle : t.imgOpenedPlural}</span></div>
                            {/* ITALIANO: Seleziona / deseleziona tutte le foto visibili */}
                            {/* ENGLISH: Select / deselect all visible photos */}
                            {displayedImages.length > 0 && (() => {
                                const allSelected = displayedImages.every(img => selectedForBulk.includes(img.id));
                                return (
                                    <button onClick={toggleSelectAll} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${allSelected ? 'bg-indigo-500 border-indigo-500 text-white' : (isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50')}`}>
                                        <Check size={13} />
                                        {allSelected ? (t.deselectAll || 'Deseleziona tutte') : (t.selectAll || 'Seleziona tutte')}
                                    </button>
                                );
                            })()}
                        </div>
                        <div className="flex-1 flex justify-center">
                            <div className={`flex items-center ${isDarkMode ? 'bg-gray-900' : 'bg-gray-100'} p-1 rounded-lg shadow-inner`}>
                                <button onClick={() => setViewMode('square')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'square' ? (isDarkMode ? 'bg-gray-700 text-indigo-400 shadow-sm' : 'bg-white text-indigo-600 shadow-sm') : (isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')}`}><LayoutGrid size={14} /> {t.square}</button>
                                <button onClick={() => setViewMode('original')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'original' ? (isDarkMode ? 'bg-gray-700 text-indigo-400 shadow-sm' : 'bg-white text-indigo-600 shadow-sm') : (isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')}`}><Grid3X3 size={14} /> {t.original}</button>
                            </div>
                        </div>
                        <div className="flex-1 flex items-center justify-end gap-3">
                            <div className="flex items-center gap-2">
                                <span className={`text-[10px] uppercase font-bold tracking-wider ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>{t.sortBy}:</span>
                                <select 
                                    value={sortOrder} 
                                    onChange={(e) => setSortOrder(e.target.value as any)}
                                    className={`text-xs font-semibold px-2 py-1.5 rounded-lg outline-none transition-all cursor-pointer ${isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'} border shadow-sm`}
                                >
                                    <option value="name-asc">{t.sortNameAsc}</option>
                                    <option value="name-desc">{t.sortNameDesc}</option>
                                    <option value="date-desc">{t.sortDateDesc}</option>
                                    <option value="date-asc">{t.sortDateAsc}</option>
                                </select>
                            </div>
                            <span className={`hidden sm:inline-block text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} uppercase tracking-wide`}>{t.zoom}</span>
                            <div className={`flex items-center gap-2 ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-gray-100 border-gray-200'} px-3 py-1 rounded-full border shadow-inner`}>
                                <ZoomOut size={14} className="text-gray-400" />
                                <input type="range" min="150" max="500" step="10" value={imageWidth} onChange={(e) => setImageWidth(Number(e.target.value))} className="w-20 md:w-32 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                                <ZoomIn size={14} className="text-gray-400" />
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-row overflow-hidden relative">
                        <div className={`p-4 md:p-6 ${isDarkMode ? 'bg-black/20' : 'bg-gray-200/40'} flex-1 overflow-y-auto min-h-0 relative`}>
                            {images.length === 0 ? <div className={`flex flex-col items-center justify-center h-full ${isDarkMode ? 'opacity-60' : 'opacity-100'}`}><ImageIcon size={64} className={`${isDarkMode ? 'text-gray-600' : 'text-gray-400'} mb-4`} /><p className={`text-lg font-bold ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>{t.noImagesTitle}</p><p className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-600'} mt-2 font-bold`}>{t.noImagesDesc}</p></div> : 
                            <div className={`grid gap-4 md:gap-6 transition-all duration-300 items-start relative z-0 ${selectedForBulk.length > 0 ? 'pb-[35vh]' : 'pb-2'}`} style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${imageWidth}px, 1fr))` }}>
                                {displayedImages.map((img) => (
                                <div key={img.id} className={`group ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all border flex flex-col h-full ${selectedForBulk.includes(img.id) ? 'border-indigo-500 ring-2 ring-indigo-500/50' : ''}`}>
                                    <div className={`relative ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} overflow-hidden shrink-0 flex justify-center items-center cursor-pointer ${viewMode === 'square' ? 'aspect-square' : ''}`} style={viewMode === 'original' ? { height: 'auto', minHeight: '120px' } : {}} onClick={() => setSelectedImageId(img.id)}>
                                        <img src={img.thumb} alt="Preview" loading="lazy" className={`w-full ${viewMode === 'square' ? 'h-full object-cover' : 'h-auto object-contain'} group-hover:scale-[1.02] transition-transform duration-500 ${selectedForBulk.includes(img.id) ? 'opacity-80' : ''}`} />
                                        
                                        {img.width * img.height < 1048576 && (
                                            <div className="absolute top-2 right-2 z-30 group/alert">
                                                <div className="p-1.5 bg-yellow-500 text-white rounded-lg shadow-md cursor-help">
                                                    <AlertTriangle size={16} strokeWidth={2.5} />
                                                </div>
                                                <div className="absolute right-0 top-full mt-2 w-64 p-2.5 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover/alert:opacity-100 group-hover/alert:visible transition-all duration-200 pointer-events-none whitespace-pre-line border border-gray-700">
                                                    {`${t.minQualityWarning}\n${t.imageQualityLabel}: ${img.width}x${img.height} (${(img.width * img.height / 1000000).toFixed(2)} MP)`}
                                                </div>
                                            </div>
                                        )}

                                        <div className="absolute top-2 left-2 z-20" onClick={(e) => { e.stopPropagation(); toggleImageSelection(img.id); }}><div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shadow-sm backdrop-blur-sm ${selectedForBulk.includes(img.id) ? 'bg-indigo-500 border-indigo-500' : 'bg-black/30 border-white/70 hover:bg-black/50'}`}>{selectedForBulk.includes(img.id) && <Check size={14} className="text-white" />}</div></div>
                                        <button onClick={(e) => { e.stopPropagation(); handleMoveToTrash(img.id); }} className={`absolute top-2 ${img.width * img.height < 1048576 ? 'right-10' : 'right-2'} p-1.5 bg-black/50 hover:bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all z-20`} title={t.moveToTrash}><Trash2 size={14} /></button>
                                        {/* ITALIANO: Contatore tag della singola foto */}
                                        {/* ENGLISH: Per-photo tag count */}
                                        <div className={`absolute bottom-2 left-2 z-20 flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold shadow-md backdrop-blur-sm ${(img.tags?.length || 0) > 0 ? 'bg-indigo-500/90 text-white' : 'bg-black/50 text-gray-300'}`} title={`${img.tags?.length || 0} ${t.tagCountLabel || 'tag'}`}>
                                            <Tag size={11} />{img.tags?.length || 0}
                                        </div>
                                    </div>
                                    <div className={`p-3 flex-1 flex flex-col ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                                        {/* ITALIANO: Area tag sotto l'anteprima, organizzata esteticamente */}
                                        {/* ENGLISH: Tag area under the preview, aesthetically organized */}
                                        <div className={`flex-1 rounded-xl border p-1 ${isDarkMode ? 'bg-gray-900/30 border-gray-700/50' : 'bg-gray-50 border-gray-100'}`}>
                                            <TagInput tags={img.tags} setTags={(newTags: string[]) => updateImageTags(img.id, newTags)} placeholder={t.addTag} maxHeight={viewMode === 'original' ? 'flex-1 h-full max-h-none' : 'max-h-[180px]'} isDarkMode={isDarkMode} />
                                        </div>
                                    </div>
                                </div>
                                ))}
                            </div>}
                        </div>
                        <TagSuggestionsPanel 
                            isOpen={isTagSuggestionsOpen} 
                            onClose={() => setIsTagSuggestionsOpen(false)} 
                            onTagClick={handleSuggestedTagClick} 
                            lang={lang} 
                            isDarkMode={isDarkMode} 
                            t={t} 
                            selectedTags={stagedBulkTags}
                        />
                    </div>

                    {selectedForBulk.length > 0 && (
                        <div className="absolute bottom-6 left-0 right-0 mx-auto w-[90%] max-w-5xl bg-gray-900/95 backdrop-blur-xl border border-gray-700 p-4 z-[150] shadow-2xl animate-in slide-in-from-bottom-12 flex flex-col gap-3 max-h-[35vh] rounded-2xl ring-1 ring-black/5">
                            <div className="w-full flex flex-col gap-3 h-full">
                                <div className="flex justify-between items-center shrink-0"><div className="flex items-center gap-3"><div className="p-1.5 bg-indigo-900/50 rounded-lg text-indigo-400"><Grid3X3 size={18} /></div><div><h3 className="text-sm font-bold text-gray-200 leading-tight">{t.addTagsTo} {selectedForBulk.length} {selectedForBulk.length === 1 ? t.selectedImageSingle : t.selectedImagePlural}</h3><p className="text-[10px] text-gray-500 uppercase tracking-wide">{t.dashedPillsDesc}</p></div></div><button onClick={() => { setSelectedForBulk([]); setStagedBulkTags([]); }} className="p-1.5 rounded-full border border-gray-600 text-gray-400 hover:bg-red-500 hover:border-red-500 hover:text-white transition-all shadow-sm"><X size={14} /></button></div>
                                {/* ITALIANO: Scrivi un tag NUOVO e premi Invio: si aggiunge a quelli in preparazione
                                              e verra' applicato a tutte le foto selezionate (col tasto Conferma). */}
                                {/* ENGLISH: Type a NEW tag and press Enter: it joins the staged ones and gets
                                             applied to all selected photos (via the Confirm button). */}
                                <input
                                    type="text"
                                    placeholder={t.bulkAddPlaceholder}
                                    className="shrink-0 w-full bg-gray-800 border border-gray-600 text-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                    onKeyDown={(e: any) => {
                                        if (e.key === 'Enter' || e.key === ',') {
                                            e.preventDefault();
                                            const newTag = e.target.value.trim().replace(/,$/, '');
                                            if (newTag) {
                                                setStagedBulkTags(prev => prev.includes(newTag) ? prev : [...prev, newTag]);
                                                e.target.value = '';
                                                soundManager.pop();
                                            }
                                        }
                                    }}
                                />
                                <div className="flex-1 overflow-y-auto flex flex-wrap content-start gap-3.5 lightbox-scroll p-[10px] border-y border-gray-800" style={{ scrollbarGutter: 'stable' }}>
                                    {(() => {
                                        const displayTags = [...new Set([...allUniqueTags, ...stagedBulkTags])].sort((a, b) => a.localeCompare(b));
                                        return displayTags.length === 0 ? <p className="text-xs text-gray-500 italic py-2 w-full text-center">{t.noTagsInProject}</p> : displayTags.map(tag => {
                                            const category = getTagCategory(tag);
                                            const colorClass = getCategoryColor(category, isDarkMode);
                                            const activeColorClass = getActiveCategoryColor(category);
                                            const isStaged = stagedBulkTags.includes(tag);
                                            const isPartiallySelected = selectedForBulk.some(id => images.find(i => i.id === id)?.tags.includes(tag));
                                            
                                            let buttonClass = '';
                                            if (isStaged) {
                                                buttonClass = `${activeColorClass} scale-105 font-bold`;
                                            } else if (isPartiallySelected) {
                                                const textColorMatch = colorClass.match(/text-[a-z]+-\d+/);
                                                const textColor = textColorMatch ? textColorMatch[0] : (isDarkMode ? 'text-gray-300' : 'text-gray-600');
                                                const borderColor = textColor.replace('text-', 'border-');
                                                buttonClass = `bg-transparent border-2 border-dashed ${textColor} ${borderColor} hover:bg-gray-800/50 opacity-80`;
                                            } else {
                                                buttonClass = `${colorClass} border border-transparent hover:brightness-110 shadow-sm`;
                                            }
                                            
                                            return (
                                                <button key={tag} onClick={() => setStagedBulkTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])} className={`px-2.5 py-1 rounded-full text-xs transition-all flex items-center gap-1 ${buttonClass}`}>
                                                    {category === 'nsfw' && <span className={`font-bold text-[9px] px-1 rounded-sm ${isStaged ? 'bg-white text-red-500' : 'bg-red-500 text-white'}`}>+18</span>}
                                                    {tag}
                                                </button>
                                            );
                                        });
                                    })()}
                                </div>
                                <div className="flex justify-end gap-2 shrink-0 h-9 transition-all">
                                    {stagedBulkTags.length > 0 ? <div className="flex gap-2 animate-in slide-in-from-right-4"><button onClick={() => setStagedBulkTags([])} className="px-4 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold transition-colors text-xs">{t.cancel}</button><button onClick={applyBulkTags} className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-md shadow-indigo-500/20 transition-all active:scale-95 flex items-center gap-1.5 text-xs"><Check size={14} /> {t.confirm}</button></div> : <div className="text-xs text-gray-500 flex items-center italic pr-2">{t.selectTagToAdd}</div>}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {isGlobalTagManagerOpen && (
                <div className="fixed inset-0 z-[200] flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setIsGlobalTagManagerOpen(false)}>
                    <div className={`w-96 max-w-[90vw] h-full ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-2xl flex flex-col animate-in slide-in-from-right-4`} onClick={e => e.stopPropagation()}>
                        <div className={`p-5 border-b ${isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-100'} flex justify-between items-center shrink-0`}>
                            <h2 className={`text-lg font-bold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'} flex items-center gap-2`}><Tag size={20} className="text-indigo-500"/> {t.projectTagManager}</h2>
                            <button onClick={() => setIsGlobalTagManagerOpen(false)} className={`hover:bg-red-500 hover:text-white rounded-full p-1.5 transition-colors ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}><X size={16} /></button>
                        </div>
                        <div className={`p-4 border-b ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'} shrink-0 flex flex-col gap-3`}>
                             <input
                                type="text"
                                placeholder={t.addTagToProject}
                                onKeyDown={(e: any) => {
                                    if (e.key === 'Enter' || e.key === ',') {
                                        e.preventDefault();
                                        const newTag = e.target.value.trim().replace(/,$/, '');
                                        if (newTag && !allUniqueTags.includes(newTag)) {
                                            setCustomProjectTags(prev => [...prev, newTag]);
                                            e.target.value = '';
                                            soundManager.pop();
                                        }
                                    }
                                }}
                                className={`w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner ${isDarkMode ? 'bg-gray-900 border-gray-600 text-gray-100' : 'bg-gray-50 border-gray-300 text-gray-800'}`}
                            />
                            
                            <div className="flex gap-2">
                                <button 
                                    onClick={handleDeleteAllTags}
                                    disabled={allUniqueTags.length === 0}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-md border-0"
                                >
                                    <Trash size={14} />
                                    {t.deleteAllTags}
                                </button>
                                <button
                                    onClick={handleCleanUnusedTags}
                                    disabled={allUniqueTags.length === 0}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md border-0"
                                >
                                    <RefreshCw size={14} />
                                    {t.cleanUnusedTags}
                                </button>
                            </div>
                            {/* ITALIANO: Esporta i tag del progetto (JSON completo o TXT lista) e reimportali altrove */}
                            {/* ENGLISH: Export the project tags (full JSON or TXT list) and re-import them elsewhere */}
                            <div className="flex gap-2">
                                <button onClick={() => handleExportProjectTags('json')} disabled={allUniqueTags.length === 0} title={`${t.exportProjectTags} (JSON)`} className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed border ${isDarkMode ? 'bg-gray-900 border-gray-600 text-gray-200 hover:bg-gray-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'}`}>
                                    <Download size={14} /> JSON
                                </button>
                                <button onClick={() => handleExportProjectTags('txt')} disabled={allUniqueTags.length === 0} title={`${t.exportProjectTags} (TXT)`} className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed border ${isDarkMode ? 'bg-gray-900 border-gray-600 text-gray-200 hover:bg-gray-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'}`}>
                                    <Download size={14} /> TXT
                                </button>
                                <button onClick={() => projectTagsImportRef.current?.click()} title={t.importProjectTags} className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 border ${isDarkMode ? 'bg-indigo-900/40 border-indigo-700/60 text-indigo-300 hover:bg-indigo-900/60' : 'bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100'}`}>
                                    <Upload size={14} /> {t.importProjectTags}
                                </button>
                                <input type="file" accept=".json,.txt,application/json,text/plain" ref={projectTagsImportRef} className="hidden" onChange={handleImportProjectTags} />
                            </div>
                        </div>
                        <div className={`flex-1 p-4 overflow-y-auto flex flex-wrap content-start gap-3.5 lightbox-scroll ${isDarkMode ? 'bg-gray-900/50' : 'bg-gray-50'}`} style={{ scrollbarGutter: 'stable' }}>
                             {allUniqueTags.length === 0 ? <p className={`text-sm italic w-full text-center mt-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>{t.noTagsInProject}</p> :
                             allUniqueTags.map(tag => {
                                const category = getTagCategory(tag);
                                const colorClass = getActiveCategoryColor(category);

                                return (
                                <span key={tag} className={`px-2.5 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 ${colorClass}`}>
                                    {category === 'nsfw' && <span className="font-bold text-[9px] bg-white text-red-500 px-1 rounded-sm">+18</span>}
                                    {tag}
                                    <button onClick={() => handleDeleteTagFromProject(tag)} className="hover:bg-red-500 hover:text-white rounded-full p-0.5 transition-colors focus:outline-none text-white/70 hover:text-white">
                                        <X size={10} />
                                    </button>
                                </span>
                             )})}
                        </div>
                    </div>
                </div>
            )}

            {isStatsOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setIsStatsOpen(false)}>
                    <div className={`w-[90vw] max-w-4xl max-h-[90vh] ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95`} onClick={e => e.stopPropagation()}>
                        <div className={`p-6 border-b ${isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'} flex justify-between items-center shrink-0`}>
                            <h2 className={`text-xl font-bold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'} flex items-center gap-2`}><PieChart size={24} className="text-indigo-500"/> {t.projectStats}</h2>
                            <button onClick={() => setIsStatsOpen(false)} className={`hover:bg-red-500 hover:text-white rounded-full p-2 transition-colors ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}><X size={20} /></button>
                        </div>
                        
                        <div className={`flex-1 overflow-y-auto p-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                            {(() => {
                                const totalImages = images.length;
                                const totalTags = allUniqueTags.length;
                                const taggedImages = images.filter(img => img.tags && img.tags.length > 0).length;
                                const taggedPercentage = totalImages > 0 ? Math.round((taggedImages / totalImages) * 100) : 0;

                                const categoryCounts: Record<string, number> = {};
                                allUniqueTags.forEach(tag => {
                                    const cat = getTagCategory(tag);
                                    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
                                });
                                const pieData = Object.entries(categoryCounts).map(([name, value]) => ({ name, value }));
                                const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F', '#FFBB28'];

                                const tagUsage: Record<string, number> = {};
                                images.forEach(img => {
                                    img.tags.forEach((tag: string) => {
                                        tagUsage[tag] = (tagUsage[tag] || 0) + 1;
                                    });
                                });
                                const barData = Object.entries(tagUsage)
                                    .sort((a, b) => b[1] - a[1])
                                    .slice(0, 10)
                                    .map(([name, value]) => ({ name, value }));

                                return (
                                    <div className="flex flex-col gap-8">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-indigo-50 border-indigo-100'} flex items-center gap-4`}>
                                                <div className="p-3 bg-indigo-500 rounded-lg text-white"><ImageIcon size={24} /></div>
                                                <div>
                                                    <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{t.statsTotalImages}</p>
                                                    <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{totalImages}</p>
                                                </div>
                                            </div>
                                            <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-purple-50 border-purple-100'} flex items-center gap-4`}>
                                                <div className="p-3 bg-purple-500 rounded-lg text-white"><Tag size={24} /></div>
                                                <div>
                                                    <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{t.statsTotalTags}</p>
                                                    <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{totalTags}</p>
                                                </div>
                                            </div>
                                            <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-emerald-50 border-emerald-100'} flex items-center gap-4`}>
                                                <div className="p-3 bg-emerald-500 rounded-lg text-white"><Check size={24} /></div>
                                                <div>
                                                    <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{t.statsTaggedImages}</p>
                                                    <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{taggedImages} <span className="text-sm font-normal opacity-70">({taggedPercentage}%)</span></p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                            <div className={`p-6 rounded-2xl border ${isDarkMode ? 'bg-gray-900/50 border-gray-700' : 'bg-white border-gray-200'} shadow-sm`}>
                                                <h3 className={`text-lg font-bold mb-6 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'} flex items-center gap-2`}><PieChart size={20} /> {t.statsCategoryDistribution}</h3>
                                                <div className="h-64 w-full">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <RechartsPieChart>
                                                            <Pie
                                                                data={pieData}
                                                                cx="50%"
                                                                cy="50%"
                                                                labelLine={false}
                                                                outerRadius={80}
                                                                fill="#8884d8"
                                                                dataKey="value"
                                                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                                            >
                                                                {pieData.map((_, index) => (
                                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                                ))}
                                                            </Pie>
                                                            <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#1f2937' : '#fff', borderColor: isDarkMode ? '#374151' : '#e5e7eb', color: isDarkMode ? '#fff' : '#000' }} />
                                                        </RechartsPieChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>

                                            <div className={`p-6 rounded-2xl border ${isDarkMode ? 'bg-gray-900/50 border-gray-700' : 'bg-white border-gray-200'} shadow-sm`}>
                                                <h3 className={`text-lg font-bold mb-6 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'} flex items-center gap-2`}><BarChart3 size={20} /> {t.statsTopTags}</h3>
                                                <div className="h-64 w-full">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <RechartsBarChart data={barData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} horizontal={false} />
                                                            <XAxis type="number" stroke={isDarkMode ? '#9ca3af' : '#4b5563'} />
                                                            <YAxis dataKey="name" type="category" width={100} stroke={isDarkMode ? '#9ca3af' : '#4b5563'} tick={{ fontSize: 11 }} />
                                                            <Tooltip cursor={{ fill: isDarkMode ? '#374151' : '#f3f4f6' }} contentStyle={{ backgroundColor: isDarkMode ? '#1f2937' : '#fff', borderColor: isDarkMode ? '#374151' : '#e5e7eb', color: isDarkMode ? '#fff' : '#000' }} />
                                                            <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} />
                                                        </RechartsBarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
