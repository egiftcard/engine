import { FastifyInstance } from "fastify";
import { StatusCodes } from "http-status-codes";
import { getSDK } from "../../../../../../core";
import {
  baseReplyErrorSchema,
  contractParamSchema,
} from "../../../../../helpers/sharedApiSchemas";
import { Static, Type } from "@sinclair/typebox";

// INPUT
const requestSchema = contractParamSchema;

// OUPUT
const responseSchema = Type.Object({
  result: Type.Optional(Type.String()),
  error: Type.Optional(baseReplyErrorSchema),
});

// LOGIC
export async function erc1155TotalCount(fastify: FastifyInstance) {
  fastify.route<{
    Params: Static<typeof requestSchema>;
    Reply: Static<typeof responseSchema>;
  }>({
    method: "GET",
    url: "/contract/:chain_name_or_id/:contract_address/erc1155/totalCount",
    schema: {
      description: "Get the total number of NFTs minted.",
      tags: ["ERC1155"],
      operationId: "erc1155_totalCount",
      params: requestSchema,
      response: {
        [StatusCodes.OK]: responseSchema,
      },
    },
    handler: async (request, reply) => {
      const { chain_name_or_id, contract_address } = request.params;
      const sdk = await getSDK(chain_name_or_id);
      const contract = await sdk.getContract(contract_address);
      const returnData = await contract.erc1155.totalCount();
      reply.status(StatusCodes.OK).send({
        result: returnData.toString(),
      });
    },
  });
}
