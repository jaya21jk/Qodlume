import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Qodlume | Daily developer challenge",
  description:
    "Sharpen frontend, backend, and engineering fundamentals with daily developer quizzes designed for modern software teams.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "Segoe UI, sans-serif",
          background:
            "radial-gradient(circle at top, #f8fafc 0%, #e2e8f0 35%, #f8fafc 100%)",
          color: "#0f172a",
        }}
      >
        {children}
      </body>
    </html>
  );
}
