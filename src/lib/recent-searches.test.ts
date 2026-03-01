import { describe, it, expect, beforeEach } from "vitest";
import {
  getRecentSearches,
  addRecentSearch,
  clearRecentSearches,
  RECENT_SEARCHES_KEY,
  MAX_RECENT_SEARCHES,
} from "./recent-searches";

describe("recent-searches", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("getRecentSearches", () => {
    it("returns empty array when no searches stored", () => {
      expect(getRecentSearches()).toEqual([]);
    });

    it("returns stored searches", () => {
      localStorage.setItem(
        RECENT_SEARCHES_KEY,
        JSON.stringify(["foo", "bar"]),
      );
      expect(getRecentSearches()).toEqual(["foo", "bar"]);
    });

    it("returns empty array for invalid JSON", () => {
      localStorage.setItem(RECENT_SEARCHES_KEY, "not-json");
      expect(getRecentSearches()).toEqual([]);
    });

    it("returns empty array if stored value is not an array", () => {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify("string"));
      expect(getRecentSearches()).toEqual([]);
    });
  });

  describe("addRecentSearch", () => {
    it("adds a search to the beginning of the list", () => {
      addRecentSearch("hello");
      expect(getRecentSearches()).toEqual(["hello"]);
    });

    it("prepends new search to existing list", () => {
      addRecentSearch("first");
      addRecentSearch("second");
      expect(getRecentSearches()).toEqual(["second", "first"]);
    });

    it("deduplicates: moves existing query to front", () => {
      addRecentSearch("a");
      addRecentSearch("b");
      addRecentSearch("c");
      addRecentSearch("a"); // re-add "a"
      expect(getRecentSearches()).toEqual(["a", "c", "b"]);
    });

    it("trims whitespace from query", () => {
      addRecentSearch("  spaced  ");
      expect(getRecentSearches()).toEqual(["spaced"]);
    });

    it("does not add empty queries", () => {
      addRecentSearch("");
      addRecentSearch("   ");
      expect(getRecentSearches()).toEqual([]);
    });

    it(`limits to ${MAX_RECENT_SEARCHES} entries`, () => {
      for (let i = 0; i < MAX_RECENT_SEARCHES + 5; i++) {
        addRecentSearch(`query-${i}`);
      }
      const searches = getRecentSearches();
      expect(searches).toHaveLength(MAX_RECENT_SEARCHES);
      // Most recent should be first
      expect(searches[0]).toBe(`query-${MAX_RECENT_SEARCHES + 4}`);
    });
  });

  describe("clearRecentSearches", () => {
    it("removes all recent searches", () => {
      addRecentSearch("one");
      addRecentSearch("two");
      clearRecentSearches();
      expect(getRecentSearches()).toEqual([]);
    });

    it("does not throw when nothing to clear", () => {
      expect(() => clearRecentSearches()).not.toThrow();
    });
  });
});
