import { PrismaClient } from "@prisma/client";

/**
 * One client for the process. The chat controller, the auth controller, the
 * user controller, the invite helper and the sandbox scripts each used to call
 * `new PrismaClient()` of their own, so a single process held six connection
 * pools against the same database.
 *
 * The global cache keeps that true across the hot reloads nodemon performs in
 * development, which otherwise leak a pool per restart.
 */
const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__communePrisma ||
  new PrismaClient({
    log:
      process.env.REACT_APP_TYPE === "dev"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.REACT_APP_TYPE === "dev") {
  globalForPrisma.__communePrisma = prisma;
}

export default prisma;
