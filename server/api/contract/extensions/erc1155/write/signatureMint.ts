import { Static, Type } from "@sinclair/typebox";
import { SignedPayload1155 } from "@thirdweb-dev/sdk";
import { BigNumber } from "ethers";
import { FastifyInstance } from "fastify";
import { StatusCodes } from "http-status-codes";
import { getContractInstance } from "../../../../../../core/index";
import { walletAuthSchema } from "../../../../../../core/schema";
import { queueTx } from "../../../../../../src/db/transactions/queueTx";
import {
  contractParamSchema,
  standardResponseSchema,
  transactionWritesResponseSchema,
} from "../../../../../helpers/sharedApiSchemas";
import { signature1155OutputSchema } from "../../../../../schemas/nft";
import { txOverridesForWriteRequest } from "../../../../../schemas/web3api-overrides";
import { getChainIdFromChain } from "../../../../../utilities/chain";

// INPUTS
const requestSchema = contractParamSchema;
const requestBodySchema = Type.Object({
  payload: signature1155OutputSchema,
  signature: Type.String(),
  ...txOverridesForWriteRequest.properties,
});

requestBodySchema.examples = [
  {
    payload: {},
    signature: "",
  },
];

export async function erc1155SignatureMint(fastify: FastifyInstance) {
  fastify.route<{
    Params: Static<typeof requestSchema>;
    Reply: Static<typeof transactionWritesResponseSchema>;
    Body: Static<typeof requestBodySchema>;
  }>({
    method: "POST",
    url: "/contract/:network/:contract_address/erc1155/signature/mint",
    schema: {
      description: "Mint tokens from a previously generated signature.",
      tags: ["ERC1155"],
      operationId: "erc1155_signature_mint",
      params: requestSchema,
      body: requestBodySchema,
      headers: walletAuthSchema,
      response: {
        ...standardResponseSchema,
        [StatusCodes.OK]: transactionWritesResponseSchema,
      },
    },
    handler: async (request, reply) => {
      const { network, contract_address } = request.params;
      const { payload, signature, tx_overrides } = request.body;
      const walletAddress = request.headers["x-wallet-address"] as string;

      const contract = await getContractInstance(
        network,
        contract_address,
        walletAddress,
      );
      const chainId = getChainIdFromChain(network);

      const signedPayload: SignedPayload1155 = {
        payload: {
          ...payload,
          royaltyBps: BigNumber.from(payload.royaltyBps),
          quantity: BigNumber.from(payload.quantity),
          mintStartTime: BigNumber.from(payload.mintStartTime),
          mintEndTime: BigNumber.from(payload.mintEndTime),
          tokenId: BigNumber.from(payload.tokenId),
        },
        signature,
      };
      const tx = await contract.erc1155.signature.mint.prepare(signedPayload);
      const queuedId = await queueTx({ tx, chainId, extension: "erc1155" });
      reply.status(StatusCodes.OK).send({
        result: queuedId,
      });
    },
  });
}
