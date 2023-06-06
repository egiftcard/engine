import { FastifyInstance } from "fastify";
import { StatusCodes } from "http-status-codes";
import { getContractInstace } from "../../../../../../../core";
import { Static, Type } from "@sinclair/typebox";
import {
  contractParamSchema,
  standardResponseSchema,
  transactionWritesResponseSchema,
} from "../../../../../../helpers/sharedApiSchemas";
import { queueTransaction } from "../../../../../../helpers";

// INPUT
const requestSchema = contractParamSchema;
const requestBodySchema = Type.Object({
  listing_id: Type.String({
    description: "The ID of the listing to buy NFT(s) from.",
  }),
});

requestBodySchema.examples = [
  {
    assetContractAddress: "0x19411143085F1ec7D21a7cc07000CBA5188C5e8e",
    tokenId: "0",
    pricePerToken: "0.00000001",
    isReservedListing: false,
    quantity: "1",
    startTimestamp: 1686006043038,
    endTimestamp: 1686610889058,
  },
];

// LOGIC
export async function eaBuyoutAuction(fastify: FastifyInstance) {
  fastify.route<{
    Params: Static<typeof requestSchema>;
    Reply: Static<typeof transactionWritesResponseSchema>;
    Body: Static<typeof requestBodySchema>;
  }>({
    method: "POST",
    url: "/marketplace/v3/:chain_name_or_id/:contract_address/englishAuction/buyoutAuction",
    schema: {
      description:
        "Pay the full price per token to buy an NFT from an auction listing.",
      tags: ["MarketplaceV3-EnglishAuctions"],
      operationId: "mktpv3_eaBuyoutAuction",
      params: requestSchema,
      body: requestBodySchema,
      response: {
        ...standardResponseSchema,
        [StatusCodes.OK]: transactionWritesResponseSchema,
      },
    },
    handler: async (request, reply) => {
      const { chain_name_or_id, contract_address } = request.params;
      const { listing_id } = request.body;

      const contract = await getContractInstace(
        chain_name_or_id,
        contract_address,
      );
      const tx = await contract.englishAuctions.buyoutAuction.prepare(
        listing_id,
      );

      const queuedId = await queueTransaction(
        request,
        tx,
        chain_name_or_id,
        "mktplcV3-englishAuction",
      );
      reply.status(StatusCodes.OK).send({
        result: queuedId,
      });
    },
  });
}
