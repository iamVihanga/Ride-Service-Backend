import type { AppRouteHandler } from "@/types";

import type { ListRoute } from "./tasks.routes";

export const list: AppRouteHandler<ListRoute> = (c) => {
  return c.json([
    { name: "Learn hono", done: false },
    { name: "Bun.sh Crash Course", done: false },
    { name: "OpenAPI with Scalar", done: false },
  ]);
};
