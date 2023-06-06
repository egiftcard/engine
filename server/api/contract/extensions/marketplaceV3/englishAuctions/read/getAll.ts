import { FastifyInstance } from "fastify";
import { StatusCodes } from "http-status-codes";
import { getContractInstace } from "../../../../../../../core";
import { Static, Type } from "@sinclair/typebox";
import {
  contractParamSchema,
  standardResponseSchema,
} from "../../../../../../helpers/sharedApiSchemas";
import { getAllFilterSchema } from "../../../../../../schemas/marketplaceV3/directListing";
import { englishAuctionOutputSchema } from "../../../../../../schemas/marketplaceV3/englishAuction";
import { formatEnglishAuctionResult } from "../../../../../../helpers/marketplaceV3";

// INPUT
const requestSchema = contractParamSchema;
const requestQuerySchema = getAllFilterSchema;

// OUPUT
const responseSchema = Type.Object({
  result: Type.Array(englishAuctionOutputSchema),
});

responseSchema.examples = [
  {
    result: [
      {
        metadata: {
          id: "0",
          uri: "ipfs://QmdaWX1GEwnFW4NooYRej5BQybKNLdxkWtMwyw8KiWRueS/0",
          name: "My Edition NFT",
          description: "My Edition NFT description",
          image:
            "ipfs://QmciR3WLJsf2BgzTSjbG5zCxsrEQ8PqsHK7JWGWsDSNo46/nft.png",
        },
        owner: "0xE79ee09bD47F4F5381dbbACaCff2040f2FbC5803",
        type: "ERC1155",
        supply: "100",
        quantityOwned: "100",
      },
    ],
  },
];

// LOGIC
export async function eaGetAll(fastify: FastifyInstance) {
  fastify.route<{
    Params: Static<typeof requestSchema>;
    Reply: Static<typeof responseSchema>;
    Querystring: Static<typeof requestQuerySchema>;
  }>({
    method: "GET",
    url: "/marketplace/v3/:chain_name_or_id/:contract_address/englishAuction/getAll",
    schema: {
      description: "Retrieve data for all auction listings on the marketplace.",
      tags: ["MarketplaceV3-EnglishAuction"],
      operationId: "mktpv3_eaGetAll",
      params: requestSchema,
      querystring: requestQuerySchema,
      response: {
        ...standardResponseSchema,
        [StatusCodes.OK]: responseSchema,
      },
    },
    handler: async (request, reply) => {
      const { chain_name_or_id, contract_address } = request.params;
      const { start, count, offeror, seller, tokenContract, tokenId } =
        request.query;
      const contract = await getContractInstace(
        chain_name_or_id,
        contract_address,
      );
      const result = await contract.englishAuctions.getAll({
        start,
        count,
        tokenContract,
        tokenId,
        offeror,
        seller,
      });

      const finalResult = result.map((data) => {
        return formatEnglishAuctionResult(data);
      });
      reply.status(StatusCodes.OK).send({
        result: finalResult,
      });
    },
  });
}
