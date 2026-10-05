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
    designationSearch: string;
    mandatorySkills: string[];
    excludeTerms: string[];
    instructions: string;
  };
  linkedin: {
    booleanQuery: string;
    titleKeywords: string[];
    skillKeywords: string[];
    searchUrl: string;
  };
  googleXray: {
    searchQuery: string;
    directUrl: string;
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
