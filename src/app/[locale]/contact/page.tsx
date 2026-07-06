import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import ContactForm from "@/components/contact/ContactForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta.contact" });
  return { title: t("title"), description: t("description") };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("contact");

  return (
    <>
      <section className="mwinda-glow">
        <div className="mx-auto max-w-3xl px-4 pb-10 pt-20 text-center sm:px-6">
          <h1 className="font-display text-4xl text-warmwhite sm:text-5xl">
            <span className="text-gradient-light">{t("hero.title")}</span>
          </h1>
          <p className="mt-5 text-ink-muted">{t("hero.subtitle")}</p>
        </div>
      </section>
      <section className="mx-auto max-w-2xl px-4 pb-20 sm:px-6">
        <ContactForm />
      </section>
    </>
  );
}
