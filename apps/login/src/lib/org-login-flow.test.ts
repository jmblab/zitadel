import { Code, ConnectError } from "@zitadel/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ClassifiedConnectError } from "./grpc/interceptors/error-classification";
import { loginWithOIDCAndSession } from "./oidc";
import { loginWithSAMLAndSession } from "./saml";
import { createCallback, createResponse, getLoginSettings } from "./zitadel";

vi.mock("./session", () => ({ isSessionValid: vi.fn(async () => true) }));
vi.mock("./server/loginname", () => ({ sendLoginname: vi.fn() }));
vi.mock("./zitadel", () => ({ createCallback: vi.fn(), createResponse: vi.fn(), getLoginSettings: vi.fn() }));

const params = {
  serviceConfig: { baseUrl: "https://api.example.com" },
  sessionId: "session",
  authRequest: "request",
  samlRequest: "request",
  sessions: [{ id: "session", factors: { user: { loginName: "user", organizationId: "org" } } }] as any,
  sessionCookies: [{ id: "session", token: "token" }] as any,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv(
    "ORG_REDIRECTS",
    JSON.stringify([
      {
        orgId: "org",
        overrideDefault: true,
        autoRedirect: true,
        links: [{ label: "Portal", url: "https://portal.example.com" }],
      },
    ]),
  );
  vi.mocked(getLoginSettings).mockResolvedValue({ defaultRedirectUri: "https://default.example.com" } as any);
});
afterEach(() => vi.unstubAllEnvs());

describe.each([
  ["OIDC", () => loginWithOIDCAndSession(params), createCallback],
  ["SAML", () => loginWithSAMLAndSession(params), createResponse],
] as const)("%s with organization links", (_name, login, endpoint) => {
  test("uses organization fallback for an already completed protocol request", async () => {
    vi.mocked(endpoint).mockRejectedValue(
      new ClassifiedConnectError(new ConnectError("Already handled", Code.FailedPrecondition)),
    );
    expect(await login()).toEqual({ redirect: "https://portal.example.com" });
  });
  test("preserves protocol callbacks over organization redirect settings", async () => {
    vi.mocked(createCallback).mockResolvedValue({ callbackUrl: "https://rp.example.com/callback" } as any);
    vi.mocked(createResponse).mockResolvedValue({
      url: "https://rp.example.com/callback",
      binding: { case: "redirect" },
    } as any);
    expect(await login()).toEqual({ redirect: "https://rp.example.com/callback" });
  });
  test("does not turn unrelated errors into success redirects", async () => {
    vi.mocked(endpoint).mockRejectedValue(new Error("Unavailable"));
    expect(await login()).toHaveProperty("error");
  });
});

test("preserves SAML POST binding", async () => {
  vi.mocked(createResponse).mockResolvedValue({
    url: "https://rp.example.com/acs",
    binding: { case: "post", value: { relayState: "state", samlResponse: "response" } },
  } as any);
  expect(await loginWithSAMLAndSession(params)).toEqual({
    samlData: { url: "https://rp.example.com/acs", fields: { RelayState: "state", SAMLResponse: "response" } },
  });
});
