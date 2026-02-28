export type TagCategory = 'characters' | 'places' | 'styles' | 'colors' | 'framing' | 'nsfw' | 'general';

const nsfwKeywords = ['nude', 'naked', 'nsfw', 'explicit', 'breasts', 'nipples', 'sex', 'porn', 'pussy', 'penis', 'ass', 'uncensored', 'hentai', 'r18', 'rule34', '18+'];
const charactersKeywords = ['boy', 'girl', 'man', 'woman', '1girl', '1boy', 'character', 'solo', 'multiple girls', 'multiple boys', 'male', 'female', 'eyes', 'hair', 'face', 'smile', 'looking at viewer', 'portrait', 'person', 'people'];
const placesKeywords = ['outdoors', 'indoors', 'scenery', 'sky', 'building', 'tree', 'nature', 'city', 'room', 'landscape', 'background', 'water', 'ocean', 'forest', 'street', 'day', 'night', 'sunlight'];
const stylesKeywords = ['sketch', 'realistic', '3d', 'painting', 'anime', 'monochrome', 'comic', 'illustration', 'watercolor', 'oil painting', 'pixel art', 'concept art', 'digital art', 'traditional media', 'greyscale'];
const colorsKeywords = ['red', 'blue', 'green', 'white', 'black', 'yellow', 'pink', 'purple', 'orange', 'brown', 'grey', 'gray', 'colorful', 'dark', 'light', 'monochrome'];
const framingKeywords = ['cowboy shot', 'close-up', 'full body', 'upper body', 'portrait', 'depth of field', 'blurry background', 'dutch angle', 'from below', 'from above', 'wide shot', 'macro', 'focus', 'bokeh'];

export const getTagCategory = (tag: string): TagCategory => {
    const lowerTag = tag.toLowerCase();
    
    // Check NSFW first
    if (nsfwKeywords.some(kw => lowerTag.includes(kw))) return 'nsfw';
    
    // Check others
    if (charactersKeywords.some(kw => lowerTag.includes(kw))) return 'characters';
    if (placesKeywords.some(kw => lowerTag.includes(kw))) return 'places';
    if (stylesKeywords.some(kw => lowerTag.includes(kw))) return 'styles';
    if (colorsKeywords.some(kw => lowerTag.includes(kw))) return 'colors';
    if (framingKeywords.some(kw => lowerTag.includes(kw))) return 'framing';
    
    return 'general';
};

export const getCategoryColor = (category: TagCategory, isDarkMode: boolean) => {
    switch (category) {
        case 'nsfw':
            return isDarkMode ? 'bg-red-900/30 text-red-400 border-red-800/50' : 'bg-red-100 text-red-700 border-red-200';
        case 'characters':
            return isDarkMode ? 'bg-blue-900/30 text-blue-400 border-blue-800/50' : 'bg-blue-100 text-blue-700 border-blue-200';
        case 'places':
            return isDarkMode ? 'bg-green-900/30 text-green-400 border-green-800/50' : 'bg-green-100 text-green-700 border-green-200';
        case 'styles':
            return isDarkMode ? 'bg-purple-900/30 text-purple-400 border-purple-800/50' : 'bg-purple-100 text-purple-700 border-purple-200';
        case 'colors':
            return isDarkMode ? 'bg-amber-900/30 text-amber-400 border-amber-800/50' : 'bg-amber-100 text-amber-700 border-amber-200';
        case 'framing':
            return isDarkMode ? 'bg-teal-900/30 text-teal-400 border-teal-800/50' : 'bg-teal-100 text-teal-700 border-teal-200';
        default:
            return isDarkMode ? 'bg-gray-800 text-gray-200 border-gray-700' : 'bg-white text-gray-700 border-gray-200';
    }
};
