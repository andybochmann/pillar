export default function TermsOfServicePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:py-20">
      <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: February 16, 2026
      </p>

      <div className="mt-10 space-y-10 text-sm leading-relaxed text-muted-foreground [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
        <section>
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using Pillar (&ldquo;the Service&rdquo;), you agree
            to be bound by these Terms of Service. If you do not agree, do not
            use the Service.
          </p>
        </section>

        <section>
          <h2>2. Service Description</h2>
          <p>
            Pillar is a Kanban-based task management application that allows you
            to organize projects, manage tasks with drag-and-drop boards, track
            time, collaborate with others, and work offline.
          </p>
        </section>

        <section>
          <h2>3. Account Registration</h2>
          <ul>
            <li>
              You must provide accurate and complete information when creating
              an account.
            </li>
            <li>
              You are responsible for maintaining the security of your account
              credentials.
            </li>
            <li>
              You may register using an email address and password, or through
              Google OAuth.
            </li>
            <li>
              You must be at least 13 years of age to use the Service.
            </li>
          </ul>
        </section>

        <section>
          <h2>4. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the Service for any illegal purpose.</li>
            <li>
              Attempt to gain unauthorized access to the Service or its
              infrastructure.
            </li>
            <li>
              Abuse the API or MCP endpoints (e.g., excessive automated
              requests).
            </li>
            <li>
              Interfere with or disrupt the Service for other users.
            </li>
            <li>Upload malicious content or attempt to exploit vulnerabilities.</li>
          </ul>
        </section>

        <section>
          <h2>5. User Content</h2>
          <ul>
            <li>
              You retain ownership of all content you create within the Service
              (projects, tasks, labels, etc.).
            </li>
            <li>
              You grant us a limited license to store, process, and display your
              content as necessary to provide the Service.
            </li>
            <li>
              When you share a project, other invited members can view and
              modify the tasks within that project according to their assigned
              role.
            </li>
          </ul>
        </section>

        <section>
          <h2>6. AI Features</h2>
          <p>
            Pillar offers optional AI-powered subtask generation using Anthropic
            Claude. When you use this feature, task information is sent to
            Anthropic&rsquo;s API for processing. AI-generated suggestions are
            provided as-is and should be reviewed before use. You are
            responsible for the content you accept and add to your projects.
          </p>
        </section>

        <section>
          <h2>7. Service Availability</h2>
          <p>
            The Service is provided &ldquo;as is&rdquo; and &ldquo;as
            available.&rdquo; We do not guarantee uninterrupted access. The
            Service includes offline support via a progressive web app (PWA), so
            you can continue working during outages. Offline changes sync
            automatically when connectivity is restored.
          </p>
        </section>

        <section>
          <h2>8. Account Termination</h2>
          <ul>
            <li>
              You may delete your account at any time from the Settings page.
              Deleting your account permanently removes all your data, including
              projects, tasks, labels, categories, access tokens, and push
              subscriptions.
            </li>
            <li>
              We reserve the right to suspend or terminate accounts that violate
              these Terms.
            </li>
          </ul>
        </section>

        <section>
          <h2>9. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, Pillar and its operators
            shall not be liable for any indirect, incidental, special, or
            consequential damages arising from your use of the Service. Our
            total liability shall not exceed the amount you have paid us in the
            twelve months preceding the claim (if any).
          </p>
        </section>

        <section>
          <h2>10. Changes to These Terms</h2>
          <p>
            We may update these Terms from time to time. Changes will be
            reflected by updating the &ldquo;Last updated&rdquo; date at the
            top of this page. Continued use of the Service after changes
            constitutes acceptance of the updated Terms.
          </p>
        </section>
      </div>
    </div>
  );
}
