import { Static, Type } from "@sinclair/typebox";
import { FastifyInstance } from "fastify";
import { StatusCodes } from "http-status-codes";
import { getContractInstance } from "../../../../../../core/index";
import { queueTransaction } from "../../../../../helpers";
import {
  erc1155ContractParamSchema,
  standardResponseSchema,
  transactionWritesResponseSchema,
} from "../../../../../helpers/sharedApiSchemas";
import { nftAndSupplySchema } from "../../../../../schemas/nft";
import { web3APIOverridesForWriteRequest } from "../../../../../schemas/web3api-overrides";

// INPUTS
const requestSchema = erc1155ContractParamSchema;
const requestBodySchema = Type.Object({
  receiver: Type.String({
    description: "Address of the wallet to mint the NFT to",
  }),
  metadataWithSupply: nftAndSupplySchema,
  ...web3APIOverridesForWriteRequest.properties,
});

requestBodySchema.examples = [
  {
    receiver: "0x3EcDBF3B911d0e9052b64850693888b008e18373",
    metadataWithSupply: {
      metadata: {
        name: "My NFT",
        description: "My NFT description",
        image: "ipfs://QmciR3WLJsf2BgzTSjbG5zCxsrEQ8PqsHK7JWGWsDSNo46/nft.png",
      },
      supply: "100",
    },
    web3api_overrides: {
      from: "0x...",
    },
  },
];

// OUTPUT

export async function erc1155mintTo(fastify: FastifyInstance) {
  fastify.route<{
    Params: Static<typeof requestSchema>;
    Reply: Static<typeof transactionWritesResponseSchema>;
    Body: Static<typeof requestBodySchema>;
  }>({
    method: "POST",
    url: "/contract/:network/:contract_address/erc1155/mintTo",
    schema: {
      description: "Mint an NFT to a specific wallet.",
      tags: ["ERC1155"],
      operationId: "erc1155_mintTo",
      params: requestSchema,
      body: requestBodySchema,
      response: {
        ...standardResponseSchema,
        [StatusCodes.OK]: transactionWritesResponseSchema,
      },
    },
    handler: async (request, reply) => {
      const { network, contract_address } = request.params;
      const { receiver, metadataWithSupply, web3api_overrides } = request.body;

      const contract = await getContractInstance(
        network,
        contract_address,
        web3api_overrides?.from,
      );
      const tx = await contract.erc1155.mintTo.prepare(
        receiver,
        metadataWithSupply,
      );
      const queuedId = await queueTransaction(request, tx, network, "erc1155");
      reply.status(StatusCodes.OK).send({
        result: queuedId,
      });
    },
  });
}
