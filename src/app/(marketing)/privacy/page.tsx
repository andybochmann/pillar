export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:py-20">
      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: February 16, 2026
      </p>

      <div className="mt-10 space-y-10 text-sm leading-relaxed text-muted-foreground [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
        <section>
          <h2>1. Introduction</h2>
          <p>
            Pillar (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;)
            operates the task management application available at
            pillar.bochmann.me. This Privacy Policy explains how we collect,
            use, and protect your information when you use our service.
          </p>
        </section>

        <section>
          <h2>2. Information We Collect</h2>
          <p>We collect the following categories of information:</p>
          <ul>
            <li>
              <strong className="text-foreground">Account data</strong> &mdash;
              name, email address, and profile avatar (via Google OAuth). If you
              register with email and password, we store a bcrypt-hashed version
              of your password. We never store plaintext passwords.
            </li>
            <li>
              <strong className="text-foreground">Task data</strong> &mdash;
              projects, tasks, subtasks, labels, categories, time tracking
              entries, and any other content you create within the app.
            </li>
            <li>
              <strong className="text-foreground">OAuth tokens</strong> &mdash;
              when you sign in with Google, we store the linked account
              identifiers required by the OAuth protocol.
            </li>
            <li>
              <strong className="text-foreground">
                Push notification tokens
              </strong>{" "}
              &mdash; web push subscription endpoints and/or Firebase Cloud
              Messaging device tokens, used solely to deliver notifications you
              have opted into.
            </li>
          </ul>
        </section>

        <section>
          <h2>3. How We Use Your Data</h2>
          <ul>
            <li>To provide and operate the task management service.</li>
            <li>To authenticate your identity and maintain your session.</li>
            <li>
              To send push notifications for task reminders (only when you opt
              in).
            </li>
            <li>
              To enable real-time sync across your devices via server-sent
              events.
            </li>
            <li>
              To support offline mode by caching data locally in your
              browser&rsquo;s IndexedDB.
            </li>
          </ul>
        </section>

        <section>
          <h2>4. Data Storage &amp; Security</h2>
          <ul>
            <li>
              Your data is stored in a MongoDB database on infrastructure we
              control.
            </li>
            <li>
              Passwords are hashed with bcryptjs before storage. API access
              tokens are hashed with SHA-256.
            </li>
            <li>All traffic is served over HTTPS.</li>
            <li>
              Authentication sessions use signed JSON Web Tokens (JWT).
            </li>
          </ul>
        </section>

        <section>
          <h2>5. Third-Party Services</h2>
          <ul>
            <li>
              <strong className="text-foreground">Google OAuth</strong> &mdash;
              used for social sign-in. Google receives standard OAuth data
              during the authentication flow.
            </li>
            <li>
              <strong className="text-foreground">
                Firebase Cloud Messaging
              </strong>{" "}
              &mdash; used to deliver push notifications to Android devices. FCM
              device tokens are sent to Google servers.
            </li>
            <li>
              <strong className="text-foreground">Anthropic Claude</strong>{" "}
              &mdash; used for AI-powered subtask generation. When you use this
              feature, task titles and descriptions are sent to Anthropic&rsquo;s
              API.
            </li>
          </ul>
          <p className="mt-2">
            We do not use any analytics, tracking, or advertising services.
          </p>
        </section>

        <section>
          <h2>6. Data Sharing</h2>
          <p>
            We do not sell, rent, or share your personal information with third
            parties for marketing purposes. Your data may be visible to others
            only in these cases:
          </p>
          <ul>
            <li>
              <strong className="text-foreground">Shared projects</strong>{" "}
              &mdash; when you share a project, invited users can see the tasks
              within that project.
            </li>
            <li>
              <strong className="text-foreground">AI features</strong> &mdash;
              task descriptions are sent to Anthropic when you use the subtask
              generation feature.
            </li>
          </ul>
        </section>

        <section>
          <h2>7. Your Rights</h2>
          <ul>
            <li>
              You can access, export, and manage your data through the app or
              via the MCP API.
            </li>
            <li>
              You can delete your account and all associated data from the
              Settings page. This permanently removes your user record, all
              projects, tasks, labels, categories, access tokens, and push
              subscriptions.
            </li>
          </ul>
        </section>

        <section>
          <h2>8. Cookies &amp; Local Storage</h2>
          <ul>
            <li>
              <strong className="text-foreground">Session cookie</strong>{" "}
              &mdash; a secure, HTTP-only cookie is used to maintain your
              authenticated session.
            </li>
            <li>
              <strong className="text-foreground">Service worker cache</strong>{" "}
              &mdash; static assets are cached locally for offline support.
            </li>
            <li>
              <strong className="text-foreground">IndexedDB</strong> &mdash;
              used to queue offline mutations until connectivity is restored.
            </li>
          </ul>
          <p className="mt-2">We do not use any tracking or advertising cookies.</p>
        </section>

        <section>
          <h2>9. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Changes will
            be reflected by updating the &ldquo;Last updated&rdquo; date at the
            top of this page. Continued use of the service after changes
            constitutes acceptance of the updated policy.
          </p>
        </section>

        <section>
          <h2>10. Contact</h2>
          <p>
            If you have questions about this Privacy Policy or your data, please
            reach out via the contact information on our website.
          </p>
        </section>
      </div>
    </div>
  );
}
