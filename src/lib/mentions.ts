interface MentionCandidate {
  userId: string;
  userName?: string;
  userEmail?: string;
}

/**
 * Escapes a string for safe use inside a RegExp.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Returns the display token used to @mention a member in comment text.
 * Prefers the member's name, falling back to the local part of their email.
 */
export function mentionToken(member: MentionCandidate): string {
  const label =
    member.userName?.trim() || member.userEmail?.split("@")[0] || "";
  return `@${label}`;
}

/**
 * Detects which project members are @mentioned in a comment body.
 *
 * A member is considered mentioned when their `@<name>` token appears in the
 * body (case-insensitive), bounded by non-word characters so it isn't matched
 * inside a larger token (e.g. an email like "bob@anna.com"). This keeps the
 * source of truth in the text itself: deleting the token from the composer
 * removes the mention.
 *
 * Members are matched longest token first and each match masks the span it
 * consumed, so a shorter name that is a prefix of a longer one (e.g. "@John"
 * inside "@John Smith") is not also counted. Returns a unique list of userIds.
 */
export function extractMentions(
  body: string,
  members: MentionCandidate[],
): string[] {
  if (!body) return [];

  const sorted = [...members].sort(
    (a, b) => mentionToken(b).length - mentionToken(a).length,
  );

  // Consume matched spans so a shorter, already-covered token can't re-match.
  let remaining = body;
  const seen = new Set<string>();
  for (const member of sorted) {
    const token = mentionToken(member);
    if (token === "@") continue;
    const pattern = new RegExp(
      "(?<![\\w@])" + escapeRegExp(token) + "(?![\\w])",
      "gi",
    );
    let matched = false;
    remaining = remaining.replace(pattern, (m) => {
      matched = true;
      return " ".repeat(m.length);
    });
    if (matched) seen.add(member.userId);
  }
  return [...seen];
}
