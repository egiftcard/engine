import { Static, Type } from "@sinclair/typebox";
import { FastifyInstance } from "fastify";
import { StatusCodes } from "http-status-codes";
import { getLastIndexedBlock } from "../../../../db/chainIndexers/getChainIndexer";
import { createCustomError } from "../../../middleware/error";
import { chainRequestQuerystringSchema } from "../../../schemas/chain";
import { standardResponseSchema } from "../../../schemas/sharedApiSchemas";
import { getChainIdFromChain } from "../../../utils/chain";

const responseSchema = Type.Object({
  result: Type.Object({
    lastIndexedBlock: Type.Number(),
    status: Type.String(),
  }),
});

responseSchema.example = {
  result: {
    getLastIndexedBlock: 100,
    status: "success",
  },
};

export async function getContractSubscriptions(fastify: FastifyInstance) {
  fastify.route<{
    Querystring: Static<typeof chainRequestQuerystringSchema>;
    Reply: Static<typeof responseSchema>;
  }>({
    method: "GET",
    url: "/contract/get-last-block",
    schema: {
      summary: "Get subscribed contract latest indexed block",
      description: "Get latest indexed block for a subscribed contract",
      tags: ["Contract-Subscriptions"],
      operationId: "getContractSubscriptions",
      response: {
        ...standardResponseSchema,
        [StatusCodes.OK]: responseSchema,
      },
    },
    handler: async (request, reply) => {
      const { chain } = request.query;

      const chainId = await getChainIdFromChain(chain);

      const lastBlock = await getLastIndexedBlock({ chainId });

      if (!lastBlock) {
        throw createCustomError(
          "Chain is not indexed",
          StatusCodes.NOT_FOUND,
          "NOT_FOUND",
        );
      }

      reply.status(StatusCodes.OK).send({
        result: {
          lastIndexedBlock: lastBlock,
          status: "success",
        },
      });
    },
  });
}