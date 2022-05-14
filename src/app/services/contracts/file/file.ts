import { MediaChannelType } from "../enum/MediaChannelType";

export interface TransferredFileContext {
  id: string;
  fileName: string;
  isSent: boolean;
  progress?: number;
  fileExtension: string;
  isFragmented: boolean;
  fragmentOffsetAt: number;
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
  error: any;
}

export enum FileSendErrorType {
  GENERIC_ERROR = "genric_error",
  CHANNEL_NOT_OPEN = "channel_not_open",
}

export interface FileShareProgress {
  id: string;
  progress: number;
  fragmentOffset: number;
  isPaused?: boolean;
  username: string; // username of the user with whom file is shared
}

export interface FileData {
  type: MediaChannelType;
  fileFragmentType: FileFragmentType;
  fileName: string;
  totalFragments?: number;
  fragmentOffset?: number;
  fileId: string;
  fileSize?: number;
  from: string;
  to: string;
  data?: string | ArrayBuffer;
}

export enum FileFragmentType {
  START = "start",
  DATA = "data",
  END = "end",
}
