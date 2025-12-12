export default function TermsPage() {
  return (
    <div className="container mx-auto max-w-4xl py-10 space-y-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Legal</p>
        <h1 className="text-3xl font-bold">Terms &amp; Conditions</h1>
        <p className="text-muted-foreground">
          Rules for using PalettaHub.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Acceptance</h2>
        <p className="text-muted-foreground">
          By accessing or using PalettaHub, you agree to these Terms. If you use the service on behalf
          of a company, you confirm you have authority to bind that company.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Accounts &amp; Access</h2>
        <p className="text-muted-foreground">
          You must keep credentials confidential. Roles determine access (e.g., Admin, Manager,
          Receiver, Packer). Do not share accounts. Administrators may suspend or revoke access.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Acceptable Use</h2>
        <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
          <li>Use the system only for lawful warehouse and logistics operations.</li>
          <li>Do not attempt to bypass security, rate limits, or access controls.</li>
          <li>Do not upload malicious code or interfere with system stability.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Data &amp; Privacy</h2>
        <p className="text-muted-foreground">
          Operational data (inventory lots, orders, production runs, audit logs) is stored to support
          traceability. Personal data is handled per our Privacy Policy.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Availability &amp; Changes</h2>
        <p className="text-muted-foreground">
          We aim for high availability but do not guarantee uninterrupted service. Features may
          change; we may suspend service to address security or operational issues.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Disclaimers</h2>
        <p className="text-muted-foreground">
          PalettaHub is provided “as is” without warranties of fitness for a particular purpose. Users
          are responsible for validating operational outputs (e.g., labels, lot allocations).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Liability</h2>
        <p className="text-muted-foreground">
          To the maximum extent permitted by law, liability is limited to the amounts paid for the
          service in the prior 12 months. We are not liable for indirect or consequential damages.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Termination</h2>
        <p className="text-muted-foreground">
          We may suspend or terminate access for violations of these Terms or to protect security.
          Upon termination, access ends but operational records may be retained for compliance.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Governing Law</h2>
        <p className="text-muted-foreground">
          These Terms are governed by the laws applicable where the service is operated unless
          otherwise required by mandatory local law.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Changes to Terms</h2>
        <p className="text-muted-foreground">
          We may update these Terms. Continued use after changes means you accept the updated Terms.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Contact</h2>
        <p className="text-muted-foreground">
          For questions about these Terms, contact support@yourcompany.com.
        </p>
      </section>
    </div>
  )
}


