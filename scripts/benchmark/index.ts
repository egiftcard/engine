import { Static } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";
import autocannon from "autocannon";
import * as dotenv from "dotenv";
import { env } from "process";
import { transactionResponseSchema } from "../../server/schemas/transaction";

dotenv.config({
  debug: true,
  override: true,
  path: ".env.benchmark",
});

function logInfo(msg: string) {
  console.log(`[INFO] ${msg}`);
}
function logError(msg: string) {
  console.error(`[ERROR] ${msg}`);
}

function getBenchmarkOpts() {
  if (!env.THIRDWEB_SDK_SECRET_KEY) {
    throw new Error("THIRDWEB_SDK_SECRET_KEY is not set");
  }
  const opts = {
    THIRDWEB_SDK_SECRET_KEY: env.THIRDWEB_SDK_SECRET_KEY,
    BENCHMARK_HOST: env.BENCHMARK_HOST ?? "http://127.0.0.1:3005",
    BENCHMARK_URL_PATH:
      env.BENCHMARK_URL_PATH ??
      "/contract/polygon/0x01De66609582B874FA34ab288859ACC4592aec04/write",
    BENCHMARK_POST_BODY:
      env.BENCHMARK_POST_BODY ??
      '{ "function_name": "mintTo", "args": ["0xCF3D06a19263976A540CFf8e7Be7b026801C52A6", "0","", "1"] }',
    BENCHMARK_CONCURRENCY: parseInt(env.BENCHMARK_CONCURRENCY ?? "1"),
    BENCHMARK_REQUESTS: parseInt(env.BENCHMARK_REQUESTS ?? "1"),
  };
  return opts;
}

async function sendTransaction(opts: ReturnType<typeof getBenchmarkOpts>) {
  const txnIds: string[] = [];

  return new Promise<string[]>(async (resolve, reject) => {
    const instance = autocannon({
      url: `${opts.BENCHMARK_HOST}`,
      connections: opts.BENCHMARK_CONCURRENCY,
      amount: opts.BENCHMARK_REQUESTS,
      requests: [
        {
          path: opts.BENCHMARK_URL_PATH,
          headers: {
            authorization: `Bearer ${opts.THIRDWEB_SDK_SECRET_KEY}`,
            "content-type": "application/json",
          },
          method: "POST",
          body: opts.BENCHMARK_POST_BODY,
          // @ts-ignore: autocannon types are 3 minor versions behind.
          // This was one of the new field that was recently added
          onResponse: (status: number, body: string) => {
            if (status === 200) {
              const parsedResult: { result?: string } = JSON.parse(body);
              if (!parsedResult.result) {
                logError(
                  `Response body does not contain a "result" field: ${body}`,
                );
                return reject({
                  error: "Response body does not contain a 'result' field",
                });
              }
              txnIds.push(parsedResult.result);
            } else {
              logError(
                `Received status code ${status} from server. Body: ${body}`,
              );
              return reject({
                error: `Received status code ${status} from server.`,
              });
            }
          },
        },
      ],
    });

    autocannon.track(instance, {
      renderLatencyTable: false,
      renderResultsTable: false,
    });

    const result = autocannon.printResult(await instance);
    logInfo(result);
    resolve(txnIds);
  });
}

async function fetchStatus({
  txnId,
  host,
  apiKey,
}: {
  txnId: string;
  host: string;
  apiKey: string;
}) {
  const resp = await fetch(`${host}/transaction/status/${txnId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
  const raw = await resp.json();
  return raw.result;
}

async function tryUntilCompleted({
  txnId,
  host,
  apiKey,
}: {
  txnId: string;
  host: string;
  apiKey: string;
}): Promise<any> {
  try {
    const resp = await fetch(`${host}/transaction/status/${txnId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    const raw = await resp.json();
    // logInfo(
    //   `Got status: ${raw.result.status}, queueId: ${raw.result.queueId}. Retrying...`,
    // );
    if (raw.result.status === "mined" || raw.result.status === "errored") {
      return raw.result;
    }
    // logInfo("Sleeping for 10 second...");
    await sleep(10);
    return tryUntilCompleted({ txnId, host, apiKey });
  } catch (error) {
    console.error("tryUntilCompleted error", error);
  }
}

function parseStatus(
  status: unknown,
): Static<typeof transactionResponseSchema> {
  const C = TypeCompiler.Compile(transactionResponseSchema);
  const isValue = C.Check(status);
  if (!isValue) {
    throw new Error(`Invalid response from server: ${status}`);
  }
  return status;
}

function sleep(timeInSeconds: number) {
  return new Promise((resolve) => setTimeout(resolve, timeInSeconds * 1_000));
}

async function processTransaction(
  txnIds: string[],
  opts: ReturnType<typeof getBenchmarkOpts>,
) {
  // give queue some time to process things
  logInfo(
    "Checking for status until all transactions are mined/errored. Can take upto 30 seconds or more...",
  );
  // await sleep(30);
  const statuses = await Promise.all(
    txnIds.map((txnId) => {
      return tryUntilCompleted({
        apiKey: opts.THIRDWEB_SDK_SECRET_KEY,
        host: opts.BENCHMARK_HOST,
        txnId,
      });
    }),
  );

  type txn = {
    timeTaken?: number;
    txnHash?: string;
    status: string;
  };
  const erroredTransaction: txn[] = [];
  const submittedTransaction: txn[] = [];
  const processedTransaction: txn[] = [];
  const minedTransaction: txn[] = [];
  // logInfo("statuses", statuses);
  statuses.map((status) => {
    const parsedStatus = parseStatus(status);
    switch (parsedStatus.status) {
      case "errored": {
        erroredTransaction.push({
          status: parsedStatus.status,
        });
        break;
      }
      default: {
        if (
          parsedStatus.txProcessedTimestamp &&
          parsedStatus.createdTimestamp
        ) {
          // throw new Error(
          //   `Invalid response from server for status transaction: ${JSON.stringify(
          //     parsedStatus,
          //   )}`,
          // );
          processedTransaction.push({
            status: parsedStatus.status!,
            timeTaken:
              new Date(parsedStatus.txProcessedTimestamp).getTime() -
              new Date(parsedStatus.createdTimestamp).getTime(),
            txnHash: parsedStatus.txHash,
          });
        }

        if (
          parsedStatus.txSubmittedTimestamp &&
          parsedStatus.createdTimestamp
        ) {
          // throw new Error(
          //   `Invalid response from server for submitted transaction: ${JSON.stringify(
          //     parsedStatus,
          //   )}`,
          // );
          submittedTransaction.push({
            status: parsedStatus.status!,
            timeTaken:
              new Date(parsedStatus.txSubmittedTimestamp).getTime() -
              new Date(parsedStatus.createdTimestamp).getTime(),
            txnHash: parsedStatus.txHash,
          });
        }

        if (parsedStatus.txMinedTimestamp && parsedStatus.createdTimestamp) {
          // throw new Error(
          //   `Invalid response from server for mined transaction: ${JSON.stringify(
          //     parsedStatus,
          //   )}`,
          minedTransaction.push({
            status: parsedStatus.status!,
            timeTaken:
              new Date(parsedStatus.txMinedTimestamp).getTime() -
              new Date(parsedStatus.createdTimestamp).getTime(),
            txnHash: parsedStatus.txHash,
          });
        }
        break;
      }
    }
  });

  console.table({
    error: erroredTransaction.length,
    processing: processedTransaction.length,
    submittedToMempool: submittedTransaction.length,
    minedTransaction: minedTransaction.length,
  });

  const sortedProcessedTransaction = processedTransaction.sort(
    (a, b) => (a.timeTaken ?? 0) - (b.timeTaken ?? 0),
  );

  const sortedSubmittedTransaction = submittedTransaction.sort(
    (a, b) => (a.timeTaken ?? 0) - (b.timeTaken ?? 0),
  );

  const sortedMinedTransaction = minedTransaction.sort(
    (a, b) => (a.timeTaken ?? 0) - (b.timeTaken ?? 0),
  );

  console.table({
    "Avg Processing Time":
      processedTransaction.reduce(
        (acc, curr) => acc + (curr.timeTaken ?? 0),
        0,
      ) /
        processedTransaction.length /
        1_000 +
      " sec",
    "Median Processing Time":
      (sortedProcessedTransaction[
        Math.floor(sortedProcessedTransaction.length / 2)
      ].timeTaken ?? 0) /
        1_000 +
      " sec",
    "Min Processing Time":
      (sortedProcessedTransaction[0].timeTaken ?? 0) / 1_000 + " sec",
    "Max Processing Time":
      (sortedProcessedTransaction[sortedProcessedTransaction.length - 1]
        .timeTaken ?? 0) /
        1_000 +
      " sec",
  });

  console.table({
    "Avg Submission Time":
      submittedTransaction.reduce(
        (acc, curr) => acc + (curr.timeTaken ?? 0),
        0,
      ) /
        submittedTransaction.length /
        1_000 +
      " sec",
    "Median Submission Time":
      (sortedSubmittedTransaction[Math.floor(submittedTransaction.length / 2)]
        .timeTaken ?? 0) /
        1_000 +
      " sec",
    "Min Submission Time":
      (sortedSubmittedTransaction[0].timeTaken ?? 0) / 1_000 + " sec",
    "Max Submission Time":
      (sortedSubmittedTransaction[sortedSubmittedTransaction.length - 1]
        .timeTaken ?? 0) /
        1_000 +
      " sec",
  });

  console.table({
    "Avg Mined Time":
      minedTransaction.reduce((acc, curr) => acc + (curr.timeTaken ?? 0), 0) /
        minedTransaction.length /
        1_000 +
      " sec",
    "Median Mined Time":
      (sortedMinedTransaction[Math.floor(minedTransaction.length / 2)]
        .timeTaken ?? 0) /
        1_000 +
      " sec",
    "Min Mined Time":
      (sortedMinedTransaction[0].timeTaken ?? 0) / 1_000 + " sec",
    "Max Mined Time":
      (sortedMinedTransaction[sortedMinedTransaction.length - 1].timeTaken ??
        0) /
        1_000 +
      " sec",
  });

  return {
    erroredTransaction,
    submittedTransaction,
    processedTransaction,
    minedTransaction,
  };
}

function confirmTransaction() {}

function getBlockStats() {}

// async/await
async function runBenchmark() {
  const opts = getBenchmarkOpts();

  logInfo(
    `Benchmarking ${opts.BENCHMARK_HOST}${opts.BENCHMARK_URL_PATH} with ${opts.BENCHMARK_REQUESTS} requests and a concurrency of ${opts.BENCHMARK_CONCURRENCY}`,
  );
  logInfo("Sending transactions...");
  const txnIds = await sendTransaction(opts);

  logInfo("Checking time taken for submission to mempool");
  await processTransaction(txnIds, opts);
}

runBenchmark().catch((e) => {
  console.error("Error while running benchmark:");
  console.error(e);
  process.exit(1);
});
