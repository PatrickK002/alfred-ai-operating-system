import assert from "node:assert/strict";
import test from "node:test";
import {
  authenticateHeaders,
  authenticationConfig,
  authenticatedUserFromHeaders,
  decodeClientPrincipal,
} from "../authentication.js";

function encodedPrincipal({ email = "patrick@example.com", name = "Patrick King", id = "user-1" } = {}) {
  return Buffer.from(JSON.stringify({
    userId: id,
    userDetails: email,
    claims: [
      { typ: "preferred_username", val: email },
      { typ: "name", val: name },
      { typ: "oid", val: id },
    ],
  })).toString("base64");
}

test("authentication config recognises supported production provider", () => {
  const config = authenticationConfig({
    APP_ENV: "production",
    AUTHENTICATION_ENABLED: "true",
    AUTHENTICATION_PROVIDER: "azure-app-service-easy-auth",
    ALFRED_ALLOWED_USERS: "patrick@example.com",
  });

  assert.equal(config.enabled, true);
  assert.equal(config.providerSupported, true);
  assert.equal(config.requireUserAllowlist, true);
  assert.deepEqual(config.allowedUsers, ["patrick@example.com"]);
});

test("Azure Easy Auth principal is decoded without exposing secrets", () => {
  const principal = decodeClientPrincipal(encodedPrincipal());

  assert.equal(principal.userDetails, "patrick@example.com");
  assert.equal(principal.claims.length, 3);
});

test("authenticated user is extracted from configured identity headers", () => {
  const user = authenticatedUserFromHeaders({
    "x-ms-client-principal": encodedPrincipal(),
    "x-ms-client-principal-id": "user-1",
  }, {
    AUTHENTICATION_ENABLED: "true",
    AUTHENTICATION_PROVIDER: "azure-app-service-easy-auth",
  });

  assert.equal(user.email, "patrick@example.com");
  assert.ok(user.identifiers.includes("patrick@example.com"));
  assert.ok(user.identifiers.includes("user-1"));
});

test("authentication gate denies missing provider and missing principal", () => {
  const missingProvider = authenticateHeaders({}, {
    APP_ENV: "production",
    AUTHENTICATION_ENABLED: "true",
  });
  const missingPrincipal = authenticateHeaders({}, {
    APP_ENV: "production",
    AUTHENTICATION_ENABLED: "true",
    AUTHENTICATION_PROVIDER: "azure-app-service-easy-auth",
    ALFRED_ALLOWED_USERS: "patrick@example.com",
  });

  assert.equal(missingProvider.allowed, false);
  assert.equal(missingProvider.statusCode, 503);
  assert.equal(missingProvider.code, "AUTH_PROVIDER_NOT_CONFIGURED");
  assert.equal(missingPrincipal.allowed, false);
  assert.equal(missingPrincipal.statusCode, 401);
  assert.equal(missingPrincipal.code, "AUTHENTICATION_REQUIRED");
});

test("authentication gate enforces Alfred allowed users", () => {
  const allowed = authenticateHeaders({
    "x-ms-client-principal": encodedPrincipal({ email: "patrick@example.com" }),
  }, {
    APP_ENV: "production",
    AUTHENTICATION_ENABLED: "true",
    AUTHENTICATION_PROVIDER: "azure-app-service-easy-auth",
    ALFRED_ALLOWED_USERS: "patrick@example.com",
  });
  const blocked = authenticateHeaders({
    "x-ms-client-principal": encodedPrincipal({ email: "other@example.com" }),
  }, {
    APP_ENV: "production",
    AUTHENTICATION_ENABLED: "true",
    AUTHENTICATION_PROVIDER: "azure-app-service-easy-auth",
    ALFRED_ALLOWED_USERS: "patrick@example.com",
  });

  assert.equal(allowed.allowed, true);
  assert.equal(allowed.user.email, "patrick@example.com");
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.statusCode, 403);
  assert.equal(blocked.code, "AUTH_USER_NOT_ALLOWED");
});
