import { Static, Type } from "@sinclair/typebox";
import { FastifyInstance } from "fastify";
import { StatusCodes } from "http-status-codes";
import { walletAuthSchema } from "../../../../../core/schema";
import { queueTx } from "../../../../../src/db/transactions/queueTx";
import {
  contractParamSchema,
  standardResponseSchema,
  transactionWritesResponseSchema,
} from "../../../../helpers/sharedApiSchemas";
import { getChainIdFromChain } from "../../../../utilities/chain";
import { getContract } from "../../../../utils/cache/getContract";

// INPUTS
const requestSchema = contractParamSchema;
const requestBodySchema = Type.Object({
  role: Type.String({
    description: "The role to revoke",
  }),
  address: Type.String({
    description: "The address to revoke the role from",
  }),
});

// OUTPUT
const responseSchema = transactionWritesResponseSchema;

export async function revokeRole(fastify: FastifyInstance) {
  fastify.route<{
    Params: Static<typeof requestSchema>;
    Reply: Static<typeof responseSchema>;
    Body: Static<typeof requestBodySchema>;
  }>({
    method: "POST",
    url: "/contract/:chain/:contract_address/roles/revoke",
    schema: {
      description: "Revoke a role from a specific address",
      tags: ["Contract-Roles"],
      operationId: "roles_revoke",
      headers: walletAuthSchema,
      params: requestSchema,
      body: requestBodySchema,
      response: {
        ...standardResponseSchema,
        [StatusCodes.OK]: responseSchema,
      },
    },
    handler: async (request, reply) => {
      const { chain, contract_address } = request.params;
      const { role, address } = request.body;
      const walletAddress = request.headers["x-wallet-address"] as string;
      const chainId = getChainIdFromChain(chain);
      const contract = await getContract({
        chainId,
        contractAddress: contract_address,
        walletAddress,
      });

      const tx = await contract.roles.revoke.prepare(role, address);
      const queuedId = await queueTx({ tx, chainId, extension: "roles" });
      reply.status(StatusCodes.OK).send({
        result: queuedId,
      });
    },
  });
}
