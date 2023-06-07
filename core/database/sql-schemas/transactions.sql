CREATE TABLE IF NOT EXISTS transactions (
    identifier uuid NOT NULL UNIQUE PRIMARY KEY,
    "walletAddress" VARCHAR(42) NOT NULL,
    "contractAddress" VARCHAR(42) NOT NULL,
    "toAddress" VARCHAR(42),
    "chainId" VARCHAR(40) NOT NULL,
    "extension" VARCHAR(20),
    "submittedTxNonce" INT,
    "txType" VARCHAR(2),
    "txHash" VARCHAR(255),
    "encodedInputData" TEXT,
    "rawFunctionName" VARCHAR(255),
    "rawFunctionArgs" TEXT,
    "createdTimestamp" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedTimestamp" TIMESTAMP,
    "txSubmittedTimestamp" TIMESTAMP,
    "txProcessedTimestamp" TIMESTAMP,
    "txRetryTimestamp" TIMESTAMP,
    "txProcessed" BOOLEAN,
    "txSubmitted" BOOLEAN,
    "txMined" BOOLEAN,
    "txErrored" BOOLEAN,
    "gasPrice" VARCHAR(50),
    "gasLimit" VARCHAR(50),
    "maxPriorityFeePerGas" VARCHAR(50),
    "maxFeePerGas" VARCHAR(50)
);

ALTER TABLE transactions
ALTER COLUMN "rawFunctionArgs" TYPE TEXT,
ALTER COLUMN "extension" TYPE VARCHAR(100),
ALTER COLUMN "submittedTxNonce" TYPE BIGINT,
ALTER COLUMN "chainId" TYPE VARCHAR(100);