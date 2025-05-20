import { createRoute } from '@hono/zod-openapi';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import { jsonContent } from 'stoker/openapi/helpers';
import { z } from 'zod';

import { db } from '@/db';
import { otpList, selectOtpList } from '@/db/schema';
import { createRouter } from '@/lib/create-app';

const router = createRouter().openapi(
  createRoute({
    tags: ['Index'],
    method: 'get',
    path: '/',
    responses: {
      [HttpStatusCodes.OK]: jsonContent(z.array(selectOtpList), 'List of OTPs'),
    },
  }),
  async (c) => {
    const otps = await db.select().from(otpList);

    return c.json(otps, HttpStatusCodes.OK);
  }
);

export default router;
