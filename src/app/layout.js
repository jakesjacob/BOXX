import { Geist } from "next/font/google";
import Providers from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://zatrovo.com"),
  title: "Zatrovo — Studio Management",
  description: "Studio management platform",
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
