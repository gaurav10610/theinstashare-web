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

export interface FileSubmitContext {
  id: string;
  file: File;
  to: string; // username of the user to whom file needs to be sent
  channelToSendFile: string;
}

export interface FileShareError {
  currentFileId: string;
  to: string; // username of the user to whom file needs to be sent
  errorCode: FileSendErrorType;
}

export enum FileSendErrorType {
  GENERIC_ERROR = "genric_error",
  CHANNEL_NOT_OPEN = "channel_not_open",
}

export interface FileShareProgress {
  id: string;
  uploadProgress: number;
  totalFragments: number;
  fragmentOffset: number;
  isPaused?: boolean
}
