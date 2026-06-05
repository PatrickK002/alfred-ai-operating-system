import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { MICROSOFT_SCOPES, MicrosoftGraphClient } from "../microsoft.js";

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

async function withClient(fetchImpl, run) {
  const directory = mkdtempSync(join(tmpdir(), "alfred-microsoft-"));
  const tokenPath = join(directory, "token.json");
  const client = new MicrosoftGraphClient({
    clientId: "test-client-id",
    tenant: "organizations",
    tokenPath,
    fetchImpl,
  });
  try {
    return await run(client);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("requests only delegated read scopes", () => {
  assert.deepEqual(MICROSOFT_SCOPES, [
    "offline_access",
    "User.Read",
    "Mail.Read",
    "Calendars.Read",
    "Files.Read",
  ]);
  assert.equal(MICROSOFT_SCOPES.some((scope) => /write|send/i.test(scope)), false);
});

test("starts and completes Microsoft device authorization", async () => {
  const calls = [];
  await withClient(async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/devicecode")) {
      return jsonResponse({
        device_code: "device-code",
        user_code: "ABCD-EFGH",
        verification_uri: "https://microsoft.com/devicelogin",
        expires_in: 900,
        interval: 5,
        message: "Enter the code.",
      });
    }
    return jsonResponse({
      access_token: "access-token",
      refresh_token: "refresh-token",
      expires_in: 3600,
      scope: MICROSOFT_SCOPES.join(" "),
    });
  }, async (client) => {
    const flow = await client.startDeviceFlow();
    assert.equal(flow.userCode, "ABCD-EFGH");

    await client.completeDeviceFlow();
    const token = client.loadToken();
    assert.equal(token.access_token, "access-token");
    assert.equal(token.refresh_token, "refresh-token");
  });

  assert.equal(calls.length, 2);
  assert.match(calls[0].options.body, /Mail.Read/);
  assert.doesNotMatch(calls[0].options.body, /Mail.Send|Calendars.ReadWrite|Files.ReadWrite/);
});

test("reads profile, messages, calendar and files using GET requests", async () => {
  const calls = [];
  await withClient(async (url, options = {}) => {
    calls.push({ url, method: options.method || "GET" });
    if (url.includes("/me/messages")) return jsonResponse({ value: [{ id: "mail-1", subject: "Status" }] });
    if (url.includes("/me/calendarView")) return jsonResponse({ value: [{ id: "event-1", subject: "Review" }] });
    if (url.includes("/me/drive/root/children")) return jsonResponse({ value: [{ id: "file-1", name: "Brief.docx" }] });
    return jsonResponse({ id: "user-1", displayName: "Patrick King", mail: "patrick@example.com" });
  }, async (client) => {
    client.saveToken({ access_token: "access-token", refresh_token: "refresh-token", expires_in: 3600 });

    assert.equal((await client.verifyConnection()).displayName, "Patrick King");
    assert.equal((await client.listMessages()).length, 1);
    assert.equal((await client.listCalendar()).length, 1);
    assert.equal((await client.listFiles()).length, 1);
  });

  assert.equal(calls.every((call) => call.method === "GET"), true);
});

test("refreshes an expired token before reading Graph data", async () => {
  let refreshCalled = false;
  await withClient(async (url, options = {}) => {
    if (url.endsWith("/token")) {
      refreshCalled = true;
      assert.match(options.body, /grant_type=refresh_token/);
      return jsonResponse({
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        expires_in: 3600,
      });
    }
    assert.equal(options.headers.Authorization, "Bearer new-access-token");
    return jsonResponse({ value: [] });
  }, async (client) => {
    client.saveToken({ access_token: "expired", refresh_token: "refresh-token", expires_in: -1 });
    await client.listMessages();
  });

  assert.equal(refreshCalled, true);
});
