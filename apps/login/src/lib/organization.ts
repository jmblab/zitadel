import { getDefaultOrg, ServiceConfig } from "@/lib/zitadel";
import { Organization } from "@zitadel/proto/zitadel/org/v2/org_pb";

export async function getEffectiveOrganizationId({
  serviceConfig,
  organization,
}: {
  serviceConfig: ServiceConfig;
  organization?: string;
}): Promise<string | undefined> {
  if (organization) {
    return organization;
  }

  if (process.env.DEFAULT_ORGANIZATION_ID) {
    return process.env.DEFAULT_ORGANIZATION_ID;
  }

  const defaultOrg: Organization | null = await getDefaultOrg({ serviceConfig });
  return defaultOrg?.id;
}
