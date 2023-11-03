import { Static, Type } from "@sinclair/typebox";
import { FastifyInstance } from "fastify";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../../../db/client";
import { getChainIdFromChain } from "../../utils/chain";

const BodySchema = Type.Object({
  chain: Type.String(),
  walletAddress: Type.String(),
  allowedContracts: Type.Optional(Type.Array(Type.String())),
});

const ReplySchema = Type.Object({
  result: Type.Object({
    relayerId: Type.String(),
  }),
});

export async function createRelayer(fastify: FastifyInstance) {
  fastify.route<{
    Reply: Static<typeof ReplySchema>;
    Body: Static<typeof BodySchema>;
  }>({
    method: "POST",
    url: "/relayer/create",
    schema: {
      summary: "Create a new meta-transaction relayer",
      description: "Create a new meta-transaction relayer",
      tags: ["Relayer"],
      operationId: "create",
      body: BodySchema,
      response: {
        [StatusCodes.OK]: ReplySchema,
      },
    },
    handler: async (req, res) => {
      const { chain, walletAddress, allowedContracts } = req.body;

      const relayer = await prisma.relayers.create({
        data: {
          chainId: getChainIdFromChain(chain).toString(),
          walletAddress,
          allowedContracts: allowedContracts
            ? JSON.stringify(allowedContracts)
            : null,
        },
      });

      return res.status(200).send({
        result: {
          relayerId: relayer.id,
        },
      });
    },
  });
}