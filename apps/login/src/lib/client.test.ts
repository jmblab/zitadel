import { beforeEach, describe, expect, test, vi } from "vitest";
import { getNextUrl } from "./client";

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

// Mock host helper
vi.mock("./server/host", () => ({
  getPublicHostWithProtocol: vi.fn(),
}));

describe("getNextUrl", () => {
  const command = { loginName: "test-user" };

  beforeEach(() => {
    vi.clearAllMocks();
    delete (process.env as any).DEFAULT_REDIRECT_URI;
    delete (process.env as any).NEXT_PUBLIC_BASE_PATH;
    delete (process.env as any).ORG_REDIRECTS;
  });

  test("should use DEFAULT_REDIRECT_URI if set", async () => {
    process.env.DEFAULT_REDIRECT_URI = "https://env-override.com";
    const result = await getNextUrl(command);
    expect(result).toBe("https://env-override.com");
  });

  test.each(["", "/ui/v2/login"])("organization redirects work with base path %s", async (basePath) => {
    process.env.NEXT_PUBLIC_BASE_PATH = basePath;
    process.env.ORG_REDIRECTS = JSON.stringify([
      {
        orgId: "org",
        autoRedirect: true,
        overrideDefault: true,
        links: [{ label: "Portal", url: "https://portal.example.com" }],
      },
    ]);
    expect(await getNextUrl({ loginName: "user", organization: "org" }, "https://default.example.com")).toBe(
      "https://portal.example.com",
    );
    process.env.DEFAULT_REDIRECT_URI = "https://override.example.com";
    expect(await getNextUrl({ loginName: "user", organization: "org" })).toBe("https://override.example.com");
  });

  test("organization configuration does not bypass validation of the default URI", async () => {
    process.env.ORG_REDIRECTS = JSON.stringify([
      { orgId: "org", links: [{ label: "Portal", url: "https://portal.example.com" }] },
    ]);
    expect(await getNextUrl({ loginName: "user", organization: "org" }, "javascript:alert(1)")).toBe(
      "/signedin?loginName=user&organization=org",
    );
  });

  test("should use host-based redirect if DEFAULT_REDIRECT_URI is set to a path (starting with '/')", async () => {
    const { headers } = await import("next/headers");
    const { getPublicHostWithProtocol } = await import("./server/host");

    process.env.DEFAULT_REDIRECT_URI = "/dashboard";
    vi.mocked(headers).mockResolvedValue({} as any);
    vi.mocked(getPublicHostWithProtocol).mockReturnValue("https://my-host.com");
    process.env.NEXT_PUBLIC_BASE_PATH = "/ui/v2/login";

    const result = await getNextUrl(command);
    expect(result).toBe("https://my-host.com/dashboard");
  });

  test("should use defaultRedirectUri if env is NOT set", async () => {
    const result = await getNextUrl(command, "https://settings.com");
    expect(result).toBe("https://settings.com");
  });

  test("should fallback to relative signedin page if everything else fails (the new default)", async () => {
    const { headers } = await import("next/headers");
    vi.mocked(headers).mockRejectedValue(new Error("No headers"));

    const result = await getNextUrl(command);
    expect(result).toBe("/signedin?loginName=test-user");
  });

  test("should send device flows to the consent page instead of completing them", async () => {
    const result = await getNextUrl({
      sessionId: "session-1",
      requestId: "device_ABCD-1234",
      organization: "org-1",
    });

    expect(result).toBe("/device/consent?sessionId=session-1&organization=org-1&requestId=device_ABCD-1234");
  });

  test("should send device flows with a login name to the consent page", async () => {
    const result = await getNextUrl({
      loginName: "test-user",
      requestId: "device_ABCD-1234",
    } as any);

    expect(result).toBe("/device/consent?loginName=test-user&requestId=device_ABCD-1234");
  });
});
