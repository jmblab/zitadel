import { completeFlowOrGetUrl } from "@/lib/client";
import { verifyTOTP } from "@/lib/server/verify";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { TotpRegister } from "./totp-register";

const { router } = vi.hoisted(() => ({ router: { push: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/lib/server/verify", () => ({ verifyTOTP: vi.fn() }));
vi.mock("@/lib/client", () => ({ completeFlowOrGetUrl: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

test("should autofocus the code input on mount", () => {
  const { getByTestId } = render(<TotpRegister uri="otpauth://totp/test" secret="SECRET" />);
  expect(getByTestId("code-text-input")).toHaveFocus();
});

async function submit(checkAfter: boolean) {
  render(<TotpRegister uri="otpauth://totp/test?secret=AAA" secret="AAA" loginName="user" checkAfter={checkAfter} />);
  fireEvent.change(screen.getByTestId("code-text-input"), { target: { value: "123456" } });
  const button = screen.getByTestId("submit-button");
  await waitFor(() => expect(button).not.toBeDisabled());
  fireEvent.click(button);
  return button;
}

test.each([true, false])("does not continue when upstream rejects MFA enrollment (checkAfter=%s)", async (checkAfter) => {
  vi.mocked(verifyTOTP).mockResolvedValue({ error: "Authentication required before enrollment" });
  const button = await submit(checkAfter);
  await waitFor(() => expect(screen.getByText("Authentication required before enrollment")).toBeInTheDocument());
  expect(button).not.toBeDisabled();
  expect(router.push).not.toHaveBeenCalled();
  expect(completeFlowOrGetUrl).not.toHaveBeenCalled();
});

test("keeps the form blocked while navigating after successful enrollment", async () => {
  vi.mocked(verifyTOTP).mockResolvedValue({} as any);
  vi.mocked(completeFlowOrGetUrl).mockResolvedValue({ redirect: "/signedin" });
  const button = await submit(false);
  await waitFor(() => expect(router.push).toHaveBeenCalledWith("/signedin"));
  expect(button).toBeDisabled();
});
