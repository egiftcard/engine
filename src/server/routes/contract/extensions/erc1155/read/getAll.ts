import { Static, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { FastifyInstance } from "fastify";
import { StatusCodes } from "http-status-codes";
import { getNFTs } from "thirdweb/extensions/erc1155";
import { getContractV5 } from "../../../../../../utils/cache/getContractV5";
import { v5NFTSchema } from "../../../../../schemas/nft";
import {
  erc1155ContractParamSchema,
  standardResponseSchema,
} from "../../../../../schemas/sharedApiSchemas";
import { getChainIdFromChain } from "../../../../../utils/chain";

// INPUT
const requestSchema = erc1155ContractParamSchema;
const querystringSchema = Type.Object({
  start: Type.Optional(
    Type.Number({
      description: "The start token ID for paginated results. Defaults to 0.",
      examples: ["0"],
    }),
  ),
  count: Type.Optional(
    Type.Number({
      description: "The page count for paginated results. Defaults to 100.",
      examples: ["20"],
    }),
  ),
});

// OUTPUT
const responseSchema = Type.Object({
  result: Type.Array(v5NFTSchema),
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
export async function erc1155GetAll(fastify: FastifyInstance) {
  fastify.route<{
    Params: Static<typeof requestSchema>;
    Reply: Static<typeof responseSchema>;
    Querystring: Static<typeof querystringSchema>;
  }>({
    method: "GET",
    url: "/contract/:chain/:contractAddress/erc1155/get-all",
    schema: {
      summary: "Get all details",
      description: "Get details for all tokens in an ERC-1155 contract.",
      tags: ["ERC1155"],
      operationId: "getAll",
      params: requestSchema,
      querystring: querystringSchema,
      response: {
        ...standardResponseSchema,
        [StatusCodes.OK]: responseSchema,
      },
    },
    handler: async (request, reply) => {
      const { chain, contractAddress } = request.params;
      const { start, count } = request.query;
      const chainId = await getChainIdFromChain(chain);
      const contract = await getContractV5({
        chainId,
        contractAddress,
      });
      const nftData = await getNFTs({
        contract,
        start,
        count,
      });
      const result = nftData.map(
        (nft) => Value.Convert(v5NFTSchema, nft) as Static<typeof v5NFTSchema>,
      );

      reply.status(StatusCodes.OK).send({
        result,
      });
    },
  });
}
