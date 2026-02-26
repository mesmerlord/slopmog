import Link from "next/link";
import LogoBlob from "@/components/LogoBlob";
import { ALTERNATIVES, routes } from "@/lib/constants";

interface FooterProps {
  /** For landing page: smooth-scroll to section by id */
  onScrollTo?: (id: string) => void;
}

export default function Footer({ onScrollTo }: FooterProps) {
  const isLanding = !!onScrollTo;

  const handleClick = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (onScrollTo) onScrollTo(id);
  };

  return (
    <footer className="py-12 px-6 max-md:py-9 max-md:px-4 border-t border-charcoal/[0.06]">
      <div className="max-w-[1140px] mx-auto">
        {/* Main footer row */}
        <div className="flex items-center justify-between flex-wrap gap-4 max-md:flex-col max-md:items-center max-md:text-center max-md:gap-5">
          {isLanding ? (
            <a
              href="#"
              className="font-heading font-bold text-[1.15rem] text-charcoal flex items-center gap-2"
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <LogoBlob className="w-7 h-7 shrink-0" />
              SlopMog
            </a>
          ) : (
            <Link href="/" className="font-heading font-bold text-[1.15rem] text-charcoal flex items-center gap-2">
              <LogoBlob className="w-7 h-7 shrink-0" />
              SlopMog
            </Link>
          )}

          <ul className="flex gap-6 max-md:flex-wrap max-md:justify-center max-md:gap-4 list-none">
            {isLanding ? (
              <>
                <li><a href="#how" className="text-[0.88rem] text-charcoal-light hover:text-teal transition-colors" onClick={handleClick("how")}>How It Works</a></li>
                <li><a href="#pricing" className="text-[0.88rem] text-charcoal-light hover:text-teal transition-colors" onClick={handleClick("pricing")}>Pricing</a></li>
                <li><a href="#faq" className="text-[0.88rem] text-charcoal-light hover:text-teal transition-colors" onClick={handleClick("faq")}>FAQ</a></li>
                <li><Link href={routes.tools.redditCommentGenerator} className="text-[0.88rem] text-charcoal-light hover:text-teal transition-colors">Free Tools</Link></li>
              </>
            ) : (
              <>
                <li><Link href="/pricing" className="text-[0.88rem] text-charcoal-light hover:text-teal transition-colors">Pricing</Link></li>
                <li><Link href={routes.tools.redditCommentGenerator} className="text-[0.88rem] text-charcoal-light hover:text-teal transition-colors">Free Tools</Link></li>
                <li><Link href="/dashboard" className="text-[0.88rem] text-charcoal-light hover:text-teal transition-colors">Dashboard</Link></li>
              </>
            )}
            <li><a href="#" className="text-[0.88rem] text-charcoal-light hover:text-teal transition-colors">Privacy</a></li>
            <li><a href="#" className="text-[0.88rem] text-charcoal-light hover:text-teal transition-colors">Terms</a></li>
          </ul>
        </div>

        {/* Compare section */}
        {ALTERNATIVES.length > 0 && (
          <div className="mt-8 pt-8 border-t border-charcoal/[0.06]">
            <div className="flex items-start gap-6 max-md:flex-col max-md:items-center max-md:text-center">
              <div className="shrink-0">
                <h3 className="text-xs font-bold uppercase tracking-[1.5px] text-charcoal-light mb-1">Compare</h3>
              </div>
              <ul className="flex flex-wrap gap-x-5 gap-y-2 list-none max-md:justify-center">
                {ALTERNATIVES.map((alt) => (
                  <li key={alt.slug}>
                    <Link
                      href={alt.url}
                      className="text-[0.82rem] text-charcoal-light hover:text-teal transition-colors"
                    >
                      vs {alt.name}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link
                    href={routes.alternatives.index}
                    className="text-[0.82rem] text-teal font-semibold hover:text-teal-dark transition-colors"
                  >
                    All comparisons
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        )}

        <p className="text-[0.82rem] text-charcoal-light opacity-70 w-full text-center mt-6 max-md:mt-4">&copy; 2025 SlopMog. The name is ridiculous. The results aren&apos;t.</p>
      </div>
    </footer>
  );
}
