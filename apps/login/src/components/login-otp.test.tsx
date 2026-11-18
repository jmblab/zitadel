import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { LoginOTP } from "./login-otp";

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, data?: Record<string, unknown>) => (data ? `${key} ${JSON.stringify(data)}` : key),
}));

vi.mock("@/lib/actions/session", () => ({
  updateOrCreateSession: vi.fn(),
}));

vi.mock("@/lib/actions/flow", () => ({
  handleServerActionResponse: vi.fn(),
  completeFlowOrGetUrl: vi.fn(),
}));

describe("LoginOTP", () => {
  let mockUpdateOrCreateSession: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { updateOrCreateSession } = await import("@/lib/actions/session");
    mockUpdateOrCreateSession = vi.mocked(updateOrCreateSession);
  });

  afterEach(cleanup);

  test.each([undefined, {}])("unlocks when OTP verification returns no session: %j", async (response) => {
    mockUpdateOrCreateSession.mockResolvedValue(response);
    render(<LoginOTP method="time-based" />);
    fireEvent.change(screen.getByTestId("code-text-input"), { target: { value: "123456" } });
    const button = screen.getByTestId("submit-button");
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);
    await waitFor(() => expect(mockUpdateOrCreateSession).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(button).not.toBeDisabled());
    const { completeFlowOrGetUrl } = await import("@/lib/actions/flow");
    expect(completeFlowOrGetUrl).not.toHaveBeenCalled();
  });

  test("should autofocus the code input on mount", () => {
    const { getByTestId } = render(<LoginOTP method="time-based" />);
    expect(getByTestId("code-text-input")).toHaveFocus();
  });

  test("should display translated fallback error when OTP verification request rejects", async () => {
    mockUpdateOrCreateSession.mockRejectedValueOnce(new Error("network down"));

    render(<LoginOTP method="time-based" />);

    const input = screen.getByTestId("code-text-input");
    fireEvent.change(input, { target: { value: "123456" } });

    const submitButton = screen.getByTestId("submit-button");
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("errors.couldNotVerifyCode")).toBeInTheDocument();
    });
  });

  test("should display translated fallback error when OTP challenge request rejects", async () => {
    mockUpdateOrCreateSession.mockRejectedValueOnce(new Error("challenge request failed"));

    render(<LoginOTP method="sms" />);

    expect(screen.getByRole("button", { name: "verify.resendCode" })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("errors.couldNotRequestChallenge")).toBeInTheDocument();
    });
  });

  describe("SMS resend cooldown", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    test("keeps verification and resend locked after the countdown expires during navigation", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const { completeFlowOrGetUrl } = await import("@/lib/actions/flow");
      vi.mocked(completeFlowOrGetUrl).mockResolvedValue({ redirect: "/signedin" });
      mockUpdateOrCreateSession
        .mockResolvedValueOnce({ sessionId: "session-1", retryAfterSeconds: 2 })
        .mockResolvedValueOnce({
          sessionId: "session-1",
          factors: { user: { loginName: "user@example.com", organizationId: "org-1" } },
        });

      render(<LoginOTP method="sms" sessionId="session-1" requestId="request-1" organization="org-1" />);
      const resendButton = screen.getByTestId("resend-button");
      await waitFor(() => expect(resendButton).toHaveTextContent('verify.resendCodeIn {"seconds":2}'));
      fireEvent.change(screen.getByTestId("code-text-input"), { target: { value: "123456" } });
      const submitButton = screen.getByTestId("submit-button");
      await waitFor(() => expect(submitButton).not.toBeDisabled());

      fireEvent.click(submitButton);
      await waitFor(() => expect(mockUpdateOrCreateSession).toHaveBeenCalledTimes(2));
      expect(submitButton).toBeDisabled();
      expect(resendButton).toBeDisabled();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

      expect(mockPush).toHaveBeenCalledWith("/signedin");
      expect(resendButton).toHaveTextContent(/^verify\.resendCode$/);
      expect(submitButton).toBeDisabled();
      expect(resendButton).toBeDisabled();
      fireEvent.click(submitButton);
      fireEvent.click(resendButton);
      expect(mockUpdateOrCreateSession).toHaveBeenCalledTimes(2);
      expect(completeFlowOrGetUrl).toHaveBeenCalledTimes(1);
    });

    test("disables resend and counts down after the code was sent", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      mockUpdateOrCreateSession.mockResolvedValue({ sessionId: "session-1", retryAfterSeconds: 2 });

      render(<LoginOTP method="sms" />);

      const resendButton = screen.getByTestId("resend-button");
      await waitFor(() => expect(resendButton).toHaveTextContent('verify.resendCodeIn {"seconds":2}'));
      expect(resendButton).toBeDisabled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(resendButton).toHaveTextContent('verify.resendCodeIn {"seconds":1}');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(resendButton).toHaveTextContent(/^verify\.resendCode$/);
      expect(resendButton).not.toBeDisabled();
    });

    test("catches up with the time that passed while the timer was suspended", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      mockUpdateOrCreateSession.mockResolvedValue({ sessionId: "session-1", retryAfterSeconds: 30 });

      render(<LoginOTP method="sms" />);

      const resendButton = screen.getByTestId("resend-button");
      await waitFor(() => expect(resendButton).toHaveTextContent('verify.resendCodeIn {"seconds":30}'));

      // the clock moves on while no timer fires, like in a suspended tab
      vi.setSystemTime(Date.now() + 60_000);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(resendButton).toHaveTextContent(/^verify\.resendCode$/);
      expect(resendButton).not.toBeDisabled();
    });

    test("exposes the countdown in the button's accessible name", async () => {
      mockUpdateOrCreateSession.mockResolvedValue({ sessionId: "session-1", retryAfterSeconds: 25 });

      render(<LoginOTP method="sms" />);

      expect(await screen.findByRole("button", { name: 'verify.resendCodeIn {"seconds":25}' })).toBeDisabled();
    });

    test("shows the countdown instead of an error when the server refuses within the cooldown", async () => {
      mockUpdateOrCreateSession.mockResolvedValue({ retryAfterSeconds: 25 });

      render(<LoginOTP method="sms" />);

      const resendButton = screen.getByTestId("resend-button");
      await waitFor(() => expect(resendButton).toHaveTextContent('verify.resendCodeIn {"seconds":25}'));
      expect(resendButton).toBeDisabled();
      expect(screen.queryByTestId("error")).not.toBeInTheDocument();
    });

    test("does not start a countdown for email codes", async () => {
      mockUpdateOrCreateSession.mockResolvedValue({ sessionId: "session-1" });

      render(<LoginOTP method="email" />);

      await waitFor(() => expect(mockUpdateOrCreateSession).toHaveBeenCalledTimes(1));
      const resendButton = screen.getByTestId("resend-button");
      await waitFor(() => expect(resendButton).not.toBeDisabled());
      expect(resendButton).toHaveTextContent(/^verify\.resendCode$/);
    });
  });
});
