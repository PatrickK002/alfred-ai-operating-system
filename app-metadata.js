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
  { key: "ANTHROPIC_API_KEY", category: "reasoning", publicName: "Anthropic Claude", productionCritical: false, secret: true },
  { key: "VOYAGE_API_KEY", category: "memory", publicName: "Voyage semantic memory", productionCritical: false, secret: true },
  { key: "MICROSOFT_CLIENT_ID", category: "microsoft", publicName: "Microsoft Entra app client ID", productionCritical: false, secret: false },
  { key: "MICROSOFT_TENANT_ID", category: "microsoft", publicName: "Microsoft tenant", productionCritical: false, secret: false },
  { key: "MONDAY_API_TOKEN", category: "finance", publicName: "Monday.com read token", productionCritical: false, secret: true },
  { key: "DEEPGRAM_API_KEY", category: "voice", publicName: "Deepgram speech-to-text", productionCritical: false, secret: true },
  { key: "ELEVENLABS_API_KEY", category: "voice", publicName: "ElevenLabs text-to-speech", productionCritical: false, secret: true },
  { key: "ELEVENLABS_VOICE_ID", category: "voice", publicName: "ElevenLabs voice ID", productionCritical: false, secret: false },
  { key: "VOICE_ENABLED", category: "voice", publicName: "Voice interface", productionCritical: false, secret: false },
];

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
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
  };
}
