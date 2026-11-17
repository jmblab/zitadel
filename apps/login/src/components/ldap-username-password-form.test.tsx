import { createNewSessionForLDAP } from "@/lib/actions/idp";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { LDAPUsernamePasswordForm } from "./ldap-username-password-form";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/lib/actions/idp", () => ({
  createNewSessionForLDAP: vi.fn(),
}));

describe("LDAPUsernamePasswordForm", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  async function submit() {
    render(<LDAPUsernamePasswordForm idpId="idp-1" link={false} />);
    fireEvent.change(screen.getByTestId("username-text-input"), { target: { value: "user" } });
    fireEvent.change(screen.getByTestId("password-text-input"), { target: { value: "test-password" } });
    const button = screen.getByTestId("submit-button");
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);
    return button;
  }

  test("blocks repeat requests while LDAP is pending and until navigation completes", async () => {
    let finish!: (value: { redirect: string }) => void;
    vi.mocked(createNewSessionForLDAP).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const button = await submit();
    await waitFor(() => expect(button).toBeDisabled());
    fireEvent.click(button);
    expect(createNewSessionForLDAP).toHaveBeenCalledTimes(1);
    finish({ redirect: "/signedin" });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/signedin"));
    expect(button).toBeDisabled();
  });

  test.each(["response", "exception"])("unlocks after an LDAP %s error", async (kind) => {
    if (kind === "response") vi.mocked(createNewSessionForLDAP).mockResolvedValue({ error: "LDAP rejected" });
    else vi.mocked(createNewSessionForLDAP).mockRejectedValue(new Error("network"));
    const button = await submit();
    await screen.findByText(kind === "response" ? "LDAP rejected" : "Could not start LDAP flow");
    expect(button).not.toBeDisabled();
    expect(push).not.toHaveBeenCalled();
  });

  test("should autofocus the username input on mount", () => {
    const { getByTestId } = render(<LDAPUsernamePasswordForm idpId="idp-1" link={false} />);
    expect(getByTestId("username-text-input")).toHaveFocus();
  });
});
