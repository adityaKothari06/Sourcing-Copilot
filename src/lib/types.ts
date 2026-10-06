export type PortalType = 'naukri' | 'linkedin' | 'google_xray' | 'referral';

export interface KeywordItem {
  id: string;
  text: string;
  category: 'role' | 'equipment' | 'company' | 'skill' | 'location' | 'exclusion';
  upvotes: number;
  downvotes: number;
  userRating?: 'up' | 'down' | null;
}

export interface GeneratedQueries {
  naukri: {
    booleanQuery: string;
    exEmployeeQuery?: string;
    fresherQuery?: string;
    designationSearch: string;
    mandatorySkills: string[];
    excludeTerms: string[];
    instructions: string;
  };
  linkedin: {
    booleanQuery: string;
    exEmployeeQuery?: string;
    fresherQuery?: string;
    titleKeywords: string[];
    skillKeywords: string[];
    searchUrl: string;
    exEmployeeSearchUrl?: string;
    fresherSearchUrl?: string;
  };
  googleXray: {
    searchQuery: string;
    exEmployeeQuery?: string;
    fresherQuery?: string;
    directUrl: string;
    exEmployeeUrl?: string;
    fresherUrl?: string;
    explanation: string;
  };
  referral: {
    whatsappTemplate: string;
    emailSnippet: string;
  };
}

export interface ParsedPosition {
  title: string;
  standardTitles: string[];
  seniorityLevel: string;
  experienceYears: { min: number; max: number };
  locations: string[];
  equipmentFocus: string[];
  targetCompanies: string[];
  adjacentTalentPools: string[];
  coreCompetencies: string[];
  exclusions: string[];
  qualification?: string;
}

export interface SourcingPosition {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  rawInput: string;
  inputType: 'voice' | 'text' | 'jd';
  parsed: ParsedPosition;
  keywords: KeywordItem[];
  queries: GeneratedQueries;
  searchRating?: 'excellent' | 'moderate' | 'poor' | null;
  searchNotes?: string;
}

export interface KeywordFeedbackSubmission {
  positionId: string;
  keywordText: string;
  category: KeywordItem['category'];
  portal: PortalType;
  vote: 'up' | 'down';
  notes?: string;
}
