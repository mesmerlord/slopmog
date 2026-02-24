import Link from "next/link";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  breadcrumbs?: { label: string; href?: string }[];
}

export default function PageHeader({
  title,
  description,
  action,
  breadcrumbs,
}: PageHeaderProps) {
  return (
    <div className="mb-8">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-sm mb-3">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && (
                <span className="text-charcoal-light">/</span>
              )}
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="text-teal font-semibold hover:text-teal-dark transition-colors"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-charcoal-light font-medium">
                  {crumb.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-charcoal">
            {title}
          </h1>
          {description && (
            <p className="text-charcoal-light mt-1 text-sm md:text-base">
              {description}
            </p>
          )}
        </div>
        {action && (
          <>
            {action.href ? (
              <Link
                href={action.href}
                className="inline-flex items-center justify-center bg-coral text-white px-6 py-2.5 rounded-full font-bold text-sm hover:bg-coral-dark hover:-translate-y-0.5 hover:shadow-lg transition-all shrink-0"
              >
                {action.label}
              </Link>
            ) : (
              <button
                onClick={action.onClick}
                className="inline-flex items-center justify-center bg-coral text-white px-6 py-2.5 rounded-full font-bold text-sm hover:bg-coral-dark hover:-translate-y-0.5 hover:shadow-lg transition-all shrink-0"
              >
                {action.label}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
