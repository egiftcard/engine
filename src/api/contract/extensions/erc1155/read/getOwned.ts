import { FastifyInstance } from "fastify";
import { StatusCodes } from "http-status-codes";
import { getSDK } from "../../../../../../core";
import { Static, Type } from "@sinclair/typebox";
import {
  contractParamSchema,
  baseReplyErrorSchema,
} from "../../../../../helpers/sharedApiSchemas";
import { nftSchema } from "../../../../../schemas/nft";

// INPUT
const requestSchema = contractParamSchema;
const querystringSchema = Type.Object({
  wallet_address: Type.String({
    description: "Address of the wallet to get NFTs for",
    examples: ["0x1946267d81Fb8aDeeEa28e6B98bcD446c8248473"],
  }),
});

// OUPUT
const responseSchema = Type.Object({
  result: Type.Array(nftSchema),
  error: Type.Optional(baseReplyErrorSchema),
});

// LOGIC
export async function erc1155GetOwned(fastify: FastifyInstance) {
  fastify.route<{
    Params: Static<typeof requestSchema>;
    Reply: Static<typeof responseSchema>;
    Querystring: Static<typeof querystringSchema>;
  }>({
    method: "GET",
    url: "/contract/:chain_name_or_id/:contract_address/erc1155/getOwned",
    schema: {
      description:
        "Get all NFTs owned by a specific wallet from a given contract.",
      tags: ["ERC1155"],
      operationId: "erc1155_getOwned",
      params: requestSchema,
      querystring: querystringSchema,
      response: {
        [StatusCodes.OK]: responseSchema,
      },
    },
    handler: async (request, reply) => {
      const { chain_name_or_id, contract_address } = request.params;
      const { wallet_address } = request.query;
      const sdk = await getSDK(chain_name_or_id);
      const contract = await sdk.getContract(contract_address);
      const result = await contract.erc1155.getOwned(wallet_address);
      reply.status(StatusCodes.OK).send({
        result,
      });
    },
  });
}
