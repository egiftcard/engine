import { Static, Type } from "@sinclair/typebox";
import { type AbiFunction } from "abitype";
import { FastifyInstance } from "fastify";
import { StatusCodes } from "http-status-codes";
import {
  ContractOptions,
  defineChain,
  getContract,
  prepareContractCall,
  resolveMethod,
} from "thirdweb";
import { resolvePromisedValue } from "thirdweb/utils";
import { queueTxRaw } from "../../../../db/transactions/queueTxRaw";
import { thirdwebClient } from "../../../../utils/sdk";
import {
  contractParamSchema,
  requestQuerystringSchema,
  standardResponseSchema,
  transactionWritesResponseSchema,
} from "../../../schemas/sharedApiSchemas";
import { txOverrides } from "../../../schemas/txOverrides";
import { walletHeaderSchema } from "../../../schemas/wallet";
import { getChainIdFromChain } from "../../../utils/chain";

// INPUT
const writeRequestBodySchema = Type.Object({
  functionName: Type.String({
    description: "The function to call on the contract",
  }),
  args: Type.Array(
    Type.Union([
      Type.String({
        description: "The arguments to call on the function",
      }),
      Type.Tuple([Type.String(), Type.String()]),
      Type.Object({}),
      Type.Array(Type.Any()),
      Type.Any(),
    ]),
  ),
  ...txOverrides.properties,
});

// Adding example for Swagger File
writeRequestBodySchema.examples = [
  {
    functionName: "transferFrom",
    args: [
      "0x1946267d81Fb8aDeeEa28e6B98bcD446c8248473",
      "0x3EcDBF3B911d0e9052b64850693888b008e18373",
      "0",
    ],
  },
];

// LOGIC
export async function writeToContract(fastify: FastifyInstance) {
  fastify.route<{
    Body: Static<typeof writeRequestBodySchema>;
    Params: Static<typeof contractParamSchema>;
    Reply: Static<typeof transactionWritesResponseSchema>;
    Querystring: Static<typeof requestQuerystringSchema>;
  }>({
    method: "POST",
    url: "/contract/:chain/:contractAddress/write",
    schema: {
      summary: "Write to contract",
      description: "Call a write function on a contract.",
      tags: ["Contract"],
      operationId: "write",
      params: contractParamSchema,
      headers: walletHeaderSchema,
      querystring: requestQuerystringSchema,
      response: {
        ...standardResponseSchema,
        [StatusCodes.OK]: transactionWritesResponseSchema,
      },
      body: writeRequestBodySchema,
    },
    handler: async (request, reply) => {
      const { chain, contractAddress } = request.params;
      const { simulateTx } = request.query;
      const { functionName, args, txOverrides } = request.body;
      const {
        "x-backend-wallet-address": walletAddress,
        "x-account-address": accountAddress,
        "x-idempotency-key": idempotencyKey,
      } = request.headers as Static<typeof walletHeaderSchema>;

      const chainId = await getChainIdFromChain(chain);
      const contract = await getContract({
        chain: defineChain(chainId),
        client: thirdwebClient,
        address: contractAddress,
      });

      // functionName may be a function signature or name.
      // If signature ("function mintTo(address to)"), use directly.
      // If name, ("mintTo"), resolve the signature from the ABI (less performant).
      let method:
        | ((contract: Readonly<ContractOptions<[]>>) => Promise<AbiFunction>)
        | `function ${string}`;
      if (functionName.startsWith("function ")) {
        method = functionName as `function ${string}`;
      } else {
        method = await resolveMethod(functionName);
      }

      const transaction = prepareContractCall({
        contract,
        method,
        params: args,
        value: txOverrides?.value ? BigInt(txOverrides.value) : undefined,
      });

      // @TODO: HANDLE USEROP

      const { id: queueId } = await queueTxRaw({
        chainId: chainId.toString(),
        fromAddress: walletAddress,
        toAddress: contractAddress,
        accountAddress,
        data: await resolvePromisedValue(transaction.data),
        extension: "none",
        simulateTx,
        idempotencyKey,
      });

      reply.status(StatusCodes.OK).send({
        result: {
          queueId,
        },
      });
    },
  });
}
