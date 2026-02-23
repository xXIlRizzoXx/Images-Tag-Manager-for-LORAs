import React, { useState, useEffect, useRef, useMemo } from 'react';
import JSZip from 'jszip';
import { Folder, Trash, Tag, Save, Download, ImageIcon, Settings, Volume2, VolumeX, Globe, LayoutGrid, Grid3X3, ZoomOut, ZoomIn, X, Check } from 'lucide-react';
import { translations } from './constants';
import { soundManager } from './utils/soundManager';
import { generateThumbnail } from './utils/imageUtils';
import { AppleToggle, TagInput, Toast, CustomConfirmDialog } from './components/ui';
import { Lightbox } from './components/Lightbox';

export default function App() {
    const [lang, setLang] = useState('it');
    const t = translations[lang as keyof typeof translations];
    const [images, setImages] = useState<any[]>([]);
    const [globalTriggers, setGlobalTriggers] = useState<string[]>([]);
    const [soundEnabled, setSoundEnabled] = useState(true);
    
    const [saveAsZip, setSaveAsZip] = useState(false); 
    const [dirHandle, setDirHandle] = useState<any>(null);
    
    const [imageWidth, setImageWidth] = useState(250); 
    
    const [viewMode, setViewMode] = useState('square'); 
    const [selectedImageId, setSelectedImageId] = useState<string | null>(null); 
    const [slideDirection, setSlideDirection] = useState('right');
    const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, onCancel: () => {} });
    const [selectedForBulk, setSelectedForBulk] = useState<string[]>([]);
    const [stagedBulkTags, setStagedBulkTags] = useState<string[]>([]);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);

    const [isGlobalTagManagerOpen, setIsGlobalTagManagerOpen] = useState(false);
    const [customProjectTags, setCustomProjectTags] = useState<string[]>([]);

    const folderInputRef = useRef<HTMLInputElement>(null);
    const settingsRef = useRef<HTMLDivElement>(null);

    const allUniqueTags = useMemo(() => {
        const imgTags = images.flatMap(img => img.tags);
        return [...new Set([...imgTags, ...customProjectTags])].sort((a, b) => a.localeCompare(b));
    }, [images, customProjectTags]);

    const showNotification = (message: string, type = 'info') => setToast({ show: true, message, type });

    const handleLoadFolderClick = async () => {
        if ('showDirectoryPicker' in window) {
            try {
                const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
                setDirHandle(handle); 
                setIsImporting(true); 
                setImportProgress(0);
                
                await new Promise(r => setTimeout(r, 300));
                
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
                    setIsImporting(false);
                    return showNotification(t.noImagesTitle, "info");
                }

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
                
                setImages(prev => [...prev, ...newImages]); 
                soundManager.chime();
                showNotification(`${newImages.length} immagini caricate con successo.`, "success");
                setIsImporting(false);
                
            } catch (err: any) {
                setIsImporting(false);
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
        
        setDirHandle(null); 
        
        setIsImporting(true); setImportProgress(0);
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
        setImages(prev => [...prev, ...newImages]); soundManager.chime();
        showNotification(`${newImages.length} immagini caricate con successo.`, "success");
        setIsImporting(false); if (folderInputRef.current) folderInputRef.current.value = '';
    };

    const handleResetProject = () => {
        setConfirmDialog({ isOpen: true, title: t.confirmResetTitle, message: t.confirmResetMsg, onConfirm: () => {
            setImages([]); setGlobalTriggers([]); setSelectedForBulk([]); setStagedBulkTags([]); setCustomProjectTags([]); setDirHandle(null);
            soundManager.chime(); showNotification(t.successReset, "success");
            setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, onCancel: () => {} });
        }, onCancel: () => setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {}, onCancel: () => {} }) });
    };

    const performSave = async (imagesToSave: any[], isExportAll = false) => {
        if (dirHandle && !saveAsZip) {
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
                showNotification(isExportAll ? t.successSave : t.successSaveChanges, "success");
            } catch (err) {
                console.error(err);
                showNotification(t.dirError, "error");
            }
            return; 
        }

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

    const handleSaveChanges = () => {
        const modifiedImages = images.filter(img => JSON.stringify(img.tags) !== JSON.stringify(img.originalTags));
        if (modifiedImages.length === 0) { showNotification(t.noChanges, "info"); return; }
        performSave(modifiedImages, false);
    };

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

    const currentIndex = images.findIndex(img => img.id === selectedImageId);
    const handleNext = () => { if (currentIndex < images.length - 1) { setSlideDirection('left'); setSelectedImageId(images[currentIndex + 1].id); } };
    const handlePrev = () => { if (currentIndex > 0) { setSlideDirection('right'); setSelectedImageId(images[currentIndex - 1].id); } };

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
        <div className="h-full transition-colors duration-500 overflow-hidden w-full dark">
            {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />}
            <CustomConfirmDialog isOpen={confirmDialog.isOpen} title={confirmDialog.title} message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={confirmDialog.onCancel} t={t} />
            
            <input type="file" {...{webkitdirectory: "true", directory: "true"} as any} multiple ref={folderInputRef} className="hidden" onChange={handleFolderUploadFallback} />
            
            <Lightbox 
                image={images.find(img => img.id === selectedImageId)} 
                onClose={() => setSelectedImageId(null)} 
                updateTags={updateImageTags} 
                allTags={allUniqueTags} 
                t={t} 
                onNext={handleNext} 
                onPrev={handlePrev} 
                hasNext={(images.length - 1) > currentIndex} 
                hasPrev={currentIndex > 0} 
                slideDirection={slideDirection} 
                showNotification={showNotification} 
                updateOriginalTags={updateOriginalTags} 
                dirHandle={dirHandle}
            />

            <div className="fixed inset-0 z-0 bg-gradient-to-br from-gray-900 via-purple-950 to-slate-900 transition-colors duration-500">
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_50%_50%,_rgba(255,255,255,0.2)_0%,_transparent_100%)]"></div>
            </div>

            <div className="relative z-10 w-full px-4 py-4 md:py-6 mx-auto h-full max-w-[1920px]">
                <div className="bg-gray-900/70 backdrop-blur-xl border border-gray-700/50 shadow-2xl rounded-3xl overflow-hidden transition-all duration-500 flex flex-col relative h-full max-h-[calc(100vh-2rem)] md:max-h-[calc(100vh-3rem)]">
                    
                    <div className="border-b border-gray-800/50 p-4 md:p-5 flex flex-col md:flex-row justify-between items-center gap-4 bg-black/20 shrink-0 z-20">
                        <div className="flex-1 flex justify-start w-full md:w-auto">
                        </div>
                        <div className="flex-1 flex justify-center items-center gap-3 w-full md:w-auto"><div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-md hidden sm:block"><ImageIcon className="text-white" size={20} /></div><h1 className="text-lg md:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-300 whitespace-nowrap">{t.appTitle}</h1></div>
                        <div className="flex-1 flex justify-end w-full md:w-auto">
                            <div className="relative" ref={settingsRef}>
                                <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className="flex items-center gap-2 p-2 md:px-3 md:py-2 rounded-xl bg-gray-800/50 hover:bg-gray-700 border border-gray-700/50 shadow-sm transition-colors text-gray-300 focus:outline-none"><span className="font-semibold text-sm hidden sm:inline-block">{t.settings}</span><Settings size={20} className={isSettingsOpen ? "rotate-45 transition-transform duration-300" : "transition-transform duration-300"} /></button>
                                
                                {isSettingsOpen && <div className="absolute right-0 mt-2 w-64 bg-gray-800 rounded-2xl shadow-xl border border-gray-700 p-4 z-50 animate-in fade-in slide-in-from-top-2">
                                    <h3 className="text-xs font-semibold text-gray-400 uppercase mb-4 tracking-wider">{t.settings}</h3>
                                    <div className="flex flex-col gap-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-sm text-gray-300 font-medium">{soundEnabled ? <Volume2 size={16} className="text-indigo-500"/> : <VolumeX size={16} className="text-gray-400"/>} {t.uiSounds}</div>
                                            <AppleToggle checked={soundEnabled} onChange={setSoundEnabled} colorClass="bg-indigo-500" />
                                        </div>
                                        <div className="w-full h-px bg-gray-700/50"></div>
                                        <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-sm text-gray-300 font-medium"><Globe size={16} className="text-blue-500"/>{t.language}</div><select value={lang} onChange={(e) => setLang(e.target.value)} className="bg-gray-700 text-xs rounded border border-gray-600 px-2 py-1 outline-none text-gray-200"><option value="it">Italiano</option></select></div>
                                        <div className="w-full h-px bg-gray-700/50 my-1"></div>
                                        <div className="flex justify-center">
                                            <span className="text-[10px] text-gray-500 font-semibold tracking-widest uppercase">Versione 1.4.0</span>
                                        </div>
                                    </div>
                                </div>}
                            </div>
                        </div>
                    </div>

                    <div className={`transition-all duration-500 ease-in-out overflow-hidden flex justify-center bg-gray-800/20 shrink-0 ${isImporting ? 'max-h-32 opacity-100 border-b border-gray-800/50' : 'max-h-0 opacity-0'}`}>
                        <div className="w-full max-w-4xl p-4"><div className="bg-indigo-900/30 border border-indigo-700/50 p-4 rounded-2xl flex items-center gap-4 shadow-inner"><div className="w-6 h-6 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin shrink-0"></div><div className="flex-1"><div className="flex justify-between items-center mb-1.5"><span className="text-sm font-semibold text-gray-200">{importProgress === 100 ? t.completed : t.processingFiles}</span><span className="text-sm font-bold text-indigo-400">{importProgress}%</span></div><div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden shadow-sm"><div className="bg-indigo-500 h-full rounded-full transition-all duration-200" style={{width: `${importProgress}%`}}></div></div></div></div></div>
                    </div>

                    <div className="p-4 md:p-5 flex flex-col lg:flex-row lg:items-center gap-6 border-b border-gray-800/50 shrink-0 bg-gray-800/20">
                        
                        <div className="w-full lg:w-[260px] flex flex-col gap-3 shrink-0 bg-gray-900/50 p-4 rounded-2xl border border-gray-700/50 shadow-inner">
                            <button onClick={handleLoadFolderClick} className="w-full h-[42px] flex justify-center items-center gap-2 px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-xl shadow-md font-semibold transition-all active:scale-95 whitespace-nowrap text-sm border border-gray-700/50">
                                <Folder size={16} className="text-amber-500" />
                                <span>{t.loadFolder}</span>
                            </button>
                            <button onClick={handleResetProject} className="w-full h-[42px] flex justify-center items-center gap-2 px-4 bg-gray-800/80 hover:bg-red-900/30 text-red-400 rounded-xl shadow-md font-semibold transition-all active:scale-95 whitespace-nowrap text-sm border border-gray-700/50 hover:border-red-800/50">
                                <Trash size={16} />
                                <span>{t.resetProject}</span>
                            </button>
                        </div>
                        
                        <div className="flex-1 w-full flex flex-col justify-center relative min-w-0 pt-1">
                            <TagInput tags={globalTriggers} setTags={handleGlobalTagsChange} placeholder={t.globalTriggersPlaceholder} isGlobal={true} maxHeight="max-h-[140px]" />
                        </div>
                        
                        <div className="w-full lg:w-[380px] flex flex-col gap-3 shrink-0 bg-gray-900/50 p-4 rounded-2xl border border-gray-700/50 shadow-inner">
                            <button 
                                onClick={() => setIsGlobalTagManagerOpen(true)}
                                className="w-full h-[42px] flex justify-center items-center gap-2 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 text-white rounded-xl shadow-md font-semibold transition-all active:scale-95 whitespace-nowrap text-sm"
                            >
                                <Tag size={16} />
                                <span>{t.allTagsButton}</span>
                            </button>
                            <div className="w-full flex flex-col gap-1.5">
                                <div className="w-full flex gap-3">
                                    <button onClick={handleSaveChanges} disabled={images.length === 0} className="flex-1 h-[42px] flex justify-center items-center gap-2 px-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 disabled:from-gray-700 disabled:text-gray-500 text-white rounded-xl shadow-md font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm">
                                        <Save size={16} />
                                        <span className="hidden sm:inline">Salva Modifiche</span>
                                        <span className="sm:hidden">Salva</span>
                                    </button>
                                    <button onClick={handleExportAll} disabled={images.length === 0} className="flex-1 h-[42px] flex justify-center items-center gap-2 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 disabled:from-gray-700 disabled:text-gray-500 text-white rounded-xl shadow-md font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm">
                                        <Download size={16} />
                                        <span className="hidden sm:inline">Esporta Tutti</span>
                                        <span className="sm:hidden">Esporta</span>
                                    </button>
                                </div>
                                <div className="flex items-center justify-between mt-1 px-1">
                                    <div className="flex items-center gap-2 text-gray-400">
                                        <Folder size={14} />
                                        <span className="text-[11px] font-bold uppercase tracking-wider">{t.exportAsZip}</span>
                                    </div>
                                    <AppleToggle checked={saveAsZip} onChange={setSaveAsZip} colorClass="bg-indigo-500" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="px-6 py-2.5 bg-gray-800/40 border-b border-gray-800/50 flex justify-between items-center shrink-0">
                        <div className="flex-1 flex items-center gap-2 text-sm font-medium text-gray-400"><ImageIcon size={16} /><span>{images.length} {images.length === 1 ? t.imgOpenedSingle : t.imgOpenedPlural}</span></div>
                        <div className="flex-1 flex justify-center"><div className="flex items-center bg-gray-900 p-1 rounded-lg shadow-inner"><button onClick={() => setViewMode('square')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'square' ? 'bg-gray-700 text-indigo-400 shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}><LayoutGrid size={14} /> {t.square}</button><button onClick={() => setViewMode('original')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'original' ? 'bg-gray-700 text-indigo-400 shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}><Grid3X3 size={14} /> {t.original}</button></div></div>
                        <div className="flex-1 flex items-center justify-end gap-3"><span className="hidden sm:inline-block text-xs font-medium text-gray-400 uppercase tracking-wide">{t.zoom}</span><div className="flex items-center gap-2 bg-gray-900 px-3 py-1 rounded-full border border-gray-700 shadow-inner"><ZoomOut size={14} className="text-gray-400" /><input type="range" min="150" max="500" step="10" value={imageWidth} onChange={(e) => setImageWidth(Number(e.target.value))} className="w-20 md:w-32 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" /><ZoomIn size={14} className="text-gray-400" /></div></div>
                    </div>

                    <div className="p-4 md:p-6 bg-black/20 flex-1 overflow-y-auto min-h-0 relative">
                        {images.length === 0 ? <div className="flex flex-col items-center justify-center h-full opacity-60"><ImageIcon size={64} className="text-gray-600 mb-4" /><p className="text-lg font-medium text-gray-400">{t.noImagesTitle}</p><p className="text-sm text-gray-500 mt-2">{t.noImagesDesc}</p></div> : 
                        <div className={`grid gap-4 md:gap-6 transition-all duration-300 items-start relative z-0 ${selectedForBulk.length > 0 ? 'pb-[35vh]' : 'pb-2'}`} style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${imageWidth}px, 1fr))` }}>
                            {images.map((img) => (
                            <div key={img.id} className={`group bg-gray-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all border flex flex-col h-full ${selectedForBulk.includes(img.id) ? 'border-indigo-500 ring-2 ring-indigo-500/50' : 'border-gray-700'}`}>
                                <div className={`relative bg-gray-900 overflow-hidden shrink-0 flex justify-center items-center cursor-pointer ${viewMode === 'square' ? 'aspect-square' : ''}`} style={viewMode === 'original' ? { height: 'auto', minHeight: '120px' } : {}} onClick={() => setSelectedImageId(img.id)}>
                                    <img src={img.thumb} alt="Preview" loading="lazy" className={`w-full ${viewMode === 'square' ? 'h-full object-cover' : 'h-auto object-contain'} group-hover:scale-[1.02] transition-transform duration-500 ${selectedForBulk.includes(img.id) ? 'opacity-80' : ''}`} />
                                    <div className="absolute top-2 left-2 z-20" onClick={(e) => { e.stopPropagation(); toggleImageSelection(img.id); }}><div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shadow-sm backdrop-blur-sm ${selectedForBulk.includes(img.id) ? 'bg-indigo-500 border-indigo-500' : 'bg-black/30 border-white/70 hover:bg-black/50'}`}>{selectedForBulk.includes(img.id) && <Check size={14} className="text-white" />}</div></div>
                                    <button onClick={(e) => { e.stopPropagation(); removeImage(img.id); }} className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all z-20"><X size={14} /></button>
                                </div>
                                <div className="p-3 flex-1 flex flex-col bg-gray-800"><TagInput tags={img.tags} setTags={(newTags: string[]) => updateImageTags(img.id, newTags)} placeholder={t.addTag} maxHeight="max-h-[180px]" /></div>
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
                    <div className="w-96 max-w-[90vw] h-full bg-gray-800 shadow-2xl flex flex-col animate-in slide-in-from-right-4" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-gray-700 flex justify-between items-center bg-gray-900 shrink-0">
                            <h2 className="text-lg font-bold text-gray-200 flex items-center gap-2"><Tag size={20} className="text-indigo-500"/> {t.projectTagManager}</h2>
                            <button onClick={() => setIsGlobalTagManagerOpen(false)} className="hover:bg-red-500 hover:text-white rounded-full p-1.5 transition-colors text-gray-400"><X size={16} /></button>
                        </div>
                        <div className="p-4 border-b border-gray-700 bg-gray-800 shrink-0">
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
                                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2.5 text-sm text-gray-100 outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                            />
                        </div>
                        <div className="flex-1 p-4 overflow-y-auto flex flex-wrap content-start gap-1.5 lightbox-scroll bg-gray-900/50">
                            {allUniqueTags.length === 0 ? <p className="text-sm text-gray-500 italic w-full text-center mt-4">{t.noTagsInProject}</p> :
                             allUniqueTags.map(tag => {
                                const isCustomOnly = customProjectTags.includes(tag) && !images.some(img => img.tags.includes(tag));
                                return (
                                <span key={tag} className="px-2.5 py-1.5 rounded-full text-xs font-medium bg-gray-800 border border-gray-700 text-gray-200 shadow-sm flex items-center gap-1.5">
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
