import { ConsentScreen } from "@/components/consent";
import { DynamicTheme } from "@/components/dynamic-theme";
import { Translated } from "@/components/translated";
import { UserAvatar } from "@/components/user-avatar";
import { checkDeviceCodeCheckCookie } from "@/lib/device-code-check";
import { getEffectiveOrganizationId } from "@/lib/organization";
import { getServiceConfig } from "@/lib/service-url";
import { loadMostRecentSession, loadSessionById } from "@/lib/session";
import { getBrandingSettings, getDeviceAuthorizationRequest } from "@/lib/zitadel";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function Page(props: { searchParams: Promise<Record<string | number | symbol, string | undefined>> }) {
  const searchParams = await props.searchParams;

  const requestId = searchParams?.requestId;
  const sessionId = searchParams?.sessionId;
  const loginName = searchParams?.loginName;
  const organization = searchParams?.organization;

  if (!requestId || !requestId.startsWith("device_")) {
    return (
      <div>
        <Translated i18nKey="noUserCode" namespace="error" />
      </div>
    );
  }

  const userCode = requestId.replace("device_", "");

  // consent can only be given in the browser that entered the user code
  if (!(await checkDeviceCodeCheckCookie(userCode))) {
    return redirect("/device?" + new URLSearchParams({ user_code: userCode }));
  }

  const _headers = await headers();
  const { serviceConfig } = getServiceConfig(_headers);

  const { deviceAuthorizationRequest } = await getDeviceAuthorizationRequest({ serviceConfig, userCode });

  if (!deviceAuthorizationRequest) {
    return (
      <div>
        <Translated i18nKey="noDeviceRequest" namespace="error" />
      </div>
    );
  }

  const sessionFactors = sessionId
    ? await loadSessionById(serviceConfig, sessionId, organization)
    : await loadMostRecentSession({ serviceConfig, sessionParams: { loginName, organization } });

  // consent is only given by an authenticated user, so send the user through the login funnel first
  if (!sessionFactors) {
    const loginParams = new URLSearchParams({ requestId });

    if (organization) {
      loginParams.append("organization", organization);
    }

    return redirect(`/loginname?` + loginParams);
  }

  const effectiveOrganization = await getEffectiveOrganizationId({ serviceConfig, organization });

  const branding = await getBrandingSettings({ serviceConfig, organization: effectiveOrganization });

  return (
    <DynamicTheme branding={branding}>
      <div className="flex flex-col space-y-4">
        <h1>
          <Translated i18nKey="request.title" namespace="device" data={{ appName: deviceAuthorizationRequest?.appName }} />
        </h1>

        <p className="ztdl-p">
          <Translated
            i18nKey="request.description"
            namespace="device"
            data={{ appName: deviceAuthorizationRequest?.appName }}
          />
        </p>

        <UserAvatar
          loginName={sessionFactors.factors?.user?.loginName}
          displayName={sessionFactors.factors?.user?.displayName}
          showDropdown={false}
        />
      </div>

      <div className="w-full">
        <ConsentScreen
          userCode={userCode}
          sessionId={sessionFactors.id}
          organization={organization}
          scope={deviceAuthorizationRequest.scope}
          appName={deviceAuthorizationRequest?.appName}
        />
      </div>
    </DynamicTheme>
  );
}
