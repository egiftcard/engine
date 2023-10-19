import fastifyCors from "@fastify/cors";
import fastifyExpress from "@fastify/express";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import WebSocketPlugin from "@fastify/websocket";
import { ThirdwebAuth } from "@thirdweb-dev/auth/fastify";
import { LocalWallet } from "@thirdweb-dev/wallets";
import { AsyncWallet } from "@thirdweb-dev/wallets/evm/wallets/async";
import fastify, { FastifyInstance } from "fastify";
import { apiRoutes } from "../../server/api";
import { getConfiguration } from "../../src/db/configuration/getConfiguration";
import { env } from "../../src/utils/env";
import { logger } from "../../src/utils/logger";
import { errorHandler } from "../middleware/error";
import { openapi } from "./openapi";

const createServer = async (): Promise<FastifyInstance> => {
  const server: FastifyInstance = fastify({
    logger: logger.server,
    disableRequestLogging: true,
  }).withTypeProvider<TypeBoxTypeProvider>();

  server.addHook("onRequest", async (request, reply) => {
    if (
      !request.routerPath?.includes("static") &&
      !request.routerPath?.includes("json")
    ) {
      request.log.info(
        `Request received - ${request.method} - ${request.routerPath}`,
      );
    }
  });

  server.addHook("preHandler", async (request, reply) => {
    if (
      !request.routerPath?.includes("static") &&
      !request.routerPath?.includes("json") &&
      !request.routerPath?.includes("/backend-wallet/import")
    ) {
      if (request.body && Object.keys(request.body).length > 0) {
        request.log.info({ ...request.body }, "Request Body : ");
      }

      if (request.params && Object.keys(request.params).length > 0) {
        request.log.info({ ...request.params }, "Request Params : ");
      }

      if (request.query && Object.keys(request.query).length > 0) {
        request.log.info({ ...request.query }, "Request Querystring : ");
      }
    }
  });

  server.addHook("onResponse", (request, reply, done) => {
    if (
      !request.routerPath?.includes("static") &&
      !request.routerPath?.includes("json")
    ) {
      request.log.info(
        `Request completed - ${request.method} - ${
          reply.request.routerPath
        } - StatusCode: ${reply.statusCode} - Response Time: ${reply
          .getResponseTime()
          .toFixed(2)}ms`,
      );
    }
    done();
  });

  await errorHandler(server);
  const originArray = env.ACCESS_CONTROL_ALLOW_ORIGIN.split(",") as string[];
  await server.register(fastifyCors, {
    origin: originArray.map((data) => {
      if (data.startsWith("/") && data.endsWith("/")) {
        return new RegExp(data.slice(1, -1));
      }

      if (data.startsWith("*.")) {
        const regex = data.replace("*.", ".*.");
        return new RegExp(regex);
      }
      return data;
    }),
    allowedHeaders: [
      "Origin, X-Requested-With, Content-Type, Accept, Access-Control-Allow-Origin, Cache-Control",
    ],
    credentials: true,
  });

  await server.register(WebSocketPlugin);

  const config = await getConfiguration();
  const { authRouter, authMiddleware, getUser } = ThirdwebAuth({
    domain: config.authDomain,
    wallet: new AsyncWallet({
      getSigner: async () => {
        const config = await getConfiguration();
        const wallet = new LocalWallet();
        await wallet.import({
          encryptedJson: config.authWalletEncryptedJson,
          password: env.THIRDWEB_API_SECRET_KEY,
        });

        return wallet.getSigner();
      },
      cacheSigner: false,
    }),
  });

  await server.register(authRouter, { prefix: "/auth" });
  await server.register(authMiddleware);

  server.addHook("onRequest", async (req, res) => {
    if (
      req.url === "/favicon.ico" ||
      req.url === "/" ||
      req.url === "/health" ||
      req.url.startsWith("/static") ||
      req.url.startsWith("/json") ||
      req.url.startsWith("/auth")
    ) {
      return;
    }

    // TODO: Enable authentiction check for websocket requests
    if (
      req.headers.upgrade &&
      req.headers.upgrade.toLowerCase() === "websocket"
    ) {
      return;
    }

    // If we have a valid secret key, skip authentication check
    const thirdwebApiSecretKey = req.headers.authorization?.split(" ")[1];
    if (thirdwebApiSecretKey === env.THIRDWEB_API_SECRET_KEY) {
      return;
    }

    // Otherwise, check for an authenticated user
    const user = await getUser(req);
    if (user) {
      return;
    }

    // TODO: Needs to add permissions checks here w/ table & default permissions

    // If we have no secret key or authenticated user, return 401
    return res.status(401).send({
      error: "Unauthorized",
      message: "Please provide a valid secret key or JWT",
    });
  });

  await server.register(fastifyExpress);

  await openapi(server);
  await server.register(apiRoutes);

  /* TODO Add a real health check
   * check if postgres connection is valid
   * have worker write a heartbeat to db
   * check the last worker heartbeat time
   * (probably more to do)
   * */
  server.get("/health", async () => {
    return {
      status: "OK",
    };
  });

  await server.ready();

  return server;
};

export default createServer;
