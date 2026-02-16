import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: {
    strategy: "jwt",
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
      session.user.hasPassword = token.hasPassword ?? true;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  providers: [],
};
