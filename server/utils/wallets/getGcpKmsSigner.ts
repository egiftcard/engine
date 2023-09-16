import { GcpKmsSigner } from "ethers-gcp-kms-signer";
import { env } from "../../../core/env";
import { WalletType } from "../../../src/schema/wallet";

interface GetGcpKmsSignerParams {
  gcpKmsKeyId: string;
  gcpKmsKeyVersionId: string;
}

export const getGcpKmsSigner = ({
  gcpKmsKeyId,
  gcpKmsKeyVersionId,
}: GetGcpKmsSignerParams) => {
  if (env.WALLET_CONFIGURATION.type !== WalletType.gcpKms) {
    throw new Error(`Server was not configured for GCP KMS.`);
  }

  return new GcpKmsSigner({
    projectId: env.WALLET_CONFIGURATION.gcpApplicationProjectId,
    locationId: env.WALLET_CONFIGURATION.gcpKmsLocationId,
    keyRingId: env.WALLET_CONFIGURATION.gcpKmsKeyRingId,
    keyId: gcpKmsKeyId,
    keyVersion: gcpKmsKeyVersionId,
  });
};
