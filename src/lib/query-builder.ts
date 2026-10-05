import { ParsedPosition, GeneratedQueries } from './types';

export function buildGeneratedQueries(parsed: ParsedPosition): GeneratedQueries {
  // 1. NAUKRI RESDEX BOOLEAN
  // Target format: ("Role1" OR "Role2") AND ("Product1" OR "Product2" OR "Company1") AND ("Skill1" OR "Skill2") NOT ("Software" OR "IT")
  const titleGroup = parsed.standardTitles.length > 0 
    ? parsed.standardTitles.slice(0, 5).map(t => `"${t}"`).join(' OR ')
    : `"${parsed.title}"`;

  const productAndCompanyPool = [
    ...parsed.equipmentFocus.slice(0, 4),
    ...parsed.targetCompanies.slice(0, 4)
  ];
  const domainGroup = productAndCompanyPool.length > 0
    ? productAndCompanyPool.map(p => `"${p}"`).join(' OR ')
    : `"Tractor" OR "Agricultural Machinery" OR "Farm Equipment"`;

  const skillsGroup = parsed.coreCompetencies.length > 0
    ? parsed.coreCompetencies.slice(0, 3).map(s => `"${s}"`).join(' OR ')
    : `"Dealer Network" OR "Channel Sales"`;

  const locationGroup = parsed.locations.length > 0
    ? parsed.locations.map(l => `"${l}"`).join(' OR ')
    : '';

  const exclusions = parsed.exclusions.slice(0, 6).map(e => `"${e}"`).join(' OR ');

  // Assemble full boolean
  let naukriBoolean = `(${titleGroup}) AND (${domainGroup}) AND (${skillsGroup})`;
  if (locationGroup) {
    naukriBoolean += ` AND (${locationGroup})`;
  }
  if (exclusions) {
    naukriBoolean += ` NOT (${exclusions})`;
  }

  const designationSearch = parsed.standardTitles.slice(0, 4).map(t => `"${t}"`).join(' OR ');
  const mandatorySkills = [...parsed.equipmentFocus.slice(0, 3), ...parsed.coreCompetencies.slice(0, 2)];

  // 2. LINKEDIN QUERY & DIRECT URL
  const linkedInTitles = parsed.standardTitles.slice(0, 3).map(t => `"${t}"`).join(' OR ');
  const linkedInDomain = [parsed.equipmentFocus[0] || 'Tractor', parsed.targetCompanies[0] || 'Implements'].map(k => `"${k}"`).join(' OR ');
  const linkedInLoc = parsed.locations[0] ? `"${parsed.locations[0]}"` : '';
  
  const linkedInQuery = `(${linkedInTitles}) AND (${linkedInDomain})${linkedInLoc ? ` AND ${linkedInLoc}` : ''}`;
  const linkedInSearchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(linkedInQuery)}`;

  // 3. GOOGLE X-RAY SEARCH (FREE CANDIDATES WITHOUT LINKEDIN RECRUITER)
  const xrayCompanies = parsed.targetCompanies.slice(0, 3).map(c => `"${c.split(' ')[0]}"`).join(' OR ');
  const xrayDomain = parsed.equipmentFocus.slice(0, 2).map(e => `"${e}"`).join(' OR ') || '"Tractor" OR "Farm Implements"';
  const xrayTitles = parsed.standardTitles.slice(0, 3).map(t => `"${t}"`).join(' OR ');
  const xrayLoc = parsed.locations.length > 0 ? `("${parsed.locations.join('" OR "')}")` : '';

  const googleXrayQuery = `site:linkedin.com/in (${xrayCompanies ? `${xrayCompanies} OR ` : ''}${xrayDomain}) (${xrayTitles}) ${xrayLoc} -intitle:jobs -intitle:recruiter`.trim();
  const googleXrayUrl = `https://www.google.com/search?q=${encodeURIComponent(googleXrayQuery)}`;

  // 4. WHATSAPP & REFERRAL BROADCAST
  const expStr = parsed.experienceYears.min 
    ? `${parsed.experienceYears.min}-${parsed.experienceYears.max || parsed.experienceYears.min + 3} yrs`
    : 'relevant experience';
  const locStr = parsed.locations.length > 0 ? parsed.locations.join('/') : 'India';
  const equipmentStr = parsed.equipmentFocus.length > 0 ? parsed.equipmentFocus.slice(0, 2).join(' & ') : 'Tractor / Farm Implements';

  const whatsappTemplate = `🚜 *Urgent Hiring: ${parsed.title}*

Hello, we are sourcing for a reputed OEM in the *Agricultural Equipment & Tractor* sector:

• *Role:* ${parsed.title}
• *Product Focus:* ${equipmentStr}
• *Target Location:* ${locStr}
• *Experience:* ${expStr}
• *Core Focus:* Dealer network management, field demo & channel growth.

If you or someone in your network (ex-Mahindra, Shaktiman, Lemken, Sonalika, Fieldking, etc.) might be open for this confidential mandate, please connect or share CV. 

Direct contact: [Your Name/Number]
Thank you!`;

  const emailSnippet = `Subject: Confidential Opportunity: ${parsed.title} (${equipmentStr}) - ${locStr}

Dear Candidate,

Hope you are doing well. 

We are currently leading an executive search for a leading manufacturer in the Tractor & Farm Implements space. We are looking for an experienced ${parsed.title} (${expStr}) to head the territory in ${locStr}.

Given your background in ${equipmentStr} and dealer channel management, your profile appears to be a strong fit.

If you are open to exploring next steps or having a brief confidential call, please reply with your updated profile or suitable time to speak.

Best regards,
HireExpert Executive Search`;

  return {
    naukri: {
      booleanQuery: naukriBoolean,
      designationSearch,
      mandatorySkills,
      excludeTerms: parsed.exclusions.slice(0, 5),
      instructions: 'Paste the Boolean string in the "Keywords / Boolean Search" box. Set Designation to "Any of these" and apply Location filter.',
    },
    linkedin: {
      booleanQuery: linkedInQuery,
      titleKeywords: parsed.standardTitles,
      skillKeywords: [...parsed.equipmentFocus, ...parsed.coreCompetencies],
      searchUrl: linkedInSearchUrl,
    },
    googleXray: {
      searchQuery: googleXrayQuery,
      directUrl: googleXrayUrl,
      explanation: 'Searches LinkedIn public profiles via Google. Works 100% free without needing a paid LinkedIn Recruiter license.',
    },
    referral: {
      whatsappTemplate,
      emailSnippet,
    },
  };
}
