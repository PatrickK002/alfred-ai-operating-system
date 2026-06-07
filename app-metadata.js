import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_JSON = JSON.parse(readFileSync(resolve(ROOT_DIR, "package.json"), "utf8"));

export const APP_RELEASES = [
  {
    version: "v0.1",
    title: "Alfred Local Foundation",
    date: "2026-06-05",
    summary: "SQLite-backed operating records, dashboard persistence and initial Alfred executive operating system foundations.",
  },
  {
    version: "v0.2",
    title: "Executive Intelligence",
    date: "2026-06-05",
    summary: "Microsoft read-only signals, Anthropic reasoning, Voyage memory, Olivia CFO and project intelligence foundations.",
  },
  {
    version: "v0.3",
    title: "Voice Command Centre",
    date: "2026-06-06",
    summary: "Read-only voice command interface with Deepgram, ElevenLabs, conversation history and advisory routing.",
  },
  {
    version: "v0.4",
    title: "Cloud/PWA Preparation",
    date: "2026-06-06",
    summary: "Azure deployment readiness, PWA install support, health checks, environment validation and device install guidance.",
  },
];

export const APP_METADATA = {
  name: "Alfred AI Operating System",
  packageName: PACKAGE_JSON.name,
  packageVersion: PACKAGE_JSON.version,
  release: APP_RELEASES[APP_RELEASES.length - 1],
  nodeEngine: PACKAGE_JSON.engines?.node || ">=22.5.0",
};

export const ENVIRONMENT_PROFILES = {
  development: {
    label: "Development",
    description: "Local use on Patrick's machine.",
    branch: "feature/* or local",
    deployment: "Local Node server",
  },
  testing: {
    label: "Testing",
    description: "Develop branch deployment for validation before production.",
    branch: "develop",
    deployment: "Azure App Service testing slot/app",
  },
  production: {
    label: "Production",
    description: "Main branch deployment for Patrick's secure executive operating system.",
    branch: "main",
    deployment: "Azure App Service production app",
  },
};

export const ENVIRONMENT_VARIABLES = [
  { key: "NODE_ENV", category: "runtime", publicName: "Runtime mode", productionCritical: true, secret: false },
  { key: "APP_ENV", category: "runtime", publicName: "Alfred environment", productionCritical: false, secret: false },
  { key: "APP_BASE_URL", category: "deployment", publicName: "Public app URL", productionCritical: true, secret: false },
  { key: "HOST", category: "deployment", publicName: "Bind host", productionCritical: false, secret: false },
  { key: "PORT", category: "deployment", publicName: "HTTP port", productionCritical: false, secret: false },
  { key: "ALFRED_DB_PATH", category: "deployment", publicName: "SQLite database path", productionCritical: true, secret: false },
  { key: "ALFRED_BACKUP_STRATEGY", category: "deployment", publicName: "Database backup strategy", productionCritical: false, secret: false },
  { key: "AUTHENTICATION_ENABLED", category: "security", publicName: "Authentication gate", productionCritical: true, secret: false },
  { key: "ENFORCE_HTTPS", category: "security", publicName: "HTTPS enforcement", productionCritical: true, secret: false },
  { key: "ANTHROPIC_API_KEY", category: "reasoning", publicName: "Anthropic Claude", productionCritical: false, secret: true },
  { key: "ANTHROPIC_MODEL", category: "reasoning", publicName: "Anthropic model", productionCritical: false, secret: false },
  { key: "VOYAGE_API_KEY", category: "memory", publicName: "Voyage semantic memory", productionCritical: false, secret: true },
  { key: "VOYAGE_MODEL", category: "memory", publicName: "Voyage model", productionCritical: false, secret: false },
  { key: "SEMANTIC_INDEXING_ENABLED", category: "memory", publicName: "Semantic indexing", productionCritical: false, secret: false },
  { key: "MICROSOFT_CLIENT_ID", category: "microsoft", publicName: "Microsoft Entra app client ID", productionCritical: false, secret: false },
  { key: "MICROSOFT_TENANT_ID", category: "microsoft", publicName: "Microsoft tenant", productionCritical: false, secret: false },
  { key: "MICROSOFT_TOKEN_PATH", category: "microsoft", publicName: "Microsoft token path", productionCritical: false, secret: false },
  { key: "MONDAY_API_TOKEN", category: "finance", publicName: "Monday.com read token", productionCritical: false, secret: true },
  { key: "MONDAY_FINANCE_BOARD_IDS", category: "finance", publicName: "Monday.com finance boards", productionCritical: false, secret: false },
  { key: "MONDAY_API_VERSION", category: "finance", publicName: "Monday.com API version", productionCritical: false, secret: false },
  { key: "DEEPGRAM_API_KEY", category: "voice", publicName: "Deepgram speech-to-text", productionCritical: false, secret: true },
  { key: "DEEPGRAM_MODEL", category: "voice", publicName: "Deepgram model", productionCritical: false, secret: false },
  { key: "ELEVENLABS_API_KEY", category: "voice", publicName: "ElevenLabs text-to-speech", productionCritical: false, secret: true },
  { key: "ELEVENLABS_VOICE_ID", category: "voice", publicName: "ElevenLabs voice ID", productionCritical: false, secret: false },
  { key: "ELEVENLABS_MODEL", category: "voice", publicName: "ElevenLabs model", productionCritical: false, secret: false },
  { key: "VOICE_ENABLED", category: "voice", publicName: "Voice interface", productionCritical: false, secret: false },
  { key: "VOICE_TRANSCRIPT_LOGGING_ENABLED", category: "voice", publicName: "Voice transcript logging", productionCritical: false, secret: false },
  { key: "VOICE_TRANSCRIPT_RETENTION_DAYS", category: "voice", publicName: "Voice transcript retention", productionCritical: false, secret: false },
];

export const API_KEY_ASSIGNMENT_GROUPS = [
  {
    id: "anthropic",
    label: "Anthropic Claude",
    purpose: "CEO reasoning, briefings, decision support and specialist analysis.",
    required: ["ANTHROPIC_API_KEY"],
    optional: ["ANTHROPIC_MODEL"],
    boundary: "Read-only analysis. No execution tools are exposed.",
  },
  {
    id: "voyage",
    label: "Voyage AI",
    purpose: "Semantic long-term memory retrieval from compact Alfred summaries.",
    required: ["VOYAGE_API_KEY"],
    optional: ["VOYAGE_MODEL", "SEMANTIC_INDEXING_ENABLED"],
    boundary: "Embeds summaries and metadata first. Raw full mailbox indexing remains disabled.",
  },
  {
    id: "microsoft",
    label: "Microsoft 365",
    purpose: "Read-only Outlook, calendar and OneDrive/SharePoint signals.",
    required: ["MICROSOFT_CLIENT_ID", "MICROSOFT_TENANT_ID"],
    optional: ["MICROSOFT_TOKEN_PATH"],
    boundary: "Delegated read scopes only. No mail, calendar or file writes.",
  },
  {
    id: "monday",
    label: "Monday.com",
    purpose: "Read-only finance and operating-system board intelligence.",
    required: ["MONDAY_API_TOKEN"],
    optional: ["MONDAY_FINANCE_BOARD_IDS", "MONDAY_API_VERSION"],
    boundary: "Read-only API usage. No board, item or sync writes.",
  },
  {
    id: "deepgram",
    label: "Deepgram",
    purpose: "Speech-to-text for the Voice Command Centre.",
    required: ["DEEPGRAM_API_KEY"],
    optional: ["DEEPGRAM_MODEL"],
    boundary: "No raw audio storage by default.",
  },
  {
    id: "elevenlabs",
    label: "ElevenLabs",
    purpose: "Text-to-speech for Alfred's spoken responses.",
    required: ["ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"],
    optional: ["ELEVENLABS_MODEL"],
    boundary: "Spoken output only. No voice-triggered execution.",
  },
];

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function configuredKeys(env, keys) {
  return keys.filter((key) => hasValue(env[key]));
}

function missingKeys(env, keys) {
  return keys.filter((key) => !hasValue(env[key]));
}

function parseVersion(version) {
  return String(version || "0.0.0")
    .replace(/^v/, "")
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
}

function versionAtLeast(actual, minimum) {
  const actualParts = parseVersion(actual);
  const minimumParts = parseVersion(minimum);
  for (let index = 0; index < Math.max(actualParts.length, minimumParts.length); index += 1) {
    const actualPart = actualParts[index] || 0;
    const minimumPart = minimumParts[index] || 0;
    if (actualPart > minimumPart) return true;
    if (actualPart < minimumPart) return false;
  }
  return true;
}

function minimumNodeVersion() {
  return String(APP_METADATA.nodeEngine).replace(/[^\d.]/g, "") || "22.5.0";
}

function readinessCheck({ id, label, passed, severity = "high", message, action }) {
  return {
    id,
    label,
    status: passed ? "pass" : severity === "high" ? "block" : "warn",
    severity: passed ? "none" : severity,
    message,
    action,
  };
}

export function apiKeyAssignmentReadiness(env = process.env) {
  const groups = API_KEY_ASSIGNMENT_GROUPS.map((group) => {
    const configuredRequired = configuredKeys(env, group.required);
    const missingRequired = missingKeys(env, group.required);
    const configuredOptional = configuredKeys(env, group.optional);
    const missingOptional = missingKeys(env, group.optional);
    const status = missingRequired.length === 0
      ? "ready"
      : configuredRequired.length > 0 ? "partial" : "missing";
    return {
      id: group.id,
      label: group.label,
      purpose: group.purpose,
      status,
      configuredRequiredCount: configuredRequired.length,
      requiredCount: group.required.length,
      configuredKeys: configuredRequired,
      missingKeys: missingRequired,
      optionalConfiguredKeys: configuredOptional,
      optionalMissingKeys: missingOptional,
      secretKeys: [...group.required, ...group.optional].filter((key) =>
        ENVIRONMENT_VARIABLES.find((variable) => variable.key === key)?.secret
      ),
      boundary: group.boundary,
      valuesRedacted: true,
    };
  });
  const ready = groups.filter((group) => group.status === "ready").length;
  const partial = groups.filter((group) => group.status === "partial").length;
  const missing = groups.length - ready - partial;
  return {
    groups,
    summary: `${ready}/${groups.length} provider groups ready, ${partial} partial, ${missing} missing.`,
    readyCount: ready,
    partialCount: partial,
    missingCount: missing,
    valuesRedacted: true,
  };
}

export function currentEnvironment(env = process.env) {
  const raw = String(env.APP_ENV || env.NODE_ENV || "development").toLowerCase();
  if (["production", "prod"].includes(raw)) return "production";
  if (["testing", "test", "staging", "develop"].includes(raw)) return "testing";
  return "development";
}

export function deploymentBranchFor(environment) {
  return ENVIRONMENT_PROFILES[environment]?.branch || ENVIRONMENT_PROFILES.development.branch;
}

export function validateEnvironment(env = process.env) {
  const environment = currentEnvironment(env);
  const isProduction = environment === "production";
  const variables = ENVIRONMENT_VARIABLES.map((variable) => {
    const configured = variable.key === "NODE_ENV"
      ? hasValue(env.NODE_ENV || environment)
      : hasValue(env[variable.key]);
    const status = configured
      ? "configured"
      : variable.productionCritical && isProduction ? "warning" : "optional_missing";
    return {
      key: variable.key,
      category: variable.category,
      name: variable.publicName,
      configured,
      status,
      productionCritical: Boolean(variable.productionCritical),
      secret: Boolean(variable.secret),
    };
  });
  const warnings = [];
  const appBaseUrl = env.APP_BASE_URL || "";

  if (isProduction && !hasValue(appBaseUrl)) {
    warnings.push({
      code: "APP_BASE_URL_REQUIRED",
      severity: "high",
      message: "APP_BASE_URL must be set before production deployment.",
    });
  }
  if (isProduction && hasValue(appBaseUrl) && !String(appBaseUrl).startsWith("https://")) {
    warnings.push({
      code: "APP_BASE_URL_HTTPS_REQUIRED",
      severity: "high",
      message: "Production APP_BASE_URL must use HTTPS.",
    });
  }
  if (isProduction && env.AUTHENTICATION_ENABLED !== "true") {
    warnings.push({
      code: "AUTHENTICATION_PLACEHOLDER",
      severity: "high",
      message: "Production access requires Microsoft Entra ID authentication before public exposure.",
    });
  }
  if (isProduction && !hasValue(env.ALFRED_DB_PATH)) {
    warnings.push({
      code: "ALFRED_DB_PATH_REQUIRED",
      severity: "high",
      message: "Production must use an explicit persistent SQLite database path.",
    });
  }
  if (isProduction && env.ENFORCE_HTTPS === "false") {
    warnings.push({
      code: "HTTPS_ENFORCEMENT_DISABLED",
      severity: "high",
      message: "ENFORCE_HTTPS=false must not be used for production exposure.",
    });
  }

  return {
    environment,
    profile: ENVIRONMENT_PROFILES[environment],
    nodeEnv: env.NODE_ENV || "development",
    appBaseUrl: appBaseUrl || null,
    variables,
    warnings,
    productionReady: isProduction ? warnings.length === 0 : true,
    security: {
      httpsRequired: isProduction,
      secureCookiesRequired: isProduction,
      cookiesUsed: false,
      secretsInFrontend: false,
      apiKeysInLocalStorage: false,
      authenticationProvider: "Microsoft Entra ID planned",
      authenticationEnabled: env.AUTHENTICATION_ENABLED === "true",
      externalWritesEnabled: false,
      approvalSafeguardsRequired: true,
    },
  };
}

export function buildProductionPreflight(env = process.env, {
  targetEnvironment = "production",
  nodeVersion = process.versions.node,
} = {}) {
  const targetEnv = { ...env, APP_ENV: targetEnvironment, NODE_ENV: env.NODE_ENV || targetEnvironment };
  const validation = validateEnvironment(targetEnv);
  const apiKeys = apiKeyAssignmentReadiness(env);
  const minimumNode = minimumNodeVersion();
  const nodeOk = versionAtLeast(nodeVersion, minimumNode);
  const appBaseUrl = env.APP_BASE_URL || "";
  const checks = [
    readinessCheck({
      id: "node_runtime",
      label: "Node.js runtime",
      passed: nodeOk,
      message: `Node ${nodeVersion} checked against required ${APP_METADATA.nodeEngine}.`,
      action: `Use Node.js ${minimumNode} or newer.`,
    }),
    readinessCheck({
      id: "https_public_url",
      label: "HTTPS public URL",
      passed: hasValue(appBaseUrl) && String(appBaseUrl).startsWith("https://"),
      message: "Production APP_BASE_URL must be set and use HTTPS.",
      action: "Set APP_BASE_URL to the final HTTPS Alfred URL.",
    }),
    readinessCheck({
      id: "authentication_gate",
      label: "Authentication gate",
      passed: env.AUTHENTICATION_ENABLED === "true",
      message: "Production must be protected before any live URL is shared.",
      action: "Enable Microsoft Entra ID authentication or an equivalent access gate.",
    }),
    readinessCheck({
      id: "persistent_database",
      label: "Persistent SQLite database",
      passed: hasValue(env.ALFRED_DB_PATH),
      message: "Production must not rely on the default repo-local SQLite path.",
      action: "Set ALFRED_DB_PATH to a persistent mounted path and define backup ownership.",
    }),
    readinessCheck({
      id: "https_enforcement",
      label: "HTTPS enforcement",
      passed: env.ENFORCE_HTTPS !== "false",
      message: "Alfred redirects production HTTP traffic to HTTPS by default.",
      action: "Leave ENFORCE_HTTPS unset or true in production.",
    }),
    readinessCheck({
      id: "api_key_assignment",
      label: "Provider API keys",
      passed: apiKeys.missingCount === 0 && apiKeys.partialCount === 0,
      severity: "medium",
      message: apiKeys.summary,
      action: "Assign provider keys as server-side environment variables or accept graceful fallback for missing providers.",
    }),
    readinessCheck({
      id: "database_backup_plan",
      label: "Database backup plan",
      passed: hasValue(env.ALFRED_BACKUP_STRATEGY),
      severity: "medium",
      message: "SQLite contains sensitive operating memory, briefings, approvals and specialist records.",
      action: "Document backup location, restore process and retention before production reliance.",
    }),
    readinessCheck({
      id: "secret_hygiene",
      label: "Secret hygiene",
      passed: true,
      message: "Readiness output redacts values and reports only configured/missing status.",
      action: "Keep .env, tokens, publish profiles and API keys out of Git.",
    }),
    readinessCheck({
      id: "external_write_boundary",
      label: "External write boundary",
      passed: true,
      message: "Microsoft, Monday, finance, property, voice and specialist layers remain advisory/read-only.",
      action: "Future writes must use approval request, preflight and a separately reviewed executor.",
    }),
  ];
  const blockers = checks.filter((check) => check.status === "block");
  const warnings = checks.filter((check) => check.status === "warn");
  return {
    targetEnvironment,
    generatedAt: new Date().toISOString(),
    goLiveReady: blockers.length === 0,
    blockers: blockers.length,
    warnings: warnings.length,
    summary: blockers.length
      ? `${blockers.length} blocker(s) before live exposure.`
      : warnings.length ? `No blockers; ${warnings.length} warning(s) remain.` : "Ready for private live beta.",
    checks,
    environment: validation,
    apiKeyReadiness: apiKeys,
    securityBoundary: {
      externalWritesEnabled: false,
      autonomousExecutionEnabled: false,
      approvalSafeguardsRequired: true,
      secretsExposed: false,
      providerValuesRedacted: true,
      microsoftWriteScopesAllowed: false,
      mondayWritesAllowed: false,
    },
  };
}

export function pwaReadiness() {
  return {
    manifest: "/manifest.json",
    serviceWorker: "/service-worker.js",
    offlineFallback: "/offline.html",
    displayMode: "standalone",
    themeColor: "#071011",
    installTargets: ["MacBook Dock", "iPhone Home Screen", "iPad Pro Home Screen"],
    installReady: true,
  };
}

export function publicAppStatus(env = process.env) {
  return {
    app: APP_METADATA,
    environment: validateEnvironment(env),
    apiKeyReadiness: apiKeyAssignmentReadiness(env),
    liveReadiness: buildProductionPreflight(env),
    pwa: pwaReadiness(),
    releases: APP_RELEASES,
  };
}

export function buildHealthResponse({
  env = process.env,
  databaseStatus = "unknown",
  integrationConfiguration = {},
  uptimeSeconds = 0,
} = {}) {
  const deployment = publicAppStatus(env);
  return {
    status: databaseStatus === "connected" ? "ok" : "degraded",
    app: deployment.app,
    environment: deployment.environment.environment,
    environmentProfile: deployment.environment.profile,
    database: { status: databaseStatus },
    integrations: integrationConfiguration,
    uptimeSeconds,
    version: deployment.app.packageVersion,
    release: deployment.app.release.version,
    pwa: deployment.pwa,
    warnings: deployment.environment.warnings,
    security: deployment.environment.security,
    apiKeyReadiness: deployment.apiKeyReadiness,
    liveReadiness: deployment.liveReadiness,
  };
}
