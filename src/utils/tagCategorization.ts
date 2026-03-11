export type TagCategory = 'characters' | 'places' | 'styles' | 'colors' | 'framing' | 'nsfw' | 'general' | 'feral_poses' | 'moods' | 'face_details' | 'bird_features' | 'seasons' | 'time_of_day' | 'weather' | 'lighting' | 'anthro_traits' | 'body_types' | 'clothing' | 'intimate' | 'accessories';

const nsfwKeywords = ['nude', 'naked', 'nsfw', 'explicit', 'breasts', 'nipples', 'sex', 'porn', 'pussy', 'penis', 'ass', 'uncensored', 'hentai', 'r18', 'rule34', '18+', 'topless', 'bottomless', 'lingerie', 'thong', 'panties', 'bra', 'bikini', 'underwear'];
const charactersKeywords = ['boy', 'girl', 'man', 'woman', '1girl', '1boy', 'character', 'solo', 'multiple girls', 'multiple boys', 'male', 'female', 'eyes', 'hair', 'face', 'smile', 'looking at viewer', 'portrait', 'person', 'people', 'human-like', 'bipedal', 'anthro', 'furry', 'kemonomimi', 'muzzle', 'snout', 'paws', 'pawpads', 'toe beans', 'claws', 'digitigrade', 'plantigrade', 'hooves', 'tail hole', 'animal ears', 'fluffy tail', 'scales', 'fur', 'fur patterns', 'striped fur', 'spotted fur', 'animal hands', 'animal feet'];
const placesKeywords = ['outdoors', 'indoors', 'scenery', 'sky', 'building', 'tree', 'nature', 'city', 'room', 'landscape', 'background', 'water', 'ocean', 'forest', 'street', 'day', 'night', 'sunlight', 'jungle', 'desert', 'beach', 'sea', 'lake', 'river', 'waterfall', 'mountains', 'hills', 'valley', 'meadow', 'field', 'cave', 'ruins', 'cityscape', 'town', 'village', 'alley', 'park', 'garden', 'bedroom', 'living room', 'bathroom', 'kitchen', 'library', 'office', 'castle', 'dungeon', 'fantasy landscape', 'sci-fi city', 'space', 'underwater'];
const stylesKeywords = ['sketch', 'realistic', '3d', 'painting', 'anime', 'monochrome', 'comic', 'illustration', 'watercolor', 'oil painting', 'pixel art', 'concept art', 'digital art', 'traditional media', 'greyscale', 'photorealistic', 'raw photo', 'photography', 'polaroid', 'rough sketch', 'lineart', 'manga', 'cartoon', 'cel shading', '3d render', 'octane render', 'unreal engine', 'colorful', 'pastel colors', 'muted colors'];
const colorsKeywords = ['red', 'blue', 'green', 'white', 'black', 'yellow', 'pink', 'purple', 'orange', 'brown', 'grey', 'gray', 'colorful', 'dark', 'light', 'monochrome'];
const framingKeywords = ['cowboy shot', 'close-up', 'full body', 'upper body', 'portrait', 'depth of field', 'blurry background', 'dutch angle', 'from below', 'from above', 'wide shot', 'macro', 'focus', 'bokeh', 'extreme close-up', 'medium close-up', 'medium shot', 'long shot', 'extreme long shot', 'extreme wide shot', 'establishing shot', 'full length', 'lower body', 'half length', 'bust', 'waist up', 'knees up', 'face focus', 'eye focus', 'from afar', 'high angle', 'low angle', 'straight on', 'from behind', 'from side', 'profile', 'three-quarter view', 'aerial view', 'bird\'s-eye view', 'worm\'s-eye view', 'point of view', 'pov', 'over the shoulder', 'off-center', 'dynamic angle'];
const feralPosesKeywords = ['standing', 'sitting', 'lying down', 'sleeping', 'curled up', 'sprawling', 'lying on back', 'lying on stomach', 'rolling over', 'crouching', 'stalking', 'pouncing', 'leaping', 'jumping', 'walking', 'running', 'trotting', 'galloping', 'mid-air', 'rearing', 'standing on hind legs', 'all fours', 'stretching', 'grooming', 'scratching', 'looking back', 'looking up', 'looking down', 'head tilt', 'head down', 'tail raised', 'tail tucked', 'ears perked', 'ears back', 'howling', 'roaring', 'panting', 'eating', 'drinking', 'biting', 'holding in mouth', 'resting', 'alert', 'pawing'];
const moodsKeywords = ['happy', 'sad', 'angry', 'surprised', 'scared', 'disgusted', 'smiling', 'grinning', 'laughing', 'cheerful', 'joyful', 'ecstatic', 'relaxed', 'calm', 'peaceful', 'confident', 'proud', 'affectionate', 'crying', 'weeping', 'tear', 'frowning', 'scowling', 'glaring', 'annoyed', 'frustrated', 'furious', 'enraged', 'depressed', 'gloomy', 'anxious', 'nervous', 'terrified', 'panicked', 'pouting', 'serious', 'blank stare', 'emotionless', 'neutral', 'thinking', 'confused', 'bored', 'sleepy', 'tired', 'exhausted', 'shocked', 'shy', 'blushing', 'embarrassed', 'seductive', 'playful', 'mischievous', 'aggressive', 'fierce', 'curious', 'apathetic', 'determined', 'lonely', 'melancholic', 'wistful', 'gentle', 'hostile', 'submissive', 'dominant'];
const faceDetailsKeywords = ['eyes open', 'eyes closed', 'one eye closed', 'winking', 'wide-eyed', 'narrowed eyes', 'squinting', 'half-closed eyes', 'cross-eyed', 'mouth open', 'mouth closed', 'slightly open mouth', 'parted lips', 'showing teeth', 'upper teeth only', 'fangs', 'tongue out', 'licking lips', 'biting lip', 'puckered lips', 'pout', 'closed mouth smile', 'open mouth smile', 'raised eyebrows', 'furrowed brow', 'flared nostrils', 'blushing', 'dimples', 'freckles', 'sweat', 'tears'];
const birdFeaturesKeywords = ['feathers', 'fluffy feathers', 'ruffled feathers', 'plumage', 'crest', 'wings', 'spread wings', 'folded wings', 'flapping wings', 'wingspan', 'flight feathers', 'tail feathers', 'long tail', 'short tail', 'fan tail', 'beak', 'open beak', 'closed beak', 'curved beak', 'hooked beak', 'straight beak', 'long beak', 'short beak', 'talons', 'claws', 'webbed feet', 'long legs', 'short legs', 'scales', 'breast', 'throat', 'nape', 'crown', 'comb', 'wattle', 'spur'];
const seasonsKeywords = ['spring', 'summer', 'autumn', 'fall', 'winter', 'early spring', 'late spring', 'early summer', 'midsummer', 'late summer', 'early autumn', 'late autumn', 'early winter', 'deep winter', 'late winter', 'dry season', 'wet season', 'rainy season', 'spring blossoms', 'autumn leaves', 'winter scenery'];
const timeOfDayKeywords = ['morning', 'early morning', 'sunrise', 'dawn', 'day', 'daytime', 'broad daylight', 'midday', 'noon', 'afternoon', 'late afternoon', 'evening', 'sunset', 'dusk', 'twilight', 'golden hour', 'blue hour', 'night', 'midnight', 'starry night', 'moonlit night', 'dark night'];
const weatherKeywords = ['rain', 'light rain', 'heavy rain', 'snow', 'falling snow', 'snowflakes', 'hail', 'fog', 'mist', 'smog', 'cloudy', 'overcast', 'sunny', 'clear sky', 'starry sky', 'wind', 'windy', 'stormy', 'storm', 'lightning', 'thunder', 'rainbow', 'dust storm', 'sandstorm', 'tornado', 'blizzard'];
const lightingKeywords = ['cinematic lighting', 'natural lighting', 'studio lighting', 'rim lighting', 'backlighting', 'volumetric lighting', 'god rays', 'sunbeams', 'lens flare', 'glowing', 'bioluminescence', 'neon lights', 'soft light', 'hard light', 'shadows', 'dramatic shadows', 'high contrast', 'low contrast', 'depth of field', 'dof', 'blurry background', 'blurry foreground', 'bokeh', 'sharp focus', 'chromatic aberration', 'motion blur', 'film grain'];
const bodyTypesKeywords = ['muscular', 'toned', 'ripped', 'skinny', 'slender', 'thin', 'chubby', 'fat', 'overweight', 'curvy', 'voluptuous', 'thick', 'athletic', 'broad shoulders', 'narrow waist', 'wide hips', 'tall', 'short', 'petite', 'giant', 'abs', 'pectorals', 'cleavage', 'breasts', 'large breasts', 'small breasts', 'muscular thighs', 'thick thighs'];
const intimateKeywords = ['hugging', 'kissing', 'kiss on the cheek', 'french kiss', 'cuddling', 'holding hands', 'arms around neck', 'hands on waist', 'lap pillow', 'carrying', 'bridal carry', 'piggyback', 'pressed together', 'cheek to cheek', 'sleeping together', 'leaning on someone', 'head on shoulder', 'petting', 'stroking'];
const accessoriesKeywords = ['collar', 'spiked collar', 'leather collar', 'leash', 'harness', 'bell', 'piercing', 'ear piercing', 'nose piercing', 'body piercing', 'tattoos', 'tribal tattoos', 'body art', 'glowing tattoos', 'scars', 'facial scar', 'bandages', 'band-aid', 'glasses', 'sunglasses', 'jewelry', 'necklace', 'earrings', 'rings', 'bracelet', 'choker'];

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
    if (feralPosesKeywords.some(kw => lowerTag.includes(kw))) return 'feral_poses';
    if (moodsKeywords.some(kw => lowerTag.includes(kw))) return 'moods';
    if (faceDetailsKeywords.some(kw => lowerTag.includes(kw))) return 'face_details';
    if (birdFeaturesKeywords.some(kw => lowerTag.includes(kw))) return 'bird_features';
    if (seasonsKeywords.some(kw => lowerTag.includes(kw))) return 'seasons';
    if (timeOfDayKeywords.some(kw => lowerTag.includes(kw))) return 'time_of_day';
    if (weatherKeywords.some(kw => lowerTag.includes(kw))) return 'weather';
    if (lightingKeywords.some(kw => lowerTag.includes(kw))) return 'lighting';
    if (bodyTypesKeywords.some(kw => lowerTag.includes(kw))) return 'body_types';
    if (intimateKeywords.some(kw => lowerTag.includes(kw))) return 'intimate';
    if (accessoriesKeywords.some(kw => lowerTag.includes(kw))) return 'accessories';
    
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
        case 'feral_poses':
            return isDarkMode ? 'bg-orange-900/30 text-orange-400 border-orange-800/50' : 'bg-orange-100 text-orange-700 border-orange-200';
        case 'moods':
            return isDarkMode ? 'bg-pink-900/30 text-pink-400 border-pink-800/50' : 'bg-pink-100 text-pink-700 border-pink-200';
        case 'face_details':
            return isDarkMode ? 'bg-rose-900/30 text-rose-400 border-rose-800/50' : 'bg-rose-100 text-rose-700 border-rose-200';
        case 'bird_features':
            return isDarkMode ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800/50' : 'bg-emerald-100 text-emerald-700 border-emerald-200';
        case 'seasons':
            return isDarkMode ? 'bg-cyan-900/30 text-cyan-400 border-cyan-800/50' : 'bg-cyan-100 text-cyan-700 border-cyan-200';
        case 'time_of_day':
            return isDarkMode ? 'bg-sky-900/30 text-sky-400 border-sky-800/50' : 'bg-sky-100 text-sky-700 border-sky-200';
        case 'weather':
            return isDarkMode ? 'bg-blue-900/30 text-blue-400 border-blue-800/50' : 'bg-blue-100 text-blue-700 border-blue-200';
        case 'lighting':
            return isDarkMode ? 'bg-yellow-900/30 text-yellow-400 border-yellow-800/50' : 'bg-yellow-100 text-yellow-700 border-yellow-200';
        case 'anthro_traits':
            return isDarkMode ? 'bg-lime-900/30 text-lime-400 border-lime-800/50' : 'bg-lime-100 text-lime-700 border-lime-200';
        case 'body_types':
            return isDarkMode ? 'bg-violet-900/30 text-violet-400 border-violet-800/50' : 'bg-violet-100 text-violet-700 border-violet-200';
        case 'clothing':
            return isDarkMode ? 'bg-indigo-900/30 text-indigo-400 border-indigo-800/50' : 'bg-indigo-100 text-indigo-700 border-indigo-200';
        case 'intimate':
            return isDarkMode ? 'bg-fuchsia-900/30 text-fuchsia-400 border-fuchsia-800/50' : 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200';
        case 'accessories':
            return isDarkMode ? 'bg-slate-900/30 text-slate-400 border-slate-800/50' : 'bg-slate-100 text-slate-700 border-slate-200';
        default:
            return isDarkMode ? 'bg-gray-800 text-gray-200 border-gray-700' : 'bg-white text-gray-700 border-gray-200';
    }
};
