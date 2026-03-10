import { Geist } from "next/font/google";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Providers from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

// Defaults used when DB is unavailable or keys are not set
const DEFAULTS = {
  seo_title: "BOXX | Luxury Boutique Boxing & Personal Training Studio in Chiang Mai",
  seo_description: "Chiang Mai's first luxury boutique boxing and personal training studio. UK-qualified coaches delivering authentic British boxing and strength training. Small-group classes, max 6 per session.",
  seo_keywords: "boxing, chiang mai, personal training, boutique gym, luxury fitness, boxing classes, strength training, thailand",
  seo_url: "https://www.boxxthailand.com",
  seo_og_title: "BOXX | Luxury Boutique Boxing Studio in Chiang Mai",
  seo_og_description: "Boxing and strength training, done properly. Small-group classes led by UK-qualified coaches.",
  seo_og_image: "",
};

export async function generateMetadata() {
  let seo = { ...DEFAULTS };

  try {
    if (supabaseAdmin) {
      const { data } = await supabaseAdmin
        .from('studio_settings')
        .select('key, value')
        .in('key', Object.keys(DEFAULTS));

      if (data) {
        for (const row of data) {
          if (row.value) seo[row.key] = row.value;
        }
      }
    }
  } catch (e) {
    console.error('[layout] Failed to load SEO settings:', e);
  }

  const keywords = seo.seo_keywords
    ? seo.seo_keywords.split(',').map((k) => k.trim()).filter(Boolean)
    : [];

  const baseUrl = seo.seo_url || DEFAULTS.seo_url;

  return {
    metadataBase: new URL(baseUrl),
    title: seo.seo_title,
    description: seo.seo_description,
    keywords,
    openGraph: {
      title: seo.seo_og_title || seo.seo_title,
      description: seo.seo_og_description || seo.seo_description,
      type: "website",
      locale: "en_US",
      url: baseUrl,
      siteName: "BOXX Boxing Studio",
      ...(seo.seo_og_image ? { images: [{ url: seo.seo_og_image }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: seo.seo_og_title || seo.seo_title,
      description: seo.seo_og_description || seo.seo_description,
      ...(seo.seo_og_image ? { images: [seo.seo_og_image] } : {}),
    },
  };
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
