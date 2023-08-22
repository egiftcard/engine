import { ChainOrRpc } from "@thirdweb-dev/sdk";
import { BigNumber } from "ethers";
import { FastifyInstance } from "fastify";
import { Knex } from "knex";
import { env, getSDK } from "../../core";
import {
  getSubmittedTransactions,
  updateTransactionState,
} from "../services/dbOperations";

const MINED_TX_CRON_ENABLED = env.MINED_TX_CRON_ENABLED;

export const checkForMinedTransactionsOnBlockchain = async (
  server: FastifyInstance,
  knex: Knex,
) => {
  if (!MINED_TX_CRON_ENABLED) {
    server.log.warn("Mined Tx Cron is disabled");
    return;
  }
  server.log.info("Running Cron to check for mined transactions on blockchain");
  const trx = await knex.transaction();
  const transactions = await getSubmittedTransactions(knex);
  if (transactions.length === 0) {
    server.log.warn("No transactions to check for mined status");
    return;
  }

  const txReceipts = await Promise.all(
    transactions.map(async (txData) => {
      server.log.debug(
        `Getting receipt for tx: ${txData.txHash} on chain: ${txData.chainId} for queueId: ${txData.identifier}`,
      );
      const sdk = await getSDK(txData.chainId as ChainOrRpc);
      return sdk.getProvider().getTransactionReceipt(txData.txHash!);
    }),
  );

  for (let txReceipt of txReceipts) {
    const txData = transactions.find(
      (tx) => tx.txHash === txReceipt.transactionHash,
    );
    if (txData) {
      server.log.debug(
        `Got receipt for tx: ${txData.txHash} ${txData.identifier}, ${txReceipt.effectiveGasPrice}`,
      );
      await updateTransactionState(
        knex,
        txData.identifier!,
        "mined",
        trx,
        undefined,
        undefined,
        { gasPrice: BigNumber.from(txReceipt.effectiveGasPrice).toString() },
      );
    }
  }
  await trx.commit();
  // await knex.destroy();
};
