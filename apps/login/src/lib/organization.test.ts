import { afterEach, describe, expect, test, vi } from "vitest";
import { getEffectiveOrganizationId } from "./organization";
import { getDefaultOrg, ServiceConfig } from "./zitadel";

vi.mock("./zitadel", () => ({ getDefaultOrg: vi.fn() }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
const serviceConfig = { baseUrl: "https://api.example.com" } as ServiceConfig;

describe("organization defaults", () => {
  test("explicit organization takes precedence over environment and API", async () => {
    vi.stubEnv("DEFAULT_ORGANIZATION_ID", "configured");
    expect(await getEffectiveOrganizationId({ serviceConfig, organization: "requested" })).toBe("requested");
    expect(getDefaultOrg).not.toHaveBeenCalled();
  });
  test("uses configured organization without an API lookup", async () => {
    vi.stubEnv("DEFAULT_ORGANIZATION_ID", "configured");
    expect(await getEffectiveOrganizationId({ serviceConfig })).toBe("configured");
    expect(getDefaultOrg).not.toHaveBeenCalled();
  });
  test("falls back to instance default", async () => {
    vi.stubEnv("DEFAULT_ORGANIZATION_ID", "");
    vi.mocked(getDefaultOrg).mockResolvedValue({ id: "instance-default" } as any);
    expect(await getEffectiveOrganizationId({ serviceConfig })).toBe("instance-default");
    expect(getDefaultOrg).toHaveBeenCalledWith({ serviceConfig });
  });
});
