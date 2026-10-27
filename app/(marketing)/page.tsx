import { Answers } from "@/components/landing/answers";
import { Features } from "@/components/landing/features";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Reveal } from "@/components/landing/reveal";

import { SiteNav } from "@/components/landing/site-nav";
import { Start } from "@/components/landing/start";

/*
 * The public page. Direction: "The product performs" (design-taste-frontend, seed 1238480833).
 *
 * The idea: on this page, the product's own audit control becomes the argument. Every claim is
 * proved by a working fragment of the real interface rather than described, so the hero's margin
 * control is live, the three steps change one real fragment, and each module is shown by the
 * components the dashboard itself renders.
 *
 * Section order as dealt: hero -> how-it-works -> features -> proof (swapped to the FAQ geometry,
 * because there are no customers and inventing proof is forbidden) -> cta -> footer.
 */
export default function LandingPage() {
  return (
    <>
      <Reveal />
      <SiteNav />
      <main id="utama">
        <Hero />
        <HowItWorks />
        <Features />
        <Answers />
        <Start />
      </main>
    </>
  );
}
