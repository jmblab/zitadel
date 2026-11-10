import { sendLoginname } from "@/lib/server/loginname";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { UsernameForm } from "./username-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/lib/server/loginname", () => ({
  sendLoginname: vi.fn(),
}));

describe("UsernameForm", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("auto-submits once in StrictMode and allows a manual retry after an error", async () => {
    vi.mocked(sendLoginname).mockResolvedValue({ error: "Try again" });
    render(
      <StrictMode>
        <UsernameForm loginName="  user  " requestId="oidc_1" loginSettings={undefined} submit allowRegister={false} />
      </StrictMode>,
    );
    await waitFor(() => expect(screen.getByText("Try again")).toBeInTheDocument());
    expect(sendLoginname).toHaveBeenCalledTimes(1);
    expect(sendLoginname).toHaveBeenCalledWith(expect.objectContaining({ loginName: "user" }));
    const button = screen.getByTestId("submit-button");
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);
    await waitFor(() => expect(sendLoginname).toHaveBeenCalledTimes(2));
  });

  test("should autofocus the loginName input on mount", () => {
    const { getByTestId } = render(
      <UsernameForm loginName="" requestId={undefined} loginSettings={undefined} submit={false} allowRegister={false} />,
    );
    expect(getByTestId("username-text-input")).toHaveFocus();
  });

  test("trims the login and blocks retries through a slow request and navigation", async () => {
    let resolve!: (value: { redirect: string }) => void;
    vi.mocked(sendLoginname).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    render(<UsernameForm loginName="" loginSettings={undefined} submit={false} allowRegister={false} />);
    fireEvent.change(screen.getByTestId("username-text-input"), { target: { value: "  user@example.com  " } });
    const button = screen.getByTestId("submit-button");
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);
    await waitFor(() => expect(sendLoginname).toHaveBeenCalledTimes(1));
    expect(sendLoginname).toHaveBeenCalledWith(expect.objectContaining({ loginName: "user@example.com" }));
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(sendLoginname).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ redirect: "/password" }));
    expect(button).toBeDisabled();
  });
});
