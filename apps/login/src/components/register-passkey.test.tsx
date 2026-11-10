import { registerPasskeyLink, verifyPasskeyRegistration } from "@/lib/server/passkeys";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { RegisterPasskey } from "./register-passkey";

const { router } = vi.hoisted(() => ({ router: { push: vi.fn(), back: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/lib/server/passkeys", () => ({ registerPasskeyLink: vi.fn(), verifyPasskeyRegistration: vi.fn() }));
const createCredential = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "credentials", { configurable: true, value: { create: createCredential } });
  vi.mocked(registerPasskeyLink).mockImplementation(
    async () =>
      ({
        passkeyId: "passkey",
        publicKeyCredentialCreationOptions: { publicKey: { challenge: "AA", user: { id: "AA" } } },
      }) as any,
  );
  createCredential.mockRejectedValue(new DOMException("Cancelled", "NotAllowedError"));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test("auto-registers once in StrictMode and allows retry after cancellation", async () => {
  render(
    <StrictMode>
      <RegisterPasskey sessionId="session" code="code" codeId="code-id" isPrompt />
    </StrictMode>,
  );
  await waitFor(() => expect(screen.getByText("An error on registering passkey")).toBeInTheDocument());
  expect(registerPasskeyLink).toHaveBeenCalledTimes(1);
  expect(createCredential).toHaveBeenCalledTimes(1);
  const button = screen.getByTestId("submit-button");
  await waitFor(() => expect(button).not.toBeDisabled());
  fireEvent.click(button);
  await waitFor(() => expect(registerPasskeyLink).toHaveBeenCalledTimes(2));
  expect(router.push).not.toHaveBeenCalled();
});

test("unlocks when malformed WebAuthn options throw before credentials.create", async () => {
  vi.mocked(registerPasskeyLink).mockResolvedValue({
    passkeyId: "passkey",
    publicKeyCredentialCreationOptions: { publicKey: { challenge: "AA" } },
  } as any);
  render(<RegisterPasskey sessionId="session" code="code" isPrompt={false} />);
  await waitFor(() => expect(screen.getByText("An error on registering passkey")).toBeInTheDocument());
  await waitFor(() => expect(screen.getByTestId("submit-button")).not.toBeDisabled());
  expect(createCredential).not.toHaveBeenCalled();
  expect(router.push).not.toHaveBeenCalled();
});

test("keeps registration and skip blocked after verification while navigating", async () => {
  createCredential.mockResolvedValue({
    id: "credential",
    type: "public-key",
    rawId: new Uint8Array([1]).buffer,
    response: { attestationObject: new Uint8Array([2]).buffer, clientDataJSON: new Uint8Array([3]).buffer },
  });
  vi.mocked(verifyPasskeyRegistration).mockResolvedValue({ loginName: "user" } as any);
  render(<RegisterPasskey sessionId="session" code="code" isPrompt />);
  await waitFor(() => expect(router.push).toHaveBeenCalled());
  expect(screen.getByTestId("submit-button")).toBeDisabled();
  expect(screen.getByRole("button", { name: "set.skip" })).toBeDisabled();
});
