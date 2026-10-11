import { ParsedPosition, GeneratedQueries } from './types';
import { TRACTOR_IMPLEMENTS_KNOWLEDGE } from './domain-knowledge';

function findMatchingRegionData(locations: string[]) {
  if (!locations || locations.length === 0) return null;
  const locLower = locations.map(l => l.toLowerCase()).join(' ');

  const matchesWord = (str: string, word: string) => {
    return new RegExp(`(^|\\s|[^a-z0-9])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|\\s|[^a-z0-9])`, 'i').test(str);
  };

  for (const reg of TRACTOR_IMPLEMENTS_KNOWLEDGE.indianAgriStatesAndHubs) {
    if (reg.aliases?.some(a => a.length <= 4 ? matchesWord(locLower, a) : locLower.includes(a.toLowerCase()))) {
      return reg;
    }
    if (reg.states?.some(s => matchesWord(locLower, s.toLowerCase()) || locLower.includes(s.toLowerCase()))) {
      return reg;
    }
    if (reg.majorHubs?.some(h => matchesWord(locLower, h.toLowerCase()) || locLower.includes(h.toLowerCase()))) {
      return reg;
    }
  }
  return null;
}

function getRealisticLocationGroup(locations: string[]): string {
  if (!locations || locations.length === 0) return '';
  const regionData = findMatchingRegionData(locations);

  if (regionData?.keySearchLocations && regionData.keySearchLocations.length > 0) {
    return `(${regionData.keySearchLocations.map(l => `"${l}"`).join(' OR ')})`;
  }

  return `(${locations.slice(0, 4).map(l => `"${l}"`).join(' OR ')})`;
}

function getRealisticTitleGroup(parsed: ParsedPosition): string {
  const isCorporateOrHR = parsed.title.toLowerCase().includes('hr') || 
                          parsed.title.toLowerCase().includes('finance') || 
                          parsed.title.toLowerCase().includes('legal') ||
                          parsed.title.toLowerCase().includes('recruitment');

  const regionData = findMatchingRegionData(parsed.locations);

  const asksFullTerritory = parsed.seniorityLevel === 'senior' || 
                            parsed.title.toLowerCase().includes('regional') || 
                            parsed.title.toLowerCase().includes('zonal') || 
                            parsed.title.toLowerCase().includes('state');

  if (!isCorporateOrHR && asksFullTerritory && regionData?.realisticJobTitles && regionData.realisticJobTitles.length > 0) {
    return `(${regionData.realisticJobTitles.slice(0, 5).map(t => `"${t}"`).join(' OR ')})`;
  }

  if (parsed.standardTitles.length > 0) {
    return `(${parsed.standardTitles.slice(0, 5).map(t => `"${t}"`).join(' OR ')})`;
  }
  return `("${parsed.title}")`;
}

function getRealisticDomainGroup(parsed: ParsedPosition): string {
  const isCorporateOrHR = parsed.title.toLowerCase().includes('hr') || 
                          parsed.title.toLowerCase().includes('finance') || 
                          parsed.title.toLowerCase().includes('legal') ||
                          parsed.title.toLowerCase().includes('recruitment');

  const regionData = findMatchingRegionData(parsed.locations);

  // 1. If it's field equipment/sales and we have regional domain intelligence
  if (!isCorporateOrHR && regionData) {
    const regionalOEMs = regionData.dominantOEMs ? regionData.dominantOEMs.slice(0, 4).map(c => `"${c.split(' ')[0]}"`) : [];
    const regionalEquip = regionData.dominantEquipment ? regionData.dominantEquipment.slice(0, 3).map(e => `"${e}"`) : [];
    const explicitEquip = parsed.equipmentFocus.slice(0, 3).map(e => `"${e}"`);
    const explicitCompanies = parsed.targetCompanies.slice(0, 4).map(c => `"${c.split(' ')[0]}"`);

    const pool = Array.from(new Set([...explicitCompanies, ...explicitEquip, ...regionalOEMs, ...regionalEquip]));
    if (pool.length > 0) {
      return `(${pool.slice(0, 8).join(' OR ')})`;
    }
  }

  // 2. Generic dynamic resolution from parsed position data
  const items: string[] = [];
  parsed.targetCompanies.slice(0, 5).forEach(c => {
    const firstWord = c.split(' ')[0];
    if (firstWord && !items.includes(`"${firstWord}"`)) items.push(`"${firstWord}"`);
  });
  parsed.equipmentFocus.slice(0, 4).forEach(e => {
    if (!items.includes(`"${e}"`)) items.push(`"${e}"`);
  });

  if (items.length > 0) {
    return `(${items.slice(0, 8).join(' OR ')})`;
  }

  if (parsed.coreCompetencies.length > 0) {
    return `(${parsed.coreCompetencies.slice(0, 4).map(s => `"${s}"`).join(' OR ')})`;
  }

  return '("Tractor" OR "Farm Equipment" OR "Manufacturing")';
}

export function buildGeneratedQueries(parsed: ParsedPosition): GeneratedQueries {
  const topCompanies = parsed.targetCompanies.slice(0, 10);
  const realisticTitle = getRealisticTitleGroup(parsed);
  const realisticDomain = getRealisticDomainGroup(parsed);
  const realisticLoc = getRealisticLocationGroup(parsed.locations);

  const qualGroup = parsed.qualification && /b\.?tech|be|engineering/i.test(parsed.qualification)
    ? '("B.Tech" OR "B.E" OR "BE" OR "Engineering")'
    : '';

  const skillsGroup = parsed.coreCompetencies.length > 0
    ? parsed.coreCompetencies.slice(0, 4).map(s => `"${s}"`).join(' OR ')
    : `"Dealer Network" OR "Channel Sales"`;

  const exclusions = parsed.exclusions.slice(0, 6).map(e => `"${e}"`).join(' OR ');

  // 1. NAUKRI RESDEX BOOLEAN
  let naukriBoolean = `${realisticTitle} AND ${realisticDomain}`;
  if (qualGroup) naukriBoolean += ` AND ${qualGroup}`;
  if (skillsGroup) naukriBoolean += ` AND (${skillsGroup})`;
  if (realisticLoc) naukriBoolean += ` AND ${realisticLoc}`;
  if (exclusions) naukriBoolean += ` NOT (${exclusions})`;

  // Specialized: Candidates who left their job / Notice Period / Immediate Joiners
  let naukriExEmployee = `${realisticTitle} AND ${realisticDomain} AND ("Serving Notice Period" OR "Immediate Joiner" OR "Notice Period" OR "Immediate" OR "Available to Join" OR "Ex-" OR "Actively Looking")`;
  if (qualGroup) naukriExEmployee += ` AND ${qualGroup}`;
  if (realisticLoc) naukriExEmployee += ` AND ${realisticLoc}`;
  if (exclusions) naukriExEmployee += ` NOT (${exclusions})`;

  // Specialized: Freshers & Trainees (GET / MT / B.Tech / Diploma)
  const fresherTitles = '"Fresher" OR "Graduate Engineer Trainee" OR "GET" OR "Management Trainee" OR "Diploma Trainee" OR "Sales Trainee" OR "Trainee Engineer"';
  const fresherDegrees = qualGroup || '"B.Tech" OR "B.E." OR "Diploma Mechanical" OR "B.Sc Agriculture" OR "Agricultural Engineering"';
  let naukriFresher = `(${fresherTitles}) AND (${fresherDegrees}) AND ${realisticDomain}`;
  if (realisticLoc) naukriFresher += ` AND ${realisticLoc}`;
  if (exclusions) naukriFresher += ` NOT (${exclusions})`;

  const designationSearch = parsed.standardTitles.slice(0, 5).join(' OR ');
  const mandatorySkills = [...parsed.equipmentFocus.slice(0, 3), ...parsed.coreCompetencies.slice(0, 2)];

  // 2. LINKEDIN QUERY & DIRECT URLs
  const linkedInStandardQuery = `${realisticTitle} AND ${realisticDomain}${realisticLoc ? ` AND ${realisticLoc}` : ''}`;
  const linkedInSearchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(linkedInStandardQuery)}`;

  const linkedInExQuery = `${realisticTitle} AND ${realisticDomain} AND ("Ex-" OR "Former" OR "Immediate" OR "Open to work" OR "Notice Period")${realisticLoc ? ` AND ${realisticLoc}` : ''}`;
  const linkedInExSearchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(linkedInExQuery)}`;

  const degreeKeywords = parsed.qualification ? `"${parsed.qualification.split(' ')[0]}"` : '"B.Tech" OR "B.E." OR "Diploma"';
  const linkedInFresherQuery = `("Graduate Engineer Trainee" OR "GET" OR "Management Trainee" OR "Fresher" OR "Trainee") AND (${degreeKeywords}) AND ${realisticDomain}${realisticLoc ? ` AND ${realisticLoc}` : ''}`;
  const linkedInFresherSearchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(linkedInFresherQuery)}`;

  // 3. GOOGLE X-RAY SEARCH (FREE CANDIDATES WITHOUT LINKEDIN RECRUITER)
  const googleXrayStandard = `site:linkedin.com/in ${realisticTitle} ${realisticDomain} ${realisticLoc} -intitle:jobs -intitle:recruiter`.trim();
  const googleXrayUrl = `https://www.google.com/search?q=${encodeURIComponent(googleXrayStandard)}`;

  const exCompanyList = topCompanies.slice(0, 4).map(c => `"ex-${c.split(' ')[0]}"`).join(' OR ');
  const googleXrayEx = `site:linkedin.com/in (${exCompanyList ? `${exCompanyList} OR ` : ''}"immediate joiner" OR "open to work" OR "serving notice") ${realisticDomain} ${realisticTitle} ${realisticLoc} -intitle:jobs -intitle:recruiter`.trim();
  const googleXrayExUrl = `https://www.google.com/search?q=${encodeURIComponent(googleXrayEx)}`;

  const googleXrayFresher = `site:linkedin.com/in ("Fresher" OR "Graduate Engineer Trainee" OR "GET" OR "Management Trainee" OR "Trainee") (${degreeKeywords}) ${realisticDomain} ${realisticLoc} -intitle:jobs -intitle:recruiter`.trim();
  const googleXrayFresherUrl = `https://www.google.com/search?q=${encodeURIComponent(googleXrayFresher)}`;

  // 4. WHATSAPP & REFERRAL BROADCAST
  const rawMin = parsed.experienceYears.min || 0;
  const rawMax = parsed.experienceYears.max || (rawMin ? rawMin + 3 : 0);
  const safeMin = Math.min(rawMin, rawMax);
  const safeMax = Math.max(rawMin, rawMax);
  const expStr = safeMin 
    ? (safeMin === safeMax ? `${safeMin}+ yrs` : `${safeMin}-${safeMax} yrs`)
    : (parsed.seniorityLevel === 'junior' ? '0-2 yrs (Freshers & Trainees welcome)' : 'relevant experience');
  const locStr = parsed.locations.length > 0 ? parsed.locations.slice(0, 3).join(' / ') : 'India';
  const equipmentStr = parsed.equipmentFocus.length > 0 ? parsed.equipmentFocus.slice(0, 3).join(' & ') : '';
  const domainContext = equipmentStr ? `sector: *Agricultural Equipment & Machinery*` : `domain: *${parsed.coreCompetencies.slice(0, 2).join(' / ')}*`;
  const targetCompStr = topCompanies.slice(0, 6).join(', ');

  const whatsappTemplate = `🎯 *Urgent Hiring: ${parsed.title}*

Hello, we are sourcing for a key mandate in the ${domainContext}:

• *Role:* ${parsed.title}
${equipmentStr ? `• *Product Focus:* ${equipmentStr}\n` : ''}• *Target Location:* ${locStr}
• *Experience:* ${expStr}
${parsed.qualification ? `• *Qualification:* ${parsed.qualification}\n` : ''}${targetCompStr ? `• *Target Companies:* ${targetCompStr}\n` : ''}• *Core Focus:* ${parsed.coreCompetencies.slice(0, 3).join(', ')}

If you or someone in your network (including immediate joiners or available candidates) might be open for this confidential mandate, please connect or share CV. 

Direct contact: [Your Name/Number]
Thank you!`;

  const emailSnippet = `Subject: Confidential Opportunity: ${parsed.title}${equipmentStr ? ` (${equipmentStr})` : ''} - ${locStr}

Dear Candidate,

Hope you are doing well. 

We are currently leading an executive search for a leading organization. We are looking for an experienced ${parsed.title} (${expStr}) to take charge of operations in ${locStr}.

Given your background in ${equipmentStr || parsed.coreCompetencies.slice(0, 2).join(', ')}, your profile appears to be a strong fit for this mandate.

If you are open to exploring next steps or having a brief confidential call, please reply with your updated profile or suitable time to speak.

Best regards,
HireExpert Executive Search`;

  return {
    naukri: {
      booleanQuery: naukriBoolean,
      exEmployeeQuery: naukriExEmployee,
      fresherQuery: naukriFresher,
      designationSearch,
      mandatorySkills,
      excludeTerms: parsed.exclusions.slice(0, 5),
      instructions: 'Paste the Boolean string in the "Keywords / Boolean Search" box. Set Designation to "Any of these" and apply Location filter.',
    },
    linkedin: {
      booleanQuery: linkedInStandardQuery,
      exEmployeeQuery: linkedInExQuery,
      fresherQuery: linkedInFresherQuery,
      titleKeywords: parsed.standardTitles,
      skillKeywords: [...parsed.equipmentFocus, ...parsed.coreCompetencies],
      searchUrl: linkedInSearchUrl,
      exEmployeeSearchUrl: linkedInExSearchUrl,
      fresherSearchUrl: linkedInFresherSearchUrl,
    },
    googleXray: {
      searchQuery: googleXrayStandard,
      exEmployeeQuery: googleXrayEx,
      fresherQuery: googleXrayFresher,
      directUrl: googleXrayUrl,
      exEmployeeUrl: googleXrayExUrl,
      fresherUrl: googleXrayFresherUrl,
      explanation: 'Searches LinkedIn public profiles via Google. Works 100% free without needing a paid LinkedIn Recruiter license.',
    },
    referral: {
      whatsappTemplate,
      emailSnippet,
    },
  };
}
