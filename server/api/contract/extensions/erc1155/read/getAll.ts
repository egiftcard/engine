import { FastifyInstance } from "fastify";
import { StatusCodes } from "http-status-codes";
import { getContractInstace } from "../../../../../../core";
import { Static, Type } from "@sinclair/typebox";
import {
  erc1155ContractParamSchema,
  standardResponseSchema,
} from "../../../../../helpers/sharedApiSchemas";
import { nftSchema } from "../../../../../schemas/nft";

// INPUT
const requestSchema = erc1155ContractParamSchema;
const querystringSchema = Type.Object({
  start: Type.Optional(
    Type.Number({
      description: "The start token id for paginated results. Defaults to 0.",
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

// OUPUT
const responseSchema = Type.Object({
  result: Type.Array(nftSchema)
});

responseSchema.examples = [{
  "result": [{
    "metadata": {
      "id": "0",
      "uri": "ipfs://QmciR3WLJsf2BgzTSjbG5zCxsrEQ8PqsHK7JWGWsDSNo46/nft.png",
      "name": "TJ-Origin",
      "description": "Origin",
      "external_url": "",
      "attributes": [
        {
          "trait_type": "Mode",
          "value": "GOD"
        }
      ]
    },
    "owner": "0x0000000000000000000000000000000000000000",
    "type": "ERC1155",
    "supply": "600000150000000000000000000000000000000000009000000000000000000000712"
  }]
}];

// LOGIC
export async function erc1155GetAll(fastify: FastifyInstance) {
  fastify.route<{
    Params: Static<typeof requestSchema>;
    Reply: Static<typeof responseSchema>;
    Querystring: Static<typeof querystringSchema>;
  }>({
    method: "GET",
    url: "/contract/:chain_name_or_id/:contract_address/erc1155/getAll",
    schema: {
      description: "Get all NFTs from a given contract.",
      tags: ["ERC1155"],
      operationId: "erc1155_getAll",
      params: requestSchema,
      querystring: querystringSchema,
      response: {
        ...standardResponseSchema,
        [StatusCodes.OK]: responseSchema,
      },
    },
    handler: async (request, reply) => {
      const { chain_name_or_id, contract_address } = request.params;
      const { start, count } = request.query;
      const contract = await getContractInstace(chain_name_or_id, contract_address);
      const result = await contract.erc1155.getAll({
        start,
        count,
      });
      reply.status(StatusCodes.OK).send({
        result,
      });
    },
  });
}
