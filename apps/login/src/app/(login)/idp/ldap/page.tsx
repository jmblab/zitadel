import { DynamicTheme } from "@/components/dynamic-theme";
import { LDAPUsernamePasswordForm } from "@/components/ldap-username-password-form";
import { Translated } from "@/components/translated";
import { getEffectiveOrganizationId } from "@/lib/organization";
import { getServiceConfig } from "@/lib/service-url";
import { getBrandingSettings } from "@/lib/zitadel";
import { headers } from "next/headers";

export default async function Page(props: {
  searchParams: Promise<Record<string | number | symbol, string | undefined>>;
  params: Promise<{ provider: string }>;
}) {
  const searchParams = await props.searchParams;
  const { idpId, organization, link, requestId, postErrorRedirectUrl, linkToSessionId, linkFingerprint } = searchParams;

  if (!idpId) {
    throw new Error("No idpId provided in searchParams");
  }

  const _headers = await headers();
  const { serviceConfig } = getServiceConfig(_headers);

  const effectiveOrganization = await getEffectiveOrganizationId({ serviceConfig, organization });

  const branding = await getBrandingSettings({ serviceConfig, organization: effectiveOrganization });

  // return login failed if no linking or creation is allowed and no user was found
  return (
    <DynamicTheme branding={branding}>
      <div className="flex flex-col space-y-4">
        <h1>
          <Translated i18nKey="title" namespace="ldap" />
        </h1>
        <p className="ztdl-p">
          <Translated i18nKey="description" namespace="ldap" />
        </p>
      </div>

      <div className="w-full">
        <LDAPUsernamePasswordForm
          idpId={idpId}
          link={link === "true"}
          requestId={requestId}
          organization={organization}
          postErrorRedirectUrl={postErrorRedirectUrl}
          linkToSessionId={linkToSessionId}
          linkFingerprint={linkFingerprint}
        />
      </div>
    </DynamicTheme>
  );
}
