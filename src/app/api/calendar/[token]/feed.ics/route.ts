import { connectDB } from "@/lib/db";
import { User } from "@/models/user";
import { Task } from "@/models/task";
import { buildCalendar, type IcsEvent } from "@/lib/ics";

/**
 * Public, unauthenticated iCal feed.
 *
 * External calendar clients (Apple/Google/Outlook) cannot send session cookies,
 * so this route authenticates via the high-entropy secret token embedded in the
 * URL — the same model as Google Calendar's "secret address". The route is
 * allowlisted in `src/proxy.ts` so the Auth.js middleware does not redirect it.
 *
 * Data exposed: only the user's OWN tasks (owner `userId`) that have a due date
 * and are not archived. We use owner rather than assignee so the feed never
 * leaks tasks the user merely collaborates on into a URL they may share loosely.
 * The feed reveals task titles and due dates — no more than the user already
 * sees, and less than the app UI (no descriptions/priority are included).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  // Reject obviously-malformed tokens before touching the DB (also keeps the
  // lookup keyed to exactly the 64-hex-char shape we generate).
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return new Response("Not found", { status: 404 });
  }

  await connectDB();

  const user = await User.findOne({ calendarFeedToken: token })
    .select("_id")
    .lean();
  if (!user) {
    return new Response("Not found", { status: 404 });
  }

  const tasks = await Task.find({
    userId: user._id,
    archived: false,
    dueDate: { $ne: null },
  })
    .select("_id title dueDate")
    .lean();

  const events: IcsEvent[] = tasks
    .filter((t): t is typeof t & { dueDate: Date } => t.dueDate != null)
    .map((t) => ({
      uid: `${t._id.toString()}@pillar`,
      start: new Date(t.dueDate),
      summary: t.title,
    }));

  const body = buildCalendar(events);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="pillar.ics"',
      // Feeds are polled frequently; allow brief caching but keep it private.
      "Cache-Control": "private, max-age=300",
    },
  });
}
