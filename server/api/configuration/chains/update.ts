import { Static, Type } from "@sinclair/typebox";
import { FastifyInstance } from "fastify";
import { StatusCodes } from "http-status-codes";
import { getConfiguration } from "../../../../src/db/configuration/getConfiguration";
import { updateConfiguration } from "../../../../src/db/configuration/updateConfiguration";
import { ReplySchema } from "./get";

const BodySchema = Type.Object({
  chainOverrides: Type.Array(
    Type.Object({
      name: Type.String(),
      chain: Type.String(),
      rpc: Type.Array(Type.String()),
      nativeCurrency: Type.Object({
        name: Type.String(),
        symbol: Type.String(),
        decimals: Type.Number(),
      }),
      chainId: Type.Number(),
      slug: Type.String(),
    }),
  ),
});

BodySchema.examples = [
  [
    {
      name: "Localhost",
      chain: "ETH",
      rpc: ["http://localhost:8545"],
      nativeCurrency: {
        name: "Ether",
        symbol: "ETH",
        decimals: 18,
      },
      chainId: 1337,
      slug: "localhost",
    },
  ],
];

export async function updateChainsConfiguration(fastify: FastifyInstance) {
  fastify.route<{
    Body: Static<typeof BodySchema>;
    Reply: Static<typeof ReplySchema>;
  }>({
    method: "POST",
    url: "/configuration/chains",
    schema: {
      summary: "Update chain overrides configuration",
      description: "Update the engine configuration for chain overrides",
      tags: ["Configuration"],
      operationId: "updateChainsConfiguration",
      body: BodySchema,
      response: {
        [StatusCodes.OK]: ReplySchema,
      },
    },
    handler: async (req, res) => {
      await updateConfiguration({
        chainOverrides: JSON.stringify(req.body.chainOverrides),
      });

      const config = await getConfiguration();
      res.status(200).send({
        result: config.chainOverrides,
      });
    },
  });
}
