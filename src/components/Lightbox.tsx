/******************************************************************************
*******************************************************************************
**                                                                            **
**  ITALIANO: VISUALIZZATORE IMMAGINI (LIGHTBOX)                              **
**  Questo file gestisce la finestra che si apre quando clicchi su un'immagine.**
**  Permette di vedere l'immagine ingrandita e di modificarne i tag.          **
**                                                                            **
**  ENGLISH: IMAGE VIEWER (LIGHTBOX)                                          **
**  This file manages the window that opens when you click on an image.       **
**  It allows you to see the enlarged image and edit its tags.                **
**                                                                            **
*******************************************************************************
*******************************************************************************/
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Save, LayoutDashboard, Wand2, Loader2, Tag, Sparkles, Trash2 } from 'lucide-react';
import { soundManager } from '../utils/soundManager';
import { AppleToggle } from './ui';
// @ts-ignore
import AIWorker from '../workers/ai.worker?worker';

export const Lightbox = ({ image, onClose, updateTags, allTags, t, onNext, onPrev, hasNext, hasPrev, slideDirection, showNotification, updateOriginalTags, dirHandle, isDarkMode, onTagsDiscovered, aiDiscoveredTags = [], onMoveToTrash }: any) => {
    const [zoomLevel, setZoomLevel] = useState(0);
    const [filterText, setFilterText] = useState('');
    const [zoomOrigin, setZoomOrigin] = useState('center');
    const [highResUrl, setHighResUrl] = useState<string | null>(null);
    const [isHighResLoaded, setIsHighResLoaded] = useState(false);
    const [showOnlyAdded, setShowOnlyAdded] = useState(false);
    
    // ITALIANO: Stato per l'elaborazione AI
    // ENGLISH: State for AI processing
    const [isProcessingAI, setIsProcessingAI] = useState(false);
    const [aiProgress, setAiProgress] = useState(0);
    const [maxTags, setMaxTags] = useState(10);
    const workerRef = useRef<Worker | null>(null);
    const imageRef = useRef(image);

    useEffect(() => {
        imageRef.current = image;
    }, [image]);

    useEffect(() => {
        workerRef.current = new AIWorker();
        workerRef.current.onmessage = (event) => {
            const { type, data } = event.data;
            if (type === 'progress') {
                if (data.status === 'progress') {
                    // ITALIANO: Stabilizziamo la percentuale per evitare salti bruschi
                    // ENGLISH: Stabilize percentage to avoid sudden jumps
                    const prog = Math.round(data.progress || 0);
                    setAiProgress(prev => Math.max(prev, prog));
                }
            } else if (type === 'result') {
                setIsProcessingAI(false);
                setAiProgress(0);
                handleAIResult(data);
            } else if (type === 'error') {
                setIsProcessingAI(false);
                setAiProgress(0);
                if (showNotification) showNotification(`${t.aiError}: ${data}`, "error");
            }
        };
        return () => {
            workerRef.current?.terminate();
        };
    }, []);

    const handleAIResult = (result: any) => {
        if (!result || !result[0] || !result[0].generated_text) return;
        
        const currentImage = imageRef.current;
        if (!currentImage) return;

        const text = result[0].generated_text;
        
        // ITALIANO: Estrazione semplice delle parole chiave
        // ENGLISH: Simple keyword extraction
        const stopwords = ['a', 'an', 'the', 'is', 'are', 'in', 'on', 'at', 'with', 'by', 'of', 'and', 'or', 'to', 'for'];
        const words = text.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "").split(/\s+/);
        const tags = words.filter((w: string) => w.length > 2 && !stopwords.includes(w));
        const newTags = [...new Set(tags)].slice(0, maxTags) as string[];

        // ITALIANO: Aggiungiamo i tag all'immagine corrente
        // ENGLISH: Add tags to the current image
        const currentTags = currentImage.tags || [];
        const combined = [...new Set([...currentTags, ...newTags])];
        updateTags(currentImage.id, combined);

        if (onTagsDiscovered) {
            onTagsDiscovered(newTags);
        }
        
        soundManager.chime();
        if (showNotification) showNotification(`${t.completed}: ${newTags.length} ${t.tagsDiscovered}`, "success");
    };

    const handleMagicWand = () => {
        if (isProcessingAI || !workerRef.current || !image) return;
        
        setIsProcessingAI(true);
        setAiProgress(0);
        
        workerRef.current.postMessage({
            type: 'generate',
            data: { imageUrl: highResUrl }
        });
    };

    const handleKeyDown = useCallback((e: any) => {
        if (!imageRef.current) return;
        if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
        if (e.key === 'ArrowRight' && hasNext) onNext();
        else if (e.key === 'ArrowLeft' && hasPrev) onPrev();
        else if (e.key === 'Escape') onClose();
    }, [hasNext, hasPrev, onNext, onPrev, onClose]);

    useEffect(() => { window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown); }, [handleKeyDown]);

    useEffect(() => {
        let currentUrl: string | null = null;
        if (image && image.file) {
            setIsHighResLoaded(false);
            setZoomLevel(0);
            currentUrl = URL.createObjectURL(image.file);
            setHighResUrl(currentUrl);
        } else setHighResUrl(null);
        return () => { if (currentUrl) URL.revokeObjectURL(currentUrl); };
    }, [image?.id, image?.file]);

    if (!image) return null;

    const currentTags = image.tags || [];
    let filteredTags = allTags.filter((tag: string) => tag.toLowerCase().includes(filterText.toLowerCase()));
    if (showOnlyAdded) {
        filteredTags = filteredTags.filter((tag: string) => currentTags.includes(tag));
    }

    const toggleTag = (tag: string) => {
        if (currentTags.includes(tag)) {
            updateTags(image.id, currentTags.filter((t: string) => t !== tag));
            soundManager.click();
        } else {
            updateTags(image.id, [...currentTags, tag]);
            soundManager.pop();
        }
    };

    const handleSidebarKeyDown = (e: any) => {
        if (e.key === ',' || e.key === 'Enter') {
            e.preventDefault();
            const newTag = filterText.trim().replace(/,$/, '');
            if (newTag && !currentTags.includes(newTag)) {
                updateTags(image.id, [...currentTags, newTag]);
                setFilterText('');
                soundManager.pop();
            }
        }
    };

    const handleAddAll = () => {
        updateTags(image.id, [...allTags]);
        soundManager.chime();
    };

    const handleRemoveAll = () => {
        updateTags(image.id, []);
        soundManager.pop();
    };

    const handleSaveSingleTxt = async () => {
        const tagString = currentTags.length > 0 ? currentTags.join(', ') + ',' : '';
        const baseName = image.file.name.substring(0, image.file.name.lastIndexOf('.')) || image.file.name;
        const fileName = `${baseName}.txt`;
        
        try {
            if (dirHandle) {
                const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(tagString);
                await writable.close();
                
                updateOriginalTags(image.id, currentTags);
                soundManager.chime();
                if (showNotification) showNotification(t.successSaveSingle, "success");
                return;
            }

            const blob = new Blob([tagString], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; 
            a.download = fileName; 
            document.body.appendChild(a);
            a.click(); 
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            updateOriginalTags(image.id, currentTags);
            soundManager.chime();
            if (showNotification) showNotification(t.successSaveSingle, "success");
        } catch (err) {
            console.error("Errore salvataggio singolo:", err);
        }
    };

    const animClass = slideDirection === 'left' ? 'anim-slide-right' : 'anim-slide-left';

    return (
        <div className={`fixed inset-0 z-[100] flex ${isDarkMode ? 'bg-black/95' : 'bg-gray-50/98'} backdrop-blur-sm p-4 md:p-6 animate-in fade-in`} onClick={onClose}>
            <div className="w-full h-full max-w-[1920px] mx-auto flex gap-6" onClick={e => e.stopPropagation()}>
                <div className="flex-1 flex flex-col items-center gap-6 h-full min-w-0 relative">
                    <div className="absolute top-0 left-0 flex gap-2 z-[110]">
                        <button className={`p-2.5 ${isDarkMode ? 'bg-gray-800/60 hover:bg-red-500 text-white border-gray-700/50' : 'bg-white hover:bg-red-500 text-gray-800 hover:text-white border-gray-200'} rounded-full transition-all border shadow-md`} onClick={onClose} title={t.close}><X size={24} /></button>
                        {onMoveToTrash && (
                            <button className={`p-2.5 ${isDarkMode ? 'bg-gray-800/60 hover:bg-red-500 text-white border-gray-700/50' : 'bg-white hover:bg-red-500 text-gray-800 hover:text-white border-gray-200'} rounded-full transition-all border shadow-md`} onClick={(e) => { e.stopPropagation(); onMoveToTrash(image.id); onClose(); }} title={t.moveToTrash}><Trash2 size={24} /></button>
                        )}
                    </div>
                    <div className={`relative w-full flex-1 rounded-xl mt-14 overflow-hidden shadow-2xl flex items-center justify-center border ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
                        {hasPrev && <button onClick={(e) => { e.stopPropagation(); onPrev(); }} className={`absolute left-4 top-1/2 -translate-y-1/2 p-3 ${isDarkMode ? 'bg-black/40 hover:bg-indigo-600 text-white border-white/10' : 'bg-white/60 hover:bg-indigo-600 text-gray-800 hover:text-white border-gray-200'} rounded-full backdrop-blur-md z-[110] border transition-all shadow-lg`}><ChevronLeft size={32} /></button>}
                        {hasNext && <button onClick={(e) => { e.stopPropagation(); onNext(); }} className={`absolute right-4 top-1/2 -translate-y-1/2 p-3 ${isDarkMode ? 'bg-black/40 hover:bg-indigo-600 text-white border-white/10' : 'bg-white/60 hover:bg-indigo-600 text-gray-800 hover:text-white border-gray-200'} rounded-full backdrop-blur-md z-[110] border transition-all shadow-lg`}><ChevronRight size={32} /></button>}
                        <div key={image.id} className={`w-full h-full relative ${animClass} ${zoomLevel > 0 ? 'cursor-zoom-out' : 'cursor-zoom-in'}`} onClick={(e) => {
                            const nextZoom = (zoomLevel + 1) % 3;
                            if (nextZoom !== 0) {
                                const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
                                setZoomOrigin(`${((e.clientX - left) / width) * 100}% ${((e.clientY - top) / height) * 100}%`);
                            } else setZoomOrigin('center');
                            setZoomLevel(nextZoom);
                        }} onMouseMove={(e) => {
                            if (zoomLevel > 0) {
                                const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
                                setZoomOrigin(`${((e.clientX - left) / width) * 100}% ${((e.clientY - top) / height) * 100}%`);
                            }
                        }}>
                            {!isHighResLoaded && <div className="absolute inset-0 flex flex-col items-center justify-center z-10"><div className="absolute inset-0 bg-cover bg-center filter blur-lg opacity-40 scale-110" style={{ backgroundImage: `url(${image.thumb})` }} /><div className={`relative ${isDarkMode ? 'bg-black/60 border-white/10' : 'bg-white/60 border-gray-200'} p-4 rounded-2xl backdrop-blur-md text-center border shadow-xl`}><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div><span className={`${isDarkMode ? 'text-white' : 'text-gray-800'} mt-3 block text-sm font-semibold tracking-wider`}>{t.loadingHD}</span></div></div>}
                            <div className="w-full h-full" style={{ backgroundImage: `url(${highResUrl})`, backgroundPosition: zoomOrigin, backgroundSize: zoomLevel === 2 ? '350%' : zoomLevel === 1 ? '200%' : 'contain', backgroundRepeat: 'no-repeat', transition: 'background-size 0.3s', opacity: isHighResLoaded ? 1 : 0 }} />
                            {highResUrl && <img src={highResUrl} onLoad={() => setIsHighResLoaded(true)} className="hidden" alt="HD" /> }
                        </div>
                    </div>
                </div>
                <div className={`hidden lg:flex flex-col w-80 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-2xl shadow-xl border shrink-0 h-full overflow-hidden`}>
                    <div className={`p-4 border-b ${isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'} text-center shrink-0`}>
                        <h3 className={`text-sm font-bold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'} flex items-center justify-center gap-2`}><LayoutDashboard size={16} className="text-indigo-500" /> {t.tagsAlreadyInserted}</h3>
                        <p className={`text-[10px] ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mt-1 uppercase tracking-wide`}>{t.clickPillsToAdd}</p>
                    </div>
                    
                    <div className={`px-4 py-3 border-b ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'} shrink-0 flex flex-col gap-3 shadow-sm z-10`}>
                        <div className="flex items-center justify-between px-1">
                            <span className={`text-xs font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{t.showOnlyAdded}</span>
                            <AppleToggle checked={showOnlyAdded} onChange={setShowOnlyAdded} iconOn={<span />} iconOff={<span />} colorClass="bg-indigo-500" />
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleAddAll} className={`flex-1 py-1.5 ${isDarkMode ? 'bg-indigo-900/30 border-indigo-800/50 text-indigo-400 hover:bg-indigo-900/50' : 'bg-indigo-50 border-indigo-100 text-indigo-600 hover:bg-indigo-100'} rounded-lg text-xs font-bold transition-colors border`}>
                                {t.addAllTags}
                            </button>
                            <button onClick={handleRemoveAll} className={`flex-1 py-1.5 ${isDarkMode ? 'bg-red-900/30 border-red-800/50 text-red-400 hover:bg-red-900/50' : 'bg-red-50 border-red-100 text-red-600 hover:bg-red-100'} rounded-lg text-xs font-bold transition-colors border`}>
                                {t.removeAllTags}
                            </button>
                        </div>
                    </div>

                    <div className={`flex-1 p-3 overflow-y-auto flex flex-wrap content-start gap-1.5 lightbox-scroll relative ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                        {allTags.length === 0 ? <p className="text-sm text-gray-500 w-full text-center mt-4 italic">{t.noTagsInProject}</p> : filteredTags.length === 0 ? <p className="text-sm text-gray-500 w-full text-center mt-4 italic">{t.noTagsFound}</p> : filteredTags.map((tag: string, idx: number) => {
                            const isAiGenerated = aiDiscoveredTags.includes(tag);
                            return (
                            <button key={idx} onClick={() => toggleTag(tag)} className={`px-2 py-1 rounded-full text-[11px] leading-tight font-medium transition-colors border shadow-sm flex items-center gap-1 ${currentTags.includes(tag) ? 'bg-indigo-500 border-indigo-500 text-white hover:bg-indigo-600' : isAiGenerated ? 'border-purple-500 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40' : (isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200')}`}>
                                {isAiGenerated && <Sparkles size={10} className={currentTags.includes(tag) ? 'text-white' : ''} />}
                                {tag}
                            </button>
                        )})}
                    </div>
                    <div className={`p-4 border-t ${isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'} shrink-0 flex flex-col gap-3`}>
                        
                        {/* ITALIANO: Sezione Strumenti AI */}
                        {/* ENGLISH: AI Tools Section */}
                        <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'} flex flex-col gap-2`}>
                            <div className="flex items-center justify-between mb-1">
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{t.aiTools}</span>
                                <div className="flex items-center gap-1">
                                    <span className={`text-[10px] ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{t.maxTags}:</span>
                                    <input 
                                        type="number" 
                                        min="1" 
                                        max="20" 
                                        value={maxTags} 
                                        onChange={(e) => setMaxTags(Math.max(1, parseInt(e.target.value) || 1))}
                                        className={`w-10 px-1 py-0.5 text-[10px] rounded border text-center outline-none focus:ring-1 focus:ring-indigo-500 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-800'}`}
                                    />
                                </div>
                            </div>
                            <button 
                                onClick={handleMagicWand} 
                                disabled={isProcessingAI}
                                className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${isProcessingAI ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-md active:scale-95'}`}
                            >
                                {isProcessingAI ? <Loader2 size={14} className="animate-spin" /> : <div className="relative"><Tag size={14} /><Sparkles size={8} className="absolute -top-1 -right-1 text-yellow-300 animate-pulse" /></div>}
                                {isProcessingAI ? t.generating : t.magicWand}
                            </button>
                            {/* ITALIANO: Barra di caricamento per l'AI */}
                            {/* ENGLISH: Loading bar for AI */}
                            {isProcessingAI && (
                                <div className="w-full px-1 pb-1 flex flex-col gap-1">
                                    <div className="flex justify-between items-center px-1">
                                        <span className={`text-[9px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>{aiProgress > 0 ? t.modelLoading : t.generating}</span>
                                        {aiProgress > 0 && <span className={`text-[9px] font-bold ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>{Math.floor(aiProgress)}%</span>}
                                    </div>
                                    <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                                        <div 
                                            className={`h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300 ${aiProgress === 0 ? 'w-full animate-pulse' : ''}`} 
                                            style={aiProgress > 0 ? { width: `${aiProgress}%` } : {}}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <input type="text" value={filterText} onChange={e => setFilterText(e.target.value)} onKeyDown={handleSidebarKeyDown} placeholder={t.searchOrAdd} className={`w-full ${isDarkMode ? 'bg-gray-800 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-800'} border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500`} />
                        <button onClick={handleSaveSingleTxt} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg shadow-md font-semibold transition-all active:scale-95 text-sm"><Save size={16} /> {t.saveSingleTxt}</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
