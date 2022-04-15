import { TransferredFileContext } from "../file/TransferredFileContext";

export interface FileTransferContextSpec {
    fileContext: Map<string, TransferredFileContext[]>;
    hasFileContext(username: string): boolean;
    initializeFileContext(username: string): void;
    getFileContext(username: string): TransferredFileContext[];
}