import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, bearer, openAPI, phoneNumber } from "better-auth/plugins";

import { db } from '@/db';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg"
  }),
  emailAndPassword: {
    enabled: true
  },
  // Better Auth Plugins
  plugins: [
    phoneNumber({
      sendOTP: ({ phoneNumber, code }, request) => {
        // TODO: Implement sending OTP code via SMS
        console.log(`Sending OTP code ${code} to phone number ${phoneNumber}`);
      }
    }),
    admin(),
    bearer(),
    openAPI()
  ]
})