import { FastifyInstance } from "fastify";
import { StatusCodes } from "http-status-codes";
import { Static, Type } from "@sinclair/typebox";
import { getSDK, queueTransaction } from "../../../../../helpers/index";
import {
  contractParamSchema,
  standardResponseSchema,
  baseReplyErrorSchema,
} from "../../../../../helpers/sharedApiSchemas";

// INPUTS
const requestSchema = contractParamSchema;
const requestBodySchema = Type.Object({
  to: Type.String({
    description: "Address of the wallet to transfer to",
  }),
  token_id: Type.String({
    description: "the tokenId to transfer",
  }),
});

requestBodySchema.examples = [
  {
    to: "0x3EcDBF3B911d0e9052b64850693888b008e18373",
    token_id: "0",
  },
];

// OUTPUT
const responseSchema = Type.Object({
  queuedId: Type.Optional(Type.String()),
  error: Type.Optional(baseReplyErrorSchema),
});

export async function erc721transfer(fastify: FastifyInstance) {
  fastify.route<{
    Params: Static<typeof requestSchema>;
    Reply: Static<typeof responseSchema>;
    Body: Static<typeof requestBodySchema>;
  }>({
    method: "POST",
    url: "/contract/:chain_name_or_id/:contract_address/erc721/transfer",
    schema: {
      description:
        "Transfer an NFT from the connected wallet to another wallet.",
      tags: ["ERC721"],
      operationId: "transfer",
      params: requestSchema,
      body: requestBodySchema,
      response: {
        ...standardResponseSchema,
        [StatusCodes.OK]: responseSchema,
      },
    },
    handler: async (request, reply) => {
      const { chain_name_or_id, contract_address } = request.params;
      const { to, token_id } = request.body;
      const sdk = await getSDK(chain_name_or_id);
      const contract = await sdk.getContract(contract_address);
      const tx = await contract.erc721.transfer.prepare(to, token_id);
      const queuedId = await queueTransaction(
        request,
        tx,
        chain_name_or_id,
        "erc721",
      );
      reply.status(StatusCodes.OK).send({
        queuedId,
      });
    },
  });
}
