import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { compare } from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models/user";
import { authConfig } from "./auth.config";
import { handleOAuthSignIn } from "./oauth-linking";
import { rateLimit, getClientIp } from "./rate-limit";
import type { Provider } from "next-auth/providers";

const LOGIN_RATE_LIMIT = 10;
const LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000;

const providers: Provider[] = [
  Credentials({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials, request) {
      if (!credentials?.email || !credentials?.password) {
        return null;
      }

      const email = (credentials.email as string).toLowerCase();

      // M19: throttle credential login attempts per IP + identifier.
      const ip =
        request && typeof (request as Request).headers?.get === "function"
          ? getClientIp(request as Request)
          : "unknown";
      const limit = rateLimit(
        `login:${ip}:${email}`,
        LOGIN_RATE_LIMIT,
        LOGIN_RATE_WINDOW_MS,
      );
      if (!limit.allowed) {
        return null;
      }

      await connectDB();
      const user = await User.findOne({ email });

      if (!user || !user.passwordHash) {
        return null;
      }

      const isValid = await compare(
        credentials.password as string,
        user.passwordHash,
      );

      if (!isValid) {
        return null;
      }

      return {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        image: user.image,
      };
    },
  }),
];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(Google);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account, profile }) {
      if (account?.provider === "credentials") {
        return true;
      }

      if (!account || !profile?.email) {
        return false;
      }

      const userId = await handleOAuthSignIn(
        {
          email: profile.email,
          name: (profile.name as string | undefined) ?? null,
          image: (profile.image as string | undefined) ?? (profile.avatar_url as string | undefined) ?? null,
          email_verified: (profile.email_verified as boolean | undefined),
        },
        {
          provider: account.provider,
          providerAccountId: account.providerAccountId,
        },
      );

      if (!userId) return false;

      user.id = userId;
      return true;
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
      }

      if (token.id) {
        await connectDB();
        const dbUser = await User.findById(token.id)
          .select("passwordHash passwordChangedAt")
          .lean();

        // L20: void tokens whose user was deleted, or that were issued before
        // the user last changed their password (session invalidation).
        // NOTE: `passwordChangedAt` is not yet on the User model — this check is
        // dormant until that field is added (see report / cross-file deps).
        if (!dbUser) {
          return null;
        }
        const changedAt = (dbUser as { passwordChangedAt?: Date })
          .passwordChangedAt;
        if (
          changedAt &&
          typeof token.iat === "number" &&
          token.iat * 1000 < changedAt.getTime()
        ) {
          return null;
        }

        if (user || trigger === "update") {
          token.hasPassword = !!dbUser.passwordHash;
        }
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
});
