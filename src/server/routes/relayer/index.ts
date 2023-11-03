import { Static, Type } from "@sinclair/typebox";
import { ethers } from "ethers";
import { FastifyInstance } from "fastify";
import { StatusCodes } from "http-status-codes";
import { getRelayerById } from "../../../db/relayer/getRelayerById";
import { queueTx } from "../../../db/transactions/queueTx";
import { getContract } from "../../../utils/cache/getContract";
import {
  standardResponseSchema,
  transactionWritesResponseSchema,
} from "../../schemas/sharedApiSchemas";

const ParamsSchema = Type.Object({
  relayerId: Type.String(),
});

const BodySchema = Type.Object({
  request: Type.Any(),
  signature: Type.String(),
  forwarderAddress: Type.String(),
});

const ReplySchema = Type.Composite([
  Type.Object({
    result: Type.Optional(
      Type.Object({
        queueId: Type.String({
          description: "Queue ID",
        }),
      }),
    ),
  }),
  Type.Object({
    error: Type.Optional(
      Type.Object({
        message: Type.String(),
      }),
    ),
  }),
]);

export async function relayTransaction(fastify: FastifyInstance) {
  fastify.route<{
    Params: Static<typeof ParamsSchema>;
    Reply: Static<typeof ReplySchema>;
    Body: Static<typeof BodySchema>;
  }>({
    method: "POST",
    url: "/relayer/:relayerId",
    schema: {
      summary: "Relay a meta-transaction",
      description: "Relay an EIP-2771 meta-transaction",
      tags: ["Relayer"],
      operationId: "relay",
      body: BodySchema,
      response: {
        ...standardResponseSchema,
        [StatusCodes.OK]: transactionWritesResponseSchema,
      },
    },
    handler: async (req, res) => {
      const { relayerId } = req.params;
      const { request, signature, forwarderAddress } = req.body;

      const relayer = await getRelayerById({ id: relayerId });
      if (!relayer) {
        return res.status(400).send({
          error: {
            message: `No relayer found with id '${relayerId}'`,
          },
        });
      }

      if (
        relayer.allowedContracts &&
        !relayer.allowedContracts.includes(request.to.toLowerCase())
      ) {
        return res.status(400).send({
          error: {
            message: `Requesting to relay transaction to unauthorized contract ${request.to}.`,
          },
        });
      }

      const contract = await getContract({
        chainId: relayer.chainId,
        walletAddress: relayer.walletAddress,
        contractAddress: forwarderAddress,
      });

      const valid = await contract.call("verify", [
        request,
        ethers.utils.joinSignature(ethers.utils.splitSignature(signature)),
      ]);

      if (!valid) {
        res.status(400).send({
          error: {
            message: "Verification failed with provided message and signature",
          },
        });
        return;
      }

      const tx = await contract.prepare("execute", [request, signature]);
      const queueId = await queueTx({
        tx,
        chainId: relayer.chainId,
        extension: "forwarder",
      });

      res.status(200).send({
        result: {
          queueId,
        },
      });
    },
  });
}