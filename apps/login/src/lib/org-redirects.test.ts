import { afterEach, describe, expect, test, vi } from "vitest";
import { buildCSP } from "./csp";
import { getOrgFallbackRedirect, getOrgIconOrigins, getOrgRedirectConfig, getOrgRedirects } from "./org-redirects";

afterEach(() => vi.unstubAllEnvs());
const links = [{ label: "Portal", url: "https://portal.example.com" }];
function configure(overrides = {}) {
  vi.stubEnv("ORG_REDIRECTS", JSON.stringify([{ orgId: "org-1", links, ...overrides }]));
}

describe("organization redirects", () => {
  test.each(["", "{", "{}", "null"])("ignores invalid configuration %s", (raw) => {
    vi.stubEnv("ORG_REDIRECTS", raw);
    expect(getOrgRedirects()).toEqual([]);
  });
  test("keeps other organizations isolated", () => {
    configure();
    expect(getOrgRedirectConfig("org-2")).toBeUndefined();
    expect(getOrgRedirectConfig(undefined)).toBeUndefined();
  });
  test("uses the signed-in selection page unless auto redirect is enabled", () => {
    configure();
    expect(getOrgFallbackRedirect("org-1", "a@b.com")).toBe("/signedin?organization=org-1&loginName=a%40b.com");
    configure({ autoRedirect: true });
    expect(getOrgFallbackRedirect("org-1", "user")).toBe(links[0].url);
  });
  test("preserves default redirect unless explicitly overridden", () => {
    configure({ autoRedirect: true });
    expect(getOrgFallbackRedirect("org-1", "user", "https://default.example.com")).toBeUndefined();
    configure({ autoRedirect: true, overrideDefault: true });
    expect(getOrgFallbackRedirect("org-1", "user", "https://default.example.com")).toBe(links[0].url);
  });
  test("rejects script URLs and only allows configured HTTP image origins in CSP", () => {
    configure({
      links: [
        { label: "Bad", url: "javascript:alert(1)" },
        { label: "Bad", url: "data:text/html,bad" },
        { ...links[0], iconUrl: "https://assets.example.com/light.svg", iconDarkUrl: "https://assets.example.com/dark.svg" },
        { label: "Other", url: "https://other.example.com", iconUrl: "javascript:alert(1)" },
      ],
    });
    expect(getOrgRedirects()[0].links).toHaveLength(2);
    expect(getOrgRedirects()[0].links[1].iconUrl).toBeUndefined();
    expect(getOrgIconOrigins()).toEqual(["https://assets.example.com"]);
    const csp = buildCSP({ imageOrigins: getOrgIconOrigins() });
    expect(csp).toContain("img-src 'self' https://assets.example.com;");
    expect(csp).toContain("connect-src 'self';");
  });
});
