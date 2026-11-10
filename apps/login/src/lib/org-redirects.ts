export type OrgRedirectLink = {
  label: string;
  url: string;
  iconUrl?: string;
  iconDarkUrl?: string;
};

export type OrgRedirectConfig = {
  orgId: string;
  /** If true, redirect to the first link when arriving at signed-in (or after flow) */
  autoRedirect?: boolean;
  /** If true, ignore Zitadel's Default Redirect URI and use the first link */
  overrideDefault?: boolean;
  links: OrgRedirectLink[];
};

let cached: OrgRedirectConfig[] | null = null;
let cachedRaw: string | undefined;

// These are administrator-configured website links, not protocol callbacks.
function isWebUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function getOrgRedirects(): OrgRedirectConfig[] {
  const raw = process.env.ORG_REDIRECTS;
  if (cached && raw === cachedRaw) return cached;
  cachedRaw = raw;
  if (!raw) {
    cached = [];
    return cached;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      cached = [];
      return cached;
    }
    cached = parsed
      .map((entry) => {
        const e = entry as Partial<OrgRedirectConfig>;
        if (!e || typeof e !== "object") return undefined;
        if (!e.orgId || !Array.isArray(e.links)) return undefined;
        const links: OrgRedirectLink[] = e.links
          .map((l: any) => {
            if (!l || typeof l !== "object") return undefined;
            if (typeof l.url !== "string" || !isWebUrl(l.url) || typeof l.label !== "string") return undefined;
            const link: OrgRedirectLink = { label: l.label, url: l.url };
            if (typeof l.iconUrl === "string" && isWebUrl(l.iconUrl)) {
              link.iconUrl = l.iconUrl;
            }
            if (typeof l.iconDarkUrl === "string" && isWebUrl(l.iconDarkUrl)) {
              link.iconDarkUrl = l.iconDarkUrl;
            }
            return link;
          })
          .filter(Boolean) as OrgRedirectLink[];

        if (links.length === 0) return undefined;

        return {
          orgId: String(e.orgId),
          autoRedirect: Boolean(e.autoRedirect),
          overrideDefault: Boolean(e.overrideDefault),
          links,
        } as OrgRedirectConfig;
      })
      .filter(Boolean) as OrgRedirectConfig[];
  } catch {
    cached = [];
  }

  return cached;
}

export function getOrgRedirectConfig(organizationId?: string | null): OrgRedirectConfig | undefined {
  if (!organizationId) return undefined;
  const list = getOrgRedirects();
  return list.find((c) => c.orgId === organizationId);
}

export function getPrimaryOrgRedirectUrl(orgConfig?: OrgRedirectConfig): string | undefined {
  if (!orgConfig) return undefined;
  return orgConfig.links?.[0]?.url;
}

export function getOrgFallbackRedirect(
  organization: string | undefined,
  loginName: string | undefined,
  defaultRedirectUri?: string,
): string | undefined {
  const config = getOrgRedirectConfig(organization);
  if (!config || (defaultRedirectUri && !config.overrideDefault)) return undefined;
  if (config.autoRedirect) return getPrimaryOrgRedirectUrl(config);
  const params = new URLSearchParams();
  if (organization) params.set("organization", organization);
  if (loginName) params.set("loginName", loginName);
  return `/signedin?${params}`;
}

export function getOrgIconOrigins(): string[] {
  return Array.from(
    new Set(
      getOrgRedirects().flatMap((config) =>
        config.links.flatMap((link) =>
          [link.iconUrl, link.iconDarkUrl].filter((url): url is string => !!url).map((url) => new URL(url).origin),
        ),
      ),
    ),
  );
}
