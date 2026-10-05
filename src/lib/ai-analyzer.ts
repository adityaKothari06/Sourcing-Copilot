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
1. Target Sector: Tractor OEMs (Mahindra, Sonalika, Escorts Kubota, TAFE, John Deere, New Holland) and Farm Implement manufacturers (Shaktiman, Fieldking, Lemken, Maschio Gaspardo, Sai Agro).
2. Equipment Types: Rotavator, MB Plough, Harvester, Baler, Laser Land Leveler, Power Tiller, Boom Sprayer, Seed Drill.
3. Indian geography: Identify target states (e.g. Maharashtra, Punjab, Haryana, MP, Gujarat) or regional hubs.
4. Historical Learned Feedback:
   - High-performing keywords in this domain: [${topUpvoted || 'Rotavator, Shaktiman, Dealer Network, Area Sales Manager'}]
   - Poor/irrelevant keywords to suppress: [${topDownvoted || 'Software, Java, Banking, Modern Trade'}]

Return a strictly valid JSON object matching this schema:
{
  "title": string (Clear job title e.g. "Area Sales Manager - Farm Implements"),
  "standardTitles": string[] (Alternative designations used across companies e.g. ["Territory Manager", "ASM", "Territory In-charge", "Area Sales Executive"]),
  "seniorityLevel": string ("junior" | "mid" | "senior" | "leadership"),
  "experienceYears": { "min": number, "max": number },
  "locations": string[] (Target cities, regions or states e.g. ["Maharashtra", "Pune", "Nashik"]),
  "equipmentFocus": string[] (Equipment keywords e.g. ["Rotavator", "Rotary Tiller", "Farm Implements", "MB Plough"]),
  "targetCompanies": string[] (Competitor OEMs to poach from e.g. ["Shaktiman", "Fieldking", "Lemken", "Mahindra", "Escorts Kubota"]),
  "adjacentTalentPools": string[] (Adjacent industries if niche is small e.g. ["Commercial Vehicles SCV", "Construction Equipment Backhoe", "Agri-Inputs"]),
  "coreCompetencies": string[] (e.g. ["Dealer Network", "Channel Sales", "Secondary Sales", "Field Demo", "Subsidy DBT"]),
  "exclusions": string[] (Exclusions for boolean NOT operator e.g. ["Software", "IT", "Developer", "Telecom", "Banking"])
}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
    },
  });

  const parsedJson = JSON.parse(response.text?.trim() || '{}');
  return sanitizeParsedPosition(parsedJson);
}

function heuristicDomainParser(
  rawInput: string,
  globalFeedback: Record<string, { upvotes: number; downvotes: number }>
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
    if (lower.includes('tractor')) detectedEquipment.push('Tractor', 'Farm Equipment');
    else if (lower.includes('implement')) detectedEquipment.push('Farm Implements', 'Tillage Equipment');
    else detectedEquipment.push('Tractor', 'Farm Implements', 'Rotavator');
  }

  // 2. Detect Locations
  const detectedLocations: string[] = [];
  for (const region of TRACTOR_IMPLEMENTS_KNOWLEDGE.indianAgriStatesAndHubs) {
    for (const state of region.states) {
      if (lower.includes(state.toLowerCase())) detectedLocations.push(state);
    }
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
  } else if (lower.includes('rsm') || lower.includes('regional') || lower.includes('state head') || lower.includes('zonal')) {
    detectedTitle = 'Regional Sales Manager';
    matchedTitles = ['Regional Sales Manager', 'RSM', 'Zonal Head', 'State Head'];
    seniority = 'senior';
  } else if (lower.includes('dealer') || lower.includes('network') || lower.includes('channel')) {
    detectedTitle = 'Dealer Development Manager';
    matchedTitles = ['Dealer Development Manager', 'Channel Development Manager', 'Network Expansion Executive'];
  } else if (lower.includes('demo') || lower.includes('field demonstration')) {
    detectedTitle = 'Field Demonstration Specialist';
    matchedTitles = ['Product Demonstrator', 'Field Demo Executive', 'Demo Incharge'];
    seniority = 'junior';
  }

  // 4. Experience Years Extraction
  let expMin = 3;
  let expMax = 7;
  const expMatch = lower.match(/(\d+)\s*(?:-|to)?\s*(\d+)?\s*(?:years|yrs|saal|sal)/i);
  if (expMatch) {
    expMin = parseInt(expMatch[1], 10);
    expMax = expMatch[2] ? parseInt(expMatch[2], 10) : expMin + 3;
  }

  // 5. Target Companies (Tractor & Implement OEMs)
  const targetCompanies: string[] = [];
  // Prioritize based on equipment detected
  if (detectedEquipment.some(e => /rotavator|plough|cultivator|tiller|harvester|baler/i.test(e))) {
    targetCompanies.push('Shaktiman', 'Fieldking', 'Lemken', 'Maschio Gaspardo', 'Sai Agro');
  }
  targetCompanies.push('Mahindra', 'Sonalika', 'Escorts Kubota', 'TAFE', 'John Deere');

  // 6. Adjacent Pools
  const adjacentTalentPools = [
    'Rural Commercial Vehicles (Bolero Maxi Truck, Tata Ace)',
    'Construction Equipment (JCB Backhoe, ACE)',
    'Agri-Inputs & Agro-Chemicals (UPL, Coromandel, Crystal)',
  ];

  // 7. Core Competencies
  const coreCompetencies = [
    'Dealer Network Management',
    'Channel Sales',
    'Secondary Sales',
    'Field Demonstration',
    'Subsidy & DBT Documentation',
  ];

  // Filter exclusions against negative feedback
  const exclusions = [...TRACTOR_IMPLEMENTS_KNOWLEDGE.standardExclusions];

  return {
    title: `${detectedTitle} - ${detectedEquipment[0] || 'Farm Equipment'}`,
    standardTitles: Array.from(new Set(matchedTitles)),
    seniorityLevel: seniority,
    experienceYears: { min: expMin, max: expMax },
    locations: Array.from(new Set(detectedLocations)),
    equipmentFocus: Array.from(new Set(detectedEquipment)),
    targetCompanies: Array.from(new Set(targetCompanies)),
    adjacentTalentPools,
    coreCompetencies,
    exclusions,
  };
}

function sanitizeParsedPosition(parsed: any): ParsedPosition {
  return {
    title: typeof parsed?.title === 'string' ? parsed.title : 'Territory Sales Manager - Agri Equipment',
    standardTitles: Array.isArray(parsed?.standardTitles) ? parsed.standardTitles : ['Territory Manager', 'Area Sales Manager', 'ASM'],
    seniorityLevel: typeof parsed?.seniorityLevel === 'string' ? parsed.seniorityLevel : 'mid',
    experienceYears: {
      min: typeof parsed?.experienceYears?.min === 'number' ? parsed.experienceYears.min : 3,
      max: typeof parsed?.experienceYears?.max === 'number' ? parsed.experienceYears.max : 7,
    },
    locations: Array.isArray(parsed?.locations) ? parsed.locations : [],
    equipmentFocus: Array.isArray(parsed?.equipmentFocus) && parsed.equipmentFocus.length > 0
      ? parsed.equipmentFocus
      : ['Tractor', 'Farm Implements', 'Rotavator'],
    targetCompanies: Array.isArray(parsed?.targetCompanies) && parsed.targetCompanies.length > 0
      ? parsed.targetCompanies
      : ['Shaktiman', 'Fieldking', 'Lemken', 'Mahindra', 'Escorts Kubota'],
    adjacentTalentPools: Array.isArray(parsed?.adjacentTalentPools) ? parsed.adjacentTalentPools : [],
    coreCompetencies: Array.isArray(parsed?.coreCompetencies) ? parsed.coreCompetencies : ['Dealer Network', 'Channel Sales'],
    exclusions: Array.isArray(parsed?.exclusions) ? parsed.exclusions : ['Software', 'IT', 'Banking'],
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
