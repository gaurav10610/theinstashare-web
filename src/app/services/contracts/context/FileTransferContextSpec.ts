import { TransferredFileContext } from "../file/file-transfer";

export interface FileTransferContextSpec {
  fileContext: Map<string, Map<string, TransferredFileContext>>;
  hasFileContext(username: string): boolean;
  initializeFileContext(username: string): void;
  getFileContext(username: string): Map<string, TransferredFileContext>;
  getSharedFiles(
    username: string,
    needSentFiles: boolean
  ): TransferredFileContext[];
}
