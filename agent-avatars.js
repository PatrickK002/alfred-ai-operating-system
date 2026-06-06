const LOCAL_AVATAR_PREFIX = "/assets/avatars/";

export const CURRENT_AGENT_IDS = Object.freeze([
  "alfred",
  "olivia",
  "sarah",
  "westbridge-property-director",
]);

export const PLANNED_AGENT_IDS = Object.freeze([
  "maya",
  "alex",
  "ethan",
  "liam",
  "james",
]);

export const AGENT_AVATAR_PROFILES = Object.freeze([
  {
    id: "alfred",
    name: "Alfred",
    title: "AI Chief of Staff / Operating Partner",
    businessArea: "Group Executive Office",
    companyId: null,
    department: "Executive Operations",
    avatarPath: "/assets/avatars/alfred.svg",
    fallbackInitials: "A",
    accentColor: "#62ead5",
    voicePersonaPlaceholder: "alfred-primary-voice",
    expertiseTags: ["Executive briefings", "Prioritisation", "Risk review", "Decision support"],
    status: "Active advisory",
    statusCategory: "active",
    reportingLine: "Patrick King",
    mission: "Protect Patrick's time, coordinate the executive team and keep recommendations factual, sourced and approval-led.",
  },
  {
    id: "olivia",
    name: "Olivia",
    title: "Chief Financial Officer",
    businessArea: "Group Finance",
    companyId: null,
    department: "Finance",
    avatarPath: "/assets/avatars/olivia.svg",
    fallbackInitials: "O",
    accentColor: "#8bc7ff",
    voicePersonaPlaceholder: "olivia-cfo-voice",
    expertiseTags: ["Forecasting", "Order book", "Debtors", "Board reporting"],
    status: "Active advisory",
    statusCategory: "active",
    reportingLine: "Alfred",
    mission: "Act as Group CFO across Alfred-managed businesses with read-only financial intelligence and board-level recommendations.",
  },
  {
    id: "sarah",
    name: "Sarah",
    title: "Digital Construction Director",
    businessArea: "Digitize Consultants",
    companyId: "digitize",
    department: "Digital Construction",
    avatarPath: "/assets/avatars/sarah.svg",
    fallbackInitials: "S",
    accentColor: "#b18ae2",
    voicePersonaPlaceholder: "sarah-digital-construction-voice",
    expertiseTags: ["BIM", "ISO 19650", "COBie", "Digital Twin"],
    status: "Active advisory",
    statusCategory: "active",
    reportingLine: "Alfred",
    mission: "Provide advisory-only BIM, GIS, ISO 19650, COBie and project information intelligence for Digitize.",
  },
  {
    id: "westbridge-property-director",
    name: "Westbridge Property Director",
    title: "AI Investment Director",
    businessArea: "Westbridge Property Group",
    companyId: "westbridge",
    department: "Property Investment",
    avatarPath: "/assets/avatars/westbridge-property-director.svg",
    fallbackInitials: "W",
    accentColor: "#d7b56d",
    voicePersonaPlaceholder: "westbridge-property-voice",
    expertiseTags: ["Cashflow", "Due diligence", "Deal analysis", "Refinance"],
    status: "Active advisory",
    statusCategory: "active",
    reportingLine: "Alfred",
    mission: "Analyse property pipeline, portfolio cashflow, due diligence and investment risk without offers, purchases or legal instructions.",
  },
  {
    id: "maya",
    name: "Maya",
    title: "Media Director",
    businessArea: "Media Studio",
    companyId: "media",
    department: "Media",
    avatarPath: "/assets/avatars/maya.svg",
    fallbackInitials: "M",
    accentColor: "#e2b46b",
    voicePersonaPlaceholder: "maya-media-voice",
    expertiseTags: ["Content strategy", "Channel systems", "Production", "Monetisation"],
    status: "Planned",
    statusCategory: "planned",
    reportingLine: "Alfred",
    mission: "Future placeholder for media business strategy and production operating systems.",
  },
  {
    id: "alex",
    name: "Alex",
    title: "Growth Director",
    businessArea: "Group Growth",
    companyId: null,
    department: "Growth",
    avatarPath: "/assets/avatars/alex.svg",
    fallbackInitials: "A",
    accentColor: "#7fa9e2",
    voicePersonaPlaceholder: "alex-growth-voice",
    expertiseTags: ["Pipeline", "Partnerships", "Sales strategy", "Market signals"],
    status: "Planned",
    statusCategory: "planned",
    reportingLine: "Alfred",
    mission: "Future placeholder for growth strategy, lead qualification and revenue opportunity intelligence.",
  },
  {
    id: "ethan",
    name: "Ethan",
    title: "Chief Technology Officer",
    businessArea: "Technology",
    companyId: null,
    department: "Technology",
    avatarPath: "/assets/avatars/ethan.svg",
    fallbackInitials: "E",
    accentColor: "#72d6ff",
    voicePersonaPlaceholder: "ethan-cto-voice",
    expertiseTags: ["Architecture", "Security", "Cloud", "Engineering"],
    status: "Planned",
    statusCategory: "planned",
    reportingLine: "Alfred",
    mission: "Future placeholder for platform architecture, engineering quality, cloud operations and technical risk.",
  },
  {
    id: "liam",
    name: "Liam",
    title: "Power Platform Director",
    businessArea: "Digital Solutions",
    companyId: "digitize",
    department: "Power Platform",
    avatarPath: "/assets/avatars/liam.svg",
    fallbackInitials: "L",
    accentColor: "#9ee080",
    voicePersonaPlaceholder: "liam-power-platform-voice",
    expertiseTags: ["Power Apps", "Dataverse", "Automation", "Power BI"],
    status: "Planned",
    statusCategory: "planned",
    reportingLine: "Alfred",
    mission: "Future placeholder for Power Platform advisory, app strategy and low-code delivery intelligence.",
  },
  {
    id: "james",
    name: "James",
    title: "Product CEO",
    businessArea: "Product Studio",
    companyId: "product",
    department: "Product",
    avatarPath: "/assets/avatars/james.svg",
    fallbackInitials: "J",
    accentColor: "#ff9fb2",
    voicePersonaPlaceholder: "james-product-voice",
    expertiseTags: ["SaaS", "MVP validation", "Product strategy", "Customer discovery"],
    status: "Planned",
    statusCategory: "planned",
    reportingLine: "Alfred",
    mission: "Future placeholder for SaaS product validation, product strategy and operating discipline.",
  },
]);

const PROFILES_BY_ID = new Map(AGENT_AVATAR_PROFILES.map((profile) => [profile.id, profile]));
const PROFILES_BY_NAME = new Map(AGENT_AVATAR_PROFILES.map((profile) => [profile.name.toLowerCase(), profile]));

export function isLocalAvatarPath(path = "") {
  const value = String(path || "").trim();
  if (!value) return false;
  if (/^(https?:|data:|blob:|file:|\/\/)/i.test(value)) return false;
  return value.startsWith(LOCAL_AVATAR_PREFIX) || value.startsWith(LOCAL_AVATAR_PREFIX.slice(1));
}

export function agentFallbackInitials(agentOrName = "") {
  const name = typeof agentOrName === "string"
    ? agentOrName
    : agentOrName.name || agentOrName.title || agentOrName.id || "";
  const words = String(name)
    .replace(/[^a-z0-9\s-]/gi, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "A";
  const single = words.length === 1 ? words[0].slice(0, 1) : `${words[0][0]}${words[1][0]}`;
  return single.toUpperCase();
}

export function getAgentAvatarProfile(agentOrId = "") {
  if (typeof agentOrId === "string") {
    return PROFILES_BY_ID.get(agentOrId) || PROFILES_BY_NAME.get(agentOrId.toLowerCase()) || null;
  }
  return PROFILES_BY_ID.get(agentOrId.id) || PROFILES_BY_NAME.get(String(agentOrId.name || "").toLowerCase()) || null;
}

export function buildAgentAvatarRenderModel(agent = {}) {
  const profile = getAgentAvatarProfile(agent) || {};
  const name = profile.name || agent.name || "Executive Agent";
  const title = profile.title || agent.title || agent.role || "Executive Specialist";
  const fallbackInitials = profile.fallbackInitials || agent.fallbackInitials || agentFallbackInitials(name);
  const requestedPath = agent.avatarPath || profile.avatarPath || "";
  const avatarPath = isLocalAvatarPath(requestedPath) ? requestedPath : "";

  return {
    id: profile.id || agent.id || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    name,
    title,
    role: title,
    businessArea: profile.businessArea || agent.businessArea || "Group",
    companyId: profile.companyId ?? agent.companyId ?? null,
    department: profile.department || agent.department || "Executive",
    avatarPath,
    fallbackInitials,
    accentColor: profile.accentColor || agent.accentColor || "#62ead5",
    voicePersonaPlaceholder: profile.voicePersonaPlaceholder || agent.voicePersonaPlaceholder || `${fallbackInitials.toLowerCase()}-voice-placeholder`,
    expertiseTags: profile.expertiseTags || agent.expertiseTags || agent.tools || [],
    status: profile.status || agent.status || "Planned",
    statusCategory: profile.statusCategory || String(agent.status || "planned").toLowerCase(),
    reportingLine: profile.reportingLine || agent.reportingLine || "Alfred",
    mission: profile.mission || agent.mission || "Future executive specialist placeholder. No autonomous execution.",
    tools: Array.isArray(agent.tools) ? agent.tools : [],
    databaseStatus: agent.status || "",
  };
}

export function buildExecutiveTeamRoster(agentRecords = []) {
  const recordsById = new Map(agentRecords.map((agent) => [agent.id, agent]));
  const knownIds = new Set(AGENT_AVATAR_PROFILES.map((profile) => profile.id));
  const known = AGENT_AVATAR_PROFILES.map((profile) =>
    buildAgentAvatarRenderModel({ ...(recordsById.get(profile.id) || {}), id: profile.id }),
  );
  const custom = agentRecords
    .filter((agent) => !knownIds.has(agent.id))
    .map((agent) => buildAgentAvatarRenderModel(agent));
  return [...known, ...custom];
}
