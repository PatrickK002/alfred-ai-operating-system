import { timingSafeEqual } from "node:crypto";

export const SUPPORTED_AUTHENTICATION_PROVIDERS = Object.freeze([
  "azure-app-service-easy-auth",
  "basic-auth",
  "reverse-proxy-header",
]);

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function splitCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeIdentifier(value) {
  return String(value || "").trim().toLowerCase();
}

function headerValue(headers, name) {
  const value = headers?.[String(name).toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function safeEqual(actual, expected) {
  const actualBuffer = Buffer.from(String(actual || ""));
  const expectedBuffer = Buffer.from(String(expected || ""));
  return actualBuffer.length === expectedBuffer.length
    && timingSafeEqual(actualBuffer, expectedBuffer);
}

function parseBasicAuthorization(value) {
  if (!hasValue(value) || !String(value).toLowerCase().startsWith("basic ")) return null;
  try {
    const decoded = Buffer.from(String(value).slice(6).trim(), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;
    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

function currentEnvironment(env) {
  const raw = String(env.APP_ENV || env.NODE_ENV || "development").toLowerCase();
  if (["production", "prod"].includes(raw)) return "production";
  if (["testing", "test", "staging", "develop"].includes(raw)) return "testing";
  return "development";
}

export function authenticationConfig(env = process.env) {
  const environment = currentEnvironment(env);
  const provider = String(env.AUTHENTICATION_PROVIDER || "").trim();
  const enabled = env.AUTHENTICATION_ENABLED === "true";
  const requireUserAllowlist = env.ALFRED_REQUIRE_USER_ALLOWLIST === "true"
    || (environment === "production" && env.ALFRED_REQUIRE_USER_ALLOWLIST !== "false");
  const allowedUsers = splitCsv(env.ALFRED_ALLOWED_USERS).map(normalizeIdentifier);

  return {
    enabled,
    environment,
    provider,
    providerSupported: !enabled || SUPPORTED_AUTHENTICATION_PROVIDERS.includes(provider),
    principalHeader: normalizeIdentifier(env.AUTHENTICATED_USER_HEADER || "x-ms-client-principal"),
    nameHeader: normalizeIdentifier(env.AUTHENTICATED_USER_NAME_HEADER || "x-ms-client-principal-name"),
    idHeader: normalizeIdentifier(env.AUTHENTICATED_USER_ID_HEADER || "x-ms-client-principal-id"),
    allowedUsers,
    allowedUsersConfigured: allowedUsers.length > 0,
    requireUserAllowlist,
    basicAuthConfigured: hasValue(env.ALFRED_BASIC_AUTH_USERNAME) && hasValue(env.ALFRED_BASIC_AUTH_PASSWORD),
  };
}

export function decodeClientPrincipal(value) {
  if (!hasValue(value)) return null;
  try {
    const json = Buffer.from(String(value), "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function claimValue(principal, names) {
  const claims = Array.isArray(principal?.claims) ? principal.claims : [];
  const lowerNames = names.map((name) => name.toLowerCase());
  const match = claims.find((claim) =>
    lowerNames.some((name) => String(claim.typ || claim.type || "").toLowerCase().includes(name))
  );
  return match?.val || match?.value || "";
}

export function authenticatedUserFromHeaders(headers = {}, env = process.env) {
  const config = authenticationConfig(env);
  if (config.provider === "basic-auth") {
    const credentials = parseBasicAuthorization(headerValue(headers, "authorization"));
    if (
      !config.basicAuthConfigured
      || !credentials
      || !safeEqual(credentials.username, env.ALFRED_BASIC_AUTH_USERNAME)
      || !safeEqual(credentials.password, env.ALFRED_BASIC_AUTH_PASSWORD)
    ) {
      return null;
    }

    const username = String(credentials.username || "").trim();
    return {
      provider: config.provider,
      id: username,
      name: username,
      email: username.includes("@") ? username : "",
      identifiers: [normalizeIdentifier(username)].filter(Boolean),
      claimsCount: 0,
    };
  }

  const encodedPrincipal = headerValue(headers, config.principalHeader);
  const principal = decodeClientPrincipal(encodedPrincipal) || {};
  const headerName = headerValue(headers, config.nameHeader) || "";
  const headerId = headerValue(headers, config.idHeader) || "";
  const email = claimValue(principal, [
    "preferred_username",
    "emailaddress",
    "email",
    "upn",
  ]) || (String(headerName).includes("@") ? headerName : "");
  const name = principal.userDetails
    || principal.name
    || claimValue(principal, ["name"])
    || headerName
    || "";
  const id = headerId || principal.userId || claimValue(principal, ["objectidentifier", "oid", "nameidentifier"]);
  const identifiers = [...new Set([email, name, id].map(normalizeIdentifier).filter(Boolean))];

  if (!identifiers.length) return null;
  return {
    provider: config.provider,
    id,
    name,
    email,
    identifiers,
    claimsCount: Array.isArray(principal.claims) ? principal.claims.length : 0,
  };
}

export function authenticateHeaders(headers = {}, env = process.env) {
  const config = authenticationConfig(env);
  if (!config.enabled) {
    return { required: false, allowed: true, statusCode: 200, config, user: null };
  }
  if (!config.providerSupported || !config.provider) {
    return {
      required: true,
      allowed: false,
      statusCode: 503,
      code: "AUTH_PROVIDER_NOT_CONFIGURED",
      message: "Production authentication is enabled but no supported authentication provider is configured.",
      config,
      user: null,
    };
  }

  if (config.provider === "basic-auth" && !config.basicAuthConfigured) {
    return {
      required: true,
      allowed: false,
      statusCode: 503,
      code: "BASIC_AUTH_NOT_CONFIGURED",
      message: "Basic authentication is enabled but Alfred's Basic Auth credentials are not configured.",
      config,
      user: null,
    };
  }

  const user = authenticatedUserFromHeaders(headers, env);
  if (!user) {
    return {
      required: true,
      allowed: false,
      statusCode: 401,
      code: "AUTHENTICATION_REQUIRED",
      message: "Authentication is required to access Alfred.",
      config,
      user: null,
    };
  }

  if (config.requireUserAllowlist && !config.allowedUsersConfigured) {
    return {
      required: true,
      allowed: false,
      statusCode: 503,
      code: "AUTH_ALLOWLIST_NOT_CONFIGURED",
      message: "Authentication is enabled but ALFRED_ALLOWED_USERS is not configured.",
      config,
      user,
    };
  }

  if (config.allowedUsersConfigured && !user.identifiers.some((identifier) => config.allowedUsers.includes(identifier))) {
    return {
      required: true,
      allowed: false,
      statusCode: 403,
      code: "AUTH_USER_NOT_ALLOWED",
      message: "Authenticated user is not allowed to access Alfred.",
      config,
      user,
    };
  }

  return { required: true, allowed: true, statusCode: 200, config, user };
}
