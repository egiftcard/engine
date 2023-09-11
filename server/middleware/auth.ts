import type { FastifyReply, FastifyRequest } from "fastify";

import { env } from "../../core";

export const performHTTPAuthentication = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  // v0.1.0
  // Next version will be more comprehensive and will use JWT with our AUTH SDK
  const auth = request.headers.authorization;
  const token = auth?.split(" ")[1];

  if (token !== env.THIRDWEB_API_SECRET_KEY) {
    return reply.status(401).send({
      error: "Unauthorized",
      message: "Please provide a valid secret key",
    });
  }
  //TODO check if Header X-Wallet-Address is present
  // check if this auth has access to this wallet
  // currently any valid auth has access to any valid walletAddress
  // we check the db if wallet exists since we've already checked auth
  /*  const walletAddress = request.headers["x-wallet-address"];*/
  /*if (!walletAddress) {*/
  /*return reply.status(400).send({*/
  /*error: "Bad Request",*/
  /*message: "Please provide a valid wallet address",*/
  /*});*/
  /*}*/
};

export const performWSAuthentication = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  // v0.1.0
  // Next version will be more comprehensive and will use JWT with our AUTH SDK
  const { token: authToken } = request.query as WebSocketQuery;
  request.log.info(authToken, "WS: Request Params : ");

  if (authToken !== env.THIRDWEB_API_SECRET_KEY) {
    // Closing the WebSocket connection with 1008 status code: "Policy Violation"
    request.raw.socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    request.raw.socket.destroy();
    throw new Error("Unauthorized: Please provide a valid secret key");
  }
};

interface WebSocketQuery {
  token: string;
}
