import { FastifyInstance } from "fastify";
import { StatusCodes } from "http-status-codes";
import { getContractInstance } from "../../../../core";
import {
  contractEventSchema,
  contractParamSchema,
  standardResponseSchema,
} from "../../../helpers/sharedApiSchemas";
import { Static, Type } from "@sinclair/typebox";

const requestSchema = contractParamSchema;

const querySringSchema = Type.Optional(
  Type.Object(
    {
      from_block: Type.Optional(
        Type.Union([Type.Number(), Type.String()], { default: "0" }),
      ),
      to_block: Type.Optional(
        Type.Union(
          [Type.Number({ default: 0 }), Type.String({ default: "0" })],
          { default: "latest" },
        ),
      ),
      order: Type.Optional(
        Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
          default: "desc",
        }),
      ),
    },
    {
      description:
        "Specify the from and to block numbers to get events for, defaults to all blocks",
    },
  ),
);

// OUTPUT
const responseSchema = Type.Object({
  result: Type.Array(contractEventSchema),
});

responseSchema.example = {
  result: [
    {
      eventName: "ApprovalForAll",
      data: {
        owner: "0xE79ee09bD47F4F5381dbbACaCff2040f2FbC5803",
        operator: "0x3EcDBF3B911d0e9052b64850693888b008e18373",
        approved: true,
      },
      transaction: {
        blockNumber: 36010321,
        blockHash:
          "0x2c388fe429215b6c2934746410a52a3416b7a1725cea6885eaf220f05f50a6ec",
        transactionIndex: 19,
        removed: false,
        address: "0xc8be6265C06aC376876b4F62670adB3c4d72EABA",
        data: "0x0000000000000000000000000000000000000000000000000000000000000001",
        topics: [
          "0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31",
          "0x000000000000000000000000e79ee09bd47f4f5381dbbacacff2040f2fbc5803",
          "0x0000000000000000000000003ecdbf3b911d0e9052b64850693888b008e18373",
        ],
        transactionHash:
          "0xa4143253005103e5203554f4e17e90a517591cd2d5e3b3dceabfbfb8fbdca5f9",
        logIndex: 55,
        event: "ApprovalForAll",
        eventSignature: "ApprovalForAll(address,address,bool)",
      },
    },
    {
      eventName: "Transfer",
      data: {
        from: "0x0000000000000000000000000000000000000000",
        to: "0x1946267d81Fb8aDeeEa28e6B98bcD446c8248473",
        tokenId: {
          type: "BigNumber",
          hex: "0x01",
        },
      },
      transaction: {
        blockNumber: 35439713,
        blockHash:
          "0x0413d9c88a664f46b54cd47d66073f47114fa3b0183ca5f713d4567d345de4a1",
        transactionIndex: 6,
        removed: false,
        address: "0xc8be6265C06aC376876b4F62670adB3c4d72EABA",
        data: "0x",
        topics: [
          "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
          "0x0000000000000000000000000000000000000000000000000000000000000000",
          "0x0000000000000000000000001946267d81fb8adeeea28e6b98bcd446c8248473",
          "0x0000000000000000000000000000000000000000000000000000000000000001",
        ],
        transactionHash:
          "0x6ee82341f1e09511e9502eea45e0ca9e52dd0295a515401834d0d05a5e802da5",
        logIndex: 13,
        event: "Transfer",
        eventSignature: "Transfer(address,address,uint256)",
      },
    },
  ],
};

export async function getAll(fastify: FastifyInstance) {
  fastify.route<{
    Params: Static<typeof requestSchema>;
    Reply: Static<typeof responseSchema>;
    Querystring: Static<typeof querySringSchema>;
  }>({
    method: "GET",
    url: "/contract/:chain_name_or_id/:contract_address/events/getAll",
    schema: {
      description:
        "Get a list of all the events emitted from this contract during the specified time period",
      tags: ["Contract-Events"],
      operationId: "getAllEvents",
      params: requestSchema,
      querystring: querySringSchema,
      response: {
        ...standardResponseSchema,
        [StatusCodes.OK]: responseSchema,
      },
    },
    handler: async (request, reply) => {
      const { chain_name_or_id, contract_address } = request.params;
      const { from_block, to_block, order } = request.query;

      const contract = await getContractInstance(
        chain_name_or_id,
        contract_address,
      );

      let returnData = await contract.events.getAllEvents({
        fromBlock: from_block,
        toBlock: to_block,
        order,
      });

      console.log(JSON.stringify(returnData));
      reply.status(StatusCodes.OK).send({
        result: returnData,
      });
    },
  });
}
