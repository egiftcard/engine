import { Static, Type } from "@sinclair/typebox";
import { FastifyInstance } from "fastify";
import { StatusCodes } from "http-status-codes";
import { walletAuthSchema } from "../../../../core/schema";
import { queueTx } from "../../../../src/db/transactions/queueTx";
import { standardResponseSchema } from "../../../helpers/sharedApiSchemas";
import {
  commonContractSchema,
  commonTrustedForwarderSchema,
  prebuiltDeployContractParamSchema,
  prebuiltDeployResponseSchema,
  splitRecipientInputSchema,
} from "../../../schemas/prebuilts";
import { txOverridesForWriteRequest } from "../../../schemas/web3api-overrides";
import { getChainIdFromChain } from "../../../utilities/chain";
import { getSdk } from "../../../utils/cache/getSdk";

// INPUTS
const requestSchema = prebuiltDeployContractParamSchema;
const requestBodySchema = Type.Object({
  contractMetadata: Type.Object({
    ...commonContractSchema.properties,
    recipients: Type.Array(splitRecipientInputSchema),
    ...commonTrustedForwarderSchema.properties,
  }),
  version: Type.Optional(
    Type.String({
      description: "Version of the contract to deploy. Defaults to latest.",
    }),
  ),
  ...txOverridesForWriteRequest.properties,
});

// Example for the Request Body

// OUTPUT
const responseSchema = prebuiltDeployResponseSchema;

export async function deployPrebuiltSplit(fastify: FastifyInstance) {
  fastify.route<{
    Params: Static<typeof requestSchema>;
    Reply: Static<typeof responseSchema>;
    Body: Static<typeof requestBodySchema>;
  }>({
    method: "POST",
    url: "/deploy/:chain/prebuilts/split",
    schema: {
      description: "Deploy prebuilt Split contract",
      tags: ["Deploy"],
      operationId: "deployPrebuiltSplit",
      params: requestSchema,
      body: requestBodySchema,
      headers: walletAuthSchema,
      response: {
        ...standardResponseSchema,
        [StatusCodes.OK]: responseSchema,
      },
    },
    handler: async (request, reply) => {
      //TODO add x-wallet-address to headers
      const { chain } = request.params;
      const { contractMetadata, version } = request.body;
      const chainId = getChainIdFromChain(chain);
      const walletAddress = request.headers["x-wallet-address"] as string;

      const sdk = await getSdk({ chainId, walletAddress });
      const tx = await sdk.deployer.deployBuiltInContract.prepare(
        "split",
        contractMetadata,
        version,
      );
      const deployedAddress = await tx.simulate();

      const queuedId = await queueTx({
        tx,
        chainId,
        extension: "deploy-prebuilt",
        deployedContractAddress: deployedAddress,
        deployedContractType: "split",
      });
      reply.status(StatusCodes.OK).send({
        result: {
          deployedAddress,
          queuedId,
        },
      });
    },
  });
}
