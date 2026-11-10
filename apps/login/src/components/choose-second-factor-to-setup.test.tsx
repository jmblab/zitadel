import { skipMFAAndContinueWithNextUrl } from "@/lib/server/session";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SecondFactorType } from "@zitadel/proto/zitadel/settings/v2/login_settings_pb";
import { AuthenticationMethodType } from "@zitadel/proto/zitadel/user/v2/user_service_pb";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ChooseSecondFactorToSetup } from "./choose-second-factor-to-setup";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/lib/server/session", () => ({ skipMFAAndContinueWithNextUrl: vi.fn() }));
const props = {
  userId: "user",
  loginName: "user",
  sessionId: "session",
  organization: "org",
  loginSettings: { secondFactors: [SecondFactorType.OTP_EMAIL] } as any,
  userMethods: [],
  checkAfter: false,
  phoneVerified: false,
  emailVerified: false,
  force: false,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(skipMFAAndContinueWithNextUrl).mockResolvedValue({ redirect: "/signedin" });
});
afterEach(cleanup);

describe("optional MFA setup", () => {
  test("skips once when no usable method is available and stays disabled during navigation", async () => {
    const { rerender } = render(<ChooseSecondFactorToSetup {...props} />);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/signedin"));
    rerender(<ChooseSecondFactorToSetup {...props} />);
    expect(skipMFAAndContinueWithNextUrl).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("reset-button")).toBeDisabled();
  });
  test("does not skip required MFA", () => {
    render(<ChooseSecondFactorToSetup {...props} force />);
    expect(skipMFAAndContinueWithNextUrl).not.toHaveBeenCalled();
    expect(screen.queryByTestId("reset-button")).toBeNull();
  });
  test.each([SecondFactorType.OTP, SecondFactorType.U2F, SecondFactorType.OTP_EMAIL, SecondFactorType.OTP_SMS])(
    "offers available method %s without automatically skipping",
    (factor) => {
      render(
        <ChooseSecondFactorToSetup
          {...props}
          emailVerified
          phoneVerified
          loginSettings={{ secondFactors: [factor] } as any}
        />,
      );
      expect(skipMFAAndContinueWithNextUrl).not.toHaveBeenCalled();
    },
  );
  test("skips when all displayed methods are already registered", async () => {
    render(<ChooseSecondFactorToSetup {...props} emailVerified userMethods={[AuthenticationMethodType.OTP_EMAIL]} />);
    await waitFor(() => expect(skipMFAAndContinueWithNextUrl).toHaveBeenCalledTimes(1));
  });
  test("allows manual retry after an error instead of looping", async () => {
    vi.mocked(skipMFAAndContinueWithNextUrl).mockResolvedValueOnce({ error: "Temporary failure" });
    render(<ChooseSecondFactorToSetup {...props} />);
    await waitFor(() => expect(screen.getByTestId("reset-button")).not.toBeDisabled());
    expect(screen.getByText("Temporary failure")).toBeTruthy();
    expect(skipMFAAndContinueWithNextUrl).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId("reset-button"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/signedin"));
  });
});
