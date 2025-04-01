import { OpenAPIHono } from "@hono/zod-openapi";
import { notFound, onError } from "stoker/middlewares";

const app = new OpenAPIHono();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

// Error Handelling Middleware
app.onError(onError);

// Not Found Handelling Middleware
app.notFound(notFound);

export default app;
