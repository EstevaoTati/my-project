import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import LoginForm from "@/components/auth/LoginForm";

function Content() {
  const t = useTranslations("auth");
  return (
    <section className="mwinda-glow">
      <div className="mx-auto max-w-md px-4 py-20 sm:px-6">
        <h1 className="text-center font-display text-3xl text-warmwhite">
          <span className="text-gradient-light">{t("title")}</span>
        </h1>
        <p className="mt-3 text-center text-sm text-ink-muted">{t("subtitle")}</p>
        <div className="mt-8">
          <LoginForm />
        </div>
      </div>
    </section>
  );
}

export default async function ConnexionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Content />;
}
