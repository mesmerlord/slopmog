import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import Seo from "@/components/Seo";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { ALTERNATIVES } from "@/lib/constants";

export default function AlternativesIndex() {
  return (
    <>
      <Seo
        title="Reddit Marketing Tool Alternatives | SlopMog"
        description="Compare SlopMog to popular Reddit marketing tools. Honest, side-by-side breakdowns with real pricing and features. No corporate fluff."
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Reddit Marketing Tool Alternatives",
          description:
            "Compare SlopMog to popular Reddit marketing and AI recommendation tools.",
        }}
      />

      <Nav variant="app" />

      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden pt-24 pb-16 md:pt-32 md:pb-20 px-4 md:px-6">
        <div className="max-w-[1140px] mx-auto text-center">
          <span className="inline-block text-xs font-bold uppercase tracking-[1.5px] text-teal mb-4">
            Alternatives
          </span>
          <h1 className="font-heading font-bold text-3xl md:text-5xl text-charcoal mb-5 leading-tight">
            SlopMog vs. The Others
          </h1>
          <p className="text-base md:text-lg text-charcoal-light max-w-[600px] mx-auto leading-relaxed">
            Honest comparisons with other Reddit marketing tools. We
            highlight what they do well, what we do better, and let you
            decide. No trash talk, no corporate spin.
          </p>
        </div>
      </section>

      {/* ═══ ALTERNATIVES GRID ═══ */}
      <section className="pb-20 md:pb-28 px-4 md:px-6">
        <div className="max-w-[1140px] mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ALTERNATIVES.map((alt) => (
              <Link
                key={alt.slug}
                href={alt.url}
                className="group bg-white rounded-brand-lg overflow-hidden shadow-brand-sm border border-charcoal/[0.06] hover:shadow-brand-lg hover:-translate-y-1 transition-all"
              >
                {/* Screenshot */}
                <div className="relative h-48 bg-charcoal/[0.03] overflow-hidden">
                  <Image
                    src={alt.image}
                    alt={`${alt.name} homepage screenshot`}
                    fill
                    className="object-cover object-top group-hover:scale-105 transition-transform duration-500"
                  />
                </div>

                {/* Content */}
                <div className="p-6">
                  <h2 className="font-heading font-bold text-lg text-charcoal mb-2 group-hover:text-teal transition-colors">
                    SlopMog vs {alt.name}
                  </h2>
                  <p className="text-sm text-charcoal-light leading-relaxed mb-4">
                    {alt.description}
                  </p>
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold text-teal group-hover:gap-2.5 transition-all">
                    Read comparison
                    <ArrowRight size={14} />
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {/* More coming soon */}
          {ALTERNATIVES.length < 3 && (
            <div className="mt-12 text-center">
              <div className="inline-block bg-teal-bg rounded-brand px-8 py-6 border border-teal/15">
                <p className="text-sm font-semibold text-charcoal mb-1">
                  More comparisons coming soon
                </p>
                <p className="text-xs text-charcoal-light">
                  We&apos;re writing honest breakdowns of every Reddit
                  marketing tool we can find. Check back or{" "}
                  <Link
                    href="/#cta"
                    className="text-teal font-bold hover:underline"
                  >
                    just try SlopMog
                  </Link>{" "}
                  and skip the research.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </>
  );
}
