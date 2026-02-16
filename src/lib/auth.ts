import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { compare } from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models/user";
import { authConfig } from "./auth.config";
import { handleOAuthSignIn } from "./oauth-linking";
import type { Provider } from "next-auth/providers";

const providers: Provider[] = [
  Credentials({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        return null;
      }

      await connectDB();
      const user = await User.findOne({
        email: (credentials.email as string).toLowerCase(),
      });

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

      if (user || trigger === "update") {
        await connectDB();
        const dbUser = await User.findById(token.id).select("passwordHash").lean();
        token.hasPassword = !!dbUser?.passwordHash;
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
});
