import { Static, Type } from "@sinclair/typebox";
import { FastifyInstance } from "fastify";
import { StatusCodes } from "http-status-codes";
import { queueTx } from "../../../../../../../src/db/transactions/queueTx";
import {
  marketplaceV3ContractParamSchema,
  standardResponseSchema,
  transactionWritesResponseSchema,
} from "../../../../../../helpers/sharedApiSchemas";
import { getChainIdFromChain } from "../../../../../../utilities/chain";
import { getContract } from "../../../../../../utils/cache/getContract";

// INPUT
const requestSchema = marketplaceV3ContractParamSchema;
const requestBodySchema = Type.Object({
  listing_id: Type.String({
    description: "The ID of the listing to execute the sale for.",
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
export async function englishAuctionsCloseAuctionForSeller(
  fastify: FastifyInstance,
) {
  fastify.route<{
    Params: Static<typeof requestSchema>;
    Reply: Static<typeof transactionWritesResponseSchema>;
    Body: Static<typeof requestBodySchema>;
  }>({
    method: "POST",
    url: "/marketplace/:network/:contract_address/english-auctions/close-auction-for-seller",
    schema: {
      description: `After an auction has concluded (and a buyout did not occur),
        execute the sale for the seller, meaning the seller receives the payment from the highest bid.
        You must also call closeAuctionForBidder to execute the sale for the buyer, meaning the buyer receives the NFT(s).`,
      tags: ["Marketplace-EnglishAuctions"],
      operationId: "mktpv3_englishAuctions_closeAuctionForSeller",
      params: requestSchema,
      body: requestBodySchema,
      response: {
        ...standardResponseSchema,
        [StatusCodes.OK]: transactionWritesResponseSchema,
      },
    },
    handler: async (request, reply) => {
      const { network, contract_address } = request.params;
      const { listing_id } = request.body;
      const walletAddress = request.headers["x-wallet-address"] as string;
      const chainId = getChainIdFromChain(network);
      const contract = await getContract({
        chainId,
        contractAddress: contract_address,
        walletAddress,
      });

      const tx = await contract.englishAuctions.closeAuctionForSeller.prepare(
        listing_id,
      );

      const queuedId = await queueTx({
        tx,
        chainId,
        extension: "marketplace-v3-english-auctions",
      });
      reply.status(StatusCodes.OK).send({
        result: queuedId,
      });
    },
  });
}
