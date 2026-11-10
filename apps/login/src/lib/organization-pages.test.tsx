import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import AccountNotFoundPage from "../app/(login)/idp/[provider]/account-not-found/page";
import ProcessPage from "../app/(login)/idp/[provider]/process/page";
import RegistrationFailedPage from "../app/(login)/idp/[provider]/registration-failed/page";
import IdentityProvidersPage from "../app/(login)/idp/page";
import PasskeyPage from "../app/(login)/passkey/page";
import PasswordPage from "../app/(login)/password/page";
import PasswordSetPage from "../app/(login)/password/set/page";
import { loadMostRecentSession } from "./session";
import { getBrandingSettings, getDefaultOrg, getLoginSettings } from "./zitadel";

vi.mock("next/headers", () => ({ headers: vi.fn(async () => ({})) }));
vi.mock("./service-url", () => ({ getServiceConfig: () => ({ serviceConfig: { baseUrl: "https://api.example.com" } }) }));
vi.mock("./session", () => ({ loadMostRecentSession: vi.fn() }));
vi.mock("./zitadel", () => ({
  getBrandingSettings: vi.fn(),
  getActiveIdentityProviders: vi.fn(async () => ({ identityProviders: [] })),
  getDefaultOrg: vi.fn(),
  getLoginSettings: vi.fn(),
  getPasswordComplexitySettings: vi.fn(),
  getSession: vi.fn(),
  getUserByID: vi.fn(),
  searchUsers: vi.fn(),
}));
vi.mock("@/components/login-passkey", () => ({ LoginPasskey: () => null }));
vi.mock("@/components/set-password-form", () => ({ SetPasswordForm: () => null }));
vi.mock("@/components/idp-process-handler", () => ({ IdpProcessHandler: () => null }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("DEFAULT_ORGANIZATION_ID", "configured-org");
  vi.mocked(loadMostRecentSession).mockResolvedValue(undefined);
  vi.mocked(getLoginSettings).mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe.each([
  ["passkey", PasskeyPage],
  ["password setup", PasswordSetPage],
  ["IDP callback", ProcessPage],
  ["IDP registration failure", RegistrationFailedPage],
  ["IDP account not found", AccountNotFoundPage],
  ["IDP selection", IdentityProvidersPage],
] as const)("default organization on %s", (_name, page) => {
  test.each([undefined, "explicit-org"])("uses the correct branding with organization %s", async (organization) => {
    await page({
      searchParams: Promise.resolve({ organization, id: "intent", token: "token" }),
      params: Promise.resolve({ provider: "google" }),
    });
    expect(getBrandingSettings).toHaveBeenCalledWith(
      expect.objectContaining({ organization: organization ?? "configured-org" }),
    );
    expect(getDefaultOrg).not.toHaveBeenCalled();
  });
});

test("passkey branding preserves the authenticated session organization", async () => {
  vi.mocked(loadMostRecentSession).mockResolvedValue({ factors: { user: { organizationId: "session-org" } } } as any);
  await PasskeyPage({ searchParams: Promise.resolve({ loginName: "user" }) });
  expect(getBrandingSettings).toHaveBeenCalledWith(expect.objectContaining({ organization: "session-org" }));
});

test("password login preserves the session organization's branding and policy", async () => {
  vi.mocked(loadMostRecentSession).mockResolvedValue({ factors: { user: { organizationId: "session-org" } } } as any);
  await PasswordPage({ searchParams: Promise.resolve({ loginName: "user" }) });
  expect(getBrandingSettings).toHaveBeenCalledWith(expect.objectContaining({ organization: "session-org" }));
  expect(getLoginSettings).toHaveBeenCalledWith(expect.objectContaining({ organization: "session-org" }));
});

test("password setup uses the session organization's login policy before the configured default", async () => {
  vi.mocked(loadMostRecentSession).mockResolvedValue({ factors: { user: { organizationId: "session-org" } } } as any);
  await PasswordSetPage({ searchParams: Promise.resolve({ loginName: "user" }) });
  expect(getLoginSettings).toHaveBeenCalledWith(expect.objectContaining({ organization: "session-org" }));
});
