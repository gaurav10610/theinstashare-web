export interface TransferredFileContext {
  id: string;
  fileName: string;
  isSent: boolean;
  downloadProgress?: number;
  uploadProgress?: number;
  fileExtension: string;
  isFragmented: boolean;
  fragmentOffset: number;
  totalFragments: number;
  fileBuffer?: any[];
  lastPartReceivedAt: Date;
  lastAcknowledgementAt: Date;
  from: string;
  isPaused: boolean;
  size: number;
  icon: string;
}
