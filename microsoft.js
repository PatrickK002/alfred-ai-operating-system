import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_TOKEN_PATH = resolve(ROOT_DIR, "data", "microsoft-token.json");
const DEFAULT_CONFIG_PATH = resolve(ROOT_DIR, "data", "microsoft-config.json");
const GRAPH_ROOT = "https://graph.microsoft.com/v1.0";
const DEFAULT_SCOPES = [
  "offline_access",
  "User.Read",
  "Mail.Read",
  "Calendars.Read",
  "Files.Read",
];

function formBody(values) {
  return new URLSearchParams(values).toString();
}

function graphError(status, body) {
  const message = body?.error?.message || body?.error_description || `Microsoft Graph request failed (${status})`;
  const error = new Error(message);
  error.statusCode = status === 401 ? 401 : 502;
  error.microsoftCode = body?.error?.code || body?.error;
  return error;
}

export class MicrosoftGraphClient {
  constructor({
    clientId,
    tenant,
    configPath = process.env.MICROSOFT_CONFIG_PATH || DEFAULT_CONFIG_PATH,
    tokenPath = process.env.MICROSOFT_TOKEN_PATH || DEFAULT_TOKEN_PATH,
    fetchImpl = globalThis.fetch,
  } = {}) {
    let localConfig = {};
    if (existsSync(configPath)) {
      try {
        localConfig = JSON.parse(readFileSync(configPath, "utf8"));
      } catch {
        localConfig = {};
      }
    }
    this.clientId = clientId || process.env.MICROSOFT_CLIENT_ID || localConfig.clientId;
    this.tenant = tenant || process.env.MICROSOFT_TENANT_ID || localConfig.tenantId || "organizations";
    this.tokenPath = tokenPath;
    this.fetch = fetchImpl;
    this.pendingDeviceCode = null;
  }

  get configured() {
    return Boolean(this.clientId);
  }

  get authority() {
    return `https://login.microsoftonline.com/${encodeURIComponent(this.tenant)}/oauth2/v2.0`;
  }

  loadToken() {
    if (!existsSync(this.tokenPath)) return null;
    try {
      return JSON.parse(readFileSync(this.tokenPath, "utf8"));
    } catch {
      return null;
    }
  }

  saveToken(token) {
    const now = Date.now();
    const existing = this.loadToken() || {};
    const stored = {
      ...existing,
      ...token,
      expires_at: now + Number(token.expires_in || 0) * 1000,
      saved_at: new Date(now).toISOString(),
    };
    mkdirSync(dirname(this.tokenPath), { recursive: true });
    writeFileSync(this.tokenPath, JSON.stringify(stored, null, 2), { mode: 0o600 });
    chmodSync(this.tokenPath, 0o600);
    return stored;
  }

  disconnect() {
    if (existsSync(this.tokenPath)) writeFileSync(this.tokenPath, "", { mode: 0o600 });
    this.pendingDeviceCode = null;
  }

  async requestToken(values) {
    const response = await this.fetch(`${this.authority}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody(values),
    });
    const body = await response.json();
    if (!response.ok) throw graphError(response.status, body);
    return this.saveToken(body);
  }

  async startDeviceFlow() {
    if (!this.configured) {
      const error = new Error("MICROSOFT_CLIENT_ID is not configured");
      error.statusCode = 503;
      throw error;
    }
    const response = await this.fetch(`${this.authority}/devicecode`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody({
        client_id: this.clientId,
        scope: DEFAULT_SCOPES.join(" "),
      }),
    });
    const body = await response.json();
    if (!response.ok) throw graphError(response.status, body);
    this.pendingDeviceCode = {
      deviceCode: body.device_code,
      userCode: body.user_code,
      verificationUri: body.verification_uri,
      expiresAt: Date.now() + body.expires_in * 1000,
      interval: body.interval || 5,
      message: body.message,
    };
    return {
      userCode: body.user_code,
      verificationUri: body.verification_uri,
      expiresIn: body.expires_in,
      interval: body.interval || 5,
      message: body.message,
    };
  }

  async completeDeviceFlow() {
    const pending = this.pendingDeviceCode;
    if (!pending || pending.expiresAt <= Date.now()) {
      const error = new Error("Microsoft device authorization has expired or was not started");
      error.statusCode = 400;
      throw error;
    }
    try {
      const token = await this.requestToken({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        client_id: this.clientId,
        device_code: pending.deviceCode,
      });
      this.pendingDeviceCode = null;
      return token;
    } catch (error) {
      if (["authorization_pending", "slow_down"].includes(error.microsoftCode)) {
        error.statusCode = 202;
        error.retryAfter = error.microsoftCode === "slow_down" ? pending.interval + 5 : pending.interval;
      }
      throw error;
    }
  }

  async accessToken() {
    const token = this.loadToken();
    if (!token) {
      const error = new Error("Microsoft 365 is not connected");
      error.statusCode = 401;
      throw error;
    }
    if (token.expires_at > Date.now() + 60_000) return token.access_token;
    if (!token.refresh_token) {
      const error = new Error("Microsoft access has expired; reconnect Microsoft 365");
      error.statusCode = 401;
      throw error;
    }
    const refreshed = await this.requestToken({
      grant_type: "refresh_token",
      client_id: this.clientId,
      refresh_token: token.refresh_token,
      scope: DEFAULT_SCOPES.join(" "),
    });
    return refreshed.access_token;
  }

  async graph(path, { retry = true } = {}) {
    const token = await this.accessToken();
    const response = await this.fetch(`${GRAPH_ROOT}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
    if (response.status === 429 && retry) {
      const retryAfter = Math.min(Number(response.headers.get("retry-after") || 1), 10);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, retryAfter * 1000));
      return this.graph(path, { retry: false });
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw graphError(response.status, body);
    return body;
  }

  async verifyConnection() {
    const profile = await this.graph("/me?$select=id,displayName,mail,userPrincipalName");
    return {
      id: profile.id,
      displayName: profile.displayName,
      email: profile.mail || profile.userPrincipalName,
    };
  }

  async status() {
    if (!this.configured) return { configured: false, connected: false };
    if (!this.loadToken()) return { configured: true, connected: false };
    try {
      return { configured: true, connected: true, profile: await this.verifyConnection() };
    } catch (error) {
      return { configured: true, connected: false, error: error.message };
    }
  }

  async listMessages({ search = "", limit = 15 } = {}) {
    const params = new URLSearchParams({
      "$top": String(Math.min(Math.max(Number(limit) || 15, 1), 50)),
      "$select": "id,subject,from,receivedDateTime,isRead,importance,bodyPreview,webLink",
    });
    if (search) {
      params.set("$search", `"${search.replaceAll('"', "")}"`);
    } else {
      params.set("$orderby", "receivedDateTime desc");
    }
    const body = await this.graph(`/me/messages?${params}`);
    return body.value || [];
  }

  async listCalendar({ start, end, limit = 25 } = {}) {
    const startDate = start || new Date().toISOString();
    const endDate = end || new Date(Date.now() + 7 * 86_400_000).toISOString();
    const params = new URLSearchParams({
      startDateTime: startDate,
      endDateTime: endDate,
      "$top": String(Math.min(Math.max(Number(limit) || 25, 1), 50)),
      "$select": "id,subject,start,end,location,organizer,attendees,bodyPreview,responseStatus,isOnlineMeeting,onlineMeeting,webLink",
      "$orderby": "start/dateTime",
    });
    const body = await this.graph(`/me/calendarView?${params}`);
    return body.value || [];
  }

  async listFiles({ search = "", limit = 20 } = {}) {
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
    const path = search
      ? `/me/drive/root/search(q='${encodeURIComponent(search.replaceAll("'", "''"))}')?$top=${safeLimit}&$select=id,name,webUrl,size,lastModifiedDateTime,file,folder`
      : `/me/drive/root/children?$top=${safeLimit}&$select=id,name,webUrl,size,lastModifiedDateTime,file,folder`;
    const body = await this.graph(path);
    return body.value || [];
  }
}

export const MICROSOFT_SCOPES = [...DEFAULT_SCOPES];
