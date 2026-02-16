import { HeroSection } from "@/components/marketing/hero-section";
import { BetaNotice } from "@/components/marketing/beta-notice";
import { FeaturesSection } from "@/components/marketing/features-section";
import { CtaSection } from "@/components/marketing/cta-section";

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <BetaNotice />
      <FeaturesSection />
      <CtaSection />
    </>
  );
}
