import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Save, LayoutDashboard } from 'lucide-react';
import { soundManager } from '../utils/soundManager';
import { AppleToggle } from './ui';

export const Lightbox = ({ image, onClose, updateTags, allTags, t, onNext, onPrev, hasNext, hasPrev, slideDirection, showNotification, updateOriginalTags, dirHandle }: any) => {
    const [zoomLevel, setZoomLevel] = useState(0);
    const [filterText, setFilterText] = useState('');
    const [zoomOrigin, setZoomOrigin] = useState('center');
    const [highResUrl, setHighResUrl] = useState<string | null>(null);
    const [isHighResLoaded, setIsHighResLoaded] = useState(false);
    const [showOnlyAdded, setShowOnlyAdded] = useState(false);

    const handleKeyDown = useCallback((e: any) => {
        if (!image) return;
        if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
        if (e.key === 'ArrowRight' && hasNext) onNext();
        else if (e.key === 'ArrowLeft' && hasPrev) onPrev();
        else if (e.key === 'Escape') onClose();
    }, [image, hasNext, hasPrev, onNext, onPrev, onClose]);

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
    }, [image]);

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
        <div className="fixed inset-0 z-[100] flex bg-black/95 backdrop-blur-sm p-4 md:p-6 animate-in fade-in" onClick={onClose}>
            <div className="w-full h-full max-w-[1920px] mx-auto flex gap-6" onClick={e => e.stopPropagation()}>
                <div className="flex-1 flex flex-col items-center gap-6 h-full min-w-0 relative">
                    <button className="absolute top-0 left-0 p-2.5 bg-gray-800/60 hover:bg-red-500 rounded-full text-white border border-gray-700/50 transition-all z-[110]" onClick={onClose} title={t.close}><X size={24} /></button>
                    <div className="relative w-full flex-1 rounded-xl mt-14 overflow-hidden shadow-2xl flex items-center justify-center bg-gray-900 border border-gray-800">
                        {hasPrev && <button onClick={(e) => { e.stopPropagation(); onPrev(); }} className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/40 hover:bg-indigo-600 text-white rounded-full backdrop-blur-md z-[110] border border-white/10 transition-all"><ChevronLeft size={32} /></button>}
                        {hasNext && <button onClick={(e) => { e.stopPropagation(); onNext(); }} className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/40 hover:bg-indigo-600 text-white rounded-full backdrop-blur-md z-[110] border border-white/10 transition-all"><ChevronRight size={32} /></button>}
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
                            {!isHighResLoaded && <div className="absolute inset-0 flex flex-col items-center justify-center z-10"><div className="absolute inset-0 bg-cover bg-center filter blur-lg opacity-40 scale-110" style={{ backgroundImage: `url(${image.thumb})` }} /><div className="relative bg-black/60 p-4 rounded-2xl backdrop-blur-md text-center border border-white/10"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div><span className="text-white mt-3 block text-sm font-semibold tracking-wider">{t.loadingHD}</span></div></div>}
                            <div className="w-full h-full" style={{ backgroundImage: `url(${highResUrl})`, backgroundPosition: zoomOrigin, backgroundSize: zoomLevel === 2 ? '350%' : zoomLevel === 1 ? '200%' : 'contain', backgroundRepeat: 'no-repeat', transition: 'background-size 0.3s', opacity: isHighResLoaded ? 1 : 0 }} />
                            {highResUrl && <img src={highResUrl} onLoad={() => setIsHighResLoaded(true)} className="hidden" alt="HD" /> }
                        </div>
                    </div>
                </div>
                <div className="hidden lg:flex flex-col w-80 bg-gray-800 rounded-2xl shadow-xl border border-gray-700 shrink-0 h-full overflow-hidden">
                    <div className="p-4 border-b border-gray-700 bg-gray-900 text-center shrink-0">
                        <h3 className="text-sm font-bold text-gray-200 flex items-center justify-center gap-2"><LayoutDashboard size={16} className="text-indigo-500" /> {t.tagsAlreadyInserted}</h3>
                        <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wide">{t.clickPillsToAdd}</p>
                    </div>
                    
                    <div className="px-4 py-3 border-b border-gray-700 bg-gray-800 shrink-0 flex flex-col gap-3 shadow-sm z-10">
                        <div className="flex items-center justify-between px-1">
                            <span className="text-xs font-semibold text-gray-300">{t.showOnlyAdded}</span>
                            <AppleToggle checked={showOnlyAdded} onChange={setShowOnlyAdded} iconOn={<span />} iconOff={<span />} colorClass="bg-indigo-500" />
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleAddAll} className="flex-1 py-1.5 bg-indigo-900/30 hover:bg-indigo-900/50 text-indigo-400 rounded-lg text-xs font-bold transition-colors border border-indigo-800/50">
                                {t.addAllTags}
                            </button>
                            <button onClick={handleRemoveAll} className="flex-1 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg text-xs font-bold transition-colors border border-red-800/50">
                                {t.removeAllTags}
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 p-3 overflow-y-auto flex flex-wrap content-start gap-1.5 lightbox-scroll relative bg-gray-800">
                        {allTags.length === 0 ? <p className="text-sm text-gray-500 w-full text-center mt-4 italic">{t.noTagsInProject}</p> : filteredTags.length === 0 ? <p className="text-sm text-gray-500 w-full text-center mt-4 italic">{t.noTagsFound}</p> : filteredTags.map((tag: string, idx: number) => (
                            <button key={idx} onClick={() => toggleTag(tag)} className={`px-2 py-1 rounded-full text-[11px] leading-tight font-medium transition-colors border shadow-sm ${currentTags.includes(tag) ? 'bg-indigo-500 border-indigo-500 text-white hover:bg-indigo-600' : 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600'}`}>{tag}</button>
                        ))}
                    </div>
                    <div className="p-4 border-t border-gray-700 bg-gray-900 shrink-0 flex flex-col gap-3">
                        <input type="text" value={filterText} onChange={e => setFilterText(e.target.value)} onKeyDown={handleSidebarKeyDown} placeholder={t.searchOrAdd} className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2.5 text-sm text-gray-200 outline-none focus:ring-2 focus:ring-indigo-500" />
                        <button onClick={handleSaveSingleTxt} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg shadow-md font-semibold transition-all active:scale-95 text-sm"><Save size={16} /> {t.saveSingleTxt}</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
