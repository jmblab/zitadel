import { continueWithSession } from "@/lib/actions/session";
import * as Tooltip from "@radix-ui/react-tooltip";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Session } from "@zitadel/proto/zitadel/session/v2/session_pb";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { SessionItem } from "./session-item";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next-intl", () => ({ useLocale: () => "en", useTranslations: () => (key: string) => key }));
vi.mock("@/lib/actions/session", () => ({ continueWithSession: vi.fn(), clearSession: vi.fn() }));
vi.mock("@/lib/actions/loginname", () => ({ sendLoginname: vi.fn() }));
vi.mock("./avatar", () => ({ Avatar: () => null }));
vi.mock("./auto-submit-form", () => ({ AutoSubmitForm: () => <div data-testid="saml-post" /> }));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

function renderSession() {
  const session = {
    id: "session-1",
    factors: {
      user: { id: "user-1", loginName: "user@example.com", displayName: "Test user", organizationId: "org-1" },
      password: { verifiedAt: { seconds: BigInt(Math.floor(Date.now() / 1000)), nanos: 0 } },
    },
  } as Session;
  render(
    <Tooltip.Provider>
      <SessionItem session={session} reload={vi.fn()} requestId="oidc_request-1" />
    </Tooltip.Provider>,
  );
  return screen.getByRole("button");
}

test.each(["redirect", "saml"])("blocks repeated session continuation through %s navigation", async (kind) => {
  let finish!: (value: Awaited<ReturnType<typeof continueWithSession>>) => void;
  vi.mocked(continueWithSession).mockReturnValue(new Promise((resolve) => (finish = resolve)));
  const button = renderSession();
  fireEvent.click(button);
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(continueWithSession).toHaveBeenCalledTimes(1);
  // The server must derive identity and factors. Do not send the session object.
  expect(continueWithSession).toHaveBeenCalledWith({ sessionId: "session-1", requestId: "oidc_request-1" });
  if (kind === "redirect") {
    finish({ redirect: "/signedin" });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/signedin"));
  } else {
    finish({ samlData: { url: "https://rp.example.com/acs", fields: { SAMLResponse: "response" } } });
    await screen.findByTestId("saml-post");
  }
  expect(button).toBeDisabled();
});

test.each(["response", "exception"])("unlocks session selection after a %s error", async (kind) => {
  if (kind === "response") vi.mocked(continueWithSession).mockResolvedValue({ error: "Session rejected" });
  else vi.mocked(continueWithSession).mockRejectedValue(new Error("network"));
  const button = renderSession();
  fireEvent.click(button);
  await screen.findByText(kind === "response" ? "Session rejected" : "An internal error occurred");
  expect(button).not.toBeDisabled();
  expect(push).not.toHaveBeenCalled();
});
