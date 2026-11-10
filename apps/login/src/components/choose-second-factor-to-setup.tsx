"use client";

import { handleServerActionResponse } from "@/lib/client-utils";
import { skipMFAAndContinueWithNextUrl } from "@/lib/server/session";
import { LoginSettings, SecondFactorType } from "@zitadel/proto/zitadel/settings/v2/login_settings_pb";
import { AuthenticationMethodType } from "@zitadel/proto/zitadel/user/v2/user_service_pb";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "./alert";
import { EMAIL, SMS, TOTP, U2F } from "./auth-methods";
import { AutoSubmitForm } from "./auto-submit-form";
import { Translated } from "./translated";

type Props = {
  userId: string;
  loginName?: string;
  sessionId?: string;
  requestId?: string;
  organization?: string;
  loginSettings: LoginSettings;
  userMethods: AuthenticationMethodType[];
  checkAfter: boolean;
  phoneVerified: boolean;
  emailVerified: boolean;
  force: boolean;
};

export function ChooseSecondFactorToSetup({
  userId,
  loginName,
  sessionId,
  requestId,
  organization,
  loginSettings,
  userMethods,
  checkAfter,
  phoneVerified,
  emailVerified,
  force,
}: Props) {
  const router = useRouter();
  const params = new URLSearchParams({});

  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const autoSkipped = useRef(false);
  const [samlData, setSamlData] = useState<{ url: string; fields: Record<string, string> } | null>(null);

  const hasSelectableFactor = loginSettings.secondFactors.some((factor) => {
    switch (factor) {
      case SecondFactorType.OTP:
        return !userMethods.includes(AuthenticationMethodType.TOTP);
      case SecondFactorType.U2F:
        return !userMethods.includes(AuthenticationMethodType.U2F);
      case SecondFactorType.OTP_EMAIL:
        return emailVerified && !userMethods.includes(AuthenticationMethodType.OTP_EMAIL);
      case SecondFactorType.OTP_SMS:
        return phoneVerified && !userMethods.includes(AuthenticationMethodType.OTP_SMS);
      default:
        return false;
    }
  });

  const skip = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await skipMFAAndContinueWithNextUrl({ userId, loginName, sessionId, organization, requestId });
      handleServerActionResponse(response, router, setSamlData, setError, setLoading);
    } catch {
      setError("Could not skip MFA and continue");
      setLoading(false);
    }
  }, [userId, loginName, sessionId, organization, requestId, router]);

  useEffect(() => {
    if (!force && !hasSelectableFactor && !autoSkipped.current) {
      autoSkipped.current = true;
      void skip();
    }
  }, [force, hasSelectableFactor, skip]);

  if (loginName) {
    params.append("loginName", loginName);
  }
  if (sessionId) {
    params.append("sessionId", sessionId);
  }
  if (requestId) {
    params.append("requestId", requestId);
  }
  if (organization) {
    params.append("organization", organization);
  }
  if (checkAfter) {
    params.append("checkAfter", "true");
  }

  return (
    <>
      {samlData && <AutoSubmitForm url={samlData.url} fields={samlData.fields} />}
      <div className="grid w-full grid-cols-1 gap-5 pt-4">
        {loginSettings.secondFactors.map((factor) => {
          switch (factor) {
            case SecondFactorType.OTP:
              return TOTP(userMethods.includes(AuthenticationMethodType.TOTP), "/otp/time-based/set?" + params);
            case SecondFactorType.U2F:
              return U2F(userMethods.includes(AuthenticationMethodType.U2F), "/u2f/set?" + params);
            case SecondFactorType.OTP_EMAIL:
              return (
                emailVerified && EMAIL(userMethods.includes(AuthenticationMethodType.OTP_EMAIL), "/otp/email/set?" + params)
              );
            case SecondFactorType.OTP_SMS:
              return phoneVerified && SMS(userMethods.includes(AuthenticationMethodType.OTP_SMS), "/otp/sms/set?" + params);
            default:
              return null;
          }
        })}
      </div>
      {!force && (
        <button
          disabled={loading}
          aria-busy={loading}
          className="hover:text-primary-light-500 dark:hover:text-primary-dark-500 text-sm transition-all"
          onClick={() => {
            if (!loading) void skip();
          }}
          type="button"
          data-testid="reset-button"
        >
          <Translated i18nKey="set.skip" namespace="mfa" />
        </button>
      )}
      {error && (
        <div className="py-4" data-testid="error">
          <Alert>{error}</Alert>
        </div>
      )}
    </>
  );
}
