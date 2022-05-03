import { MediaChannelType } from "./../contracts/enum/MediaChannelType";
import { LoggerUtil } from "./../logging/LoggerUtil";
import { QueueStorage } from "./../util/QueueStorage";
import {
  FileFragmentType,
  FileData,
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

  /**
   * trigger file sender job if it's not running already
   */
  startSharing(): void {
    if (!this.isSendingFiles) {
      LoggerUtil.logAny(`triggered the file sender job`);
      this.startSendingFiles();
    }
  }

  /**
   * send all the queued file
   */
  private async startSendingFiles(): Promise<void> {
    /**
     * set this to specify that file sender job is currenly running
     */
    this.isSendingFiles = true;

    /**
     * start iterating the files queue and start sending files one by one
     */
    while (!this.fileSendQueue.isEmpty()) {
      const submittedFile: FileSubmitContext = this.fileSendQueue.front();
      let dataChannel: RTCDataChannel;
      try {
        dataChannel = this.userContextService.getUserWebrtcContext(
          submittedFile.to
        )[AppConstants.MEDIA_CONTEXT][submittedFile.channelToSendFile][
          AppConstants.DATACHANNEL
        ];

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
        LoggerUtil.logAny(
          `${submittedFile.file.name} is smaller than the maximum allowed chunk size, so sending file without chunks`
        );
        try {
          /**
           * send file start fragment
           */
          this.sendFileMetadata(
            dataChannel,
            submittedFile,
            FileFragmentType.START
          );

          /**
           * send file end fragment
           */
          this.sendFileMetadata(
            dataChannel,
            submittedFile,
            FileFragmentType.END
          );
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
        LoggerUtil.logAny(
          `${submittedFile.file.name} is bigger than the maximum allowed chunk size, so sending file in chunks`
        );

        try {
          /**
           * send file start fragment
           */
          this.sendFileMetadata(
            dataChannel,
            submittedFile,
            FileFragmentType.START
          );

          /**
           * send file end fragment
           */
          this.sendFileMetadata(
            dataChannel,
            submittedFile,
            FileFragmentType.END
          );
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
      }
      this.fileSendQueue.dequeue();
      LoggerUtil.logAny(`${submittedFile.file.name} is sent successfully`);
    }
    if (this.fileSendQueue.isEmpty()) {
      this.isSendingFiles = false;
    } else {
      this.startSendingFiles();
    }
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

  /**
   * send start/end file metadata for a file being transferred
   *
   * @param dataChannel datachannel to route the message
   * @param file file which needs to be tranferred
   * @param fileFragmentType
   */
  private sendFileMetadata(
    dataChannel: RTCDataChannel,
    file: FileSubmitContext,
    fileFragmentType: FileFragmentType
  ) {
    const fileMetadata: FileData = {
      type: MediaChannelType.FILE,
      fileFragmentType,
      fileName: file.file.name,
      totalFragments: 0, // change it afterwards
      fileId: file.id,
      fileSize: file.file.size,
      from: this.userContextService.getUserName(),
      to: file.to,
    };
    dataChannel.send(JSON.stringify(fileMetadata));
    this.updateLastUsedTimestamp(file.to, AppConstants.FILE);
  }

  /**
   * update last used timestamp for the specified channel's datachannel
   * @param username username of the user
   * @param channel type of datachannel
   */
  private updateLastUsedTimestamp(username: string, channel: string) {
    const webrtcContext: any =
      this.userContextService.getUserWebrtcContext(username);
    webrtcContext[AppConstants.MEDIA_CONTEXT][channel][AppConstants.LAST_USED] =
      new Date();
  }
}
