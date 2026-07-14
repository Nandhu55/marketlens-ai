import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MarketLens AI — Intelligent Stock Analytics",
  description: "AI-Powered Stock Volatility Prediction Using LSTM and Financial News Sentiment Analysis. Professional-grade market analytics dashboard.",
  keywords: ["MarketLens AI", "Stock Prediction", "LSTM", "FinBERT", "Volatility", "AI Analytics"],
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📈</text></svg>",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#0a0e1a] text-slate-200 overflow-x-hidden`}
      >
        <TooltipProvider delayDuration={0}>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: 'rgba(15, 23, 42, 0.95)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                color: '#e2e8f0',
                backdropFilter: 'blur(12px)',
              },
            }}
          />
        </TooltipProvider>
      </body>
    </html>
  );
}