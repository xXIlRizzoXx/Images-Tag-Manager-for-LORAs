/******************************************************************************
*******************************************************************************
**                                                                            **
**  ITALIANO: VISUALIZZATORE IMMAGINI (LIGHTBOX)                              **
**  Questo file gestisce la finestra che si apre quando clicchi su un'immagine.**
**  Permette di vedere l'immagine ingrandita, modificarne tag e didascalia,   **
**  e usare l'AI offline (tag WD14 + didascalia BLIP) se abilitata.           **
**                                                                            **
**  ENGLISH: IMAGE VIEWER (LIGHTBOX)                                          **
**  This file manages the window that opens when you click on an image.       **
**  It allows viewing, editing tags and caption, plus offline AI (WD14 tags + **
**  BLIP caption) when enabled.                                               **
**                                                                            **
*******************************************************************************
*******************************************************************************/
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Save, LayoutDashboard, Tag, Trash2, Tags, AlertTriangle, Wand2, Loader2, Sparkles } from 'lucide-react';
import { soundManager } from '../utils/soundManager';
import { AppleToggle } from './ui';

import { getTagCategory, getCategoryColor, getActiveCategoryColor } from '../utils/tagCategorization';
import { TagSuggestionsPanel } from './TagSuggestionsPanel';
import { buildTagFileName } from '../utils/pathUtils';

export const Lightbox = ({ image, onClose, updateTags, updateImageCaption, allTags, t, onNext, onPrev, hasNext, hasPrev, slideDirection, showNotification, updateOriginalTags, dirHandle, isDarkMode, onMoveToTrash, lang, globalTriggers = [], aiEnabled = false, aiBusy = false, onAITagSingle, onAICaptionSingle }: any) => {
    const [zoomLevel, setZoomLevel] = useState(0);
    const [filterText, setFilterText] = useState('');
    const [zoomOrigin, setZoomOrigin] = useState('center');
    const [highResUrl, setHighResUrl] = useState<string | null>(null);
    const [isHighResLoaded, setIsHighResLoaded] = useState(false);
    const [showOnlyAdded, setShowOnlyAdded] = useState(false);
    const [isTagSuggestionsOpen, setIsTagSuggestionsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'tags' | 'caption'>('tags');
    const [captionDraft, setCaptionDraft] = useState<string>(image?.caption || '');

    const imageRef = useRef(image);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    useEffect(() => {
        imageRef.current = image;
        setCaptionDraft(image?.caption || '');
    }, [image]);

    const handleKeyDown = useCallback((e: any) => {
        if (!imageRef.current) return;
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
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

    const handleAddAll = () => { updateTags(image.id, [...allTags]); soundManager.chime(); };
    const handleRemoveAll = () => { updateTags(image.id, []); soundManager.pop(); };

    const handleSaveSingleTxt = async () => {
        const orderedTags = [
            ...globalTriggers.filter((t: string) => currentTags.includes(t)),
            ...currentTags.filter((t: string) => !globalTriggers.includes(t))
        ];
        const tagString = orderedTags.length > 0 ? orderedTags.join(', ') + ',' : '';
        const fileName = buildTagFileName(image.file.name);

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
            try {
                const a = document.createElement('a');
                a.href = url; a.download = fileName;
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
            } finally { URL.revokeObjectURL(url); }
            updateOriginalTags(image.id, currentTags);
            soundManager.chime();
            if (showNotification) showNotification(t.successSaveSingle, "success");
        } catch (err) {
            console.error("Errore salvataggio singolo");
        }
    };

    const handleAITagClick = async () => {
        if (!onAITagSingle || aiBusy) return;
        await onAITagSingle(image.id);
    };

    const handleAICaptionClick = async () => {
        if (!onAICaptionSingle || aiBusy) return;
        const result = await onAICaptionSingle(image.id);
        if (result && isMountedRef.current) setCaptionDraft(result);
    };

    const handleSaveCaption = () => {
        if (!updateImageCaption) return;
        updateImageCaption(image.id, captionDraft);
        soundManager.chime();
        if (showNotification) showNotification(t.aiCaptionSaved || 'Caption saved!', 'success');
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
                    <div className="absolute top-0 right-0 flex gap-2 z-[110]">
                        {image.width * image.height < 1048576 && (
                            <div className="relative group/alert">
                                <div className="p-2.5 bg-yellow-500 text-white rounded-full transition-all border border-yellow-600 shadow-md flex items-center justify-center cursor-help">
                                    <AlertTriangle size={24} strokeWidth={2.5} />
                                </div>
                                <div className="absolute right-0 top-full mt-2 w-64 p-2.5 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover/alert:opacity-100 group-hover/alert:visible transition-all duration-200 pointer-events-none whitespace-pre-line border border-gray-700">
                                    {`${t.minQualityWarning || 'Qualità minima richiesta dal sistema: 1 Megapixel (es. 1024x1024)'}\n${t.imageQualityLabel || 'Qualità di questa immagine'}: ${image.width}x${image.height} (${(image.width * image.height / 1000000).toFixed(2)} MP)`}
                                </div>
                            </div>
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
                    {aiEnabled && (
                        <div className={`flex border-b shrink-0 ${isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
                            <button
                                onClick={() => setActiveTab('tags')}
                                className={`flex-1 py-2.5 text-xs font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 ${activeTab === 'tags' ? (isDarkMode ? 'text-indigo-400 border-b-2 border-indigo-400 bg-gray-800/40' : 'text-indigo-600 border-b-2 border-indigo-600 bg-white') : (isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700')}`}
                            >
                                <Tag size={12} /> {t.aiTagsTab || 'Tags'}
                            </button>
                            <button
                                onClick={() => setActiveTab('caption')}
                                className={`flex-1 py-2.5 text-xs font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 ${activeTab === 'caption' ? (isDarkMode ? 'text-purple-400 border-b-2 border-purple-400 bg-gray-800/40' : 'text-purple-600 border-b-2 border-purple-600 bg-white') : (isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700')}`}
                            >
                                <Sparkles size={12} /> {t.aiCaptionTab || 'Caption'}
                            </button>
                        </div>
                    )}

                    {activeTab === 'tags' && (
                        <>
                            <div className={`p-4 border-b ${isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'} text-center shrink-0`}>
                                <h3 className={`text-sm font-bold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'} flex items-center justify-center gap-2`}><LayoutDashboard size={16} className="text-indigo-500" /> {t.tagsAlreadyInserted}</h3>
                                <p className={`text-[10px] ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mt-1 uppercase tracking-wide`}>{t.clickPillsToAdd}</p>
                            </div>

                            <div className={`px-4 py-3 border-b ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'} shrink-0 flex flex-col gap-3 shadow-sm z-10`}>
                                {aiEnabled && (
                                    <button
                                        onClick={handleAITagClick}
                                        disabled={aiBusy}
                                        className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${aiBusy ? (isDarkMode ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed') : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-md active:scale-95'}`}
                                    >
                                        {aiBusy ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                                        {aiBusy
                                            ? (t.aiTaggingInProgress || 'Tagging…')
                                            : (t.aiAutoTagSingle || 'Generate tags with AI')}
                                    </button>
                                )}
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
                                <input type="text" value={filterText} onChange={e => setFilterText(e.target.value)} onKeyDown={handleSidebarKeyDown} placeholder={t.searchOrAdd} className={`w-full mt-1 ${isDarkMode ? 'bg-gray-800 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-800'} border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500`} />

                                <button
                                    onClick={() => setIsTagSuggestionsOpen(!isTagSuggestionsOpen)}
                                    className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-colors border ${isDarkMode ? 'bg-cyan-900/30 border-cyan-800/50 text-cyan-400 hover:bg-cyan-900/50' : 'bg-cyan-50 border-cyan-100 text-cyan-600 hover:bg-cyan-100'}`}
                                >
                                    <Tags size={14} />
                                    {t.suggestedTags || 'Tag Suggeriti'}
                                </button>
                            </div>

                            <div className={`flex-1 p-3 overflow-y-auto flex flex-wrap content-start gap-3.5 lightbox-scroll relative ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                                {allTags.length === 0 ? <p className="text-sm text-gray-500 w-full text-center mt-4 italic">{t.noTagsInProject}</p> : filteredTags.length === 0 ? <p className="text-sm text-gray-500 w-full text-center mt-4 italic">{t.noTagsFound}</p> : filteredTags.map((tag: string, idx: number) => {
                                    const category = getTagCategory(tag);
                                    const isNsfw = category === 'nsfw';
                                    const baseColorClass = getCategoryColor(category, isDarkMode);
                                    const activeColorClass = getActiveCategoryColor(category);
                                    const isSelected = currentTags.includes(tag);
                                    let colorClass = '';
                                    if (isSelected) {
                                        colorClass = `${activeColorClass} scale-105 font-bold`;
                                    } else {
                                        colorClass = `${baseColorClass} border border-transparent hover:brightness-110 shadow-sm`;
                                    }
                                    return (
                                        <button key={idx} onClick={() => toggleTag(tag)} className={`px-2 py-1 rounded-full text-[11px] leading-tight transition-all flex items-center gap-1 ${colorClass}`}>
                                            {isNsfw && <span className={`font-bold text-[9px] px-1 rounded-sm mr-0.5 ${isSelected ? 'bg-white text-red-500' : 'bg-red-500 text-white'}`}>+18</span>}
                                            {tag}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className={`p-4 border-t ${isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'} shrink-0`}>
                                <button onClick={handleSaveSingleTxt} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg shadow-md font-semibold transition-all active:scale-95 text-sm"><Save size={16} /> {t.saveSingleTxt}</button>
                            </div>
                        </>
                    )}

                    {activeTab === 'caption' && aiEnabled && (
                        <div className={`flex flex-col flex-1 min-h-0 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                            <div className={`p-4 border-b ${isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'} text-center shrink-0`}>
                                <h3 className={`text-sm font-bold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'} flex items-center justify-center gap-2`}><Sparkles size={16} className="text-purple-500" /> {t.aiCaption || 'AI Caption'}</h3>
                                <p className={`text-[10px] ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mt-1 uppercase tracking-wide`}>BLIP base · offline</p>
                            </div>
                            <div className="flex-1 p-4 flex flex-col gap-3 min-h-0">
                                <textarea
                                    value={captionDraft}
                                    onChange={(e) => setCaptionDraft(e.target.value)}
                                    placeholder={t.aiCaptionPlaceholder || 'Write a caption or generate one with AI…'}
                                    className={`flex-1 w-full p-3 rounded-xl border resize-none outline-none focus:ring-2 focus:ring-purple-500 ${isDarkMode ? 'bg-gray-900 border-gray-700 text-gray-200 placeholder-gray-600' : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400'}`}
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleAICaptionClick}
                                        disabled={aiBusy}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${aiBusy ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 text-white shadow-md'}`}
                                    >
                                        {aiBusy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                        {aiBusy
                                            ? (t.aiCaptioningInProgress || 'Generating…')
                                            : (t.aiCaptionGenerate || 'Generate caption')}
                                    </button>
                                    <button
                                        onClick={handleSaveCaption}
                                        className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-md transition-all"
                                    >
                                        <Save size={14} className="inline mr-1" />
                                        {t.aiSaveCaption || 'Save caption'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <TagSuggestionsPanel
                    isOpen={isTagSuggestionsOpen}
                    onClose={() => setIsTagSuggestionsOpen(false)}
                    onTagClick={(tag) => {
                        if (!currentTags.includes(tag)) {
                            updateTags(image.id, [...currentTags, tag]);
                            soundManager.pop();
                        }
                    }}
                    lang={lang}
                    isDarkMode={isDarkMode}
                    t={t}
                    isLightbox={true}
                    selectedTags={currentTags}
                />
            </div>
        </div>
    );
};
