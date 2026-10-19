import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/og-metadata";
import PaymentPageClient from "./PaymentPageClient";

interface PaymentPageProps {
  params: Promise<{ username: string; amount: string }>;
  searchParams: Promise<{ asset?: string }>;
}

export async function generateMetadata({
  params,
  searchParams,
}: PaymentPageProps): Promise<Metadata> {
  const [{ username, amount }, { asset: requestedAsset }] = await Promise.all([
    params,
    searchParams,
  ]);
  const safeUsername = username.replace(/[^\w-]/g, "").slice(0, 64);
  const safeAmount = amount.replace(/[^\d.]/g, "").slice(0, 32);
  const asset = requestedAsset?.replace(/[^a-z\d]/gi, "").slice(0, 12).toUpperCase() || "XLM";
  const title = `Send ${safeAmount} ${asset} to ${safeUsername} via QuickEx`;
  const description = "Click to pay instantly on the Stellar network. No sign-up required.";
  const siteUrl = getSiteUrl();
  const imageParams = new URLSearchParams({
    username: safeUsername,
    amount: safeAmount,
    asset,
    state: "ACTIVE",
  });
  const imageUrl = `${siteUrl}/api/og/payment-link?${imageParams.toString()}`;

  return {
    title,
    description,
    alternates: { canonical: `${siteUrl}/${safeUsername}/${safeAmount}` },
    openGraph: {
      type: "website",
      siteName: "QuickEx",
      title,
      description,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default function PaymentPage() {
  return <PaymentPageClient />;
}
