import app from "./app";
import { logger } from "./lib/logger";
import { seedFleet } from "./lib/fleet";
import { seedSupplies, startSupplyTicker } from "./lib/supplies";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

seedFleet()
  .then(() => seedSupplies())
  .then(() => {
    startSupplyTicker();
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }

      logger.info({ port }, "Server listening");
    });
  })
  .catch((err: unknown) => {
    logger.error({ err }, "Unable to seed fleet data");
    process.exit(1);
  });
