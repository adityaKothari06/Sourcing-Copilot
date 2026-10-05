/**
 * Comprehensive Hindi Devanagari to Hinglish (Roman script) transliterator
 * with specialized dictionary for Indian Tractor & Implements recruitment.
 */

const DOMAIN_DICTIONARY: Record<string, string> = {
  // Roles & Titles
  'एरिया सेल्स मैनेजर': 'Area Sales Manager',
  'एरिया सेल्समैन': 'Area Sales Manager',
  'सेल्स मैनेजर': 'Sales Manager',
  'सेल्स': 'Sales',
  'मैनेजर': 'Manager',
  'टेरिटरी मैनेजर': 'Territory Manager',
  'टेरिटरी': 'Territory',
  'सर्विस इंजीनियर': 'Service Engineer',
  'सर्विस': 'Service',
  'इंजीनियर': 'Engineer',
  'डीलर नेटवर्क': 'Dealer Network',
  'डीलर': 'Dealer',
  'नेटवर्क': 'Network',
  'कैंडिडेट': 'Candidate',
  'कैंडिडेट्स': 'Candidates',

  // Tractor & Implements Equipment
  'ट्रैक्टर': 'Tractor',
  'ट्रैक्टर्स': 'Tractors',
  'रोटावेटर': 'Rotavator',
  'रोटरी टिलर': 'Rotary Tiller',
  'एमबी प्लाउ': 'MB Plough',
  'प्लाउ': 'Plough',
  'कल्टीवेटर': 'Cultivator',
  'हार्वेस्टर': 'Harvester',
  'कंबाइन हार्वेस्टर': 'Combine Harvester',
  'स्ट्रॉ रीपर': 'Straw Reaper',
  'रीपर': 'Reaper',
  'बेलर': 'Baler',
  'लेजर लैंड लेवलर': 'Laser Land Leveler',
  'लेवलर': 'Leveler',
  'पावर टिलर': 'Power Tiller',
  'स्प्रेयर': 'Sprayer',
  'सीड ड्रिल': 'Seed Drill',
  'इंप्लीमेंट्स': 'Implements',
  'इम्प्लीमेंट्स': 'Implements',
  'कृषि': 'Krishi',
  'उपकरण': 'Upkaran',

  // Companies / Brands
  'शक्तिमान': 'Shaktiman',
  'लेमकेन': 'Lemken',
  'महिंद्रा': 'Mahindra',
  'सोनालीका': 'Sonalika',
  'एस्कॉर्ट्स': 'Escorts',
  'कुबोटा': 'Kubota',
  'जॉन डियर': 'John Deere',
  'न्यू हॉलैंड': 'New Holland',
  'टाफे': 'TAFE',
  'वीएसटी': 'VST',
  'फील्डकिंग': 'Fieldking',
  'मास्कियो': 'Maschio',

  // Locations
  'महाराष्ट्र': 'Maharashtra',
  'पुणे': 'Pune',
  'नासिक': 'Nashik',
  'नागपुर': 'Nagpur',
  'औरंगाबाद': 'Aurangabad',
  'पंजाब': 'Punjab',
  'हरियाणा': 'Haryana',
  'राजस्थान': 'Rajasthan',
  'गुजरात': 'Gujarat',
  'मध्य प्रदेश': 'Madhya Pradesh',
  'उत्तर प्रदेश': 'Uttar Pradesh',

  // Common Hindi spoken words in recruitment
  'चाहिए': 'chahiye',
  'के लिए': 'ke liye',
  'केलिए': 'ke liye',
  'का': 'ka',
  'की': 'ki',
  'के': 'ke',
  'में': 'mein',
  'से': 'se',
  'और': 'aur',
  'भी': 'bhi',
  'होना': 'hona',
  'होने': 'hone',
  'है': 'hai',
  'हैं': 'hain',
  'था': 'tha',
  'साल': 'saal',
  'वर्ष': 'saal',
  'एक्सपीरियंस': 'experience',
  'अनुभव': 'experience',
  'क्लाइंट': 'Client',
  'बैकग्राउंड': 'background',
  'अच्छा': 'achha',
  'अच्छी': 'achhi',
  'बंदा': 'banda',
  'काम': 'kaam',
  'देखना': 'dekhna',
  'सैलरी': 'salary',
  'लाख': 'Lakh',
  'सीटीसी': 'CTC',
  'अर्जेन्ट': 'Urgent',
  'रिक्वायरमेंट': 'Requirement',
  'तो': 'to',
  'तक': 'tak',
};

// Character mapping for phonetic transliteration
const VOWELS: Record<string, string> = {
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri',
  'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'अं': 'an', 'अः': 'ah',
};

const MATRAS: Record<string, string> = {
  'ा': 'a', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri',
  'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ं': 'n', 'ँ': 'n', 'ः': 'h',
  '्': '', // Virama suppresses the implicit vowel
};

const CONSONANTS: Record<string, string> = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
  'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
  'ड़': 'd', 'ढ़': 'dh', 'क़': 'q', 'ख़': 'kh', 'ग़': 'gh', 'ज़': 'z', 'फ़': 'f',
};

/**
 * Phonetically transliterates a single Devanagari word into English/Hinglish
 */
function transliterateDevanagariWord(word: string): string {
  let result = '';
  const len = word.length;

  for (let i = 0; i < len; i++) {
    const char = word[i];
    const nextChar = i + 1 < len ? word[i + 1] : '';

    if (VOWELS[char]) {
      result += VOWELS[char];
    } else if (CONSONANTS[char]) {
      const cons = CONSONANTS[char];
      if (nextChar in MATRAS) {
        result += cons + MATRAS[nextChar];
        i++; // Skip the matra
      } else if (nextChar === '्') {
        result += cons; // Half consonant
        i++; // Skip virama
      } else if (i + 1 === len || nextChar === ' ' || !CONSONANTS[nextChar]) {
        // Trailing consonant usually has no implicit 'a' in modern spoken Hindi
        result += cons;
      } else {
        // In-word consonant gets short implicit 'a'
        result += cons + 'a';
      }
    } else if (MATRAS[char]) {
      result += MATRAS[char];
    } else {
      result += char;
    }
  }

  return result;
}

/**
 * Converts Devanagari Hindi text to natural Hinglish
 */
export function devanagariToHinglish(text: string): string {
  if (!text || !text.trim()) return '';

  let converted = text;

  // 1. First replace multi-word domain terms
  for (const [hindi, english] of Object.entries(DOMAIN_DICTIONARY)) {
    const regex = new RegExp(hindi, 'g');
    converted = converted.replace(regex, english);
  }

  // 2. Transliterate remaining Devanagari characters
  // Match contiguous Devanagari blocks [\u0900-\u097F]+
  converted = converted.replace(/[\u0900-\u097F]+/g, (match) => {
    return transliterateDevanagariWord(match);
  });

  // Clean up duplicate spaces and trim
  return converted
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?:])/g, '$1')
    .trim();
}

/**
 * Helper to check if string contains Devanagari characters
 */
export function containsDevanagari(text: string): boolean {
  return /[\u0900-\u097F]/.test(text);
}
