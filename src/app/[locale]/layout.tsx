import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { Toaster } from "react-hot-toast";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
   const { locale } = await params
  console.log('🌍 LocaleLayout locale:', locale)
  const messages = await getMessages({ locale })
  console.log('📦 messages keys:', Object.keys(messages))

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
      <Toaster position="top-right" />
    </NextIntlClientProvider>
  );
}