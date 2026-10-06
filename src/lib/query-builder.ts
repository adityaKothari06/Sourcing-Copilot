import { ParsedPosition, GeneratedQueries } from './types';

export function buildGeneratedQueries(parsed: ParsedPosition): GeneratedQueries {
  // 1. NAUKRI RESDEX BOOLEAN
  const titleGroup = parsed.standardTitles.length > 0 
    ? parsed.standardTitles.slice(0, 5).map(t => `"${t}"`).join(' OR ')
    : `"${parsed.title}"`;

  const topCompanies = parsed.targetCompanies.slice(0, 10);
  const productAndCompanyPool = [
    ...parsed.equipmentFocus.slice(0, 5),
    ...topCompanies,
  ];
  const domainGroup = productAndCompanyPool.length > 0
    ? productAndCompanyPool.map(p => `"${p}"`).join(' OR ')
    : `"Tractor" OR "Agricultural Machinery" OR "Farm Equipment" OR "Shaktiman" OR "Fieldking" OR "Mahindra"`;

  const skillsGroup = parsed.coreCompetencies.length > 0
    ? parsed.coreCompetencies.slice(0, 4).map(s => `"${s}"`).join(' OR ')
    : `"Dealer Network" OR "Channel Sales"`;

  const locationGroup = parsed.locations.length > 0
    ? parsed.locations.map(l => `"${l}"`).join(' OR ')
    : '';

  const exclusions = parsed.exclusions.slice(0, 6).map(e => `"${e}"`).join(' OR ');

  // Standard Boolean for all target lateral talent
  let naukriBoolean = `(${titleGroup}) AND (${domainGroup}) AND (${skillsGroup})`;
  if (locationGroup) naukriBoolean += ` AND (${locationGroup})`;
  if (exclusions) naukriBoolean += ` NOT (${exclusions})`;

  // Specialized: Candidates who left their job / Notice Period / Immediate Joiners
  let naukriExEmployee = `(${titleGroup}) AND (${domainGroup}) AND ("Serving Notice Period" OR "Immediate Joiner" OR "Notice Period" OR "Immediate" OR "Available to Join" OR "Ex-" OR "Actively Looking")`;
  if (locationGroup) naukriExEmployee += ` AND (${locationGroup})`;
  if (exclusions) naukriExEmployee += ` NOT (${exclusions})`;

  // Specialized: Freshers & Trainees (GET / MT / B.Tech / Diploma)
  const fresherTitles = '"Fresher" OR "Graduate Engineer Trainee" OR "GET" OR "Management Trainee" OR "Diploma Trainee" OR "Sales Trainee" OR "Trainee Engineer"';
  const fresherDegrees = '"B.Tech" OR "B.E." OR "Diploma Mechanical" OR "B.Sc Agriculture" OR "Agricultural Engineering"';
  let naukriFresher = `(${fresherTitles}) AND (${fresherDegrees}) AND (${domainGroup})`;
  if (locationGroup) naukriFresher += ` AND (${locationGroup})`;
  if (exclusions) naukriFresher += ` NOT (${exclusions})`;

  const designationSearch = parsed.standardTitles.slice(0, 5).join(' OR ');
  const mandatorySkills = [...parsed.equipmentFocus.slice(0, 3), ...parsed.coreCompetencies.slice(0, 2)];

  // 2. LINKEDIN QUERY & DIRECT URLs
  const linkedInTitles = parsed.standardTitles.slice(0, 3).map(t => `"${t}"`).join(' OR ');
  const linkedInDomain = [
    parsed.equipmentFocus[0] || 'Farm Implements',
    parsed.targetCompanies[0] || 'Shaktiman',
    parsed.targetCompanies[1] || 'Fieldking',
  ].map(k => `"${k}"`).join(' OR ');
  const linkedInLoc = parsed.locations[0] ? `"${parsed.locations[0]}"` : '';
  
  const linkedInStandardQuery = `(${linkedInTitles}) AND (${linkedInDomain})${linkedInLoc ? ` AND ${linkedInLoc}` : ''}`;
  const linkedInSearchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(linkedInStandardQuery)}`;

  const linkedInExQuery = `(${linkedInTitles}) AND (${linkedInDomain}) AND ("Ex-" OR "Former" OR "Immediate" OR "Open to work" OR "Notice Period")${linkedInLoc ? ` AND ${linkedInLoc}` : ''}`;
  const linkedInExSearchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(linkedInExQuery)}`;

  const linkedInFresherQuery = `("Graduate Engineer Trainee" OR "GET" OR "Management Trainee" OR "Fresher") AND ("B.Tech" OR "Diploma") AND (${linkedInDomain})${linkedInLoc ? ` AND ${linkedInLoc}` : ''}`;
  const linkedInFresherSearchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(linkedInFresherQuery)}`;

  // 3. GOOGLE X-RAY SEARCH (FREE CANDIDATES WITHOUT LINKEDIN RECRUITER)
  const xrayCompanies = topCompanies.slice(0, 5).map(c => `"${c.split(' ')[0]}"`).join(' OR ');
  const xrayDomain = parsed.equipmentFocus.slice(0, 3).map(e => `"${e}"`).join(' OR ') || '"Farm Implements" OR "Tractor"';
  const xrayTitles = parsed.standardTitles.slice(0, 3).map(t => `"${t}"`).join(' OR ');
  const xrayLoc = parsed.locations.length > 0 ? `("${parsed.locations.slice(0, 3).join('" OR "')}")` : '';

  const googleXrayStandard = `site:linkedin.com/in (${xrayCompanies ? `${xrayCompanies} OR ` : ''}${xrayDomain}) (${xrayTitles}) ${xrayLoc} -intitle:jobs -intitle:recruiter`.trim();
  const googleXrayUrl = `https://www.google.com/search?q=${encodeURIComponent(googleXrayStandard)}`;

  const googleXrayEx = `site:linkedin.com/in ("ex-Shaktiman" OR "ex-Fieldking" OR "ex-Lemken" OR "ex-Mahindra" OR "ex-Sonalika" OR "immediate joiner" OR "open to work" OR "serving notice") (${xrayDomain}) (${xrayTitles}) ${xrayLoc} -intitle:jobs -intitle:recruiter`.trim();
  const googleXrayExUrl = `https://www.google.com/search?q=${encodeURIComponent(googleXrayEx)}`;

  const googleXrayFresher = `site:linkedin.com/in ("Fresher" OR "Graduate Engineer Trainee" OR "GET" OR "Management Trainee") ("B.Tech" OR "Diploma" OR "Agriculture") (${xrayDomain}) ${xrayLoc} -intitle:jobs -intitle:recruiter`.trim();
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
  const equipmentStr = parsed.equipmentFocus.length > 0 ? parsed.equipmentFocus.slice(0, 3).join(' & ') : 'Tractor / Farm Implements';

  const whatsappTemplate = `🚜 *Urgent Hiring: ${parsed.title}*

Hello, we are sourcing for a reputed OEM in the *Agricultural Equipment & Tractor* sector:

• *Role:* ${parsed.title}
• *Product Focus:* ${equipmentStr}
• *Target Location:* ${locStr}
• *Experience:* ${expStr}
${parsed.qualification ? `• *Qualification:* ${parsed.qualification}\n` : ''}• *Target Background:* Ex/Current employees from Shaktiman, Fieldking, Lemken, Mahindra, Sonalika, TAFE, Escorts Kubota, etc.
• *Core Focus:* Dealer network management, field demo & channel growth.

If you or someone in your network (including immediate joiners or available candidates) might be open for this confidential mandate, please connect or share CV. 

Direct contact: [Your Name/Number]
Thank you!`;

  const emailSnippet = `Subject: Confidential Opportunity: ${parsed.title} (${equipmentStr}) - ${locStr}

Dear Candidate,

Hope you are doing well. 

We are currently leading an executive search for a leading manufacturer in the Tractor & Farm Implements space. We are looking for an experienced ${parsed.title} (${expStr}) to lead operations in ${locStr}.

Given your background in ${equipmentStr} and dealer channel management, your profile appears to be a strong fit.

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
