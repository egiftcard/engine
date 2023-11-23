import { getBlock } from "@thirdweb-dev/sdk";
import { ERC4337EthersSigner } from "@thirdweb-dev/wallets/dist/declarations/src/evm/connectors/smart-wallet/lib/erc4337-signer";
import { prisma } from "../../db/client";
import { getSentUserOps } from "../../db/transactions/getSentUserOps";
import { updateTx } from "../../db/transactions/updateTx";
import { TransactionStatusEnum } from "../../server/schemas/transaction";
import { getSdk } from "../../utils/cache/getSdk";
import { logger } from "../../utils/logger";

export const updateMinedUserOps = async () => {
  try {
    await prisma.$transaction(
      async (pgtx) => {
        const userOps = await getSentUserOps({ pgtx });

        if (userOps.length === 0) {
          return;
        }

        // TODO: Improve spaghetti code...
        const updatedUserOps = (
          await Promise.all(
            userOps.map(async (userOp) => {
              const sdk = await getSdk({
                chainId: parseInt(userOp.chainId!),
                walletAddress: userOp.signerAddress!,
                accountAddress: userOp.accountAddress!,
              });

              const signer = sdk.getSigner() as ERC4337EthersSigner;
              const txHash = await signer.smartAccountAPI.getUserOpReceipt(
                userOp.userOpHash!,
                3000,
              );

              if (!txHash) {
                // If no receipt was received, return undefined to filter out tx
                return undefined;
              }

              const tx = await signer.provider!.getTransaction(txHash);
              const minedAt = new Date(
                (
                  await getBlock({
                    block: tx.blockNumber!,
                    network: sdk.getProvider(),
                  })
                ).timestamp * 1000,
              );

              return {
                ...userOp,
                blockNumber: tx.blockNumber!,
                minedAt,
              };
            }),
          )
        ).filter((userOp) => !!userOp);

        await Promise.all(
          updatedUserOps.map(async (userOp) => {
            await updateTx({
              pgtx,
              queueId: userOp!.id,
              data: {
                status: TransactionStatusEnum.Mined,
                minedAt: userOp!.minedAt,
              },
            });

            logger.worker.info(
              `[User Op] [${userOp!.id}] Updated with receipt`,
            );
          }),
        );
      },
      {
        timeout: 5 * 60000,
      },
    );
  } catch (err) {
    logger.worker.error(`Failed to update receipts with error - ${err}`);
    return;
  }
};
