import type { Metadata } from "next";
import { Geist } from "next/font/google"; // Fixed package order here
import "./globals.css";
import { VaultProvider } from "../utils/VaultContext"; // Fixed relative path here

const geist = Geist({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SpiderVault",
  description: "Zero-Knowledge Password & ID Manager",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geist.className} antialiased`}>
        <VaultProvider>
          {children}
        </VaultProvider>
      </body>
    </html>
  );
}