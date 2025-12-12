export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto max-w-4xl py-10 space-y-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Legal</p>
        <h1 className="text-3xl font-bold">Privacy Policy</h1>
        <p className="text-muted-foreground">
          How we collect, use, and protect information in PalettaHub.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Information We Collect</h2>
        <p className="text-muted-foreground">
          We collect account details (name, email, role), authentication logs, and operational data
          generated inside the warehouse (orders, lots, picks, production, audit logs). We do not
          ingest payment data.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">How We Use Information</h2>
        <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
          <li>Authenticate and authorize users based on their assigned role.</li>
          <li>Provide warehouse workflows (receiving, production, picking, traceability).</li>
          <li>Maintain audit logs for compliance and security investigations.</li>
          <li>Send operational emails (password resets, alerts) when configured.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Data Retention</h2>
        <p className="text-muted-foreground">
          Operational data and audit logs are retained to meet traceability requirements. Account
          data is retained while the account is active or as required by policy or law.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Security</h2>
        <p className="text-muted-foreground">
          Access is role-based. Passwords are hashed; sensitive tokens are stored hashed where
          possible. Transport uses TLS. Admins should enable least-privilege roles and rotate
          credentials regularly.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Your Choices</h2>
        <p className="text-muted-foreground">
          You may request account changes or deletion through an administrator. Certain operational
          records may need to be retained for compliance.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Updates</h2>
        <p className="text-muted-foreground">
          We may update this policy. Material changes will be communicated to administrators.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Contact</h2>
        <p className="text-muted-foreground">
          For privacy questions, contact support@yourcompany.com.
        </p>
      </section>
    </div>
  )
}


