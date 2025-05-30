import type { Metadata } from "next";
import { B612_Mono, Noto_Serif } from "next/font/google";
import "./globals.css";
import { combineClasses } from "./logic/util";

const notoSerif = Noto_Serif({
  variable: "--font-noto-serif",
  subsets: ["latin"],
});

const mono = B612_Mono({
  variable: "--font-b12-mono",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Typesetter",
  description: "Giving a new meaning to font weight",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={combineClasses(notoSerif.variable, mono.variable)}>
        {children}
      </body>
    </html>
  );
}
