import Seo from "@/components/Seo";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

const BRAND = "SlopMog";
const SUPPORT_EMAIL = "support@slopmog.com";

export default function TermsPage() {
  return (
    <>
      <Seo
        title={`Terms of Service - ${BRAND}`}
        description={`Terms of Service for ${BRAND}. Read about account terms, payments, content ownership, and more.`}
      />
      <Nav variant="app" />

      <div className="max-w-[780px] mx-auto px-6 py-12 min-h-[80vh]">
        <h1 className="font-heading text-3xl font-bold text-charcoal text-center mb-2">
          Terms of Service
        </h1>
        <p className="text-center text-sm text-charcoal-light mb-10">
          Last updated: <strong>March 4, 2026</strong>
        </p>

        <div className="space-y-6 text-sm text-charcoal leading-relaxed">
          <p>
            From everyone at {BRAND}, thank you for using our products! Because we
            don&apos;t know every one of our users personally, we have to put in place
            some Terms of Service to help keep the ship afloat.
          </p>

          <p>
            When we say &ldquo;Company&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo; in this
            document, we are referring to {BRAND}. When we say &ldquo;Services&rdquo;, we
            mean any product created and maintained by {BRAND}. When we say
            &ldquo;You&rdquo; or &ldquo;your&rdquo;, we are referring to the people or organizations
            that own an account with one or more of our Services.
          </p>

          <p>
            We may update these Terms of Service in the future. When you use our
            Services, now or in the future, you are agreeing to the latest Terms of
            Service. If you violate any of the terms, we may terminate your account.
          </p>

          <h2 className="font-heading text-xl font-bold text-charcoal pt-4">Account Terms</h2>
          <p>
            You are responsible for maintaining the security of your account and
            password. The Company cannot and will not be liable for any loss or
            damage from your failure to comply with this security obligation.
          </p>
          <p>
            You are responsible for all content posted and activity that occurs
            under your account, including comments generated and published through
            our Services.
          </p>
          <p>
            You must be a human. Accounts registered by &ldquo;bots&rdquo; or other automated
            methods are not permitted.
          </p>

          <h2 className="font-heading text-xl font-bold text-charcoal pt-4">Services Description</h2>
          <p>
            {BRAND} provides tools to discover relevant online conversations and
            generate contextual comments that mention your brand. Comments are
            generated using AI and require your review and approval before
            publishing. You are ultimately responsible for all content published
            through your account.
          </p>

          <h2 className="font-heading text-xl font-bold text-charcoal pt-4">Acceptable Use</h2>
          <p>
            You agree not to use our Services to:
          </p>
          <ul className="list-disc pl-6 space-y-1.5">
            <li>Violate the terms of service of any third-party platform (e.g. Reddit, YouTube)</li>
            <li>Post misleading, deceptive, or fraudulent content</li>
            <li>Spam, harass, or engage in abusive behavior</li>
            <li>Promote illegal products, services, or activities</li>
            <li>Impersonate another person or entity</li>
          </ul>
          <p>
            We reserve the right to suspend or terminate accounts that violate
            these terms at our sole discretion.
          </p>

          <h2 className="font-heading text-xl font-bold text-charcoal pt-4">Payments</h2>
          <p>
            Some functionalities of the Service require a paid subscription or
            credit purchase. Payment is processed through Stripe. We do not have
            access to and do not store your full payment information.
          </p>
          <p>
            Subscriptions renew automatically unless cancelled before the renewal
            date. Refunds are handled on a case-by-case basis &mdash; contact us if
            you have concerns.
          </p>

          <h2 className="font-heading text-xl font-bold text-charcoal pt-4">Modifications to the Service</h2>
          <p>
            We reserve the right at any time to modify or discontinue, temporarily
            or permanently, any part of our Services with or without notice.
          </p>

          <h2 className="font-heading text-xl font-bold text-charcoal pt-4">Uptime, Security, and Privacy</h2>
          <p>
            Your use of the Services is at your sole risk. We provide these
            Services on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis.
          </p>
          <p>
            We take many measures to protect and secure your data through backups,
            redundancies, and encryption. When you use our Services, you entrust
            us with your data. We take that trust to heart. You agree that {BRAND} may
            process your data as described in our Privacy Policy and for no other
            purpose.
          </p>

          <h2 className="font-heading text-xl font-bold text-charcoal pt-4">Content Ownership</h2>
          <p>
            You retain all rights to the content and brand information you provide
            to the Services. We claim no intellectual property rights over your
            materials.
          </p>
          <p>
            Comments generated by our AI tools are provided for your use. Once
            published, you are responsible for the content as if you had written it
            yourself.
          </p>

          <h2 className="font-heading text-xl font-bold text-charcoal pt-4">Features and Bugs</h2>
          <p>
            We design our Services with care, based on our own experience and the
            experiences of customers who share their time and feedback. However,
            there is no such thing as a service that pleases everybody. We make no
            guarantees that our Services will meet your specific requirements or
            expectations.
          </p>

          <h2 className="font-heading text-xl font-bold text-charcoal pt-4">Liability</h2>
          <p>
            You expressly understand and agree that the Company shall not be
            liable, in law or in equity, to you or to any third party for any
            direct, indirect, incidental, lost profits, special, consequential,
            punitive or exemplary damages, including but not limited to damages
            resulting from content posted through our Services.
          </p>

          <p className="pt-4 text-charcoal-light">
            If you have a question about any of the Terms of Service, please
            contact us at{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-teal hover:underline">
              {SUPPORT_EMAIL}
            </a>.
          </p>
        </div>
      </div>

      <Footer />
    </>
  );
}
