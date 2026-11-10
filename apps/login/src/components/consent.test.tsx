import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ConsentScreen } from "./consent";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/lib/server/device", () => ({
  approveDeviceAuthorization: vi.fn(),
  denyDeviceAuthorization: vi.fn(),
}));

describe("ConsentScreen", () => {
  let approveDeviceAuthorization: any;
  let denyDeviceAuthorization: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const device = await import("@/lib/server/device");
    approveDeviceAuthorization = vi.mocked(device.approveDeviceAuthorization);
    denyDeviceAuthorization = vi.mocked(device.denyDeviceAuthorization);

    approveDeviceAuthorization.mockResolvedValue({ redirect: "/signedin?requestId=device_ABCD-1234" });
    denyDeviceAuthorization.mockResolvedValue({ details: {} });
  });

  afterEach(cleanup);

  test.each(["approve", "deny"])("blocks both actions through a slow %s request and navigation", async (choice) => {
    let resolve!: (value: { redirect: string }) => void;
    const action = choice === "approve" ? approveDeviceAuthorization : denyDeviceAuthorization;
    action.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { getByTestId } = render(<ConsentScreen userCode="code" sessionId="session" />);
    const approve = getByTestId("submit-button");
    const deny = getByTestId("deny-button");
    fireEvent.click(choice === "approve" ? approve : deny);
    expect(approve).toBeDisabled();
    expect(deny).toBeDisabled();
    fireEvent.click(approve);
    fireEvent.click(deny);
    expect(action).toHaveBeenCalledTimes(1);
    expect(choice === "approve" ? denyDeviceAuthorization : approveDeviceAuthorization).not.toHaveBeenCalled();
    await act(async () => resolve({ redirect: "/signedin" }));
    expect(push).toHaveBeenCalledWith("/signedin");
    expect(approve).toBeDisabled();
    expect(deny).toBeDisabled();
  });

  test.each([{ error: "denied" }, {}, undefined])("unlocks after approval cannot navigate: %j", async (response) => {
    approveDeviceAuthorization.mockResolvedValue(response);
    const { getByTestId } = render(<ConsentScreen userCode="code" sessionId="session" />);
    fireEvent.click(getByTestId("submit-button"));
    await waitFor(() => expect(getByTestId("submit-button")).not.toBeDisabled());
    expect(getByTestId("deny-button")).not.toBeDisabled();
    expect(push).not.toHaveBeenCalled();
  });

  test("shows the user code so it can be compared with the device", () => {
    const { getByTestId } = render(<ConsentScreen userCode="ABCD-1234" sessionId="session-1" />);

    expect(getByTestId("user-code")).toHaveTextContent("ABCD-1234");
  });

  test("approves the device authorization and follows the returned redirect", async () => {
    const { getByTestId } = render(
      <ConsentScreen userCode="ABCD-1234" sessionId="session-1" organization="org-1" appName="My Device" />,
    );

    fireEvent.click(getByTestId("submit-button"));

    await waitFor(() => expect(approveDeviceAuthorization).toHaveBeenCalledTimes(1));
    expect(approveDeviceAuthorization).toHaveBeenCalledWith({
      userCode: "ABCD-1234",
      sessionId: "session-1",
      organization: "org-1",
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/signedin?requestId=device_ABCD-1234"));
  });

  test("denies the device authorization and returns to the code entry page", async () => {
    const { getByTestId } = render(<ConsentScreen userCode="ABCD-1234" sessionId="session-1" organization="org-1" />);

    fireEvent.click(getByTestId("deny-button"));

    await waitFor(() =>
      expect(denyDeviceAuthorization).toHaveBeenCalledWith({
        userCode: "ABCD-1234",
        sessionId: "session-1",
        organization: "org-1",
      }),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/device"));
    expect(approveDeviceAuthorization).not.toHaveBeenCalled();
  });
});
