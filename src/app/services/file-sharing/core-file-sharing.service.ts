import { CoreAppUtilityService } from "./../util/core-app-utility.service";
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
import { CoreFileStreamer } from "./CoreFileStreamer";

@Injectable({
  providedIn: "root",
})
export class CoreFileSharingService {
  onFileShareError: EventEmitter<FileShareError>;
  onFileProgress: EventEmitter<FileShareProgress>;

  private isSendingFiles: boolean;
  private fileSendQueue: QueueStorage<FileSubmitContext>;

  public static MAX_FILE_CHUNK_SIZE = 16 * 1024;

  constructor(
    private userContextService: UserContextService,
    private appUtilService: CoreAppUtilityService
  ) {
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
          error: e,
        });
        return;
      }

      const fileStreamer: CoreFileStreamer = new CoreFileStreamer(
        submittedFile.file,
        CoreFileSharingService.MAX_FILE_CHUNK_SIZE
      );

      try {
        /**
         * send file START fragment
         */
        await this.sendDataOnChannel(
          dataChannel,
          {
            type: MediaChannelType.FILE,
            fileFragmentType: FileFragmentType.START,
            fileName: submittedFile.file.name,
            totalFragments: fileStreamer.getTotalFragments(),
            fileId: submittedFile.id,
            fileSize: submittedFile.file.size,
            from: this.userContextService.getUserName(),
            to: submittedFile.to,
          },
          submittedFile.to
        );

        if (
          submittedFile.file.size < CoreFileSharingService.MAX_FILE_CHUNK_SIZE
        ) {
          /**
           * no need to send file in chunks as file size is small
           */
          LoggerUtil.logAny(
            `${submittedFile.file.name} is smaller than the maximum allowed chunk size, so sending file without chunks`
          );
        } else {
          /**
           * send file in chunks of size (16 * 1024)
           */
          LoggerUtil.logAny(
            `${submittedFile.file.name} is bigger than the maximum allowed chunk size, so sending file in chunks`
          );
        }

        let offsetCounter: number = 1;
        /**
         * sending file data fragments
         */
        while (!fileStreamer.isEndOfFile()) {
          // LoggerUtil.logAny(
          //   `sending ${offsetCounter} chunk of ${submittedFile.file.name}`
          // );
          const data: ArrayBuffer = await fileStreamer.readBlockAsArrayBuffer();
          const dataString: string =
            this.appUtilService.arrayBufferToString(data);

          /**
           * prepare file fragment payload to send
           */
          const fileFragment: FileData = {
            type: MediaChannelType.FILE,
            fileFragmentType: FileFragmentType.DATA,
            from: this.userContextService.getUserName(),
            to: submittedFile.to,
            fileName: submittedFile.file.name,
            fileId: submittedFile.id,
            fileSize: submittedFile.file.size,
            totalFragments: fileStreamer.getTotalFragments(),
            data: dataString,
          };
          await this.sendDataOnChannel(
            dataChannel,
            fileFragment,
            submittedFile.to
          );

          // emit file progress event
          this.shareFileProgress(
            submittedFile.to,
            submittedFile.id,
            offsetCounter,
            fileStreamer.getTotalFragments()
          );

          offsetCounter++;
        }

        /**
         * send file END fragment
         */
        await this.sendDataOnChannel(
          dataChannel,
          {
            type: MediaChannelType.FILE,
            fileFragmentType: FileFragmentType.START,
            fileName: submittedFile.file.name,
            totalFragments: fileStreamer.getTotalFragments(),
            fileId: submittedFile.id,
            fileSize: submittedFile.file.size,
            from: this.userContextService.getUserName(),
            to: submittedFile.to,
          },
          submittedFile.to
        );
      } catch (e) {
        /**
         * throw error if not able to send the file
         */
        this.onFileShareError.emit({
          currentFileId: submittedFile.id,
          errorCode: FileSendErrorType.GENERIC_ERROR,
          to: submittedFile.to,
          error: e,
        });
        return;
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
   * @param username username of the user to whom data needs to be sent
   */
  private async sendDataOnChannel(
    dataChannel: RTCDataChannel,
    data: FileData,
    username: string
  ): Promise<void> {
    try {
      dataChannel.send(JSON.stringify(data));
      //stop sending file data if data channel buffer is already crossed threshold
      while (
        dataChannel.bufferedAmount > AppConstants.DATACHANNEL_BUFFER_THRESHOLD
      ) {
        await this.appUtilService.delay(
          AppConstants.DATACHANNEL_FILE_SEND_TIMEOUT
        );
      }
      this.updateLastUsedTimestamp(data.to, AppConstants.FILE);
    } catch (e) {
      LoggerUtil.logAny(
        `unable to send file data on datachannel for user ${username}`
      );
      throw e;
    }
  }

  /**
   * update last used timestamp for the specified channel's datachannel
   * @param username username of the user
   * @param channel type of datachannel
   */
  private async updateLastUsedTimestamp(
    username: string,
    channel: string
  ): Promise<void> {
    const webrtcContext: any =
      this.userContextService.getUserWebrtcContext(username);
    webrtcContext[AppConstants.MEDIA_CONTEXT][channel][AppConstants.LAST_USED] =
      new Date();
  }

  /**
   * emit an emit containing the progress of file shared via file sharing service
   * @param username username of the user with whom file is shared
   * @param id unique id of the file
   * @param fragmentOffset fragment offset of the file
   * @param totalFragments total number of fragments in the shared file
   */
  private async shareFileProgress(
    username: string,
    id: string,
    fragmentOffset: number,
    totalFragments: number
  ) {
    this.onFileProgress.emit({
      username,
      id,
      fragmentOffset,
      progress: Math.floor((fragmentOffset / totalFragments) * 100),
    });
  }
}
