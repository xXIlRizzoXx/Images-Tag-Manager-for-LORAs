import React, { useState, useRef, useEffect } from 'react';
import { X, TriangleAlert, Info, Check } from 'lucide-react';
import { soundManager } from '../utils/soundManager';

export const AppleToggle = ({ checked, onChange, iconOn, iconOff, colorClass = "bg-green-500" }: any) => (
    <div onClick={() => { onChange(!checked); if(!checked) soundManager.pop(); else soundManager.click(); }} className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ease-in-out shadow-inner shrink-0 ${checked ? colorClass : 'bg-gray-300 dark:bg-gray-600'}`}>
        <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ease-in-out flex justify-center items-center ${checked ? 'translate-x-6' : 'translate-x-0'}`}>
        <span className="text-gray-800 w-3 h-3 flex items-center justify-center">{checked ? iconOn : iconOff}</span>
        </div>
    </div>
);

export const TagInput = ({ tags, setTags, placeholder = "Scrivi tag...", isGlobal = false, maxHeight = "max-h-[120px]" }: any) => {
    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    
    const handleKeyDown = (e: any) => {
        if (e.key === ',' || e.key === 'Enter') {
            e.preventDefault();
            const newTag = inputValue.trim().replace(/,$/, '');
            if (newTag && !tags.includes(newTag)) { setTags([...tags, newTag]); setInputValue(''); soundManager.pop(); }
        } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
            setTags(tags.slice(0, -1)); soundManager.click();
        }
    };

    const handlePaste = (e: any) => {
        e.preventDefault();
        const pasteData = e.clipboardData.getData('text');
        const newTags = pasteData.split(/[,\n\r]+/)
            .map((t: string) => t.trim())
            .filter((t: string) => t && !tags.includes(t));
        
        if (newTags.length > 0) {
            setTags([...tags, ...newTags]);
            soundManager.pop();
        }
    };

    const removeTag = (idx: number) => { setTags(tags.filter((_: any, i: number) => i !== idx)); soundManager.click(); };
    
    return (
        <div onClick={() => inputRef.current?.focus()} className={`flex flex-wrap items-center content-start gap-1 p-1.5 border rounded-xl transition-all w-full min-h-[46px] overflow-y-auto cursor-text ${maxHeight} ${isGlobal ? 'justify-center bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-700/50 focus-within:ring-2 focus-within:ring-indigo-500/50' : 'bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500'}`}>
        {tags.map((tag: string, index: number) => (
            <span key={index} className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] leading-tight font-medium animate-in zoom-in duration-200 ${isGlobal ? 'bg-indigo-500 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 shadow-sm'}`}>
            {tag}
            <button onClick={(e) => { e.stopPropagation(); removeTag(index); }} className="hover:bg-black/10 dark:hover:bg-black/20 rounded-full p-0.5 transition-colors focus:outline-none"><X size={10} /></button>
            </span>
        ))}
        <input 
            ref={inputRef}
            type="text" 
            value={inputValue} 
            onChange={(e) => setInputValue(e.target.value)} 
            onKeyDown={handleKeyDown} 
            onPaste={handlePaste}
            placeholder={tags.length === 0 ? placeholder : "Scrivi tag..."} 
            className={`w-full bg-transparent border-none outline-none text-gray-800 dark:text-gray-100 placeholder-gray-400 text-sm py-1 px-1 ${isGlobal ? 'text-center' : ''}`} 
        />
        </div>
    );
};

export const Toast = ({ message, type, onClose }: any) => {
    useEffect(() => { const timer = setTimeout(onClose, 4000); return () => clearTimeout(timer); }, [onClose]);
    const bgColor = type === 'error' ? 'bg-red-600' : 'bg-emerald-500';
    const infoColor = type === 'info' ? 'bg-blue-600' : bgColor;
    return (
        <div className={`fixed bottom-8 right-8 flex items-center gap-3 px-6 py-3 rounded-full shadow-2xl text-white ${infoColor} animate-in slide-in-from-bottom-10 fade-in z-[9999] w-max max-w-[90vw]`}>
            {type === 'error' ? <TriangleAlert size={18} /> : type === 'info' ? <Info size={18} /> : <Check size={18} />}
            <span className="font-medium text-sm whitespace-nowrap">{message}</span>
            <button onClick={onClose} className="ml-2 hover:bg-black/20 rounded-full p-1 transition-colors"><X size={14} /></button>
        </div>
    );
};

export const CustomConfirmDialog = ({ isOpen, title, message, onConfirm, onCancel, t }: any) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-3 text-red-500 dark:text-red-400"><TriangleAlert size={24} /><h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3></div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed ml-9">{message}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-4 flex justify-end gap-3 border-t border-gray-100 dark:border-gray-700">
                    <button onClick={onCancel} className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">{t.cancel}</button>
                    <button onClick={onConfirm} className="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 shadow-md shadow-red-500/20 transition-all active:scale-95">{title}</button>
                </div>
            </div>
        </div>
    );
};
