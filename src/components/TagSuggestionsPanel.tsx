import React, { useState } from 'react';
import { X, ChevronDown, ChevronRight, User, MapPin, Palette, Camera, Tag as TagIcon, Tags, Info, ChevronsDown, ChevronsUp } from 'lucide-react';
import { suggestedTagsData, TagCategoryList } from '../constants/tagSuggestions';
import { getCategoryColor, TagCategory } from '../utils/tagCategorization';

interface TagSuggestionsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onTagClick: (tag: string) => void;
    lang: string;
    isDarkMode: boolean;
    t: any;
    isLightbox?: boolean;
    selectedTags?: string[];
}

const iconMap: Record<string, React.ReactNode> = {
    'User': <User size={16} />,
    'MapPin': <MapPin size={16} />,
    'Palette': <Palette size={16} />,
    'Camera': <Camera size={16} />,
};

export const TagSuggestionsPanel: React.FC<TagSuggestionsPanelProps> = ({ isOpen, onClose, onTagClick, lang, isDarkMode, t, isLightbox = false, selectedTags = [] }) => {
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(
        suggestedTagsData.reduce((acc, cat) => ({ ...acc, [cat.id]: false }), {})
    );

    const toggleCategory = (id: string) => {
        setExpandedCategories(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const expandAll = () => {
        setExpandedCategories(suggestedTagsData.reduce((acc, cat) => ({ ...acc, [cat.id]: true }), {}));
    };

    const collapseAll = () => {
        setExpandedCategories(suggestedTagsData.reduce((acc, cat) => ({ ...acc, [cat.id]: false }), {}));
    };

    return (
        <div 
            className={`flex flex-col h-full shrink-0 transition-all duration-300 overflow-hidden ${isOpen ? `w-80 ${isLightbox ? 'rounded-2xl border shadow-xl' : 'border-l'}` : `w-0 ${isLightbox ? 'border-0' : 'border-l-0'}`} ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
        >
            <div className={`w-80 flex flex-col h-full`}>
                <div className={`p-4 border-b flex justify-between items-center shrink-0 ${isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
                    <h2 className={`text-lg font-bold flex items-center gap-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                        <Tags size={20} className="text-cyan-500" />
                        {t.suggestedTags || 'Tag Suggeriti'}
                    </h2>
                    <button onClick={onClose} className={`p-1.5 rounded-full hover:bg-red-500 hover:text-white transition-colors ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        <X size={18} />
                    </button>
                </div>

                <div className={`flex-1 overflow-y-auto p-[10px] flex flex-col gap-4 lightbox-scroll min-h-0 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`} style={{ scrollbarGutter: 'stable' }}>
                    <div className="flex gap-2 shrink-0">
                        <button 
                            onClick={expandAll}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white shadow-md active:scale-95`}
                        >
                            <ChevronsDown size={14} />
                            {t.expandAll || 'Espandi tutti'}
                        </button>
                        <button 
                            onClick={collapseAll}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white shadow-md active:scale-95`}
                        >
                            <ChevronsUp size={14} />
                            {t.collapseAll || 'Comprimi tutti'}
                        </button>
                    </div>
                {suggestedTagsData.map((category: TagCategoryList) => {
                    const isExpanded = expandedCategories[category.id];
                    const categoryName = category.name[lang] || category.name['en'];
                    
                    return (
                        <div key={category.id} className={`rounded-xl border overflow-hidden shrink-0 ${isDarkMode ? 'border-gray-700 bg-gray-900/30' : 'border-gray-200 bg-gray-50/50'}`}>
                            <button 
                                onClick={() => toggleCategory(category.id)}
                                className={`w-full p-3 flex items-center justify-between transition-colors ${isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100'}`}
                            >
                                <div className={`flex items-center gap-2 font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {iconMap[category.icon] || <TagIcon size={16} />}
                                    {categoryName}
                                </div>
                                {isExpanded ? <ChevronDown size={16} className={isDarkMode ? 'text-gray-500' : 'text-gray-400'} /> : <ChevronRight size={16} className={isDarkMode ? 'text-gray-500' : 'text-gray-400'} />}
                            </button>
                            
                            {isExpanded && (
                                <div className={`p-3 pt-2 pb-3 flex flex-wrap gap-3.5`}>
                                    {category.tags.map((tagObj, idx) => {
                                        const translation = tagObj.translations[lang] || tagObj.translations['en'];
                                        const baseColorClass = getCategoryColor(category.id as TagCategory, isDarkMode);
                                        const isSelected = selectedTags.includes(tagObj.tag);
                                        
                                        let buttonClass = '';
                                        if (isSelected) {
                                            buttonClass = `${baseColorClass} ring-2 ring-offset-1 ${isDarkMode ? 'ring-offset-gray-800 ring-white' : 'ring-offset-white ring-black'} shadow-md scale-105 font-bold`;
                                        } else {
                                            buttonClass = `${baseColorClass} border border-transparent hover:brightness-110 shadow-sm`;
                                        }
                                        
                                        return (
                                            <div key={idx} className="relative group">
                                                <button 
                                                    onClick={() => onTagClick(tagObj.tag)}
                                                    className={`px-2 py-1 rounded-full text-[11px] transition-all flex items-center gap-1 hover:scale-105 active:scale-95 ${buttonClass}`}
                                                >
                                                    {translation}
                                                </button>
                                                
                                                {/* Tooltip */}
                                                <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded text-[10px] font-bold whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-lg pointer-events-none ${isDarkMode ? 'bg-gray-700 text-white border border-gray-600' : 'bg-gray-800 text-white'}`}>
                                                    {tagObj.tag}
                                                    <div className={`absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent ${isDarkMode ? 'border-t-gray-700' : 'border-t-gray-800'}`}></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            </div>
        </div>
    );
};
