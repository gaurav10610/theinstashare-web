import { QueueStorage } from "./../../util/QueueStorage";
import { TransferredFileContext } from "../file/file";

export interface FileTransferContextSpec {
  fileQueues: Map<string, QueueStorage<File>>;
  fileContext: Map<string, Map<string, TransferredFileContext>>;
  hasFileContext(username: string): boolean;
  initializeFileContext(username: string): void;
  getFileContext(username: string): Map<string, TransferredFileContext>;
  getSharedFiles(
    username: string,
    needSentFiles: boolean
  ): TransferredFileContext[];
  hasFileQueue(username: string): boolean;
  initializeFileQueue(username: string): void;
  getFileQueue(username: string): QueueStorage<File>;
}
