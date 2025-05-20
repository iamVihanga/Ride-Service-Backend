import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, bearer, customSession, openAPI, phoneNumber } from 'better-auth/plugins';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { drivers, otpList } from '@/db/schema';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  emailAndPassword: {
    enabled: true,
  },
  // Better Auth Plugins
  plugins: [
    customSession(async ({ user, session }) => {
      const driver = await db.query.drivers.findFirst({
        where: eq(drivers.userId, user.id),
      });

      return {
        user: {
          ...user,
          driver: driver || null,
        },
        session,
      };
    }),
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
  ],
});
