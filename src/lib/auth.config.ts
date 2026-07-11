import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: {
    strategy: "jwt",
    // L20: shorten the JWT session window to bound the exposure of a stolen or
    // stale token (default was 30 days). Refreshed at most once per day.
    maxAge: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAuthPage =
        nextUrl.pathname.startsWith("/login") ||
        nextUrl.pathname.startsWith("/register");
      const isPublicPage =
        nextUrl.pathname === "/" ||
        nextUrl.pathname === "/privacy" ||
        nextUrl.pathname === "/terms";

      if (isAuthPage) {
        if (isLoggedIn) return Response.redirect(new URL("/home", nextUrl));
        return true;
      }
      if (isPublicPage) return true;
      if (!isLoggedIn) return false;
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id as string;
      }
      session.user.hasPassword = token.hasPassword ?? false;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  providers: [],
};
