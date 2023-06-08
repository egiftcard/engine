import { FastifyInstance } from "fastify";
import { StatusCodes } from "http-status-codes";
import { getSDK } from "../../../../core";
import {
  prebuiltDeployContractParamSchema,
  standardResponseSchema,
  prebuiltDeployResponseSchema,
} from "../../../helpers/sharedApiSchemas";
import { Static, Type } from "@sinclair/typebox";
import { queueTransaction } from "../../../helpers";
import {
  commonContractSchema,
  merkleSchema,
  commonSymbolSchema,
} from "../../../schemas/prebuilts";

// INPUTS
const requestSchema = prebuiltDeployContractParamSchema;
const requestBodySchema = Type.Object({
  contractMetadata: Type.Union([
    commonContractSchema,
    merkleSchema,
    commonSymbolSchema,
  ]),
  version: Type.Optional(
    Type.String({
      description: "Version of the contract to deploy. Defaults to latest.",
    }),
  ),
});

// Example for the Request Body
requestBodySchema.examples = [
  {
    contractMetadata: {
      name: `My Contract`,
      description: "Contract deployed from web3 api",
    },
  },
];

// OUTPUT
const responseSchema = prebuiltDeployResponseSchema;

export async function deployPrebuiltTokenDrop(fastify: FastifyInstance) {
  fastify.route<{
    Params: Static<typeof requestSchema>;
    Reply: Static<typeof responseSchema>;
    Body: Static<typeof requestBodySchema>;
  }>({
    method: "POST",
    url: "/deployer/:chain_name_or_id/prebuilts/tokenDrop",
    schema: {
      description: "Deploy prebuilt Token Drop contract",
      tags: ["Deploy"],
      operationId: "deployPrebuiltTokenDrop",
      params: requestSchema,
      body: requestBodySchema,
      response: {
        ...standardResponseSchema,
        [StatusCodes.OK]: responseSchema,
      },
    },
    handler: async (request, reply) => {
      const { chain_name_or_id } = request.params;
      const { contractMetadata, version } = request.body;
      const sdk = await getSDK(chain_name_or_id);
      const tx = await sdk.deployer.deployBuiltInContract.prepare(
        "token-drop",
        contractMetadata,
        version,
      );
      const deployedAddress = await tx.simulate();
      const queuedId = await queueTransaction(
        request,
        tx,
        chain_name_or_id,
        "deployer_prebuilt",
      );
      reply.status(StatusCodes.OK).send({
        deployedAddress,
        queuedId,
      });
    },
  });
}
