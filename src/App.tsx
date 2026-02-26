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
import React, { useState, useEffect, useRef, useMemo } from 'react';
import JSZip from 'jszip';
import { Folder, Trash, Trash2, RefreshCw, Tag, Save, SaveAll, ImageIcon, Settings, Volume2, VolumeX, Globe, LayoutGrid, Grid3X3, ZoomOut, ZoomIn, X, Check, ArrowDownUp, Sun, Moon, Sparkles, Loader2 } from 'lucide-react';
import { translations } from './constants';
import { soundManager } from './utils/soundManager';
import { generateThumbnail } from './utils/imageUtils';
import { AppleToggle, TagInput, Toast, CustomConfirmDialog, ImportSummaryDialog } from './components/ui';
import { Lightbox } from './components/Lightbox';

// @ts-ignore
import AIWorker from './workers/ai.worker?worker';

export default function App() {
    const [lang, setLang] = useState('it');
    const t = translations[lang as keyof typeof translations];
    const [images, setImages] = useState<any[]>([]);
    const [globalTriggers, setGlobalTriggers] = useState<string[]>([]);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [sortOrder, setSortOrder] = useState<'name-asc' | 'name-desc' | 'date-asc' | 'date-desc'>('name-asc');
    
    const [saveAsZip, setSaveAsZip] = useState(false); 
    const [dirHandle, setDirHandle] = useState<any>(null);
    
    const [imageWidth, setImageWidth] = useState(250); 
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

    const [isGlobalTagManagerOpen, setIsGlobalTagManagerOpen] = useState(false);
    const [customProjectTags, setCustomProjectTags] = useState<string[]>([]);
    const [aiDiscoveredTags, setAiDiscoveredTags] = useState<string[]>([]);
    const [isGlobalAutoTagging, setIsGlobalAutoTagging] = useState(false);
    const [globalAutoTaggingProgress, setGlobalAutoTaggingProgress] = useState(0);
    const [globalModelProgress, setGlobalModelProgress] = useState(0);
    const [isDownloadingModel, setIsDownloadingModel] = useState(false);
    const [globalMaxTags, setGlobalMaxTags] = useState(10);

    const folderInputRef = useRef<HTMLInputElement>(null);
    const settingsRef = useRef<HTMLDivElement>(null);
    const globalWorkerRef = useRef<Worker | null>(null);

    useEffect(() => {
        globalWorkerRef.current = new AIWorker();
        return () => globalWorkerRef.current?.terminate();
    }, []);

    const handleGlobalAutoTagging = async () => {
        if (images.length === 0 || isGlobalAutoTagging || !globalWorkerRef.current) return;
        
        setIsGlobalAutoTagging(true);
        setGlobalAutoTaggingProgress(0);
        setGlobalModelProgress(0);
        setIsDownloadingModel(false);
        
        let processed = 0;
        const total = images.length;
        const newDiscoveredTags: string[] = [];

        for (const img of images) {
            try {
                const imageUrl = URL.createObjectURL(img.file);
                
                const result = await new Promise<any>((resolve, reject) => {
                    if (!globalWorkerRef.current) return reject("No worker");
                    
                    const handleMessage = (e: MessageEvent) => {
                        if (e.data.type === 'progress') {
                            if (e.data.data.status === 'progress') {
                                setIsDownloadingModel(true);
                                setGlobalModelProgress(Math.round(e.data.data.progress || 0));
                            } else if (e.data.data.status === 'done') {
                                setIsDownloadingModel(false);
                            }
                        } else if (e.data.type === 'result') {
                            globalWorkerRef.current?.removeEventListener('message', handleMessage);
                            resolve(e.data.data);
                        } else if (e.data.type === 'error') {
                            globalWorkerRef.current?.removeEventListener('message', handleMessage);
                            reject(e.data.data);
                        }
                    };
                    
                    globalWorkerRef.current.addEventListener('message', handleMessage);
                    globalWorkerRef.current.postMessage({
                        type: 'generate',
                        data: { imageUrl }
                    });
                });

                URL.revokeObjectURL(imageUrl);

                if (result && result[0] && result[0].generated_text) {
                    const text = result[0].generated_text;
                    const stopwords = ['a', 'an', 'the', 'is', 'are', 'in', 'on', 'at', 'with', 'by', 'of', 'and', 'or', 'to', 'for'];
                    const words = text.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "").split(/\s+/);
                    const tags = words.filter((w: string) => w.length > 2 && !stopwords.includes(w));
                    const uniqueTags = [...new Set(tags)].slice(0, globalMaxTags) as string[];
                    newDiscoveredTags.push(...uniqueTags);
                }
            } catch (err) {
                console.error("Error processing image:", img.id, err);
            }
            
            processed++;
            setGlobalAutoTaggingProgress(Math.round((processed / total) * 100));
        }

        setAiDiscoveredTags(prev => [...new Set([...prev, ...newDiscoveredTags])]);
        setIsGlobalAutoTagging(false);
        setGlobalAutoTaggingProgress(0);
        setIsDownloadingModel(false);
        setGlobalModelProgress(0);
        soundManager.chime();
        showNotification(`${t.completed}: ${newDiscoveredTags.length} ${t.tagsDiscovered}`, "success");
    };

    const allUniqueTags = useMemo(() => {
        const imgTags = images.flatMap(img => img.tags);
        return [...new Set([...imgTags, ...customProjectTags, ...aiDiscoveredTags])].sort((a, b) => a.localeCompare(b));
    }, [images, customProjectTags, aiDiscoveredTags]);

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
            message: "Sei sicuro di voler eliminare tutti i tag da tutte le immagini? Questa azione non può essere annullata.",
            onConfirm: () => {
                setImages(prev => prev.map(img => ({ ...img, tags: [] })));
                setCustomProjectTags([]);
                setAiDiscoveredTags([]);
                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                soundManager.pop();
                showNotification("Tutti i tag sono stati eliminati", "success");
            },
            onCancel: () => setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        });
    };

    const handleMoveToTrash = (id: string) => {
        setImages(prev => prev.map(img => img.id === id ? { ...img, isTrashed: true } : img));
        if (selectedImageId === id) setSelectedImageId(null);
        soundManager.pop();
    };

    const handleRestore = (id: string) => {
        setImages(prev => prev.map(img => img.id === id ? { ...img, isTrashed: false } : img));
        soundManager.pop();
    };

    const handleDeletePermanently = async (id: string) => {
        const img = images.find(i => i.id === id);
        if (!img || !dirHandle) return;
        try {
            await dirHandle.removeEntry(img.file.name);
            const txtName = img.file.name.replace(/\.[^/.]+$/, "") + '.txt';
            try { await dirHandle.removeEntry(txtName); } catch (e) { /* ignore if txt doesn't exist */ }
            setImages(prev => prev.filter(i => i.id !== id));
            showNotification(t.deleteSuccess, 'success');
            soundManager.pop();
        } catch (error) {
            console.error(error);
            showNotification(t.deleteError, 'error');
        }
    };

    const handleEmptyTrash = async () => {
        if (!dirHandle) return;
        let successCount = 0;
        for (const img of trashedImages) {
            try {
                await dirHandle.removeEntry(img.file.name);
                const txtName = img.file.name.replace(/\.[^/.]+$/, "") + '.txt';
                try { await dirHandle.removeEntry(txtName); } catch (e) {}
                successCount++;
            } catch (error) {
                console.error("Failed to delete", img.file.name);
            }
        }
        setImages(prev => prev.filter(i => !i.isTrashed));
        showNotification(t.deleteSuccess, 'success');
        setIsTrashOpen(false);
        soundManager.pop();
    };

    const handleRestoreAll = () => {
        setImages(prev => prev.map(img => ({ ...img, isTrashed: false })));
        showNotification("Tutte le foto sono state ripristinate", "success");
        setIsTrashOpen(false);
        soundManager.pop();
    };

    const processImportData = async (imgFiles: any[], txtFiles: any[], handle: any = null) => {
        setImportSummary({ isOpen: false, summary: null, pendingData: null });
        setDirHandle(handle);
        setIsImporting(true); 
        setImportProgress(0);
        
        await new Promise(r => setTimeout(r, 300));
        
        const textMap = new Map();
        for (let i = 0; i < txtFiles.length; i++) {
            const text = await txtFiles[i].text();
            textMap.set(txtFiles[i].name.split('.').slice(0, -1).join('.'), text.split(/[,\n\r]+/).map((t: string) => t.trim()).filter((t: string) => t.length > 0));
            setImportProgress(Math.round(((i + 1) / (imgFiles.length + txtFiles.length)) * 50));
        }
        
        const newImages = [];
        for (let i = 0; i < imgFiles.length; i++) {
            const base = imgFiles[i].name.split('.').slice(0, -1).join('.');
            const thumb = await generateThumbnail(imgFiles[i]);
            const combinedTags = [...new Set([...globalTriggers, ...(textMap.get(base) || [])])];
            newImages.push({ id: Math.random().toString(36).substring(7), file: imgFiles[i], thumb, tags: combinedTags, originalTags: [...combinedTags] });
            setImportProgress(50 + Math.round(((i + 1) / imgFiles.length) * 50));
            if (i % 5 === 0) await new Promise(r => setTimeout(r, 10));
        }
        
        setImages(prev => {
            const combined = [...prev, ...newImages];
            return combined.sort((a, b) => a.file.name.localeCompare(b.file.name));
        }); 
        soundManager.chime();
        showNotification(`${newImages.length} ${t.successImport}`, "success");
        setIsImporting(false);
        if (folderInputRef.current) folderInputRef.current.value = '';
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
                const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
                
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

    const handleResetProject = () => {
        setConfirmDialog({ isOpen: true, title: t.confirmResetTitle, message: t.confirmResetMsg, onConfirm: () => {
            setImages([]); setGlobalTriggers([]); setSelectedForBulk([]); setStagedBulkTags([]); setCustomProjectTags([]); setDirHandle(null);
            soundManager.chime(); showNotification(t.successReset, "success");
            setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, onCancel: () => {} });
        }, onCancel: () => setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, onCancel: () => {} }) });
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
                    const tagString = img.tags.length > 0 ? img.tags.join(', ') + ',' : '';
                    const baseName = img.file.name.substring(0, img.file.name.lastIndexOf('.')) || img.file.name;
                    const fileName = `${baseName}.txt`;
                    
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
                    const exportHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
                    showNotification(t.processingFiles, "info");
                    
                    for (const img of imagesToSave) {
                        const tagString = img.tags.length > 0 ? img.tags.join(', ') + ',' : '';
                        const baseName = img.file.name.substring(0, img.file.name.lastIndexOf('.')) || img.file.name;
                        const fileName = `${baseName}.txt`;
                        
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
                    const tagString = img.tags.length > 0 ? img.tags.join(', ') + ',' : '';
                    const baseName = img.file.name.substring(0, img.file.name.lastIndexOf('.')) || img.file.name;
                    zip.file(`${baseName}.txt`, tagString);
                });
                
                const blob = await zip.generateAsync({ type: "blob" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = isExportAll ? "tags_tutti.zip" : "tags_modificati.zip";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
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
            const tagString = img.tags.length > 0 ? img.tags.join(', ') + ',' : '';
            const blob = new Blob([tagString], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); 
            const baseName = img.file.name.substring(0, img.file.name.lastIndexOf('.')) || img.file.name;
            a.href = url; 
            a.download = `${baseName}.txt`; 
            document.body.appendChild(a);
            a.click(); 
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
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

    const updateImageTags = (id: string, newTags: string[]) => setImages(prev => prev.map(img => img.id === id ? { ...img, tags: newTags } : img));
    const updateOriginalTags = (id: string, newTags: string[]) => setImages(prev => prev.map(img => img.id === id ? { ...img, originalTags: [...newTags] } : img));
    const removeImage = (id: string) => { setImages(prev => prev.filter(img => img.id !== id)); setSelectedForBulk(p => p.filter(i => i !== id)); soundManager.click(); };
    const toggleImageSelection = (id: string) => setSelectedForBulk(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id]);
    
    const applyBulkTags = () => {
        setImages(prev => prev.map(img => {
            if (selectedForBulk.includes(img.id)) {
                const combinedTags = [...new Set([...img.tags, ...stagedBulkTags])];
                return { ...img, tags: combinedTags };
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
                return { ...img, tags: updatedTags };
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

    return (
        <div className={`h-screen transition-colors duration-500 overflow-hidden w-full ${isDarkMode ? 'dark' : ''}`}>
            {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />}
            {/* ITALIANO: Finestre di dialogo per conferme e riepilogo importazione */}
            {/* ENGLISH: Dialog boxes for confirmations and import summary */}
            <CustomConfirmDialog isOpen={confirmDialog.isOpen} title={confirmDialog.title} message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={confirmDialog.onCancel} t={t} isDarkMode={isDarkMode} />
            <ImportSummaryDialog isOpen={importSummary.isOpen} summary={importSummary.summary} onConfirm={() => processImportData(importSummary.pendingData.imgFiles, importSummary.pendingData.txtFiles, importSummary.pendingData.handle)} onCancel={() => { setImportSummary({ isOpen: false, summary: null, pendingData: null }); if (folderInputRef.current) folderInputRef.current.value = ''; }} t={t} isDarkMode={isDarkMode} />
            
            <input type="file" {...{webkitdirectory: "true", directory: "true"} as any} multiple ref={folderInputRef} className="hidden" onChange={handleFolderUploadFallback} />
            
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
                                                    }} className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all z-20" title={t.deletePermanently}><X size={14} /></button>
                                                </div>
                                                <div className={`p-3 flex-1 flex flex-col ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                                                    <div className={`flex-1 rounded-xl border p-1 ${isDarkMode ? 'bg-gray-900/30 border-gray-700/50' : 'bg-gray-50 border-gray-100'}`}>
                                                        <TagInput tags={img.tags} setTags={() => {}} placeholder="" maxHeight={viewMode === 'original' ? 'flex-1 h-full max-h-none' : 'max-h-[180px]'} readOnly={true} />
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

            <Lightbox 
                image={displayedImages.find(img => img.id === selectedImageId)} 
                onClose={() => setSelectedImageId(null)} 
                updateTags={updateImageTags} 
                allTags={allUniqueTags} 
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
                aiDiscoveredTags={aiDiscoveredTags}
                onTagsDiscovered={(newTags: string[]) => setAiDiscoveredTags(prev => [...new Set([...prev, ...newTags])])}
                onMoveToTrash={handleMoveToTrash}
            />

            <div className={`fixed inset-0 z-0 transition-colors duration-500 ${isDarkMode ? 'bg-gradient-to-br from-gray-900 via-purple-950 to-slate-900' : 'bg-gradient-to-br from-gray-100 via-indigo-50 to-white'}`}>
                <div className={`absolute inset-0 opacity-20 ${isDarkMode ? 'bg-[radial-gradient(circle_at_50%_50%,_rgba(255,255,255,0.2)_0%,_transparent_100%)]' : 'bg-[radial-gradient(circle_at_50%_50%,_rgba(0,0,0,0.05)_0%,_transparent_100%)]'}`}></div>
            </div>

            <div className="relative z-10 w-full px-4 py-4 md:py-6 mx-auto h-full max-w-[1920px]">
                <div className={`${isDarkMode ? 'bg-gray-900/70 border-gray-700/50' : 'bg-white/80 border-gray-200'} backdrop-blur-xl border shadow-2xl rounded-3xl overflow-hidden transition-all duration-500 flex flex-col relative h-full max-h-[calc(100vh-2rem)] md:max-h-[calc(100vh-3rem)]`}>
                    
                    <div className={`border-b ${isDarkMode ? 'border-gray-800/50 bg-black/20' : 'border-gray-200 bg-gray-50/50'} p-4 md:p-5 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 z-20`}>
                        <div className="flex-1 flex justify-start w-full md:w-auto">
                        </div>
                        <div className="flex-1 flex justify-center items-center gap-3 w-full md:w-auto"><div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-md hidden sm:block"><ImageIcon className="text-white" size={20} /></div><h1 className={`text-lg md:text-xl font-bold bg-clip-text text-transparent ${isDarkMode ? 'bg-gradient-to-r from-white to-gray-300' : 'bg-gradient-to-r from-gray-900 to-gray-600'} whitespace-nowrap`}>{t.appTitle}</h1></div>
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
                                
                                {isSettingsOpen && <div className={`absolute right-0 mt-2 w-64 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-2xl shadow-xl border p-4 z-50 animate-in fade-in slide-in-from-top-2`}>
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
                                                    {[
                                                        { code: 'it', label: 'Italiano', flag: 'it' },
                                                        { code: 'en', label: 'English', flag: 'gb' },
                                                        { code: 'fr', label: 'Français', flag: 'fr' },
                                                        { code: 'es', label: 'Español', flag: 'es' },
                                                        { code: 'de', label: 'Deutsch', flag: 'de' },
                                                        { code: 'zh', label: '中文 (简体)', flag: 'cn' },
                                                        { code: 'ja', label: '日本語', flag: 'jp' },
                                                        { code: 'pt', label: 'Português', flag: 'br' },
                                                        { code: 'ru', label: 'Русский', flag: 'ru' }
                                                    ].map((l) => (
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
                                            <span className={`text-[10px] ${isDarkMode ? 'text-gray-500' : 'text-gray-400'} font-semibold tracking-widest uppercase`}>Versione 2.1.0</span>
                                            <span className={`text-[9px] ${isDarkMode ? 'text-gray-600' : 'text-gray-400'} font-medium italic`}>Copyright xXIlRizzoXx</span>
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
                        
                        <div className={`w-full lg:w-[260px] flex flex-col gap-3 shrink-0 ${isDarkMode ? 'bg-gray-900/50 border-gray-700/50' : 'bg-white border-gray-200'} p-4 rounded-2xl border shadow-inner`}>
                            <button onClick={handleLoadFolderClick} className={`w-full h-[42px] flex justify-center items-center gap-2 px-4 ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700 text-white border-gray-700/50' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 text-white border-transparent'} rounded-xl shadow-md font-semibold transition-all active:scale-95 whitespace-nowrap text-sm border`}>
                                <Folder size={16} className={isDarkMode ? "text-amber-500" : "text-amber-200"} />
                                <span>{t.loadFolder}</span>
                            </button>
                            <button onClick={handleResetProject} className={`w-full h-[42px] flex justify-center items-center gap-2 px-4 ${isDarkMode ? 'bg-gray-800/80 hover:bg-red-900/30 text-red-400 border-gray-700/50 hover:border-red-800/50' : 'bg-red-600 hover:bg-red-700 text-white border-transparent'} rounded-xl shadow-md font-semibold transition-all active:scale-95 whitespace-nowrap text-sm border`}>
                                <Trash size={16} />
                                <span>{t.resetProject}</span>
                            </button>
                        </div>
                        
                        <div className="flex-1 w-full flex flex-col justify-center relative min-w-0 pt-1">
                            {/* ITALIANO: Input per le trigger words globali */}
                            {/* ENGLISH: Input for global trigger words */}
                            <TagInput tags={globalTriggers} setTags={handleGlobalTagsChange} placeholder={t.globalTriggersPlaceholder} isGlobal={true} maxHeight="max-h-[140px]" />
                            
                            {/* ITALIANO: Strumenti di Auto Tagging Globale */}
                            {/* ENGLISH: Global Auto Tagging tools */}
                            <div className={`mt-3 p-2 rounded-xl border ${isDarkMode ? 'bg-gray-900/50 border-gray-700/50' : 'bg-white border-gray-200'} flex flex-col gap-2`}>
                                <div className="flex items-center justify-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-semibold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} whitespace-nowrap`}>{t.maxTags}:</span>
                                        <input 
                                            type="number" 
                                            min="1" 
                                            max="20" 
                                            value={globalMaxTags} 
                                            onChange={(e) => setGlobalMaxTags(Math.max(1, parseInt(e.target.value) || 1))}
                                            className={`w-12 px-1 py-1 text-xs rounded-lg border text-center outline-none focus:ring-2 focus:ring-indigo-500 ${isDarkMode ? 'bg-gray-800 border-gray-600 text-gray-200' : 'bg-gray-50 border-gray-300 text-gray-800'}`}
                                        />
                                    </div>
                                    <button 
                                        onClick={handleGlobalAutoTagging}
                                        disabled={isGlobalAutoTagging || images.length === 0}
                                        className={`flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${isGlobalAutoTagging || images.length === 0 ? (isDarkMode ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed') : (isDarkMode ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-md active:scale-95' : 'bg-white border border-gray-200 text-indigo-600 hover:bg-indigo-50 shadow-sm active:scale-95')}`}
                                    >
                                        {isGlobalAutoTagging ? <Loader2 size={14} className="animate-spin" /> : <div className="relative"><Tag size={14} /><Sparkles size={8} className={`absolute -top-1 -right-1 animate-pulse ${isDarkMode ? 'text-yellow-300' : 'text-yellow-500'}`} /></div>}
                                        {isGlobalAutoTagging ? `${Math.floor(globalAutoTaggingProgress)}%` : t.autoTaggingGlobal}
                                    </button>
                                </div>
                                {isGlobalAutoTagging && (
                                    <div className="w-full px-2 pb-1">
                                        <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
                                            <div 
                                                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300" 
                                                style={{ width: `${globalAutoTaggingProgress}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className={`w-full lg:w-[380px] flex flex-col gap-3 shrink-0 ${isDarkMode ? 'bg-gray-900/50 border-gray-700/50' : 'bg-white border-gray-200'} p-4 rounded-2xl border shadow-inner`}>
                            {/* ITALIANO: Pulsante per visualizzare tutti i tag del progetto */}
                            {/* ENGLISH: Button to view all project tags */}
                            <button 
                                onClick={() => setIsGlobalTagManagerOpen(true)}
                                className="w-full h-[42px] flex justify-center items-center gap-2 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 text-white rounded-xl shadow-md font-semibold transition-all active:scale-95 whitespace-nowrap text-sm"
                            >
                                <Tag size={16} />
                                <span>{t.allTagsButton}</span>
                            </button>
                            <div className="w-full flex flex-col gap-1.5">
                                <div className="w-full flex gap-3 items-start">
                                    {/* ITALIANO: Pulsante Salva Modifiche */}
                                    {/* ENGLISH: Save Changes button */}
                                    <button onClick={handleSaveChanges} disabled={images.length === 0} className="flex-1 h-[42px] flex justify-center items-center gap-2 px-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-400 text-white rounded-xl shadow-md font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm">
                                        <Save size={16} />
                                        <span className="hidden sm:inline">{t.saveChanges}</span>
                                        <span className="sm:hidden">Salva</span>
                                    </button>
                                    
                                    {/* ITALIANO: Sezione Esporta con opzione ZIP sotto */}
                                    {/* ENGLISH: Export section with ZIP option below */}
                                    <div className="flex-1 flex flex-col gap-2">
                                        <button onClick={handleExportAll} disabled={images.length === 0} className="w-full h-[42px] flex justify-center items-center gap-2 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-400 text-white rounded-xl shadow-md font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm">
                                            <SaveAll size={16} />
                                            <span className="hidden sm:inline">{t.exportAllTxt}</span>
                                            <span className="sm:hidden">Esporta</span>
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
                        <div className={`flex-1 flex items-center gap-2 text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}><ImageIcon size={16} /><span>{images.length} {images.length === 1 ? t.imgOpenedSingle : t.imgOpenedPlural}</span></div>
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

                    <div className={`p-4 md:p-6 ${isDarkMode ? 'bg-black/20' : 'bg-gray-200/40'} flex-1 overflow-y-auto min-h-0 relative`}>
                        {images.length === 0 ? <div className={`flex flex-col items-center justify-center h-full ${isDarkMode ? 'opacity-60' : 'opacity-100'}`}><ImageIcon size={64} className={`${isDarkMode ? 'text-gray-600' : 'text-gray-400'} mb-4`} /><p className={`text-lg font-bold ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>{t.noImagesTitle}</p><p className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-600'} mt-2 font-bold`}>{t.noImagesDesc}</p></div> : 
                        <div className={`grid gap-4 md:gap-6 transition-all duration-300 items-start relative z-0 ${selectedForBulk.length > 0 ? 'pb-[35vh]' : 'pb-2'}`} style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${imageWidth}px, 1fr))` }}>
                            {displayedImages.map((img) => (
                            <div key={img.id} className={`group ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all border flex flex-col h-full ${selectedForBulk.includes(img.id) ? 'border-indigo-500 ring-2 ring-indigo-500/50' : ''}`}>
                                <div className={`relative ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} overflow-hidden shrink-0 flex justify-center items-center cursor-pointer ${viewMode === 'square' ? 'aspect-square' : ''}`} style={viewMode === 'original' ? { height: 'auto', minHeight: '120px' } : {}} onClick={() => setSelectedImageId(img.id)}>
                                    <img src={img.thumb} alt="Preview" loading="lazy" className={`w-full ${viewMode === 'square' ? 'h-full object-cover' : 'h-auto object-contain'} group-hover:scale-[1.02] transition-transform duration-500 ${selectedForBulk.includes(img.id) ? 'opacity-80' : ''}`} />
                                    <div className="absolute top-2 left-2 z-20" onClick={(e) => { e.stopPropagation(); toggleImageSelection(img.id); }}><div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shadow-sm backdrop-blur-sm ${selectedForBulk.includes(img.id) ? 'bg-indigo-500 border-indigo-500' : 'bg-black/30 border-white/70 hover:bg-black/50'}`}>{selectedForBulk.includes(img.id) && <Check size={14} className="text-white" />}</div></div>
                                    <button onClick={(e) => { e.stopPropagation(); handleMoveToTrash(img.id); }} className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all z-20" title={t.moveToTrash}><Trash2 size={14} /></button>
                                </div>
                                <div className={`p-3 flex-1 flex flex-col ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                                    {/* ITALIANO: Area tag sotto l'anteprima, organizzata esteticamente */}
                                    {/* ENGLISH: Tag area under the preview, aesthetically organized */}
                                    <div className={`flex-1 rounded-xl border p-1 ${isDarkMode ? 'bg-gray-900/30 border-gray-700/50' : 'bg-gray-50 border-gray-100'}`}>
                                        <TagInput tags={img.tags} setTags={(newTags: string[]) => updateImageTags(img.id, newTags)} placeholder={t.addTag} maxHeight={viewMode === 'original' ? 'flex-1 h-full max-h-none' : 'max-h-[180px]'} />
                                    </div>
                                </div>
                            </div>
                            ))}
                        </div>}
                    </div>

                    {selectedForBulk.length > 0 && (
                        <div className="absolute bottom-6 left-0 right-0 mx-auto w-[90%] max-w-5xl bg-gray-900/95 backdrop-blur-xl border border-gray-700 p-4 z-[150] shadow-2xl animate-in slide-in-from-bottom-12 flex flex-col gap-3 max-h-[35vh] rounded-2xl ring-1 ring-black/5">
                            <div className="w-full flex flex-col gap-3 h-full">
                                <div className="flex justify-between items-center shrink-0"><div className="flex items-center gap-3"><div className="p-1.5 bg-indigo-900/50 rounded-lg text-indigo-400"><Grid3X3 size={18} /></div><div><h3 className="text-sm font-bold text-gray-200 leading-tight">{t.addTagsTo} {selectedForBulk.length} {selectedForBulk.length === 1 ? t.selectedImageSingle : t.selectedImagePlural}</h3><p className="text-[10px] text-gray-500 uppercase tracking-wide">{t.dashedPillsDesc}</p></div></div><button onClick={() => { setSelectedForBulk([]); setStagedBulkTags([]); }} className="p-1.5 rounded-full border border-gray-600 text-gray-400 hover:bg-red-500 hover:border-red-500 hover:text-white transition-all shadow-sm"><X size={14} /></button></div>
                                <div className="flex-1 overflow-y-auto flex flex-wrap content-start gap-1.5 lightbox-scroll p-1 border-y border-gray-800">
                                    {allUniqueTags.length === 0 ? <p className="text-xs text-gray-500 italic py-2 w-full text-center">{t.noTagsInProject}</p> : allUniqueTags.map(tag => (
                                        <button key={tag} onClick={() => setStagedBulkTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])} className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${stagedBulkTags.includes(tag) ? 'bg-indigo-500 border-2 border-indigo-500 text-white shadow-md scale-105' : selectedForBulk.some(id => images.find(i => i.id === id)?.tags.includes(tag)) ? 'bg-transparent border-2 border-gray-500 border-dashed text-gray-300 hover:bg-gray-800' : 'bg-gray-800 border-2 border-transparent text-gray-200 hover:bg-gray-700 shadow-sm'}`}>{tag}</button>
                                    ))}
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
                            
                            {/* ITALIANO: Controlli AI duplicati nel gestore tag (visibili solo se ci sono immagini) */}
                            {/* ENGLISH: Duplicate AI controls in tag manager (visible only if there are images) */}
                            {images.length > 0 && (
                                <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-100 border-gray-200'} flex flex-col gap-2`}>
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{t.maxTags}:</span>
                                            <input 
                                                type="number" 
                                                min="1" 
                                                max="20" 
                                                value={globalMaxTags} 
                                                onChange={(e) => setGlobalMaxTags(Math.max(1, parseInt(e.target.value) || 1))}
                                                className={`w-10 px-1 py-0.5 text-[10px] rounded border text-center outline-none focus:ring-1 focus:ring-indigo-500 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-800'}`}
                                            />
                                        </div>
                                        <button 
                                            onClick={handleGlobalAutoTagging}
                                            disabled={isGlobalAutoTagging || images.length === 0}
                                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${isGlobalAutoTagging || images.length === 0 ? (isDarkMode ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed') : (isDarkMode ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-md active:scale-95' : 'bg-white border border-gray-200 text-indigo-600 hover:bg-indigo-50 shadow-sm active:scale-95')}`}
                                        >
                                            {isGlobalAutoTagging ? <Loader2 size={12} className="animate-spin" /> : <div className="relative"><Tag size={12} /><Sparkles size={6} className={`absolute -top-1 -right-1 animate-pulse ${isDarkMode ? 'text-yellow-300' : 'text-yellow-500'}`} /></div>}
                                            {isGlobalAutoTagging ? `${Math.floor(globalAutoTaggingProgress)}%` : t.autoTaggingGlobal}
                                        </button>
                                    </div>
                                    {isGlobalAutoTagging && (
                                        <div className="w-full px-1 flex flex-col gap-1.5">
                                            {isDownloadingModel && (
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex justify-between items-center px-1">
                                                        <span className={`text-[9px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>{t.modelLoading}</span>
                                                        <span className={`text-[9px] font-bold ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>{globalModelProgress}%</span>
                                                    </div>
                                                    <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
                                                        <div 
                                                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300" 
                                                            style={{ width: `${globalModelProgress}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                            <div className="flex flex-col gap-1">
                                                <div className="flex justify-between items-center px-1">
                                                    <span className={`text-[9px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-pink-400' : 'text-pink-600'}`}>{t.processing}</span>
                                                    <span className={`text-[9px] font-bold ${isDarkMode ? 'text-pink-400' : 'text-pink-600'}`}>{globalAutoTaggingProgress}%</span>
                                                </div>
                                                <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
                                                    <div 
                                                        className={`h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300 ${!isDownloadingModel && globalAutoTaggingProgress === 0 ? 'w-full animate-pulse' : ''}`} 
                                                        style={globalAutoTaggingProgress > 0 ? { width: `${globalAutoTaggingProgress}%` } : {}}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <button 
                                onClick={handleDeleteAllTags}
                                disabled={allUniqueTags.length === 0}
                                className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${isDarkMode ? 'bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-800/50' : 'bg-red-600 hover:bg-red-700 text-white border-transparent shadow-md'}`}
                            >
                                <Trash size={14} />
                                {t.deleteAllTags}
                            </button>
                        </div>
                        <div className={`flex-1 p-4 overflow-y-auto flex flex-wrap content-start gap-1.5 lightbox-scroll ${isDarkMode ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
                             {allUniqueTags.length === 0 ? <p className={`text-sm italic w-full text-center mt-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>{t.noTagsInProject}</p> :
                             allUniqueTags.map(tag => {
                                const isCustomOnly = customProjectTags.includes(tag) && !images.some(img => img.tags.includes(tag));
                                const isAiGenerated = aiDiscoveredTags.includes(tag);
                                return (
                                <span key={tag} className={`px-2.5 py-1.5 rounded-full text-xs font-medium border shadow-sm flex items-center gap-1.5 ${isAiGenerated ? 'border-purple-500 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20' : isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-700'}`}>
                                    {isAiGenerated && <Sparkles size={10} className="text-purple-500" />}
                                    {tag}
                                    {isCustomOnly && (
                                        <button onClick={() => setCustomProjectTags(prev => prev.filter(t => t !== tag))} className="hover:bg-red-500 hover:text-white rounded-full p-0.5 transition-colors focus:outline-none text-gray-400">
                                            <X size={10} />
                                        </button>
                                    )}
                                </span>
                             )})}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
