import { LoggerUtil } from "./../logging/LoggerUtil";
import { QueueStorage } from "./../util/QueueStorage";
import {
  FileSendErrorType,
  FileShareError,
  FileShareProgress,
  FileSubmitContext,
} from "./../contracts/file/file";
import { EventEmitter, Injectable } from "@angular/core";
import { UserContextService } from "../context/user.context.service";
import { AppConstants } from "../AppConstants";

@Injectable({
  providedIn: "root",
})
export class CoreFileSharingService {
  onFileShareError: EventEmitter<FileShareError>;
  onFileProgress: EventEmitter<FileShareProgress>;

  private isSendingFiles: boolean;
  private fileSendQueue: QueueStorage<FileSubmitContext>;

  private MAX_CHUNK_SIZE = 16 * 1024;

  constructor(public userContextService: UserContextService) {
    this.onFileShareError = new EventEmitter(true);
    this.onFileProgress = new EventEmitter(true);
    this.isSendingFiles = false;
    this.fileSendQueue = new QueueStorage<FileSubmitContext>();
  }

  submitFileToSend(fileToSend: FileSubmitContext): void {
    this.fileSendQueue.enqueue(fileToSend);
  }

  startSharing(): void {
    if (!this.isSendingFiles) {
      this.startSendingFiles();
    }
  }

  private startSendingFiles(): void {
    /**
     * start iterating the files queue and start sending files one by one
     */
    while (this.fileSendQueue.isEmpty()) {
      /**
       * set this to specify that file sender job is currenly running
       */
      this.isSendingFiles = true;
      const submittedFile: FileSubmitContext = this.fileSendQueue.front();
      try {
        const dataChannel: RTCDataChannel =
          this.userContextService.getUserWebrtcContext(submittedFile.to)[
            AppConstants.MEDIA_CONTEXT
          ][submittedFile.channelToSendFile][AppConstants.DATACHANNEL];

        /**
         * if data channel is not open state then stop sending files anymore
         */
        if (dataChannel.readyState !== "open") {
          throw Error();
        }
      } catch (e) {
        /**
         *
         * emit a file share error if there is no open data channel found with user
         */
        this.onFileShareError.emit({
          currentFileId: submittedFile.id,
          to: submittedFile.to,
          errorCode: FileSendErrorType.CHANNEL_NOT_OPEN,
        });
        return;
      }

      if (submittedFile.file.size < this.MAX_CHUNK_SIZE) {
        /**
         * no need to send file in chunks as file size is small
         */
        try {
        } catch (e) {
          /**
           * throw error if not able to send the file
           */
          this.onFileShareError.emit({
            currentFileId: submittedFile.id,
            errorCode: FileSendErrorType.GENERIC_ERROR,
            to: submittedFile.to,
          });
          return;
        }
      } else {
        /**
         * send file in chunks of size (16 * 1024)
         */
      }
    }
    this.isSendingFiles = false;
  }

  /**
   * send file data on provided data channel
   * @param dataChannel data channel to be used for sending the data
   * @param data data to be sent
   */
  private sendDataOnChannel(
    dataChannel: RTCDataChannel,
    data: any,
    username: string
  ) {
    try {
      dataChannel.send(data);
    } catch (e) {
      LoggerUtil.logAny(
        `unable to send file data on datachannel for user ${username}`
      );
      throw e;
    }
  }
}
