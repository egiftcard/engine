import { FastifyInstance } from "fastify";
import { StatusCodes } from "http-status-codes";
import { Static, Type } from "@sinclair/typebox";
import { getContractInstace } from "../../../../../../core/index";
import {
  erc20ContractParamSchema,
  standardResponseSchema,
  baseReplyErrorSchema,
  transactionWritesResponseSchema,
} from "../../../../../helpers/sharedApiSchemas";
import { queueTransaction } from "../../../../../helpers";

// INPUTS
const requestSchema = erc20ContractParamSchema;
const requestBodySchema = Type.Object({
  recipient: Type.String({
    description: "The wallet address to receive the claimed tokens.",
  }),
  amount: Type.String({
    description: 'The amount of tokens to claim.',
  }),
});

// Example for the Request Body
requestBodySchema.examples = [
  {
    recipient: "0x3EcDBF3B911d0e9052b64850693888b008e18373",
    amount: "0.1",
  },
];

export async function erc20claimTo(fastify: FastifyInstance) {
  fastify.route<{
    Params: Static<typeof requestSchema>;
    Reply: Static<typeof transactionWritesResponseSchema>;
    Body: Static<typeof requestBodySchema>;
  }>({
    method: "POST",
    url: "/contract/:chain_name_or_id/:contract_address/erc20/claimTo",
    schema: {
      description: "Allow a specific wallet to claim tokens.",
      tags: ["ERC20"],
      operationId: "erc20_claimTo",
      params: requestSchema,
      body: requestBodySchema,
      response: {
        ...standardResponseSchema,
        [StatusCodes.OK]: transactionWritesResponseSchema,
      },
    },
    handler: async (request, reply) => {
      const { chain_name_or_id, contract_address } = request.params;
      const { recipient, amount } = request.body;
      const contract = await getContractInstace(chain_name_or_id, contract_address);
      const tx = await contract.erc20.claimTo.prepare(recipient, amount);
      const queuedId = await queueTransaction(
        request,
        tx,
        chain_name_or_id,
        "erc20",
      );
      reply.status(StatusCodes.OK).send({
        result: queuedId!,
      });
    },
  });
}
