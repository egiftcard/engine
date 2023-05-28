import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { getCodeFromStatusCode } from "./utilities/errorCodes";
import { getEnv } from "./helpers/loadEnv";
import { FastifyInstance } from "fastify";
import { CustomError } from "./helpers/customError";

export const errorHandler = async (server: FastifyInstance) => {
  server.setErrorHandler((error: Error | CustomError, request, reply) => {
    request.log.error(error);

    if ("statusCode" in error && "code" in error) {
      // Transform unexpected errors into a standard payload
      const statusCode = error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR;
      const code =
        error.code ??
        getCodeFromStatusCode(statusCode) ??
        StatusCodes.INTERNAL_SERVER_ERROR;

      const message = error.message ?? ReasonPhrases.INTERNAL_SERVER_ERROR;
      reply.status(statusCode).send({
        error: {
          code,
          message,
          statusCode,
          stack:
            getEnv("NODE_ENV", "development") !== "production"
              ? error.stack
              : undefined,
        },
      });
    } else {
      // Handle non-custom errors
      reply.status(500).send({
        error: {
          statusCode: 500,
          message: error.message || ReasonPhrases.INTERNAL_SERVER_ERROR,
          stack:
            getEnv("NODE_ENV", "development") !== "production"
              ? error.stack
              : undefined,
        },
      });
    }
  });
};
