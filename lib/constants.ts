export const LEAD_SOURCES = ["manual", "tool_generated"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

// Only "US" is usable today; CA/UK are placeholders so the schema/filters
// don't need a rebuild once those regions are sourced.
export const LEAD_COUNTRIES = ["US", "CA", "UK"] as const;
export type LeadCountry = (typeof LEAD_COUNTRIES)[number];

// Countries the "Generate" search will actually source from right now.
// Brief requires US-only; add "CA" / "UK" here (no other code change) to expand.
export const ENABLED_SEARCH_COUNTRIES: readonly LeadCountry[] = ["US"];

// Maps our short country code <-> the location string Apollo expects, and a
// human label for the UI. Keep all three lists in sync when adding a country.
export const COUNTRY_CONFIG: Record<
  LeadCountry,
  { label: string; apolloLocation: string }
> = {
  US: { label: "United States", apolloLocation: "United States" },
  CA: { label: "Canada", apolloLocation: "Canada" },
  UK: { label: "United Kingdom", apolloLocation: "United Kingdom" },
};

// Normalizes Apollo's free-text `country` (e.g. "United States") back to our
// short code for storage. Falls back to "US" since search is US-scoped today.
export function countryCodeFromApollo(apolloCountry: string | null | undefined): LeadCountry {
  const match = (Object.keys(COUNTRY_CONFIG) as LeadCountry[]).find(
    (code) => COUNTRY_CONFIG[code].apolloLocation.toLowerCase() === (apolloCountry ?? "").toLowerCase(),
  );
  return match ?? "US";
}

// Curated industry picklist for tagging/filtering leads. Free-text in the DB,
// so this list can grow without a migration. Ordered roughly by how often
// fractional CMO prospects cluster in each vertical.
export const INDUSTRIES = [
  "Luxury Hospitality",
  "Travel & Tourism",
  "SaaS / B2B Software",
  "FinTech",
  "Financial Services",
  "Healthcare / HealthTech",
  "Consumer Goods / CPG",
  "Beauty & Cosmetics",
  "Retail & eCommerce",
  "Fashion & Apparel",
  "Food & Beverage",
  "Real Estate / PropTech",
  "Media & Entertainment",
  "Education / EdTech",
  "Technology / Hardware",
  "Professional Services",
  "Manufacturing / Industrial",
  "Automotive",
  "Sports & Fitness",
  "Energy / CleanTech",
  "Nonprofit",
  "Legal",
  "Cannabis",
  "Aerospace & Defense",
  "Agriculture / AgTech",
  "Construction & Built Environment",
  "Gaming & Esports",
  "Insurance / InsurTech",
  "Logistics & Supply Chain",
  "Telecommunications",
  "Government & Public Sector",
  "Pets & Pet Care",
  "Home & Furniture",
  "Events & Experiential",
  "Cybersecurity",
  "Other",
] as const;
export type Industry = (typeof INDUSTRIES)[number];

// Case-insensitive keyword hints used to auto-tag a lead's industry from its
// title/summary/company text. First match wins, so order from specific → broad.
export const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  "Luxury Hospitality": ["luxury hospitality", "luxury hotel", "resort", "five-star", "5-star", "hospitality"],
  "Travel & Tourism": ["travel", "tourism", "airline", "cruise", "destination"],
  "Beauty & Cosmetics": ["beauty", "cosmetic", "skincare", "makeup", "fragrance"],
  "Fashion & Apparel": ["fashion", "apparel", "footwear", "luxury goods", "jewelry"],
  "FinTech": ["fintech", "payments", "crypto", "blockchain", "neobank"],
  "Financial Services": ["financial services", "bank", "insurance", "wealth", "investment", "capital"],
  "Healthcare / HealthTech": ["healthcare", "health tech", "healthtech", "medical", "pharma", "biotech", "wellness", "clinic"],
  "SaaS / B2B Software": ["saas", "b2b software", "b2b", "software", "platform", "cloud", "proserve"],
  "Consumer Goods / CPG": ["cpg", "consumer goods", "consumer packaged", "d2c", "dtc"],
  "Retail & eCommerce": ["retail", "ecommerce", "e-commerce", "marketplace"],
  "Food & Beverage": ["food", "beverage", "restaurant", "cpg food", "grocery"],
  "Real Estate / PropTech": ["real estate", "proptech", "property"],
  "Media & Entertainment": ["media", "entertainment", "publishing", "gaming", "streaming", "sports media"],
  "Education / EdTech": ["education", "edtech", "e-learning", "university", "academy"],
  "Technology / Hardware": ["hardware", "iot", "semiconductor", "robotics", "device"],
  "Automotive": ["automotive", "auto ", "vehicle", "mobility"],
  "Sports & Fitness": ["sports", "fitness", "athletic", "gym"],
  "Energy / CleanTech": ["energy", "cleantech", "clean tech", "solar", "renewable", "climate"],
  "Nonprofit": ["nonprofit", "non-profit", "ngo", "charity", "foundation"],
  "Legal": ["legal", "law firm", "legaltech"],
  "Cannabis": ["cannabis", "cbd", "hemp"],
  "Aerospace & Defense": ["aerospace", "defense", "defence", "aviation", "space "],
  "Agriculture / AgTech": ["agriculture", "agtech", "ag tech", "farming", "agribusiness"],
  "Construction & Built Environment": ["construction", "built environment", "architecture", "contech"],
  "Gaming & Esports": ["gaming", "esports", "video game", "game studio"],
  "Insurance / InsurTech": ["insurance", "insurtech", "reinsurance", "underwriting"],
  "Logistics & Supply Chain": ["logistics", "supply chain", "freight", "3pl", "fulfillment"],
  "Telecommunications": ["telecom", "telecommunications", "wireless", "5g", "broadband"],
  "Government & Public Sector": ["government", "public sector", "govtech", "civic", "municipal"],
  "Pets & Pet Care": ["pet ", "pets", "veterinary", "petcare"],
  "Home & Furniture": ["furniture", "home goods", "home decor", "interior design", "homeware"],
  "Events & Experiential": ["events", "experiential", "conference", "trade show", "event marketing"],
  "Cybersecurity": ["cybersecurity", "cyber security", "infosec", "security software"],
  "Manufacturing / Industrial": ["manufacturing", "industrial", "factory"],
  "Professional Services": ["consulting", "agency", "advisory", "professional services"],
};

// Company-size buckets → Apollo `organization_num_employees_ranges` ("min,max").
export const COMPANY_SIZES = [
  { label: "Micro (1–9)", range: "1,9" },
  { label: "Small (10–49)", range: "10,49" },
  { label: "Medium (50–249)", range: "50,249" },
  { label: "Large (250+)", range: "250,1000000" },
] as const;

// Decision-maker role buckets. `keywords` classify a lead's free-text title into
// a bucket for the leads filter; `searchTitles` feed Apollo's person_titles.
export const TITLE_CATEGORIES: { label: string; keywords: string[]; searchTitles: string[] }[] = [
  { label: "Fractional CMO", keywords: ["fractional cmo", "fractional chief marketing", "interim cmo", "fractional marketing"],
    searchTitles: ["Fractional CMO", "Fractional Chief Marketing Officer", "Interim CMO", "Interim Chief Marketing Officer"] },
  { label: "CMO", keywords: ["cmo", "chief marketing officer"],
    searchTitles: ["Chief Marketing Officer", "CMO"] },
  { label: "VP Marketing", keywords: ["vp marketing", "vp of marketing", "vice president marketing", "vice president of marketing", "svp marketing"],
    searchTitles: ["VP Marketing", "VP of Marketing", "SVP Marketing", "Fractional VP Marketing"] },
  { label: "Head of Marketing", keywords: ["head of marketing", "head, marketing", "marketing lead"],
    searchTitles: ["Head of Marketing", "Head of Growth Marketing"] },
  { label: "Marketing Director", keywords: ["marketing director", "director of marketing", "director, marketing"],
    searchTitles: ["Marketing Director", "Director of Marketing", "Fractional Marketing Director"] },
  { label: "Growth", keywords: ["growth", "demand generation", "demand gen"],
    searchTitles: ["Chief Growth Officer", "Head of Growth", "VP Growth", "Head of Demand Generation"] },
  { label: "Brand", keywords: ["brand", "chief brand"],
    searchTitles: ["Chief Brand Officer", "VP Brand", "Head of Brand", "Brand Director"] },
  { label: "Creative Strategy", keywords: ["creative strateg", "creative director", "creative lead"],
    searchTitles: ["Creative Director", "Senior Creative Strategist", "Head of Creative", "VP Creative"] },
  { label: "Product Marketing", keywords: ["product marketing", "pmm"],
    searchTitles: ["VP Product Marketing", "Head of Product Marketing", "Director of Product Marketing"] },
  { label: "Revenue", keywords: ["chief revenue", "cro", "revenue officer"],
    searchTitles: ["Chief Revenue Officer", "CRO"] },
];

// Classify a free-text title into one of the TITLE_CATEGORIES labels, or null.
export function categorizeTitle(title: string | null | undefined): string | null {
  const t = (title ?? "").toLowerCase();
  if (!t) return null;
  for (const cat of TITLE_CATEGORIES) {
    if (cat.keywords.some((k) => t.includes(k))) return cat.label;
  }
  return null;
}

// Apollo returns its own authoritative industry string (e.g. "restaurants").
// Map the common ones onto our picklist so the filter stays coherent; anything
// unmapped is Title-Cased and kept as-is (still accurate, just Apollo's wording).
const APOLLO_INDUSTRY_MAP: Record<string, string> = {
  "information technology & services": "SaaS / B2B Software",
  "computer software": "SaaS / B2B Software",
  "software": "SaaS / B2B Software",
  "internet": "SaaS / B2B Software",
  "financial services": "Financial Services",
  "banking": "Financial Services",
  "investment management": "Financial Services",
  "insurance": "Insurance / InsurTech",
  "hospital & health care": "Healthcare / HealthTech",
  "health, wellness & fitness": "Healthcare / HealthTech",
  "medical devices": "Healthcare / HealthTech",
  "pharmaceuticals": "Healthcare / HealthTech",
  "biotechnology": "Healthcare / HealthTech",
  "restaurants": "Food & Beverage",
  "food & beverages": "Food & Beverage",
  "food production": "Food & Beverage",
  "consumer goods": "Consumer Goods / CPG",
  "consumer electronics": "Technology / Hardware",
  "cosmetics": "Beauty & Cosmetics",
  "apparel & fashion": "Fashion & Apparel",
  "luxury goods & jewelry": "Fashion & Apparel",
  "retail": "Retail & eCommerce",
  "real estate": "Real Estate / PropTech",
  "leisure, travel & tourism": "Travel & Tourism",
  "hospitality": "Luxury Hospitality",
  "education management": "Education / EdTech",
  "e-learning": "Education / EdTech",
  "higher education": "Education / EdTech",
  "computer & network security": "Cybersecurity",
  "telecommunications": "Telecommunications",
  "logistics & supply chain": "Logistics & Supply Chain",
  "automotive": "Automotive",
  "sports": "Sports & Fitness",
  "nonprofit organization management": "Nonprofit",
  "law practice": "Legal",
  "legal services": "Legal",
};

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Normalize Apollo's industry string to our taxonomy (or a tidy Title Case).
export function mapApolloIndustry(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim().toLowerCase();
  if (!t) return null;
  return APOLLO_INDUSTRY_MAP[t] ?? titleCase(t);
}

// Best-effort industry guess from a lead's text. Returns null if nothing matches.
export function guessIndustry(text: string | null | undefined): string | null {
  const t = (text ?? "").toLowerCase();
  if (!t) return null;
  for (const [industry, kws] of Object.entries(INDUSTRY_KEYWORDS)) {
    if (kws.some((k) => t.includes(k))) return industry;
  }
  return null;
}

export const CSV_COLUMNS = [
  "name",
  "title",
  "linkedin_url",
  "email",
  "personal_website",
  "company_website",
  "summary",
  "university",
  "past_employers",
  "source",
] as const;
