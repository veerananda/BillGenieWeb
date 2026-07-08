import { Link } from 'react-router-dom';
import { LegalPage } from '../components/LegalPage';

export function PrivacyPolicy() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        BillGenie (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates the website{' '}
        <a href="https://thebillgenie.com">thebillgenie.com</a> and the BillGenie restaurant
        management application. This Privacy Policy explains how we collect, use, and protect your
        information when you use our services.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Account information:</strong> name, email address, phone number, restaurant name,
          and login credentials you provide during registration.
        </li>
        <li>
          <strong>Business data:</strong> menu items, orders, bills, staff accounts, table
          configuration, and other operational data you enter while using BillGenie.
        </li>
        <li>
          <strong>Payment information:</strong> subscription payments are processed by Razorpay. We
          do not store your card or UPI credentials. We receive payment status, order IDs, and
          transaction references needed to activate your subscription.
        </li>
        <li>
          <strong>Technical data:</strong> device type, browser, IP address, and usage logs used to
          secure the service and fix issues.
        </li>
      </ul>

      <h2>How we use your information</h2>
      <ul>
        <li>Provide, operate, and improve BillGenie features</li>
        <li>Authenticate users and manage restaurant accounts</li>
        <li>Process subscription payments and send account-related emails</li>
        <li>Respond to support requests and security incidents</li>
        <li>Comply with applicable law</li>
      </ul>

      <h2>Data sharing</h2>
      <p>We do not sell your personal information. We may share data with:</p>
      <ul>
        <li>
          <strong>Payment processors</strong> (e.g. Razorpay) to complete subscription payments
        </li>
        <li>
          <strong>Infrastructure providers</strong> that host our application and databases
        </li>
        <li>
          <strong>Authorities</strong> when required by law or to protect our rights and users
        </li>
      </ul>

      <h2>Data retention</h2>
      <p>
        We retain account and business data while your subscription is active and for a reasonable
        period afterward to meet legal, accounting, and support obligations. You may request deletion
        of your account by contacting us.
      </p>

      <h2>Security</h2>
      <p>
        We use industry-standard measures including encrypted connections (HTTPS), access controls,
        and secure authentication. No method of transmission over the internet is 100% secure.
      </p>

      <h2>Your rights</h2>
      <p>
        Depending on applicable law, you may request access, correction, or deletion of your
        personal data. Contact us at{' '}
        <a href="mailto:hello@thebillgenie.com">hello@thebillgenie.com</a> to make a request.
      </p>

      <h2>Children</h2>
      <p>
        BillGenie is a business product for restaurants and is not intended for use by individuals
        under 18 years of age.
      </p>

      <h2>Changes</h2>
      <p>
        We may update this policy from time to time. Continued use of BillGenie after changes are
        posted constitutes acceptance of the updated policy.
      </p>

      <h2>Contact</h2>
      <p>
        For privacy-related questions, email{' '}
        <a href="mailto:hello@thebillgenie.com">hello@thebillgenie.com</a> or visit our{' '}
        <Link to="/contact">Contact page</Link>.
      </p>
    </LegalPage>
  );
}
