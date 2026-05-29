import type { Metadata } from "next";
import { Questrial, Oswald, Saira_Stencil_One } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import "../globals.css";

// Body / UI — Questrial (brand body font).
const questrial = Questrial({
  weight: "400",
  variable: "--font-questrial",
  subsets: ["latin"],
});

// In-app headings — Oswald (clean condensed).
const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
});

// Brand display / wordmark — Saira Stencil One.
const sairaStencil = Saira_Stencil_One({
  weight: "400",
  variable: "--font-saira-stencil",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Adminidor",
  description: "Administration for modern advisory firms",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className={`${questrial.variable} ${oswald.variable} ${sairaStencil.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
