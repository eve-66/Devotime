import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { normalizeName, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const credentialsProvider = CredentialsProvider({
  name: "credentials",
  credentials: {
    name: { label: "Username", type: "text" },
    password: { label: "Password", type: "password" },
  },
  async authorize(credentials) {
    const name = typeof credentials?.name === "string" ? credentials.name : "";
    const password = typeof credentials?.password === "string" ? credentials.password : "";

    if (!name || !password) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: {
        normalizedName: normalizeName(name),
      },
    });

    if (!user) {
      return null;
    }

    const passwordMatches = verifyPassword(password, user.passwordSalt, user.passwordHash);

    if (!passwordMatches) {
      return null;
    }

    return {
      id: user.id,
      name: user.name ?? user.username,
      email: user.email,
      username: user.username,
    };
  },
});

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET ?? "devotime-local-nextauth-secret-change-me",
  pages: {
    signIn: "/",
  },
  providers: [credentialsProvider],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.username = typeof user.username === "string" ? user.username : user.name ?? "";
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }

      if (session.user && typeof token.username === "string") {
        session.user.username = token.username;
      }

      return session;
    },
  },
};
