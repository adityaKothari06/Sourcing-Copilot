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

  const prompt = `You are a specialist talent sourcing strategist for the Indian Tractor, Agriculture Farm Equipment, and Implements industry.
Analyze the following job requirement (which may be a spoken recruiter voice note in Hindi/Hinglish, short client WhatsApp brief, or full JD):

"""
${rawInput}
"""

Context & Domain Rules:
1. Target Sector: Tractor OEMs (Mahindra, Sonalika, Escorts Kubota, TAFE, John Deere, New Holland, VST Tillers) and Farm Implement manufacturers (Shaktiman, Fieldking, Lemken, Maschio Gaspardo, Sai Agro).
2. Equipment Types: Rotavator, MB Plough, Harvester, Baler, Laser Land Leveler, Power Tiller, Boom Sprayer, Seed Drill, Farm Implements.
3. Indian geography: Identify target regions/states/hubs across India:
   - North East: Assam, Guwahati, Meghalaya, Tripura, etc.
   - North: Punjab, Haryana, UP, Rajasthan, etc.
   - West: Maharashtra, Gujarat.
   - South: Karnataka, AP, Telangana, Tamil Nadu.
   - East: Bihar, West Bengal, Odisha.
   - Central: MP, Chhattisgarh.
4. Historical Learned Feedback:
   - High-performing keywords in this domain: [${topUpvoted || 'Rotavator, Shaktiman, Dealer Network, Area Sales Manager'}]
   - Poor/irrelevant keywords to suppress: [${topDownvoted || 'Software, Java, Banking, Modern Trade'}]

Return a strictly valid JSON object matching this schema:
{
  "title": string (Clear job title e.g. "Regional Sales Manager - Farm Implements"),
  "standardTitles": string[] (Alternative designations used across companies e.g. ["Territory Manager", "ASM", "Territory In-charge", "Regional Sales Manager"]),
  "seniorityLevel": string ("junior" | "mid" | "senior" | "leadership"),
  "experienceYears": { "min": number, "max": number },
  "locations": string[] (Target cities, regions or states e.g. ["North East India", "Assam", "Guwahati"]),
  "equipmentFocus": string[] (Equipment keywords e.g. ["Farm Implements", "Rotavator", "MB Plough"]),
  "targetCompanies": string[] (Competitor OEMs to poach from e.g. ["Shaktiman", "Fieldking", "Lemken", "Mahindra", "Escorts Kubota"]),
  "adjacentTalentPools": string[] (Adjacent industries if niche is small e.g. ["Commercial Vehicles SCV", "Construction Equipment Backhoe", "Agri-Inputs"]),
  "coreCompetencies": string[] (e.g. ["Dealer Network", "Channel Sales", "Secondary Sales", "Field Demo", "Subsidy DBT"]),
  "exclusions": string[] (Exclusions for boolean NOT operator e.g. ["Software", "IT", "Developer", "Telecom", "Banking"])
}`;

  // Call gemini-3.5-flash-lite with fallback to gemini-3.5-flash with a 10s timeout
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
        setTimeout(() => reject(new Error(`Timeout calling ${modelName}`)), 10000)
      ),
    ]);
  };

  let response;
  try {
    response = await callModelWithTimeout('gemini-3.5-flash-lite');
  } catch (err) {
    console.warn('gemini-3.5-flash-lite failed, falling back to gemini-3.5-flash:', err);
    response = await callModelWithTimeout('gemini-3.5-flash');
  }

  const parsedJson = JSON.parse(response.text?.trim() || '{}');
  return sanitizeParsedPosition(parsedJson);
}

function heuristicDomainParser(
  rawInput: string,
  _globalFeedback: Record<string, { upvotes: number; downvotes: number }>
): ParsedPosition {
  const lower = rawInput.toLowerCase();

  // 1. Detect Equipment
  const detectedEquipment: string[] = [];
  for (const cat of TRACTOR_IMPLEMENTS_KNOWLEDGE.equipmentCategories) {
    if (cat.synonyms.some((syn) => lower.includes(syn.toLowerCase()))) {
      detectedEquipment.push(cat.name.split('/')[0].trim());
      detectedEquipment.push(...cat.synonyms.slice(0, 2));
    }
  }
  if (detectedEquipment.length === 0) {
    if (lower.includes('implement')) {
      detectedEquipment.push('Farm Implements', 'Tractor Implements', 'Tillage Equipment', 'Rotavator');
    } else if (lower.includes('tractor')) {
      detectedEquipment.push('Tractor', 'Farm Equipment');
    } else {
      detectedEquipment.push('Farm Implements', 'Rotavator', 'MB Plough');
    }
  }

  // 2. Detect Locations & Regions
  const detectedLocations: string[] = [];
  for (const region of TRACTOR_IMPLEMENTS_KNOWLEDGE.indianAgriStatesAndHubs) {
    // Check regional aliases (e.g. "northeast", "north east", "north", "south", etc.)
    if (region.aliases && region.aliases.some((alias) => lower.includes(alias))) {
      detectedLocations.push(region.region);
      // Also add top 2 representative states and key hub
      if (region.states.length > 0) detectedLocations.push(region.states[0]);
      if (region.majorHubs.length > 0) detectedLocations.push(region.majorHubs[0]);
    }
    // Check individual states
    for (const state of region.states) {
      if (lower.includes(state.toLowerCase())) detectedLocations.push(state);
    }
    // Check hubs
    for (const hub of region.majorHubs) {
      if (lower.includes(hub.toLowerCase())) detectedLocations.push(hub);
    }
  }

  // 3. Detect Title & Seniority
  let detectedTitle = 'Territory Sales Manager';
  let matchedTitles: string[] = ['Territory Manager', 'Area Sales Manager', 'ASM', 'Territory In-charge'];
  let seniority = 'mid';

  if (lower.includes('service') || lower.includes('technical') || lower.includes('mechanic')) {
    detectedTitle = 'Customer Service Engineer';
    matchedTitles = ['Service Territory Manager', 'Customer Support Engineer', 'Area Service Manager', 'Field Service Engineer'];
  } else if (
    lower.includes('rsm') ||
    lower.includes('regional') ||
    lower.includes('state head') ||
    lower.includes('zonal') ||
    lower.includes('pura northeast') ||
    lower.includes('pura north') ||
    lower.includes('pura south') ||
    lower.includes('pura west')
  ) {
    detectedTitle = 'Regional Sales Manager';
    matchedTitles = ['Regional Sales Manager', 'RSM', 'Zonal Head', 'State Head', 'Area Sales Manager'];
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

  // Handles: "5-10 years", "5 to 10 saal", "5 se 10 saal", "5 se 8 saal", "10 saal", "10 years"
  const rangeMatch = lower.match(/(\d+)\s*(?:-|to|se|\/)\s*(\d+)\s*(?:years|yrs|saal|sal)/i);
  const singleMatch = lower.match(/(?:kam se kam|minimum|at least|jisse|having)?\s*(\d+)\+?\s*(?:years|yrs|saal|sal)/i);

  if (rangeMatch) {
    const v1 = parseInt(rangeMatch[1], 10);
    const v2 = parseInt(rangeMatch[2], 10);
    expMin = Math.min(v1, v2);
    expMax = Math.max(v1, v2);
  } else if (singleMatch) {
    const singleVal = parseInt(singleMatch[1], 10);
    expMin = singleVal;
    expMax = singleVal + 3;
  }

  // Final sanity swap: min is NEVER greater than max
  if (expMin > expMax) {
    const temp = expMin;
    expMin = expMax;
    expMax = temp;
  }

  // 5. Target Companies (Comprehensive Tractor & Farm Implement OEMs in India)
  const targetCompanies: string[] = [
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
    'Bull Agro',
    'New Swan Multitech',
    'Indo Farm',
    'ACE Tractors',
  ];

  // 6. Adjacent Pools
  const adjacentTalentPools = [
    'Rural Commercial Vehicles (Bolero Maxi Truck, Tata Ace)',
    'Construction Equipment (JCB Backhoe, ACE)',
    'Agri-Inputs & Agro-Chemicals (UPL, Coromandel, Crystal)',
  ];

  // 7. Core Competencies & Education
  const coreCompetencies = [
    'Dealer Network Management',
    'Channel Sales',
    'Secondary Sales',
    'Field Demonstration',
    'Subsidy & DBT Documentation',
  ];

  let qualification: string | undefined = undefined;
  // Check degree/education mention (e.g. BE / B.Tech)
  if (lower.includes('b.tech') || lower.includes('b tech') || lower.includes('be') || lower.includes('engineering')) {
    qualification = 'BE / B.Tech (Agri / Mechanical Engineering)';
    coreCompetencies.unshift('BE / B.Tech (Agri / Mechanical Engineering)');
  } else if (lower.includes('diploma')) {
    qualification = 'Diploma (Agri / Mechanical Engineering)';
    coreCompetencies.unshift('Diploma (Mechanical / Agri)');
  }

  // Handle freshers / trainee briefs
  if (lower.includes('fresher') || lower.includes('trainee') || lower.includes('get')) {
    expMin = 0;
    expMax = 2;
    seniority = 'junior';
    matchedTitles.unshift('Graduate Engineer Trainee', 'Management Trainee', 'Sales Trainee');
    if (!qualification) {
      qualification = 'B.Tech / Diploma / Agri Graduate (Fresher / Trainee)';
    }
  }

  // Filter exclusions against negative feedback
  const exclusions = [...TRACTOR_IMPLEMENTS_KNOWLEDGE.standardExclusions];

  return {
    title: `${detectedTitle} - ${detectedEquipment[0] || 'Farm Implements'}`,
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

  const parsedCompanies = Array.isArray(parsed?.targetCompanies) && parsed.targetCompanies.length > 0
    ? Array.from(new Set([...parsed.targetCompanies, ...defaultCompanies]))
    : defaultCompanies;

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
    equipmentFocus: Array.isArray(parsed?.equipmentFocus) && parsed.equipmentFocus.length > 0
      ? parsed.equipmentFocus
      : ['Farm Implements', 'Rotavator', 'MB Plough'],
    targetCompanies: parsedCompanies,
    adjacentTalentPools: Array.isArray(parsed?.adjacentTalentPools) ? parsed.adjacentTalentPools : [],
    coreCompetencies: Array.isArray(parsed?.coreCompetencies) ? parsed.coreCompetencies : ['Dealer Network', 'Channel Sales'],
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
