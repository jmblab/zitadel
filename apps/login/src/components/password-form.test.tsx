import { resetPassword, sendPassword } from "@/lib/server/password";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { PasswordForm } from "./password-form";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/lib/server/password", () => ({
  sendPassword: vi.fn(),
  resetPassword: vi.fn(),
}));

describe("PasswordForm", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  test("should autofocus the password input on mount", () => {
    const { getByTestId } = render(<PasswordForm loginSettings={undefined} loginName="test@example.com" />);
    expect(getByTestId("password-text-input")).toHaveFocus();
  });

  test("blocks repeated submits during a slow request and until navigation completes", async () => {
    let resolve!: (value: { redirect: string }) => void;
    vi.mocked(sendPassword).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    render(<PasswordForm loginSettings={undefined} loginName="test@example.com" />);
    fireEvent.change(screen.getByTestId("password-text-input"), { target: { value: "password" } });
    const button = screen.getByTestId("submit-button");
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);
    await waitFor(() => expect(sendPassword).toHaveBeenCalledTimes(1));
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(sendPassword).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ redirect: "/signedin" }));
    expect(push).toHaveBeenCalledWith("/signedin");
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(sendPassword).toHaveBeenCalledTimes(1);
  });

  test.each(["response", "exception"])("unlocks after an authentication %s error", async (kind) => {
    if (kind === "response") vi.mocked(sendPassword).mockResolvedValue({ error: "Incorrect password" });
    else vi.mocked(sendPassword).mockRejectedValue(new Error("Network error"));
    render(<PasswordForm loginSettings={undefined} loginName="test@example.com" />);
    fireEvent.change(screen.getByTestId("password-text-input"), { target: { value: "password" } });
    const button = screen.getByTestId("submit-button");
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByTestId("error")).toBeTruthy());
    expect(button).not.toBeDisabled();
    expect(push).not.toHaveBeenCalled();
  });

  test("keeps password reset disabled through its redirect", async () => {
    let resolve!: (value: {}) => void;
    vi.mocked(resetPassword).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    render(<PasswordForm loginSettings={undefined} loginName="test@example.com" />);
    const button = screen.getByTestId("reset-button");
    fireEvent.click(button);
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(resetPassword).toHaveBeenCalledTimes(1);
    await act(async () => resolve({}));
    expect(push).toHaveBeenCalledWith("/password/set?loginName=test%40example.com");
    expect(button).toBeDisabled();
  });
});
