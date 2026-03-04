import Seo from "@/components/Seo";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

const BRAND = "SlopMog";
const SITE_URL = "https://slopmog.com";
const SUPPORT_EMAIL = "support@slopmog.com";

export default function PrivacyPage() {
  return (
    <>
      <Seo
        title={`Privacy Policy - ${BRAND}`}
        description={`Privacy Policy for ${BRAND}. Learn how we collect, use, and protect your personal information.`}
      />
      <Nav variant="app" />

      <div className="max-w-[780px] mx-auto px-6 py-12 min-h-[80vh]">
        <h1 className="font-heading text-3xl font-bold text-charcoal text-center mb-2">
          Privacy Policy
        </h1>
        <p className="text-center text-sm text-charcoal-light mb-10">
          Last updated: <strong>March 4, 2026</strong>
        </p>

        <div className="space-y-6 text-sm text-charcoal leading-relaxed">
          <p>
            At {BRAND}, accessible from{" "}
            <a href={SITE_URL} className="text-teal hover:underline">{SITE_URL}</a>,
            one of our main priorities is the privacy of our visitors. This Privacy
            Policy document contains types of information that is collected and
            recorded by {BRAND} and how we use it.
          </p>

          <p>
            If you have additional questions or require more information about our
            Privacy Policy, do not hesitate to contact us at{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-teal hover:underline">
              {SUPPORT_EMAIL}
            </a>.
          </p>

          <p>
            This Privacy Policy applies only to our online activities and is valid
            for visitors to our website with regards to the information that they
            shared and/or collected in {BRAND}. This policy is not applicable to any
            information collected offline or via channels other than this website.
          </p>

          <h2 className="font-heading text-xl font-bold text-charcoal pt-4">Consent</h2>
          <p>
            By using our website, you hereby consent to our Privacy Policy and
            agree to its terms.
          </p>

          <h2 className="font-heading text-xl font-bold text-charcoal pt-4">Information We Collect</h2>
          <p>
            The personal information that you are asked to provide, and the reasons
            why you are asked to provide it, will be made clear to you at the point
            we ask you to provide your personal information.
          </p>
          <p>
            If you contact us directly, we may receive additional information about
            you such as your name, email address, the contents of the message
            and/or attachments you may send us, and any other information you may
            choose to provide.
          </p>
          <p>
            When you register for an account, we may ask for your contact
            information, including items such as name, email address, and company
            or brand details.
          </p>
          <p>
            When you use our Services, we collect information about the sites and
            keywords you configure, the opportunities we discover, and the comments
            generated and published through your account.
          </p>

          <h2 className="font-heading text-xl font-bold text-charcoal pt-4">How We Use Your Information</h2>
          <p>We use the information we collect in various ways, including to:</p>
          <ul className="list-disc pl-6 space-y-1.5">
            <li>Provide, operate, and maintain our Services</li>
            <li>Improve, personalize, and expand our Services</li>
            <li>Understand and analyze how you use our Services</li>
            <li>Develop new products, services, features, and functionality</li>
            <li>Generate relevant comments on your behalf based on your brand information</li>
            <li>Communicate with you for customer service, updates, and marketing purposes</li>
            <li>Process payments and manage subscriptions</li>
            <li>Find and prevent fraud</li>
          </ul>

          <h2 className="font-heading text-xl font-bold text-charcoal pt-4">Log Files</h2>
          <p>
            {BRAND} follows a standard procedure of using log files. These files log
            visitors when they visit websites. The information collected by log
            files includes internet protocol (IP) addresses, browser type, Internet
            Service Provider (ISP), date and time stamp, referring/exit pages, and
            possibly the number of clicks. These are not linked to any information
            that is personally identifiable. The purpose of the information is for
            analyzing trends, administering the site, and gathering demographic
            information.
          </p>

          <h2 className="font-heading text-xl font-bold text-charcoal pt-4">Cookies</h2>
          <p>
            Like any other website, {BRAND} uses cookies. These cookies are used to
            store information including visitors&apos; preferences, authentication
            session tokens, and the pages on the website that the visitor accessed
            or visited. The information is used to optimize the users&apos; experience
            and to keep you logged in.
          </p>

          <h2 className="font-heading text-xl font-bold text-charcoal pt-4">Third-Party Services</h2>
          <p>
            We use the following third-party services that may collect information:
          </p>
          <ul className="list-disc pl-6 space-y-1.5">
            <li>
              <strong>Stripe</strong> &mdash; for payment processing.{" "}
              <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-teal hover:underline">
                Stripe Privacy Policy
              </a>
            </li>
            <li>
              <strong>NextAuth / Authentication providers</strong> &mdash; for account
              authentication via Google or email
            </li>
          </ul>
          <p>
            Note that {BRAND} has no access to or control over cookies that are used
            by third-party services.
          </p>

          <h2 className="font-heading text-xl font-bold text-charcoal pt-4">CCPA Privacy Rights</h2>
          <p>
            Under the CCPA, among other rights, California consumers have the
            right to:
          </p>
          <ul className="list-disc pl-6 space-y-1.5">
            <li>Request that a business disclose the categories and specific pieces of personal data collected about them</li>
            <li>Request that a business delete any personal data collected about them</li>
            <li>Request that a business that sells personal data not sell their data</li>
          </ul>
          <p>
            If you make a request, we have one month to respond to you. If you
            would like to exercise any of these rights, please contact us.
          </p>

          <h2 className="font-heading text-xl font-bold text-charcoal pt-4">GDPR Data Protection Rights</h2>
          <p>
            We would like to make sure you are fully aware of all of your data
            protection rights. Every user is entitled to the following:
          </p>
          <ul className="list-disc pl-6 space-y-1.5">
            <li><strong>The right to access</strong> &mdash; You have the right to request copies of your personal data.</li>
            <li><strong>The right to rectification</strong> &mdash; You have the right to request that we correct any information you believe is inaccurate or complete information you believe is incomplete.</li>
            <li><strong>The right to erasure</strong> &mdash; You have the right to request that we erase your personal data, under certain conditions.</li>
            <li><strong>The right to restrict processing</strong> &mdash; You have the right to request that we restrict the processing of your personal data, under certain conditions.</li>
            <li><strong>The right to object to processing</strong> &mdash; You have the right to object to our processing of your personal data, under certain conditions.</li>
            <li><strong>The right to data portability</strong> &mdash; You have the right to request that we transfer the data we have collected to another organization, or directly to you, under certain conditions.</li>
          </ul>
          <p>
            If you make a request, we have one month to respond to you. If you
            would like to exercise any of these rights, please contact us at{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-teal hover:underline">
              {SUPPORT_EMAIL}
            </a>.
          </p>

          <h2 className="font-heading text-xl font-bold text-charcoal pt-4">Children&apos;s Information</h2>
          <p>
            Another part of our priority is adding protection for children while
            using the internet. We encourage parents and guardians to observe,
            participate in, and/or monitor and guide their online activity.
          </p>
          <p>
            {BRAND} does not knowingly collect any Personal Identifiable Information
            from children under the age of 13. If you think that your child
            provided this kind of information on our website, we strongly encourage
            you to contact us immediately and we will do our best efforts to
            promptly remove such information from our records.
          </p>
        </div>
      </div>

      <Footer />
    </>
  );
}
