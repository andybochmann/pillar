import { describe, it, expect } from "vitest";
import { extractMentions, mentionToken } from "./mentions";

const members = [
  { userId: "u1", userName: "Alice", userEmail: "alice@example.com" },
  { userId: "u2", userName: "Bob", userEmail: "bob@example.com" },
  { userId: "u3", userName: "Ann", userEmail: "ann@example.com" },
  { userId: "u4", userName: "Anna", userEmail: "anna@example.com" },
  { userId: "u5", userName: "", userEmail: "carol@example.com" },
];

describe("mentionToken", () => {
  it("uses the member name", () => {
    expect(mentionToken(members[0])).toBe("@Alice");
  });

  it("falls back to the email local part when name is empty", () => {
    expect(mentionToken(members[4])).toBe("@carol");
  });
});

describe("extractMentions", () => {
  it("returns an empty array for an empty body", () => {
    expect(extractMentions("", members)).toEqual([]);
  });

  it("detects a single mention", () => {
    expect(extractMentions("hey @Alice look at this", members)).toEqual(["u1"]);
  });

  it("detects multiple mentions", () => {
    const result = extractMentions("@Alice and @Bob please review", members);
    expect(result).toHaveLength(2);
    expect(result).toContain("u1");
    expect(result).toContain("u2");
  });

  it("does not match a shorter name inside a longer one", () => {
    // "@Anna" should match Anna (u4) but not Ann (u3)
    expect(extractMentions("ping @Anna", members)).toEqual(["u4"]);
  });

  it("matches the exact shorter name when followed by a boundary", () => {
    expect(extractMentions("ping @Ann!", members)).toEqual(["u3"]);
  });

  it("is case-insensitive", () => {
    expect(extractMentions("hey @alice", members)).toEqual(["u1"]);
  });

  it("de-duplicates repeated mentions of the same member", () => {
    expect(extractMentions("@Bob @Bob @Bob", members)).toEqual(["u2"]);
  });

  it("ignores tokens that don't match any member", () => {
    expect(extractMentions("hey @Nobody", members)).toEqual([]);
  });

  it("matches email-fallback mention tokens", () => {
    expect(extractMentions("cc @carol", members)).toEqual(["u5"]);
  });

  it("does not match a name embedded in an email address", () => {
    // member "Anna" must not be mentioned by an email that contains "@anna"
    expect(extractMentions("reach bob@anna.com later", members)).toEqual([]);
  });

  it("does not count a shorter name that is a prefix word of a longer member", () => {
    const multi = [
      { userId: "j1", userName: "John", userEmail: "john@example.com" },
      { userId: "j2", userName: "John Smith", userEmail: "js@example.com" },
    ];
    // Only "John Smith" is mentioned, not the unrelated "John"
    expect(extractMentions("hey @John Smith", multi)).toEqual(["j2"]);
  });

  it("counts both when the shorter name is mentioned separately", () => {
    const multi = [
      { userId: "j1", userName: "John", userEmail: "john@example.com" },
      { userId: "j2", userName: "John Smith", userEmail: "js@example.com" },
    ];
    const result = extractMentions("@John and @John Smith", multi);
    expect(result).toHaveLength(2);
    expect(result).toContain("j1");
    expect(result).toContain("j2");
  });
});
