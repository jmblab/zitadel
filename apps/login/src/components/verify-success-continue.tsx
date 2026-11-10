"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ButtonVariants } from "./button";

type Props = {
  continueUrl: string;
};

export function VerifySuccessContinue({ continueUrl }: Props) {
  const router = useRouter();
  const t = useTranslations("verify");
  const [loading, setLoading] = useState(false);

  return (
    <div className="mt-8 flex w-full flex-row items-center justify-end">
      <Button
        type="button"
        variant={ButtonVariants.Primary}
        disabled={loading}
        onClick={() => {
          setLoading(true);
          router.push(continueUrl);
        }}
        data-testid="continue-button"
      >
        {t("successContinue")}
      </Button>
    </div>
  );
}
