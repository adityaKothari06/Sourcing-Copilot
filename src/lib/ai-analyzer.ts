import { GoogleGenAI } from '@google/genai';
import { ParsedPosition, KeywordItem, SourcingPosition } from './types';
import { TRACTOR_IMPLEMENTS_KNOWLEDGE } from './domain-knowledge';
import { buildGeneratedQueries } from './query-builder';
import { getGlobalKeywordKnowledge } from './storage';

export async function analyzePositionRequirement(
  rawInput: string,
  inputType: 'voice' | 'text' | 'jd'
): Promise<SourcingPosition> {
  const globalFeedback = await getGlobalKeywordKnowledge();
  const apiKey = process.env.GEMINI_API_KEY;

  let parsed: ParsedPosition;

  if (apiKey) {
    try {
      parsed = await analyzeWithGemini(rawInput, apiKey, globalFeedback);
    } catch (err) {
      console.warn('Gemini analysis failed, utilizing intelligent domain fallback parser:', err);
      parsed = heuristicDomainParser(rawInput, globalFeedback);
    }
  } else {
    parsed = heuristicDomainParser(rawInput, globalFeedback);
  }

  // Build ready-to-use search queries for all portals
  const queries = buildGeneratedQueries(parsed);

  // Compile full keyword catalog for interactive feedback
  const keywords = compileKeywordCatalog(parsed, globalFeedback);

  const position: SourcingPosition = {
    id: `pos_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    title: parsed.title,
    rawInput,
    inputType,
    parsed,
    keywords,
    queries,
    searchRating: null,
  };

  return position;
}

async function analyzeWithGemini(
  rawInput: string,
  apiKey: string,
  globalFeedback: Record<string, { upvotes: number; downvotes: number }>
): Promise<ParsedPosition> {
  const ai = new GoogleGenAI({ apiKey });

  // Supply known successful / rejected keywords to the AI prompt
  const topUpvoted = Object.entries(globalFeedback)
    .filter(([_, v]) => v.upvotes > v.downvotes)
    .map(([k]) => k)
    .slice(0, 15)
    .join(', ');

  const topDownvoted = Object.entries(globalFeedback)
    .filter(([_, v]) => v.downvotes > v.upvotes)
    .map(([k]) => k)
    .slice(0, 15)
    .join(', ');

  const prompt = `You are an expert talent sourcing strategist and recruitment keyword intelligence engine for Indian hiring mandates across Tractor, Agriculture, Farm Equipment, Automotive, Industrial, and Corporate/Commercial domains.
Carefully analyze the following job requirement (which may be a spoken recruiter note in Hindi/Hinglish, brief message, or full JD):

"""
${rawInput}
"""

Domain & Extraction Rules:
1. Candidate Role & Recruiter Shorthand:
   - Accurately determine the exact functional area (Sales, HR, Customer Service, Plant, Quality, Engineering, Supply Chain, Finance).
   - "BBT" / "bbt" / "b.tech" / "be": In Indian recruiter speech/notes, "BBT" refers to **BE / B.Tech (Engineering Graduate)** (Mechanical or Agricultural Engineering).
   - If the brief mentions "sales hr", "hr", "recruiter", "talent acquisition", or "hrbp", the role MUST be Human Resources / Talent Acquisition, NOT a Sales Manager!
2. Regional Market Realities & Realistic Designations:
   - **North East India Market Context**:
     - Real market titles: "State Head - Assam & North East", "Area Sales Manager (ASM) - North East", "Regional Sales Manager (RSM)", "Territory Manager". (NEVER use unrealistic corporate designations like "Business Head - North East" or "Regional Head - Sales" which do not exist in NE agri-machinery).
     - Dominant machinery in NE: North East agriculture is predominantly hilly, terrace, and paddy small holdings. Dominant equipment is **Power Tillers, Rotavators, Weeders, Paddy Harvesters, Reapers, and Mini Tractors**.
     - Top OEMs in NE: **VST Tillers Tractors, Shaktiman, Fieldking, KisanKraft, Kamco, Sonalika, Mahindra Farm Equipment, Honda Power Products**.
     - Crucial skills: **SMAM DBT Government Subsidies, State Agriculture Directorate tender billing, Dealer Network across Assam and 7 Sisters, Farmer Field Demonstrations**.
     - Hubs: Guwahati, Siliguri, Assam.
   - **North India (Punjab / Haryana / Western UP)**:
     - Real titles: "Zonal Sales Manager", "Regional Sales Manager", "Area Sales Manager".
     - Dominant machinery: Combine Harvesters, Round Balers, Straw Reapers, Laser Land Levelers, Super Seeders, Heavy Tractors.
     - Top OEMs: Claas, Preet, Dasmesh, KS Agrotech, Kartar, Shaktiman, Fieldking, New Holland, Mahindra.
   - **West India (Maharashtra / Gujarat)**:
     - Dominant machinery: Sugarcane Harvesters, Orchard Boom Sprayers (Mitra, ASPEE), MB Plough, Rotavator, Reversible Plough.
     - Top OEMs: Mitra Sprayers, ASPEE, Lemken, Maschio Gaspardo, Shaktiman, Mahindra, Swaraj.
   - **South India (Karnataka / AP / Telangana / Tamil Nadu)**:
     - Dominant machinery: Power Tillers, Paddy Transplanters, Weeders, Mini Tractors, Sprayers.
     - Top OEMs: VST Tillers, Kamco, KisanKraft, TAFE, Kubota, Yanmar.
3. Experience & Qualification:
   - Accurately parse min and max years (e.g. 5-10 -> min: 5, max: 10; 8+ -> min: 8, max: 12). Min must ALWAYS be <= max.
   - If BE / B.Tech / BBT / Diploma / MBA is mentioned, specify in qualification.
4. Historical Learned Feedback:
   - High-performing keywords: [${topUpvoted || 'Rotavator, Power Tiller, Shaktiman, VST, Dealer Network, Area Sales Manager'}]
   - Poor/irrelevant keywords to suppress: [${topDownvoted || 'Java, Python, Software Developer, Modern Trade'}]

Return a strictly valid JSON object matching this schema:
{
  "title": string (Realistic job title e.g. "State Head - Farm Implements & Machinery" or "Regional Sales Manager - Farm Implements" or "HR Business Partner - Sales"),
  "standardTitles": string[] (Realistic designations used in that market e.g. ["State Head", "Area Sales Manager", "ASM", "Regional Sales Manager", "Territory Manager"]),
  "seniorityLevel": string ("junior" | "mid" | "senior" | "leadership"),
  "experienceYears": { "min": number, "max": number },
  "locations": string[] (Target cities, regions or states e.g. ["Guwahati", "Assam", "Siliguri", "North East India"]),
  "equipmentFocus": string[] (Regional equipment keywords e.g. ["Power Tiller", "Rotavator", "Farm Implements", "Weeder"]; empty [] if non-equipment/HR),
  "targetCompanies": string[] (Competitor OEMs to poach from in that market e.g. ["VST Tillers", "Shaktiman", "Fieldking", "KisanKraft", "Mahindra", "Sonalika"]),
  "adjacentTalentPools": string[],
  "coreCompetencies": string[] (e.g. ["SMAM DBT Subsidy", "Dealer Network Management", "Channel Sales", "Field Demonstration"]),
  "exclusions": string[],
  "qualification": string
}`;

  // Call gemini-2.5-flash with fallback to gemini-2.0-flash with a 12s timeout
  const callModelWithTimeout = async (modelName: string) => {
    return Promise.race([
      ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout calling ${modelName}`)), 12000)
      ),
    ]);
  };

  let response;
  try {
    response = await callModelWithTimeout('gemini-2.5-flash');
  } catch (err) {
    console.warn('gemini-2.5-flash failed, falling back to gemini-2.0-flash:', err);
    response = await callModelWithTimeout('gemini-2.0-flash');
  }

  const parsedJson = JSON.parse(response.text?.trim() || '{}');
  return sanitizeParsedPosition(parsedJson);
}

function heuristicDomainParser(
  rawInput: string,
  _globalFeedback: Record<string, { upvotes: number; downvotes: number }>
): ParsedPosition {
  const lower = rawInput.toLowerCase();

  // Role Category Classification
  const isHR = /\b(hr|human resource|human resources|recruiter|recruitment|talent acquisition|hrbp|people ops)\b/i.test(lower);
  const isService = /\b(service|technical|mechanic|customer support|cse|technician)\b/i.test(lower);
  const isOperations = /\b(plant|operations|production|manufacturing|quality|qa|qc|shop floor)\b/i.test(lower);


  // 2. Detect Locations & Regions (word boundary & prefix safe)
  const detectedLocations: string[] = [];
  const isNorthEast = lower.includes('northeast') || lower.includes('north east') || lower.includes('north-east') || lower.includes('assam') || lower.includes('guwahati');

  for (const region of TRACTOR_IMPLEMENTS_KNOWLEDGE.indianAgriStatesAndHubs) {
    // If requirement asks for Northeast, do NOT let North India or East India falsely match
    if ((region.region === 'North India' || region.region === 'East India') && isNorthEast) {
      continue;
    }

    if (region.aliases) {
      for (const alias of region.aliases) {
        const regex = new RegExp(`(^|\\s|[^a-z0-9])${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|\\s|[^a-z0-9])`, 'i');
        if (regex.test(lower)) {
          detectedLocations.push(region.region);
          if (region.states.length > 0) detectedLocations.push(region.states[0]);
          if (region.majorHubs.length > 0) detectedLocations.push(region.majorHubs[0]);
          break;
        }
      }
    }
    // Check individual states
    for (const state of region.states) {
      const stateRegex = new RegExp(`(^|\\s|[^a-z0-9])${state.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|\\s|[^a-z0-9])`, 'i');
      if (stateRegex.test(lower) || lower.includes(state.toLowerCase())) {
        detectedLocations.push(state);
      }
    }
    // Check hubs
    for (const hub of region.majorHubs) {
      const hubRegex = new RegExp(`(^|\\s|[^a-z0-9])${hub.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|\\s|[^a-z0-9])`, 'i');
      if (hubRegex.test(lower) || lower.includes(hub.toLowerCase())) {
        detectedLocations.push(hub);
      }
    }
  }

  // Handle common Indian transliterations
  if (lower.includes('maharastra') && !detectedLocations.includes('Maharashtra')) {
    detectedLocations.push('Maharashtra', 'Pune', 'Mumbai');
  }

  // Dynamically resolve matching agro-economic region data
  const matchedRegion = TRACTOR_IMPLEMENTS_KNOWLEDGE.indianAgriStatesAndHubs.find((r) =>
    detectedLocations.some((loc) =>
      loc.toLowerCase() === r.region.toLowerCase() ||
      r.states.some((s) => s.toLowerCase() === loc.toLowerCase()) ||
      r.majorHubs.some((h) => h.toLowerCase() === loc.toLowerCase())
    )
  );

  // 1. Detect Equipment / Focus (context-driven)
  const detectedEquipment: string[] = [];
  for (const cat of TRACTOR_IMPLEMENTS_KNOWLEDGE.equipmentCategories) {
    if (cat.synonyms.some((syn) => lower.includes(syn.toLowerCase()))) {
      detectedEquipment.push(cat.name.split('/')[0].trim());
      detectedEquipment.push(...cat.synonyms.slice(0, 2));
    }
  }

  if (detectedEquipment.length === 0) {
    if (matchedRegion?.dominantEquipment && !isHR && !isOperations) {
      detectedEquipment.push(...matchedRegion.dominantEquipment.slice(0, 3));
    } else if (lower.includes('implement')) {
      detectedEquipment.push('Farm Implements', 'Tractor Implements', 'Tillage Equipment', 'Rotavator');
    } else if (lower.includes('tractor')) {
      detectedEquipment.push('Tractor', 'Farm Equipment');
    } else if (!isHR && !isOperations) {
      detectedEquipment.push('Farm Implements', 'Rotavator', 'MB Plough');
    }
  }

  // 3. Detect Title & Seniority (context-driven)
  let detectedTitle = matchedRegion?.realisticJobTitles ? matchedRegion.realisticJobTitles[1] || 'Area Sales Manager' : 'Territory Sales Manager';
  let matchedTitles: string[] = matchedRegion?.realisticJobTitles 
    ? [...matchedRegion.realisticJobTitles]
    : ['Territory Manager', 'Area Sales Manager', 'ASM', 'Territory In-charge'];
  let seniority = 'mid';
  let coreCompetencies = matchedRegion?.specialSkills && !isHR
    ? [...matchedRegion.specialSkills.slice(0, 3), 'Dealer Network Management', 'Channel Sales']
    : [
        'Dealer Network Management',
        'Channel Sales',
        'Secondary Sales',
        'Field Demonstration',
        'Subsidy & DBT Documentation',
      ];

  if (isHR) {
    if (lower.includes('sales')) {
      detectedTitle = 'HR Business Partner - Sales';
      matchedTitles = ['Sales HR Manager', 'HR Business Partner - Sales', 'Regional HR Manager', 'Talent Acquisition Specialist - Sales', 'HRBP'];
    } else {
      detectedTitle = 'HR Manager / Talent Acquisition';
      matchedTitles = ['HR Manager', 'Talent Acquisition Specialist', 'HR Business Partner', 'HRBP', 'Recruitment Lead'];
    }
    seniority = lower.includes('lead') || lower.includes('head') || lower.includes('senior') || lower.includes('8+') || lower.includes('8') ? 'senior' : 'mid';
    coreCompetencies = [
      'Sales Recruitment',
      'Talent Acquisition',
      'HR Business Partnering',
      'Employee Relations',
      'Performance Management',
      'HR Operations',
      'Field Staff Retention',
    ];
  } else if (isService) {
    detectedTitle = 'Customer Service Engineer';
    matchedTitles = ['Service Territory Manager', 'Customer Support Engineer', 'Area Service Manager', 'Field Service Engineer'];
    coreCompetencies = ['After Sales Service', 'Warranty Processing', 'Customer Support', 'Mechanic Training'];
  } else if (isOperations) {
    detectedTitle = 'Plant Operations / Production Manager';
    matchedTitles = ['Plant Manager', 'Production Manager', 'Operations Head', 'Quality Manager'];
    coreCompetencies = ['Production Planning', 'Plant Operations', 'Quality Control', 'Assembly Line Management'];
  } else if (
    lower.includes('rsm') ||
    lower.includes('regional') ||
    lower.includes('state head') ||
    lower.includes('zonal') ||
    /\b(pura|poora)\s*([a-z\s]+)\s*(sambhal|dekh|handle)/i.test(lower) ||
    lower.includes('pura') ||
    lower.includes('poora')
  ) {
    if (matchedRegion?.realisticJobTitles && matchedRegion.realisticJobTitles.length > 0) {
      detectedTitle = `${matchedRegion.realisticJobTitles[0]} - Farm Implements & Machinery`;
      matchedTitles = [...matchedRegion.realisticJobTitles];
    } else {
      detectedTitle = 'Regional Sales Manager';
      matchedTitles = ['Regional Sales Manager', 'RSM', 'Zonal Head', 'State Head', 'Area Sales Manager'];
    }
    seniority = 'senior';
  } else if (lower.includes('dealer') || lower.includes('network') || lower.includes('channel')) {
    detectedTitle = 'Dealer Development Manager';
    matchedTitles = ['Dealer Development Manager', 'Channel Development Manager', 'Network Expansion Executive'];
  } else if (lower.includes('demo') || lower.includes('field demonstration')) {
    detectedTitle = 'Field Demonstration Specialist';
    matchedTitles = ['Product Demonstrator', 'Field Demo Executive', 'Demo Incharge'];
    seniority = 'junior';
  } else if (lower.includes('manager')) {
    detectedTitle = 'Area Sales Manager';
    matchedTitles = ['Area Sales Manager', 'ASM', 'Territory Manager', 'Regional Sales Manager'];
    seniority = 'mid';
  }

  // 4. Experience Years Extraction - robust handling for ranges and single numbers
  let expMin = 3;
  let expMax = 7;

  const rangeMatch = lower.match(/(\d+)\s*(?:-|to|se|\/)\s*(\d+)\s*(?:years|yrs|saal|sal)/i);
  const singleMatch = lower.match(/(\d+)\+?\s*(?:years|yrs|saal|sal|of experience|years of experience)/i);

  if (rangeMatch) {
    const v1 = parseInt(rangeMatch[1], 10);
    const v2 = parseInt(rangeMatch[2], 10);
    expMin = Math.min(v1, v2);
    expMax = Math.max(v1, v2);
  } else if (singleMatch) {
    const singleVal = parseInt(singleMatch[1], 10);
    expMin = singleVal;
    expMax = singleVal + 4;
  }

  // Final sanity swap: min is NEVER greater than max
  if (expMin > expMax) {
    const temp = expMin;
    expMin = expMax;
    expMax = temp;
  }

  // 5. Target Companies (Dynamic Context Resolution)
  let targetCompanies: string[];
  if (isHR) {
    targetCompanies = [
      'Mahindra & Mahindra',
      'Tata Motors',
      'Ashok Leyland',
      'Force Motors',
      'Bajaj Auto',
      'John Deere India',
      'Escorts Kubota',
      'Sonalika Tractors',
      'Bosch India',
      'Cummins India',
      'L&T Construction Equipment',
      'Shaktiman',
      'Fieldking',
    ];
  } else if (matchedRegion?.dominantOEMs && matchedRegion.dominantOEMs.length > 0) {
    targetCompanies = Array.from(new Set([...matchedRegion.dominantOEMs, ...TRACTOR_IMPLEMENTS_KNOWLEDGE.implementOEMs.slice(0, 10)]));
  } else {
    targetCompanies = [
      'Shaktiman',
      'Fieldking',
      'Lemken',
      'Maschio Gaspardo',
      'Sai Agro',
      'Mahindra Farm Equipment',
      'Swaraj Tractors',
      'Sonalika',
      'TAFE',
      'Escorts Kubota',
      'John Deere',
      'New Holland',
      'VST Tillers Tractors',
      'Landforce',
      'KS Agrotech',
      'Jagatjit',
      'Dasmesh',
      'Garud',
      'Mitra Agro Equipments',
      'ASPEE',
      'KisanKraft',
      'Captain Tractors',
      'Preet Agro',
      'Claas India',
      'Indo Farm',
      'ACE Tractors',
    ];
  }

  // 6. Adjacent Pools
  const adjacentTalentPools = isHR
    ? [
        'HR Business Partners from Manufacturing',
        'HR Generalists in Automotive / Commercial Vehicles',
        'Talent Acquisition Specialists for Sales Teams',
        'Regional HR Managers from Industrial Sector',
      ]
    : [
        'Rural Commercial Vehicles (Bolero Maxi Truck, Tata Ace)',
        'Construction Equipment (JCB Backhoe, ACE)',
        'Agri-Inputs & Agro-Chemicals (UPL, Coromandel, Crystal)',
      ];

  let qualification: string | undefined = undefined;
  // Check degree/education mention (e.g. BE / B.Tech / BBT)
  if (lower.includes('b.tech') || lower.includes('b tech') || lower.includes('be') || lower.includes('bbt') || lower.includes('engineering')) {
    qualification = 'BE / B.Tech (Agri / Mechanical / Engineering)';
    coreCompetencies.unshift('BE / B.Tech');
  } else if (lower.includes('diploma')) {
    qualification = 'Diploma (Agri / Mechanical Engineering)';
    coreCompetencies.unshift('Diploma (Mechanical / Agri)');
  } else if (lower.includes('mba') || lower.includes('msw')) {
    qualification = 'MBA / MSW (Human Resources)';
    coreCompetencies.unshift('MBA / MSW (HR)');
  }

  // Handle freshers / trainee briefs
  if (lower.includes('fresher') || lower.includes('trainee') || lower.includes('get')) {
    expMin = 0;
    expMax = 2;
    seniority = 'junior';
    matchedTitles.unshift('Graduate Engineer Trainee', 'Management Trainee', 'Sales Trainee');
    if (!qualification) {
      qualification = 'B.Tech / Diploma / Graduate (Fresher / Trainee)';
    }
  }

  // Exclusions
  const exclusions = isHR
    ? ['IT Recruitment', 'Software Developer', 'Java', 'Python', 'DevOps', 'Call Center']
    : [...TRACTOR_IMPLEMENTS_KNOWLEDGE.standardExclusions];

  const titleSuffix = detectedEquipment.length > 0 ? ` - ${detectedEquipment[0]}` : (isHR ? '' : ' - Farm Implements');

  return {
    title: `${detectedTitle}${titleSuffix}`,
    standardTitles: Array.from(new Set(matchedTitles)),
    seniorityLevel: seniority,
    experienceYears: { min: expMin, max: expMax },
    locations: Array.from(new Set(detectedLocations)),
    equipmentFocus: Array.from(new Set(detectedEquipment)),
    targetCompanies: Array.from(new Set(targetCompanies)),
    adjacentTalentPools,
    coreCompetencies,
    exclusions,
    qualification,
  };
}

function sanitizeParsedPosition(parsed: any): ParsedPosition {
  const rawMin = typeof parsed?.experienceYears?.min === 'number' ? parsed.experienceYears.min : 3;
  const rawMax = typeof parsed?.experienceYears?.max === 'number' ? parsed.experienceYears.max : rawMin + 3;
  const safeMin = Math.min(rawMin, rawMax);
  const safeMax = Math.max(rawMin, rawMax);

  const defaultCompanies = [
    'Shaktiman',
    'Fieldking',
    'Lemken',
    'Maschio Gaspardo',
    'Sai Agro',
    'Mahindra Farm Equipment',
    'Swaraj Tractors',
    'Sonalika',
    'TAFE',
    'Escorts Kubota',
    'John Deere',
    'New Holland',
    'VST Tillers Tractors',
    'Landforce',
    'KS Agrotech',
    'Jagatjit',
    'Dasmesh',
    'Mitra Agro Equipments',
    'ASPEE',
    'KisanKraft',
  ];

  const parsedCompanies = Array.isArray(parsed?.targetCompanies) && parsed.targetCompanies.length >= 3
    ? parsed.targetCompanies
    : (Array.isArray(parsed?.targetCompanies) && parsed.targetCompanies.length > 0
        ? Array.from(new Set([...parsed.targetCompanies, ...defaultCompanies]))
        : defaultCompanies);

  return {
    title: typeof parsed?.title === 'string' ? parsed.title : 'Territory Sales Manager - Farm Implements',
    standardTitles: Array.isArray(parsed?.standardTitles) && parsed.standardTitles.length > 0
      ? parsed.standardTitles
      : ['Territory Manager', 'Area Sales Manager', 'ASM', 'Regional Sales Manager'],
    seniorityLevel: typeof parsed?.seniorityLevel === 'string' ? parsed.seniorityLevel : 'mid',
    experienceYears: {
      min: safeMin,
      max: safeMax === safeMin ? safeMin + 2 : safeMax,
    },
    locations: Array.isArray(parsed?.locations) ? parsed.locations : [],
    equipmentFocus: Array.isArray(parsed?.equipmentFocus) ? parsed.equipmentFocus : [],
    targetCompanies: parsedCompanies,
    adjacentTalentPools: Array.isArray(parsed?.adjacentTalentPools) ? parsed.adjacentTalentPools : [],
    coreCompetencies: Array.isArray(parsed?.coreCompetencies) && parsed.coreCompetencies.length > 0
      ? parsed.coreCompetencies
      : ['Dealer Network', 'Channel Sales'],
    exclusions: Array.isArray(parsed?.exclusions) ? parsed.exclusions : ['Software', 'IT', 'Banking'],
    qualification: typeof parsed?.qualification === 'string' ? parsed.qualification : undefined,
  };
}

function compileKeywordCatalog(
  parsed: ParsedPosition,
  globalFeedback: Record<string, { upvotes: number; downvotes: number }>
): KeywordItem[] {
  const items: KeywordItem[] = [];

  const add = (text: string, category: KeywordItem['category']) => {
    if (!text || items.some((i) => i.text.toLowerCase() === text.toLowerCase())) return;
    const lower = text.toLowerCase().trim();
    const stats = globalFeedback[lower] || { upvotes: 0, downvotes: 0 };
    items.push({
      id: `kw_${Math.random().toString(36).substring(2, 9)}`,
      text: text.trim(),
      category,
      upvotes: stats.upvotes,
      downvotes: stats.downvotes,
      userRating: null,
    });
  };

  parsed.standardTitles.forEach((t) => add(t, 'role'));
  parsed.equipmentFocus.forEach((e) => add(e, 'equipment'));
  parsed.targetCompanies.forEach((c) => add(c, 'company'));
  parsed.coreCompetencies.forEach((s) => add(s, 'skill'));
  parsed.locations.forEach((l) => add(l, 'location'));
  parsed.exclusions.slice(0, 5).forEach((x) => add(x, 'exclusion'));

  // Sort by upvotes descending, downvotes ascending
  return items.sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes));
}
