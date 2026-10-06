export interface DomainKnowledgeBase {
  tractorOEMs: string[];
  implementOEMs: string[];
  equipmentCategories: {
    name: string;
    synonyms: string[];
    typicalRoles: string[];
  }[];
  jobTitles: {
    standard: string;
    synonyms: string[];
    seniority: 'junior' | 'mid' | 'senior' | 'leadership';
  }[];
  functionalSkills: string[];
  adjacentIndustries: {
    name: string;
    targetRoles: string[];
    companies: string[];
  }[];
  standardExclusions: string[];
  indianAgriStatesAndHubs: {
    region: string;
    aliases?: string[];
    states: string[];
    majorHubs: string[];
  }[];
}

export const TRACTOR_IMPLEMENTS_KNOWLEDGE: DomainKnowledgeBase = {
  tractorOEMs: [
    'Mahindra & Mahindra',
    'Mahindra Farm Equipment',
    'Swaraj Tractors',
    'Swaraj',
    'Sonalika',
    'Sonalika Tractors',
    'International Tractors Limited',
    'ITL',
    'Solis Tractors',
    'Escorts Kubota',
    'Escorts',
    'Kubota',
    'Farmtrac',
    'Powertrac',
    'Digitrac',
    'TAFE',
    'Tractors and Farm Equipment',
    'Massey Ferguson',
    'Eicher Tractors',
    'John Deere',
    'John Deere India',
    'New Holland',
    'New Holland Agriculture',
    'CNH Industrial',
    'Case IH',
    'VST Tillers',
    'VST Tillers Tractors',
    'VST Shakti',
    'Captain Tractors',
    'Preet Tractors',
    'Indo Farm',
    'Indo Farm Equipment',
    'Force Motors',
    'Standard Tractors',
    'ACE Tractors',
    'Kartar Tractors',
    'SAME Deutz-Fahr',
    'SDF India',
    'Landini',
    'Gromax Agri',
    'Trakstar',
  ],

  implementOEMs: [
    'Shaktiman',
    'Tirth Agro',
    'Shaktiman Agro',
    'Fieldking',
    'Beri Udyog',
    'Lemken',
    'Lemken India',
    'Maschio Gaspardo',
    'Maschio Gaspardo India',
    'Sai Agro',
    'Garud',
    'Sovereign Tech',
    'Landforce',
    'Dasmesh Mechanical Works',
    'KS Agrotech',
    'KS Group',
    'Jagatjit',
    'Jagatjit Group',
    'Dasmesh',
    'Dasmesh Agro',
    'Balkar',
    'Balkar Combines',
    'Preet Agro',
    'New Swan Multitech',
    'Bull Agro',
    'Claas India',
    'Mitra Agro Equipments',
    'Mitra Sprayers',
    'ASPEE',
    'ASPEE Group',
    'KisanKraft',
    'Honda India Power Products',
    'Honda Power',
    'Greaves Cotton Agri',
    'STIHL India',
    'Husqvarna India',
    'Kuhn India',
    'Kverneland India',
    'Yanmar India',
    'Captain Agri',
    'Agricad',
    'Redlands Ashlyn',
    'National Agro Industries',
    'Malwa Agro',
    'Gobind Industries',
    'Guru Nanak Agri',
    'Agristar',
    'Escorts Crop Solutions',
    'Swaraj Implements',
    'Falcon Garden Tools',
    'Balwan Agri',
    'Neptune Fairdeal',
  ],

  equipmentCategories: [
    {
      name: 'Rotavator / Rotary Tiller',
      synonyms: ['Rotavator', 'Rotary Tiller', 'Rotorvator', 'Rotovator', 'Tillage Equipment', 'Active Tillage'],
      typicalRoles: ['Sales Executive', 'Territory Manager', 'Service Engineer', 'Dealer Development'],
    },
    {
      name: 'Plough & Primary Tillage',
      synonyms: ['MB Plough', 'Mouldboard Plough', 'Reversible Plough', 'Hydraulic Reversible MB Plough', 'Disc Plough', 'Chisel Plough', 'Subsoiler'],
      typicalRoles: ['Area Sales Manager', 'Territory In-charge', 'Field Demo Specialist'],
    },
    {
      name: 'Secondary Tillage & Harrow',
      synonyms: ['Cultivator', 'Spring Cultivator', 'Rigid Cultivator', 'Duckfoot Cultivator', 'Disc Harrow', 'Offset Disc Harrow'],
      typicalRoles: ['Territory Manager', 'Channel Sales'],
    },
    {
      name: 'Laser Land Leveler',
      synonyms: ['Laser Land Leveler', 'Laser Leveler', 'Laser Transmitter', 'Scraper Bucket', 'Precision Farming Equipment'],
      typicalRoles: ['Product Specialist', 'Technical Sales', 'Demonstration Executive'],
    },
    {
      name: 'Harvester & Straw Management',
      synonyms: ['Combine Harvester', 'Paddy Harvester', 'Track Harvester', 'Straw Reaper', 'Super Seeder', 'Happy Seeder', 'Straw Management System'],
      typicalRoles: ['Zonal Service Manager', 'Harvesting Specialist', 'Key Account Manager'],
    },
    {
      name: 'Balers & Crop Residue',
      synonyms: ['Baler', 'Round Baler', 'Square Baler', 'Mini Round Baler', 'Hay Rake', 'Forage Harvester', 'Baling Machine'],
      typicalRoles: ['Product Manager', 'Institutional Sales', 'Project Sales'],
    },
    {
      name: 'Power Tillers & Weeders',
      synonyms: ['Power Tiller', 'Power Weeder', 'Inter-cultivation Equipment', 'Mini Weeder', 'Walking Tractor'],
      typicalRoles: ['Rural Sales Manager', 'Dealer Network Executive', 'Govt Subsidy Manager'],
    },
    {
      name: 'Sprayers & Crop Care',
      synonyms: ['Boom Sprayer', 'Tractor Mounted Sprayer', 'Orchard Sprayer', 'Air Assisted Sprayer', 'Mist Blower', 'Power Sprayer'],
      typicalRoles: ['Territory Sales Manager', 'Horticulture Equipment Specialist'],
    },
    {
      name: 'Sowing & Planting',
      synonyms: ['Seed Drill', 'Zero Till Drill', 'Multi Crop Planter', 'Pneumatic Planter', 'Rabi Drill', 'Paddy Transplanter'],
      typicalRoles: ['Territory Manager', 'Agronomy Specialist'],
    },
  ],

  jobTitles: [
    {
      standard: 'Territory Sales Manager',
      synonyms: ['Territory Manager', 'TSM', 'Area Sales Manager', 'ASM', 'Territory In-charge', 'Area Manager', 'Area Sales Executive', 'ASE', 'Territory Sales Executive'],
      seniority: 'mid',
    },
    {
      standard: 'Regional Sales Manager',
      synonyms: ['Regional Manager', 'RSM', 'Zonal Sales Manager', 'ZSM', 'State Head', 'Regional Head', 'Zonal Head'],
      seniority: 'senior',
    },
    {
      standard: 'Customer Service Engineer',
      synonyms: ['Service Territory Manager', 'Customer Support Engineer', 'CSE', 'Service In-charge', 'Area Service Manager', 'Service Engineer', 'Field Service Specialist'],
      seniority: 'mid',
    },
    {
      standard: 'Dealer Development Manager',
      synonyms: ['Dealer Network Manager', 'Channel Development Manager', 'Network Expansion Executive', 'Dealer Network Appointment'],
      seniority: 'mid',
    },
    {
      standard: 'Spare Parts Specialist',
      synonyms: ['Parts Territory Manager', 'Spares Sales Manager', 'Spare Parts Executive', 'Parts Distribution Incharge'],
      seniority: 'mid',
    },
    {
      standard: 'Field Demonstration Specialist',
      synonyms: ['Demo Executive', 'Product Demonstrator', 'Field Trial Specialist', 'Agronomy Demo Specialist'],
      seniority: 'junior',
    },
  ],

  functionalSkills: [
    'Dealer Network Management',
    'Channel Sales',
    'Dealer Appointment',
    'Counter Sales',
    'Secondary Sales',
    'Primary Sales',
    'Government Subsidy',
    'DBT Portal',
    'SMAM Scheme',
    'Field Demonstration',
    'Farmer Meets',
    'Kisan Mela',
    'Customer Relationship',
    'After Sales Support',
    'Warranty Claim Processing',
    'PDI Pre-Delivery Inspection',
    'Mechanic Training',
    'Spare Parts Inventory',
    'Territory Development',
    'Collection & Outstanding Management',
  ],

  adjacentIndustries: [
    {
      name: 'Rural Commercial Vehicles (Pickups / SCV)',
      targetRoles: ['Territory Sales Manager', 'Rural Channel Incharge', 'Dealer Sales Executive'],
      companies: ['Mahindra Bolero Maxi Truck', 'Tata Motors SCV', 'Ashok Leyland Dost', 'Piaggio Ape', 'Force Motors Commercial'],
    },
    {
      name: 'Construction & Earthmoving Equipment',
      targetRoles: ['Area Sales Manager', 'Territory Manager Backhoe', 'Customer Support Engineer'],
      companies: ['JCB India', 'Escorts Construction Equipment', 'Action Construction Equipment (ACE)', 'Case Construction', 'L&T Construction Equipment'],
    },
    {
      name: 'Agri-Inputs & Agro-Chemicals',
      targetRoles: ['Territory Manager', 'Area Business Manager', 'Channel Development Officer'],
      companies: ['UPL', 'Coromandel International', 'Crystal Crop Protection', 'Dhanuka Agritech', 'Bayer Crop Science', 'PI Industries'],
    },
    {
      name: 'Two-Wheeler Rural Sales',
      targetRoles: ['Rural Territory Manager', 'Area Sales Manager', 'Channel Executive'],
      companies: ['Hero MotoCorp', 'Bajaj Auto', 'TVS Motor Company'],
    },
  ],

  standardExclusions: [
    'Software',
    'IT',
    'Java',
    'Python',
    'Developer',
    'Frontend',
    'Backend',
    'DevOps',
    'QA Tester',
    'Telecom',
    'BPO',
    'Call Center',
    'Banking',
    'Insurance Agent',
    'Wealth Management',
    'Apparel Retail',
    'FMCG Modern Trade',
  ],

  indianAgriStatesAndHubs: [
    {
      region: 'North East India',
      aliases: ['northeast', 'north east', 'north-east', 'ne', 'seven sisters'],
      states: ['Assam', 'Meghalaya', 'Tripura', 'Mizoram', 'Manipur', 'Nagaland', 'Arunachal Pradesh', 'Sikkim'],
      majorHubs: ['Guwahati', 'Siliguri', 'Dibrugarh', 'Jorhat', 'Silchar', 'Agartala', 'Shillong', 'Dimapur', 'Imphal', 'Aizawl', 'Gangtok', 'Tezpur', 'Tinsukia'],
    },
    {
      region: 'West India',
      aliases: ['west', 'west india', 'western india'],
      states: ['Maharashtra', 'Gujarat', 'Goa'],
      majorHubs: ['Pune', 'Nashik', 'Nagpur', 'Aurangabad', 'Chhatrapati Sambhajinagar', 'Kolhapur', 'Ahmedabad', 'Rajkot', 'Surat', 'Baroda', 'Vadodara'],
    },
    {
      region: 'North India',
      aliases: ['north', 'north india', 'northern india'],
      states: ['Punjab', 'Haryana', 'Uttar Pradesh', 'Rajasthan', 'Uttarakhand', 'Himachal Pradesh', 'Delhi NCR'],
      majorHubs: ['Ludhiana', 'Karnal', 'Chandigarh', 'Jaipur', 'Kota', 'Lucknow', 'Varanasi', 'Meerut', 'Agra', 'Gorakhpur', 'Bareilly'],
    },
    {
      region: 'Central India',
      aliases: ['central', 'central india'],
      states: ['Madhya Pradesh', 'Chhattisgarh'],
      majorHubs: ['Indore', 'Bhopal', 'Jabalpur', 'Gwalior', 'Ujjain', 'Raipur', 'Bilaspur'],
    },
    {
      region: 'South India',
      aliases: ['south', 'south india', 'southern india'],
      states: ['Andhra Pradesh', 'Telangana', 'Karnataka', 'Tamil Nadu', 'Kerala'],
      majorHubs: ['Hyderabad', 'Vijayawada', 'Guntur', 'Bengaluru', 'Hubli', 'Dharwad', 'Belgaum', 'Coimbatore', 'Madurai', 'Trichy'],
    },
    {
      region: 'East India',
      aliases: ['east', 'east india', 'eastern india'],
      states: ['Bihar', 'West Bengal', 'Odisha', 'Jharkhand'],
      majorHubs: ['Patna', 'Muzaffarpur', 'Kolkata', 'Burdwan', 'Bhubaneswar', 'Cuttack', 'Ranchi'],
    },
  ],
};
