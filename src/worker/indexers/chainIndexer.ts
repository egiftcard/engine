import { SmartContract } from "@thirdweb-dev/sdk";
import { ethers } from "ethers";
import { getBlockForIndexing } from "../../db/chainIndexers/getChainIndexer";
import { upsertChainIndexer } from "../../db/chainIndexers/upsertChainIndexer";
import { prisma } from "../../db/client";
import {
  bulkInsertContractLogs,
  type ContractLogEntry,
} from "../../db/contractLogs/createContractLogs";
import { getIndexedContracts } from "../../db/indexedContracts/getIndexedContract";
import { getConfig } from "../../utils/cache/getConfig";
import { getContract } from "../../utils/cache/getContract";
import { getSdk } from "../../utils/cache/getSdk";
import { logger } from "../../utils/logger";

export interface GetIndexedContractsLogsParams {
  chainId: number;
  contractAddresses: string[];
  fromBlock: number;
  toBlock: number;
}

/**
 * Used to abstract eth_getLogs
 * requirement: throw if any of the rpc calls fail, otherwise some contracts will be out of sync
 * @param params
 * @returns ethers.Logs[]
 */
const ethGetLogs = async (params: GetIndexedContractsLogsParams) => {
  // Alchemy is wayyy more reliable, faster and supports this
  /*
    const provider = new ethers.providers.AlchemyProvider(
      "mainnet",
      "XtKklSIX8j93iiMXjtTkXVEAs8QpnP8_",
    );

    const input = {
      fromBlock: ethers.utils.hexlify(params.fromBlock),
      toBlock: ethers.utils.hexlify(params.toBlock),
      address: params.contractAddresses,
    };

    const logs = await provider.send("eth_getLogs", [input]);
  */

  const sdk = await getSdk({ chainId: params.chainId });
  const provider = sdk.getProvider();

  console.log(
    `Getting Logs: fromBlock: ${params.fromBlock} toBlock: ${params.toBlock}`,
  );
  const logs = await Promise.all(
    params.contractAddresses.map(async (contractAddress) => {
      const logFilter = {
        address: contractAddress,
        fromBlock: params.fromBlock,
        toBlock: params.toBlock,
      };
      const logs = await provider.getLogs(logFilter);
      return logs;
    }),
  );
  console.log("received logs: ", logs.length);
  return logs.flat();
};

export const getIndexedContractsLogs = async (
  params: GetIndexedContractsLogsParams,
) => {
  const sdk = await getSdk({ chainId: params.chainId });
  const provider = sdk.getProvider();

  // get the log for the contracts
  const logs = await ethGetLogs(params);

  // cache the contracts and abi
  const contractAddressesWithLogs = logs.map((log) => log.address);
  const contracts = await Promise.all(
    contractAddressesWithLogs.map(async (address) => {
      const contract = await getContract({
        chainId: params.chainId,
        contractAddress: address,
      });
      return { contractAddress: address, contract: contract };
    }),
  );
  const contractCache = contracts.reduce((acc, val) => {
    acc[val.contractAddress] = val.contract;
    return acc;
  }, {} as Record<string, SmartContract<ethers.BaseContract>>);

  // cache the blocks and their timestamps
  const uniqueBlockNumbers = [...new Set(logs.map((log) => log.blockNumber))];
  const blockDetails = await Promise.all(
    uniqueBlockNumbers.map(async (blockNumber) => ({
      blockNumber,
      details: await provider.getBlock(blockNumber),
    })),
  );
  const blockCache = blockDetails.reduce((acc, { blockNumber, details }) => {
    acc[blockNumber] = details;
    return acc;
  }, {} as Record<number, ethers.providers.Block>);

  // format the logs to ContractLogEntries
  const formattedLogs = logs.map((log) => {
    const contractAddress = log.address;

    // attempt to decode the log
    let decodedLog;
    let decodedEventName;

    const contract = contractCache[contractAddress];
    if (contract) {
      try {
        const iface = new ethers.utils.Interface(contract.abi);
        const parsedLog = iface.parseLog(log);
        decodedEventName = parsedLog.name;
        decodedLog = parsedLog.eventFragment.inputs.reduce((acc, input) => {
          acc[input.name] = {
            type: input.type,
            value: parsedLog.args[input.name],
          };
          return acc;
        }, {} as Record<string, { type: string; value: string }>);
      } catch (error) {
        logger({
          service: "worker",
          level: "warn",
          message: `Failed to decode log: chainId: ${params.chainId}, contractAddress ${contractAddress}`,
        });
      }
    }

    const block = blockCache[log.blockNumber];

    // format the log entry
    return {
      chainId: params.chainId,
      blockNumber: log.blockNumber,
      contractAddress: log.address,
      transactionHash: log.transactionHash,
      topic0: log.topics[0],
      topic1: log.topics[1],
      topic2: log.topics[2],
      topic3: log.topics[3],
      data: log.data,
      eventName: decodedEventName,
      decodedLog: decodedLog,
      timestamp: new Date(block.timestamp * 1000), // ethers timestamp is s, Date uses ms
      transactionIndex: log.transactionIndex,
      logIndex: log.logIndex,
    } as ContractLogEntry;
  });

  return formattedLogs;
};

export const createChainIndexerTask = async (chainId: number) => {
  const chainIndexerTask = async () => {
    try {
      await prisma.$transaction(
        async (pgtx) => {
          let lastIndexedBlock;
          try {
            lastIndexedBlock = await getBlockForIndexing({ chainId, pgtx });
          } catch (error) {
            // row is locked, return
            return;
          }

          const sdk = await getSdk({ chainId });
          const config = await getConfig();

          const provider = sdk.getProvider();
          const currentBlockNumber = await provider.getBlockNumber();

          // check if up-to-date
          if (lastIndexedBlock >= currentBlockNumber) {
            return;
          }

          // limit max block numbers
          let toBlockNumber = currentBlockNumber;
          if (
            currentBlockNumber - (lastIndexedBlock + 1) >
            config.maxBlocksToIndex
          ) {
            toBlockNumber = lastIndexedBlock + 1 + config.maxBlocksToIndex;
          }

          // get contracts to index
          const indexedContracts = await getIndexedContracts(chainId);
          const indexedContractAddresses = indexedContracts.map(
            (indexedContract) => indexedContract.contractAddress,
          );

          // get all logs for the contracts
          const logs = await getIndexedContractsLogs({
            chainId,
            fromBlock: lastIndexedBlock + 1,
            toBlock: toBlockNumber,
            contractAddresses: indexedContractAddresses,
          });

          console.log("logs:", logs);

          // update the logs
          if (logs.length > 0) {
            await bulkInsertContractLogs(logs);
          }

          // update the block number
          await upsertChainIndexer({
            chainId,
            currentBlockNumber: toBlockNumber,
          });
        },
        {
          timeout: 5 * 60000, // 3 minutes timeout
        },
      );
    } catch (err: any) {
      logger({
        service: "worker",
        level: "error",
        message: `Failed to index: ${chainId}`,
        error: err,
      });
    }
  };

  return chainIndexerTask;
};
