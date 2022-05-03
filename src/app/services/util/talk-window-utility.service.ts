import { Injectable, ApplicationRef } from "@angular/core";
import { DeviceDetectorService } from "ngx-device-detector";
import { AppConstants } from "../AppConstants";
import { TalkWindowContextService } from "../context/talk-window-context.service";
import { UserContextService } from "../context/user.context.service";
import { LoggerUtil } from "../logging/LoggerUtil";
import { CoreAppUtilityService } from "./core-app-utility.service";

@Injectable({
  providedIn: "root",
})
export class TalkWindowUtilityService {
  constructor(
    private userContextService: UserContextService,
    private talkWindowContextService: TalkWindowContextService,
    public appRef: ApplicationRef,
    private deviceDetectorService: DeviceDetectorService,
    private coreAppUtilService: CoreAppUtilityService
  ) {}

  /**
   * update user status in contact list
   * @param connected boolean flag to distinguish whether user is connected or
   * disconnected
   *
   * @param username username of the user whose status needs to be updated
   */
  updateUserStatus(connected: boolean, username: string) {
    if (username !== this.userContextService.username) {
      if (
        connected &&
        !this.talkWindowContextService.userStatus.has(username)
      ) {
        this.talkWindowContextService.activeUsers.push(username);
      }
      this.talkWindowContextService.userStatus.set(username, connected);
    }
  }

  /**
   * load chat history for curretly selected user from user's message context
   *
   * @param username username of the user who's chat history has to be loaded
   *
   */
  loadChatHistory(username: string) {
    return new Promise<void>((resolve) => {
      LoggerUtil.logAny("loading chat history for " + username);

      /**
       * if user's message context doesn't exist then initialize it
       */
      if (!this.talkWindowContextService.hasMessageContext(username)) {
        this.talkWindowContextService.initializeMessageContext(username);
      }

      if (
        this.userContextService.getUserWebrtcContext(username) &&
        this.userContextService.getUserWebrtcContext(username).unreadCount !== 0
      ) {
        /**
         * acknowledge the unseen messages
         *
         */
        this.acknowledgeUnseenMessages(username);
      }
      resolve();
    });
  }

  /**
   * this will check if an HTML element is in viewport or not
   *
   * @param htmlElement html dom element that needed to be checked
   *
   * @return a promise
   */
  isElementInViewport(htmlElement: any) {
    return new Promise((resolve) => {
      const rect = htmlElement.getBoundingClientRect();
      resolve(
        rect.top >= 0 &&
          rect.left >= 0 &&
          rect.bottom <=
            (window.innerHeight || document.documentElement.clientHeight) &&
          rect.right <=
            (window.innerWidth || document.documentElement.clientWidth)
      );
    });
  }

  /**
   * this will break a string in chunks of specified length
   *
   * @param value string value that needs to be chunked
   *
   * @param tokenLength string token length
   *
   * @return an array of string tokens
   */
  chunkString(value: string, tokenLength: number) {
    return value.match(new RegExp(".{1," + tokenLength + "}", "g"));
  }

  /**
   * this will flag an error message in the app for a time period and then will
   * remove it
   *
   * @param errorMessage error message that needs to be displayed
   */
  flagError(errorMessage: string) {
    this.talkWindowContextService.errors.push(errorMessage);
    setTimeout(() => {
      const index = this.talkWindowContextService.errors.indexOf(errorMessage);
      if (index > -1) {
        this.talkWindowContextService.errors.splice(index, 1);
      }
    }, AppConstants.ERROR_FLAG_TIMEOUT);
  }

  /**
   * while selecting the files for sharing, this will be used to check if any of
   * the selected file is of unsupported file format
   *
   * @param fileList list of selected files
   *
   * @return a promise containing a boeolean flag specifying the result of check
   *
   * @TODO refactor it afterwards, this can be done in an easy way
   */
  areAllowedFileTypes(fileList: any) {
    return new Promise<boolean>((resolve) => {
      for (let i = 0; i < fileList.length; i++) {
        const fileExtension = fileList[i].type.split("/")[1];
        let index = AppConstants.SUPPORTED_IMAGE_FORMATS.indexOf(fileExtension);
        if (index > -1) {
          continue;
        }
        index = AppConstants.SUPPORTED_VIDEO_FORMATS.indexOf(fileExtension);
        if (index > -1) {
          continue;
        }
        index = AppConstants.SUPPORTED_AUDIO_FORMATS.indexOf(fileExtension);
        if (index > -1) {
          continue;
        }
        resolve(false);
      }
      resolve(true);
    });
  }

  /**
   * this will simply send message to a user via data channel if it found to be in
   * open state and will return a boolean result
   *
   * @param username username of the user to whom message has to be sent
   *
   * @param message json message object containing the message
   *
   * @param channel channel type for webrtc data channel on which provided
   * message has to be sent
   *
   * @return a promise containing a boolean flag whether message has been sent
   * or not
   */
  sendMessageOnDataChannel(username: string, message: any, channel: string) {
    return new Promise<boolean>((resolve) => {
      let sentFlag = false;

      try {
        /**
         * get the user's webrtc context, if there is an open data channel the
         * send the message on data channel
         *
         */
        const userContext: any =
          this.userContextService.getUserWebrtcContext(username);
        if (
          this.coreAppUtilService.isDataChannelConnected(userContext, channel)
        ) {
          userContext[AppConstants.MEDIA_CONTEXT][channel][
            AppConstants.DATACHANNEL
          ].send(JSON.stringify(message));
          sentFlag = true;
        }
        resolve(sentFlag);
      } catch (e) {
        resolve(sentFlag);
      }
    });
  }

  /**
   * this will update the receipt status of a message when an acknowledgement
   * is received
   *
   * @param ackMessage received message acknowledgement
   */
  updateChatMessageStatus(ackMessage: any) {
    /**
     * a. get all the messages from user's message context
     *
     * b. do the reconciliation by finding the original message with the message
     * id from the acknowledgement and then update the receipt status
     *
     */
    const messages: any[] = this.talkWindowContextService.getMessageContext(
      ackMessage[AppConstants.USERNAME]
    );
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].id === ackMessage.messageId) {
        messages[i].status = ackMessage.status;
        messages[i].time = new Date(ackMessage.time).toLocaleTimeString();
        break;
      }
    }
    this.appRef.tick();
  }

  /**
   * this will send 'seen' acknowledgement for all the unseen messages loaded in
   * current chat window
   *
   * @param username username of the user whose messages are loaded in the current
   * chat window
   *
   * @return a promise
   */
  acknowledgeUnseenMessages(username: string) {
    return new Promise<void>((resolve) => {
      const messages: any[] =
        this.talkWindowContextService.getMessageContext(username);
      if (messages) {
        for (let i = 0; i < messages.length; i++) {
          if (
            messages[i].status === AppConstants.CHAT_MESSAGE_STATUS.DELIVERED
          ) {
            /**
             * if the status of the message is delivered then send the 'seen'
             * acknowledgement to the message sender
             */
            this.sendMessageAcknowledgement(
              messages[i],
              AppConstants.CHAT_MESSAGE_STATUS.SEEN,
              messages[i].type
            );
          }
        }
      }
      resolve();
    });
  }

  /**
   * this will send an acknowledgement for a received message along with a status
   * like 'seen' or 'delivered'
   *
   * @param message received message
   *
   * @param messageStatus status of the message
   *
   * @param channel media type for the data channel i.e the type of data being
   * relayed on this data channel
   *
   * @TODO add a new contract for acknowledgement afterwards for type checking
   */
  async sendMessageAcknowledgement(
    message: any,
    messageStatus: string,
    channel: string
  ) {
    const ackId: string = this.coreAppUtilService.generateIdentifier();
    const isAckSent: boolean = await this.sendMessageOnDataChannel(
      message[AppConstants.USERNAME],
      {
        id: ackId,
        status: messageStatus,
        username: this.userContextService.username,
        type: AppConstants.MESSAGE_ACKNOWLEDGEMENT,
        time: new Date().getTime(),
        messageType: message.type,
        messageId: message.id,
      },
      channel
    );
    if (isAckSent) {
      if (message.id) {
        LoggerUtil.logAny(
          "acknowledgement sent for message with id: " +
            message.id +
            " from " +
            message[AppConstants.USERNAME]
        );
      } else {
        LoggerUtil.logAny(
          "error while sending acknowledgement for: " + JSON.stringify(message)
        );
      }
    }
  }

  /**
   * this will read a file using provided fileReader instance
   *
   * @param fileReader file reader instance
   *
   * @param fileItem json object containing the file details
   */
  readFile(fileReader: any, fileItem: any) {
    fileReader.readAsDataURL(fileItem[AppConstants.FILE]);
  }

  /**
   * this will return the a custom common os type of the host machine
   *
   * @param os platform name provided by the deviceInfo from device detector service
   *
   */
  getOSType() {
    if (
      ["Windows", "Win16", "Win32"].indexOf(this.deviceDetectorService.os) > -1
    ) {
      return "win";
    } else if (
      ["Mac", "Macintosh", "MacIntel", "MacPPC", "Mac68K"].indexOf(
        this.deviceDetectorService.os
      ) > -1
    ) {
      return "mac";
    } else if (this.deviceDetectorService.isMobile()) {
      return "mob";
    }
  }

  /**
   * this will remove all the event listeners registered on blank canvas for remote access
   *
   * @param unlistenFunctionsList list containing Renderer2 unlisten functions
   *
   * @TODO move it to remote access utils
   *
   */
  removeRemoteAccessEventListeners(unlistenFunctionsList: any[]) {
    unlistenFunctionsList.forEach((unlistenFunction) => {
      /**
       * remove registered event listener from canvas by calling the Renderer2 function returned
       * while registering the listeners in the first place
       */
      unlistenFunction();
    });
    this.talkWindowContextService.canvasUnlistenFunctions = [];
  }
}
