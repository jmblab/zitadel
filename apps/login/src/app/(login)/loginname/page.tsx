import { DynamicTheme } from "@/components/dynamic-theme";
import { SignInWithIdp } from "@/components/sign-in-with-idp";
import { Translated } from "@/components/translated";
import { UsernameForm } from "@/components/username-form";
import { getEffectiveOrganizationId } from "@/lib/organization";
import { getServiceConfig } from "@/lib/service-url";
import { getActiveIdentityProviders, getBrandingSettings, getLoginSettings } from "@/lib/zitadel";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("loginname");
  return { title: t("title") };
}

export default async function Page(props: { searchParams: Promise<Record<string | number | symbol, string | undefined>> }) {
  const searchParams = await props.searchParams;

  const loginName = searchParams?.loginName;
  const requestId = searchParams?.requestId;
  const organization = searchParams?.organization;
  const orgDomain = searchParams?.orgDomain;
  const submit: boolean = searchParams?.submit === "true";

  // With an org domain suffix the login name may only be the local part (the
  // form shows the suffix separately), so put it back together for the IdP
  // login hint the same way sendLoginname does for the username form.
  const idpLoginHint = loginName && orgDomain && !loginName.includes("@") ? `${loginName}@${orgDomain}` : loginName;

  const _headers = await headers();
  const { serviceConfig } = getServiceConfig(_headers);

  const effectiveOrganization = await getEffectiveOrganizationId({ serviceConfig, organization });

  const loginSettings = await getLoginSettings({ serviceConfig, organization: effectiveOrganization });

  const identityProviders = await getActiveIdentityProviders({
    serviceConfig,
    orgId: effectiveOrganization,
  }).then((resp) => {
    return resp.identityProviders;
  });

  const branding = await getBrandingSettings({ serviceConfig, organization: effectiveOrganization });

  return (
    <DynamicTheme branding={branding}>
      <div className="flex flex-col space-y-4">
        <h1>
          <Translated i18nKey="title" namespace="loginname" />
        </h1>
        <p className="ztdl-p">
          <Translated i18nKey="description" namespace="loginname" />
        </p>
      </div>

      <div className="w-full">
        {loginSettings?.allowLocalAuthentication && (
          <UsernameForm
            loginName={loginName}
            requestId={requestId}
            organization={organization} // stick to "organization" as we still want to do user discovery based on the searchParams not the default organization, later the organization is determined by the found user
            defaultOrganization={effectiveOrganization}
            loginSettings={loginSettings}
            suffix={orgDomain}
            hideSuffix={branding?.hideLoginNameSuffix}
            submit={submit}
            allowRegister={!!loginSettings?.allowRegister}
          ></UsernameForm>
        )}

        {loginSettings?.allowExternalIdp && !!identityProviders?.length && (
          <div className="w-full pt-6 pb-4">
            <SignInWithIdp
              identityProviders={identityProviders}
              requestId={requestId}
              organization={organization}
              postErrorRedirectUrl="/loginname"
              loginHint={idpLoginHint}
              showLabel={loginSettings?.allowLocalAuthentication}
            ></SignInWithIdp>
          </div>
        )}
      </div>
    </DynamicTheme>
  );
}
