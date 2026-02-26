import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import LogoBlob from "@/components/LogoBlob";
import { routes } from "@/lib/constants";

type NavVariant = "landing" | "app";

interface NavProps {
  variant?: NavVariant;
  /** For landing page: smooth-scroll to section by id */
  onScrollTo?: (id: string) => void;
}

export default function Nav({ variant = "app", onScrollTo }: NavProps) {
  const { data: session } = useSession();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Track previous value to avoid unnecessary re-renders
  const scrolledRef = useRef(false);

  const handleScroll = useCallback(() => {
    const scrolled = window.scrollY > 20;
    if (scrolledRef.current !== scrolled) {
      scrolledRef.current = scrolled;
      setNavScrolled(scrolled);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const isLanding = variant === "landing";

  // Stabilize handleNavClick — only depends on onScrollTo
  const handleNavClick = useCallback(
    (id: string) => (e: React.MouseEvent) => {
      e.preventDefault();
      setMobileNavOpen(false);
      if (onScrollTo) onScrollTo(id);
    },
    [onScrollTo],
  );

  // Memoize navLinks so children don't re-render on every parent render
  const navLinks = useMemo(
    (): { label: string; href: string; onClick?: (e: React.MouseEvent) => void }[] =>
      isLanding
        ? [
            { label: "How It Works", href: "#how", onClick: handleNavClick("how") },
            { label: "Demo", href: "#demo", onClick: handleNavClick("demo") },
            { label: "Pricing", href: "#pricing", onClick: handleNavClick("pricing") },
            { label: "FAQ", href: "#faq", onClick: handleNavClick("faq") },
          ]
        : [
            { label: "Dashboard", href: routes.dashboard.index },
            { label: "Free Tools", href: routes.tools.redditCommentGenerator },
            { label: "Pricing", href: routes.pricing },
          ],
    [isLanding, handleNavClick],
  );

  return (
    <nav className={`fixed top-0 left-0 right-0 z-[1000] bg-bg/[0.92] backdrop-blur-xl border-b border-charcoal/[0.06] transition-shadow duration-300 ${navScrolled ? "shadow-brand-sm" : ""}`}>
      <div className="max-w-[1140px] mx-auto px-4 md:px-6 flex items-center justify-between h-14 md:h-[68px]">
        {isLanding ? (
          <a
            href="#"
            className="font-heading font-bold text-xl md:text-2xl text-charcoal flex items-center gap-2"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <LogoBlob className="w-8 h-8 md:w-10 md:h-10 shrink-0" />
            SlopMog
          </a>
        ) : (
          <Link href="/" className="font-heading font-bold text-xl md:text-2xl text-charcoal flex items-center gap-2">
            <LogoBlob className="w-8 h-8 md:w-10 md:h-10 shrink-0" />
            SlopMog
          </Link>
        )}

        {/* Desktop nav */}
        <ul className="hidden md:flex items-center gap-8 list-none">
          {navLinks.map((link) => (
            <li key={link.label}>
              {link.onClick ? (
                <a
                  href={link.href}
                  className="text-[0.95rem] font-semibold text-charcoal-light hover:text-teal transition-colors"
                  onClick={link.onClick}
                >
                  {link.label}
                </a>
              ) : (
                <Link href={link.href} className="text-[0.95rem] font-semibold text-charcoal-light hover:text-teal transition-colors">
                  {link.label}
                </Link>
              )}
            </li>
          ))}

          {/* Auth-aware right side */}
          {session ? (
            <li className="relative">
              <button
                className="flex items-center gap-2 text-[0.95rem] font-semibold text-charcoal-light hover:text-teal transition-colors"
                onClick={() => setUserMenuOpen((v) => !v)}
              >
                <div className="w-8 h-8 rounded-full bg-teal text-white flex items-center justify-center text-sm font-bold">
                  {session.user.name?.[0]?.toUpperCase() || session.user.email?.[0]?.toUpperCase() || "?"}
                </div>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`transition-transform ${userMenuOpen ? "rotate-180" : ""}`}>
                  <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-[998]" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-brand-sm shadow-brand-md border border-charcoal/[0.08] py-2 z-[999]">
                    <div className="px-4 py-2 text-sm text-charcoal-light border-b border-charcoal/[0.06] truncate">
                      {session.user.email}
                    </div>
                    <Link href={routes.dashboard.index} className="block px-4 py-2 text-sm text-charcoal hover:bg-teal-bg transition-colors" onClick={() => setUserMenuOpen(false)}>
                      Dashboard
                    </Link>
                    <button
                      className="block w-full text-left px-4 py-2 text-sm text-coral hover:bg-coral/5 transition-colors"
                      onClick={() => signOut({ callbackUrl: "/" })}
                    >
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </li>
          ) : (
            <li>
              <Link
                href={routes.auth.login}
                className="bg-coral text-white px-6 py-2.5 rounded-full font-bold text-sm hover:bg-coral-dark hover:-translate-y-0.5 hover:shadow-lg transition-all"
              >
                Get Started
              </Link>
            </li>
          )}
        </ul>

        {/* Mobile hamburger */}
        <button className="flex md:hidden flex-col gap-[5px] bg-transparent p-1" aria-label="Menu" onClick={() => setMobileNavOpen((v) => !v)}>
          <span className={`block w-6 h-[2.5px] bg-charcoal rounded-sm transition-transform duration-300 ${mobileNavOpen ? "translate-y-[7.5px] rotate-45" : ""}`} />
          <span className={`block w-6 h-[2.5px] bg-charcoal rounded-sm transition-opacity duration-300 ${mobileNavOpen ? "opacity-0" : ""}`} />
          <span className={`block w-6 h-[2.5px] bg-charcoal rounded-sm transition-transform duration-300 ${mobileNavOpen ? "-translate-y-[7.5px] -rotate-45" : ""}`} />
        </button>
      </div>

      {/* Mobile menu dropdown */}
      <div className={`md:hidden overflow-hidden transition-all duration-300 bg-bg border-b border-charcoal/[0.06] shadow-brand-md ${mobileNavOpen ? "max-h-80 opacity-100" : "max-h-0 opacity-0 pointer-events-none"}`}>
        <ul className="flex flex-col items-center gap-4 py-6 list-none">
          {navLinks.map((link) => (
            <li key={link.label}>
              {link.onClick ? (
                <a href={link.href} className="text-base font-semibold text-charcoal-light hover:text-teal transition-colors" onClick={link.onClick}>
                  {link.label}
                </a>
              ) : (
                <Link href={link.href} className="text-base font-semibold text-charcoal-light hover:text-teal transition-colors" onClick={() => setMobileNavOpen(false)}>
                  {link.label}
                </Link>
              )}
            </li>
          ))}
          {session ? (
            <li>
              <button
                className="text-base font-semibold text-coral hover:text-coral-dark transition-colors"
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                Sign Out
              </button>
            </li>
          ) : (
            <li>
              <Link
                href={routes.auth.login}
                className="bg-coral text-white px-8 py-2.5 rounded-full font-bold text-sm hover:bg-coral-dark transition-all"
                onClick={() => setMobileNavOpen(false)}
              >
                Get Started
              </Link>
            </li>
          )}
        </ul>
      </div>
    </nav>
  );
}
