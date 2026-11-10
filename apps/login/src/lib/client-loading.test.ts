import { describe, expect, test, vi } from "vitest";
import { handleServerActionResponse } from "./client-utils";

describe("loading during navigation", () => {
  test.each([
    undefined,
    null,
    { error: "Failed" },
    { redirect: "javascript:alert(1)" },
    { samlData: { url: "data:text/html,bad", fields: {} } },
  ])("unlocks the form when no navigation can happen (%j)", (response) => {
    const setLoading = vi.fn();
    handleServerActionResponse(response, { push: vi.fn() }, vi.fn(), vi.fn(), setLoading);
    expect(setLoading).toHaveBeenCalledWith(false);
  });
  test.each(["/signedin", "/ui/v2/login/signedin"])("keeps the form locked during navigation to %s", (redirect) => {
    const push = vi.fn();
    const setLoading = vi.fn();
    handleServerActionResponse({ redirect }, { push }, vi.fn(), vi.fn(), setLoading);
    expect(push).toHaveBeenCalledWith(redirect);
    expect(setLoading).not.toHaveBeenCalled();
  });
  test("keeps the form locked while posting SAML", () => {
    const setLoading = vi.fn();
    const setSamlData = vi.fn();
    const samlData = { url: "https://rp.example.com/acs", fields: { SAMLResponse: "response" } };
    handleServerActionResponse({ samlData }, { push: vi.fn() }, setSamlData, vi.fn(), setLoading);
    expect(setSamlData).toHaveBeenCalledWith(samlData);
    expect(setLoading).not.toHaveBeenCalled();
  });
});
