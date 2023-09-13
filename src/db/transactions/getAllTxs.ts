import { Static } from "@sinclair/typebox";
import {
  TransactionStatusEnum,
  transactionResponseSchema,
} from "../../../server/schemas/transaction";
import { ContractExtension } from "../../schema/extension";
import { prisma } from "../client";
import { cleanTxs } from "./cleanTxs";

interface GetAllTxsParams {
  page: number;
  limit: number;
  filter?: TransactionStatusEnum;
  extensions?: ContractExtension[];
}

export const getAllTxs = async ({
  page,
  limit,
  filter,
  extensions,
}: GetAllTxsParams): Promise<Static<typeof transactionResponseSchema>[]> => {
  let filterBy:
    | "queuedAt"
    | "sentAt"
    | "processedAt"
    | "minedAt"
    | "errorMessage"
    | undefined;

  if (filter === TransactionStatusEnum.Queued) {
    filterBy = "queuedAt";
  } else if (filter === TransactionStatusEnum.Submitted) {
    filterBy = "sentAt";
  } else if (filter === TransactionStatusEnum.Processed) {
    filterBy = "processedAt";
  } else if (filter === TransactionStatusEnum.Mined) {
    filterBy = "minedAt";
  } else if (filter === TransactionStatusEnum.Errored) {
    filterBy = "errorMessage";
  }

  // TODO: Cleaning should be handled by zod
  const txs = await prisma.transactions.findMany({
    where: {
      ...(filterBy
        ? {
            [filterBy]: {
              not: null,
            },
          }
        : {}),
      ...(extensions
        ? {
            extension: {
              in: extensions,
            },
          }
        : {}),
    },
    orderBy: [
      {
        queuedAt: "desc",
      },
    ],
    skip: (page - 1) * limit,
    take: limit,
  });

  return cleanTxs(txs);
};
