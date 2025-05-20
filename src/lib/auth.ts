import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, bearer, customSession, openAPI, phoneNumber } from 'better-auth/plugins';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { otpList, user as userSchema } from '@/db/schema';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  emailAndPassword: {
    enabled: true,
  },
  // Better Auth Plugins
  plugins: [
    phoneNumber({
      sendOTP: async ({ phoneNumber, code }) => {
        // TODO: Implement sending OTP code via SMS
        console.log(`Sending OTP code ${code} to phone number ${phoneNumber}`);

        await db.insert(otpList).values({
          code,
          phoneNumber,
        });
      },
      signUpOnVerification: {
        getTempEmail: (phoneNumber) => {
          return `${phoneNumber}@donext.org`;
        },
        //optionally, you can also pass `getTempName` function to generate a temporary name for the user
        getTempName: (phoneNumber) => {
          return phoneNumber; //by default, it will use the phone number as the name
        },
      },
    }),
    admin(),
    bearer(),
    openAPI(),
    customSession(async ({ user, session }) => {
      const userData = await db.query.user.findFirst({
        where: eq(userSchema.id, user.id),
        with: {
          driver: true,
        },
      });

      if (!userData) return { user: null, session: null };

      const customUser = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        emailVerified: userData.emailVerified,
        image: userData.image,
        phoneNumber: userData.phoneNumber,
        phoneNumberVerified: userData.phoneNumberVerified,
        role: userData.role,
        banned: userData.banned,
        banReason: userData.banReason,
        banExpires: userData.banExpires,
        createdAt: userData.createdAt,
        updatedAt: userData.updatedAt,
        driver: userData.driver,
      };

      return {
        user: {
          ...user,
          ...customUser,
        },
        session,
      };
    }),
  ],
});
