import { Static } from "@sinclair/typebox";
import { FastifyInstance } from "fastify";
import { StatusCodes } from "http-status-codes";
import { readContract, resolveMethod } from "thirdweb";
import { getContractV5 } from "../../../../utils/cache/getContractV5";
import { readRequestQuerySchema, readSchema } from "../../../schemas/contract";
import {
  partialRouteSchema,
  replyBodySchema,
} from "../../../schemas/sharedApiSchemas";
import { getChainIdFromChain } from "../../../utils/chain";

export async function readContractAPI(fastify: FastifyInstance) {
  fastify.route<readSchema>({
    method: "GET",
    url: "/contract/:chain/:contractAddress/read",
    schema: {
      summary: "Read from contract",
      description: "Call a read function on a contract.",
      tags: ["Contract"],
      operationId: "read",
      ...partialRouteSchema,
      querystring: readRequestQuerySchema,
    },
    handler: async (request, reply) => {
      const { chain, contractAddress } = request.params;
      const { functionName, args } = request.query;

      const chainId = await getChainIdFromChain(chain);
      const contract = await getContractV5({
        chainId,
        contractAddress,
      });

      const returnData = await readContract({
        contract: contract,
        method: resolveMethod(functionName),
        params: args ? args.split(",") : [],
      });

      let result: Static<typeof replyBodySchema>["result"] = "";
      if (Array.isArray(returnData)) {
        result = returnData.map((item) => {
          if (typeof item === "bigint") {
            return item.toString();
          }
          return item;
        });
      } else {
        result =
          //@ts-expect-error : we are not sure if returnData is a bigint or not
          typeof returnData === "bigint" ? returnData.toString() : returnData;
      }

      reply.status(StatusCodes.OK).send({
        result,
      });
    },
  });
}
