import { Alert, AlertType } from "@/components/alert";
import { Button, ButtonVariants } from "@/components/button";
import { DynamicTheme } from "@/components/dynamic-theme";
import { Translated } from "@/components/translated";
import { UserAvatar } from "@/components/user-avatar";
import { resolveRedirectUri } from "@/lib/client";
import { isSafeRedirectUri } from "@/lib/client-utils";
import { getOrgRedirectConfig } from "@/lib/org-redirects";
import { getEffectiveOrganizationId } from "@/lib/organization";
import { getServiceConfig } from "@/lib/service-url";
import { loadMostRecentSession, loadSessionById } from "@/lib/session";
import { getBrandingSettings, getLoginSettings } from "@/lib/zitadel";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("signedin");
  return { title: t("title", { user: "" }) };
}

export default async function Page(props: { searchParams: Promise<any> }) {
  const searchParams = await props.searchParams;

  const _headers = await headers();
  const { serviceConfig } = getServiceConfig(_headers);

  const { loginName, requestId, organization, sessionId } = searchParams;

  const sessionFactors = sessionId
    ? await loadSessionById(serviceConfig, sessionId, organization)
    : await loadMostRecentSession({ serviceConfig, sessionParams: { loginName, organization } });

  const effectiveOrgId = await getEffectiveOrganizationId({
    serviceConfig,
    organization: organization || sessionFactors?.factors?.user?.organizationId,
  });
  const branding = await getBrandingSettings({ serviceConfig, organization: effectiveOrgId });
  const loginSettings = await getLoginSettings({ serviceConfig, organization: effectiveOrgId });
  const orgConfig = getOrgRedirectConfig(effectiveOrgId);
  const hasDefault = Boolean(loginSettings?.defaultRedirectUri);
  const hasEnvRedirect = !!process.env.DEFAULT_REDIRECT_URI && isSafeRedirectUri(process.env.DEFAULT_REDIRECT_URI);
  const mayUseOrgConfig = Boolean(!hasEnvRedirect && orgConfig && (orgConfig.overrideDefault || !hasDefault));

  // Auto-redirect if configured and not in device flow
  if (mayUseOrgConfig && orgConfig?.autoRedirect && !(requestId && String(requestId).startsWith("device_"))) {
    const first = orgConfig.links?.[0];
    if (first?.url) {
      redirect(first.url);
    }
  }

  const redirectUri = await resolveRedirectUri(
    requestId && sessionId
      ? { sessionId, requestId, organization: effectiveOrgId }
      : { loginName: loginName ?? sessionFactors?.factors?.user?.loginName, organization: effectiveOrgId },
    loginSettings?.defaultRedirectUri,
  );

  const isSamePage = redirectUri?.startsWith("/signedin") ?? false;

  return (
    <DynamicTheme branding={branding}>
      <div className="flex flex-col space-y-4">
        <h1>
          <Translated i18nKey="title" namespace="signedin" data={{ user: sessionFactors?.factors?.user?.displayName }} />
        </h1>
        <p className="ztdl-p mb-6 block">
          <Translated i18nKey="description" namespace="signedin" />
        </p>

        <UserAvatar
          loginName={loginName ?? sessionFactors?.factors?.user?.loginName}
          displayName={sessionFactors?.factors?.user?.displayName ?? loginName}
          showDropdown={!(requestId && requestId.startsWith("device_"))}
          searchParams={searchParams}
        />
      </div>

      <div className="w-full">
        {requestId && requestId.startsWith("device_") && (
          <Alert type={AlertType.INFO}>
            You can now close this window and return to the device where you started the authorization process to continue.
          </Alert>
        )}

        {redirectUri && !isSamePage && !mayUseOrgConfig && (
          <div className="mt-8 flex w-full flex-row items-center">
            <span className="flex-grow"></span>

            <Link href={redirectUri}>
              <Button type="submit" className="self-end" variant={ButtonVariants.Primary}>
                <Translated i18nKey="continue" namespace="signedin" />
              </Button>
            </Link>
          </div>
        )}

        {/* Org-specific links styled like account list items */}
        {mayUseOrgConfig && orgConfig?.links?.length ? (
          <div className="mt-8 flex w-full flex-col space-y-2">
            {orgConfig.links.map((l, idx) => (
              <a key={`${l.url}-${idx}`} href={l.url}>
                <div className="group border-divider-light bg-background-light-400 dark:bg-background-dark-400 flex flex-row items-center rounded-md border px-4 py-2 transition-all hover:shadow-lg dark:hover:bg-white/10">
                  <div className="mr-4 flex aspect-square h-8 w-8 flex-none shrink-0 items-center justify-center overflow-hidden rounded-full bg-black/5 text-xs font-medium dark:bg-white/5">
                    {l.iconUrl || l.iconDarkUrl ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {l.iconUrl && (
                          <img
                            src={l.iconUrl}
                            alt=""
                            className={`h-full w-full object-cover ${l.iconDarkUrl ? "block dark:hidden" : ""}`}
                          />
                        )}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {l.iconDarkUrl && (
                          <img
                            src={l.iconDarkUrl}
                            alt=""
                            className={`h-full w-full object-cover ${l.iconUrl ? "hidden dark:block" : ""}`}
                          />
                        )}
                      </>
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-col items-start overflow-hidden">
                    <span className="truncate">{l.label}</span>
                    <span className="truncate text-xs opacity-80">{l.url}</span>
                  </div>
                  <span className="flex-grow"></span>
                </div>
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </DynamicTheme>
  );
}
