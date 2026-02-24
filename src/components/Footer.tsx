import Link from "next/link";
import LogoBlob from "@/components/LogoBlob";

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
      <div className="max-w-[1140px] mx-auto flex items-center justify-between flex-wrap gap-4 max-md:flex-col max-md:items-center max-md:text-center max-md:gap-5">
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
            </>
          ) : (
            <>
              <li><Link href="/pricing" className="text-[0.88rem] text-charcoal-light hover:text-teal transition-colors">Pricing</Link></li>
              <li><Link href="/dashboard" className="text-[0.88rem] text-charcoal-light hover:text-teal transition-colors">Dashboard</Link></li>
            </>
          )}
          <li><a href="#" className="text-[0.88rem] text-charcoal-light hover:text-teal transition-colors">Privacy</a></li>
          <li><a href="#" className="text-[0.88rem] text-charcoal-light hover:text-teal transition-colors">Terms</a></li>
        </ul>

        <p className="text-[0.82rem] text-charcoal-light opacity-70 w-full text-center mt-4 max-md:mt-2">&copy; 2025 SlopMog. The name is ridiculous. The results aren&apos;t.</p>
      </div>
    </footer>
  );
}
