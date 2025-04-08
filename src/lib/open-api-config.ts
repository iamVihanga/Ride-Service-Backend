import { apiReference } from "@scalar/hono-api-reference";

import packageJson from "../../package.json";

export default function configureOpenAPI(app: AppOpenAPI) {
  app.doc("/doc", {
    openapi: "3.0.0",
    info: {
      version: packageJson.version,
      title: "Hono Advanced API with Bun",
    },
  });

  app.get(
    "/reference",
    apiReference({
      theme: "kepler",
      url: "/doc"
    })
  );
}
