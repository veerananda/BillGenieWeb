import { Link } from 'react-router-dom';
import { LegalPage } from '../components/LegalPage';

export function TermsOfService() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your use of BillGenie, including the
        website at <a href="https://thebillgenie.com">thebillgenie.com</a> and our mobile and web
        applications. By creating an account or using BillGenie, you agree to these Terms.
      </p>

      <h2>Service description</h2>
      <p>
        BillGenie provides restaurant management software including billing, order management,
        kitchen display, team management, and related features on a subscription basis.
      </p>

      <h2>Accounts</h2>
      <ul>
        <li>You must provide accurate registration information and keep credentials secure.</li>
        <li>You are responsible for activity under your restaurant account.</li>
        <li>Admin and manager roles may manage billing and staff; assign roles carefully.</li>
      </ul>

      <h2>Subscriptions and payments</h2>
      <ul>
        <li>
          Paid plans are billed monthly or annually as selected. Prices are shown before payment and
          may include applicable GST.
        </li>
        <li>
          Payments are processed by Razorpay. By subscribing, you also agree to Razorpay&apos;s
          terms where applicable.
        </li>
        <li>
          Free trials, where offered, convert to paid plans unless cancelled before the trial ends.
        </li>
        <li>
          Failure to pay may result in restricted access to features until payment is completed.
        </li>
      </ul>

      <h2>Refunds and cancellations</h2>
      <p>
        Subscription fees are generally non-refundable except where required by law or explicitly
        stated at purchase. To cancel renewal, contact us before your next billing date. Access
        continues until the end of the paid period.
      </p>

      <h2>Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use BillGenie for unlawful purposes or to process fraudulent transactions</li>
        <li>Attempt to access other restaurants&apos; data or disrupt the service</li>
        <li>Reverse engineer, scrape, or resell the service without permission</li>
        <li>Upload malicious code or content that infringes others&apos; rights</li>
      </ul>

      <h2>Your data</h2>
      <p>
        You retain ownership of the business data you enter. You grant us a license to host, process,
        and display that data solely to provide the service. See our{' '}
        <Link to="/privacy">Privacy Policy</Link> for details.
      </p>

      <h2>Availability and support</h2>
      <p>
        We aim for reliable uptime but do not guarantee uninterrupted service. Maintenance, updates,
        or factors outside our control may cause temporary downtime. Support is available via email
        at <a href="mailto:hello@thebillgenie.com">hello@thebillgenie.com</a>.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, BillGenie is provided &quot;as is&quot;. We are not
        liable for indirect, incidental, or consequential damages, or for loss of profits or data
        arising from use of the service. Our total liability is limited to the fees you paid in the
        twelve months before the claim.
      </p>

      <h2>Termination</h2>
      <p>
        You may stop using BillGenie at any time. We may suspend or terminate accounts that violate
        these Terms or pose a security risk. Upon termination, your right to use the service ends.
      </p>

      <h2>Governing law</h2>
      <p>
        These Terms are governed by the laws of India. Disputes shall be subject to the courts of
        competent jurisdiction in India.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these Terms. Material changes will be posted on this page. Continued use after
        changes constitutes acceptance.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these Terms:{' '}
        <a href="mailto:hello@thebillgenie.com">hello@thebillgenie.com</a> or our{' '}
        <Link to="/contact">Contact page</Link>.
      </p>
    </LegalPage>
  );
}
