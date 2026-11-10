import { cleanup, render } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { AutoSubmitForm } from "./auto-submit-form";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test("submits the SAML POST only once during StrictMode effect replay", () => {
  const submit = vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(() => {});
  const element = (
    <StrictMode>
      <AutoSubmitForm url="https://sp.example.com/acs" fields={{ SAMLResponse: "response", RelayState: "state" }} />
    </StrictMode>
  );
  const { container, rerender } = render(element);
  rerender(element);
  expect(submit).toHaveBeenCalledTimes(1);
  expect(container.querySelector("form")).toHaveAttribute("method", "post");
  expect(container.querySelector('input[name="SAMLResponse"]')).toHaveValue("response");
});
