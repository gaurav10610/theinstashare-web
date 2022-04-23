import { TransferredFileContext } from "./../services/contracts/file/TransferredFileContext";
import { QueueStorage } from "./../services/util/QueueStorage";
import {
  AfterViewInit,
  ApplicationRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  Renderer2,
  ViewChild,
} from "@angular/core";
import { MatDialog, MatDialogRef } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { Router } from "@angular/router";
import { GoogleAnalyticsService } from "ngx-google-analytics";
import { firstValueFrom, Observable } from "rxjs";
import { environment } from "src/environments/environment";
import { AppLoginDialogComponent } from "../app-login-dialog/app-login-dialog.component";
import { IconsDialogComponent } from "../icons-dialog/icons-dialog.component";
import { ProgressDialogComponent } from "../progress-dialog/progress-dialog.component";
import { ApiService } from "../services/api/api.service";
import { AppConstants } from "../services/AppConstants";
import { FileTransferContextService } from "../services/context/file-transfer/file-transfer-context.service";
import { UserContextService } from "../services/context/user.context.service";
import { MessageContext } from "../services/contracts/context/MessageContext";
import { CreateDataChannelType } from "../services/contracts/CreateDataChannelType";
import { DataChannelInfo } from "../services/contracts/datachannel/DataChannelInfo";
import { DialogCloseResult } from "../services/contracts/dialog/DialogCloseResult";
import { DialogCloseResultType } from "../services/contracts/enum/DialogCloseResultType";
import { DialogType } from "../services/contracts/enum/DialogType";
import { ConnectionStateChangeContext } from "../services/contracts/event/ConnectionStateChangeContext";
import { CoreDataChannelService } from "../services/data-channel/core-data-channel.service";
import { LoggerUtil } from "../services/logging/LoggerUtil";
import { SignalingService } from "../services/signaling/signaling.service";
import { CoreAppUtilityService } from "../services/util/core-app-utility.service";
import { FileTransferUtilityService } from "../services/util/file-transfer-utility.service";
import { CoreWebrtcService } from "../services/webrtc/core-webrtc.service";
import { FileTransferService } from "../services/webrtc/file-transfer-webrtc.service";

@Component({
  selector: "app-file-transfer-window",
  templateUrl: "./file-transfer-window.component.html",
  styleUrls: ["./file-transfer-window.component.scss"],
})
export class FileTransferWindowComponent
  implements OnInit, OnDestroy, AfterViewInit
{
  constructor(
    public userContextService: UserContextService,
    public contextService: FileTransferContextService,
    private utilityService: FileTransferUtilityService,
    private fileTransferService: FileTransferService,
    private coreAppUtilService: CoreAppUtilityService,
    private signalingService: SignalingService,
    private coreDataChannelService: CoreDataChannelService,
    private coreWebrtcService: CoreWebrtcService,
    private apiService: ApiService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private router: Router,
    private gaService: GoogleAnalyticsService,
    private applicationRef: ApplicationRef,
    private renderer: Renderer2
  ) {}

  @ViewChild("textMessage", { static: false }) messageInput: ElementRef;
  @ViewChild("messageHistoryDiv", { static: false })
  messageHistoryDiv: ElementRef;

  dialogRef: MatDialogRef<any>;

  //assets path
  assetsPath = environment.is_native_app ? "assets/" : "../../assets/";

  currentTab: String = "file-upload"; // or 'chat'

  async ngOnInit(): Promise<void> {
    this.gaService.pageView("/file-transfer", "File Transfer");
    await this.setupSignaling();

    //subscribe to custom events
    this.fileTransferService.onDataChannelMessageEvent.subscribe(
      this.onDataChannelMessage.bind(this)
    );
    this.fileTransferService.onDataChannelReceiveEvent.subscribe(
      this.sendQueuedMessagesOnChannel.bind(this)
    );
    this.fileTransferService.onWebrtcConnectionStateChangeEvent.subscribe(
      this.onWebrtcConnectionStateChange.bind(this)
    );
  }

  ngAfterViewInit() {}

  /**
   * do clean up here before this component get destroyed
   */
  ngOnDestroy(): void {}

  /**
   * signaling setup
   */
  async setupSignaling(): Promise<void> {
    if (this.signalingService.isRegistered) {
      /**
       * this is the case when user has already been registered with server,
       * usually the scenario when user is routed to this component after logging
       * in via login page
       *
       *
       * a. register the 'reconnect' and 'onmessage' handlers only in this scenario
       *
       * b. fetch all the active users list from server
       */
      const eventsConfig = {
        onreconnect: this.onRouterConnect.bind(this),
        onmessage: this.onRouterMessage.bind(this),
        onclose: () => {
          this.snackBar.open("disconnected from server....");
        },
      };

      this.signalingService.registerEventListeners(eventsConfig);
      if (this.userContextService.selectedApp === undefined) {
        try {
          await this.registerApplicationUser(
            AppConstants.APPLICATION_NAMES.FILE_TRANSFER
          );
        } catch (error) {
          LoggerUtil.logAny(error);
          this.router.navigateByUrl("app");
        }
      }
      await this.fetchActiveUsersList();
    } else {
      /**
       * this is the case when user either reloads this page or directly came on
       * this page via its url
       *
       */
      const eventsConfig = {
        onopen: this.onRouterConnect.bind(this),
        onreconnect: this.onRouterConnect.bind(this),
        onmessage: this.onRouterMessage.bind(this),
        onclose: () => {
          this.snackBar.open("disconnected from server....");
        },
      };
      this.signalingService.registerEventListeners(eventsConfig);
    }
  }

  /**
   * register user in selected application
   * @param applicationName name of the selected application
   */
  async registerApplicationUser(applicationName: String): Promise<String> {
    const data: any = await firstValueFrom(
      this.apiService.post(AppConstants.API_ENDPOINTS.REGISTER_APP_USER, {
        username: this.userContextService.username,
        groupName: applicationName,
      })
    );

    if (data && data.registered) {
      LoggerUtil.logAny(
        `user was succussfully registered for app: ${applicationName}`
      );
      this.userContextService.selectedApp = applicationName;
      this.coreAppUtilService.setStorageValue(
        AppConstants.STORAGE_APPLICATION,
        applicationName.toString()
      );
      return "user application registration was successful";
    } else {
      this.userContextService.selectedApp = undefined;
      throw new Error("user application registration was unsuccessful");
    }
  }

  /**
   * fetch list of all the active users from server and update them in the
   * contact list view with their connected status
   *
   */
  async fetchActiveUsersList(): Promise<void> {
    const data: any = await firstValueFrom(
      this.apiService.get(
        `${AppConstants.API_ENDPOINTS.GET_ALL_ACTIVE_USERS}?groupName=${AppConstants.APPLICATION_NAMES.FILE_TRANSFER}`
      )
    );

    // clear userStatus object
    this.contextService.userStatus.clear();
    //clear active users list
    this.contextService.activeUsers = [];
    data.users.forEach((user: string) => {
      this.utilityService.updateUserStatus(true, user);
    });
  }

  /*
   * handle connection open event with server
   */
  onRouterConnect() {
    const username: String = this.userContextService.getUserName()
      ? this.userContextService.getUserName().trim()
      : undefined;
    if (username) {
      this.openDialog(DialogType.PROGRESS, {
        message: "login in progress",
      });
      this.signalingService.registerOnSignalingServer(username, true);
    } else {
      this.openDialog(DialogType.APP_LOGIN);
    }
    this.snackBar.dismiss();
  }

  /**
   * handle messages received via server or via webrtc datachannel
   *
   *
   * while sending any message to other user app gives first priority to existing
   * datachannel between two users to exchange any messages(see the existing
   * supported message types below) between them if it found one else it will
   * send the messages to other user via signaling server only
   *
   *
   * @param signalingMessage received signaling message
   *
   */
  async onRouterMessage(signalingMessage: any) {
    try {
      LoggerUtil.logAny(
        `received message via ${signalingMessage.via} ${JSON.stringify(
          signalingMessage
        )}`
      );
      switch (signalingMessage.type) {
        case AppConstants.REGISTER:
          await this.handleRegister(signalingMessage);
          break;

        case AppConstants.USER_ACTIVE_STATUS:
          this.utilityService.updateUserStatus(
            signalingMessage.connected,
            signalingMessage.username
          );
          break;

        case AppConstants.OFFER:
          await this.consumeWebrtcOffer(signalingMessage);
          break;

        case AppConstants.ANSWER:
          await this.coreWebrtcService.handleAnswer(signalingMessage);
          break;

        case AppConstants.CANDIDATE:
          await this.coreWebrtcService.handleCandidate(signalingMessage);
          break;

        case AppConstants.WEBRTC_EVENT:
          this.handleWebrtcEvent(signalingMessage);
          break;

        default:
          LoggerUtil.logAny(
            `received unknown signaling message with type: ${signalingMessage.type}`
          );
      }
      this.applicationRef.tick();
    } catch (err) {
      LoggerUtil.logAny(
        "error occured while handling received signaling message"
      );
      LoggerUtil.logAny(JSON.stringify(signalingMessage));
      LoggerUtil.logAny(err);
    }
  }

  /**
   * handle to handle received messages of type 'register'
   *
   * @param signalingMessage received signaling message
   *
   */
  async handleRegister(signalingMessage: any): Promise<void> {
    if (signalingMessage.success) {
      /**
       * this is the case when user was successfully able to register with
       * the server
       *
       *
       * received 'register' type message will have a boolean 'success'
       * property as a user registration status
       *
       * a. set the registered status property within signaling service
       *
       * b. set the chosen username in userContext
       *
       * c. set the username in the browser's storage
       *
       * d. fetch all the active users
       */
      this.signalingService.isRegistered = signalingMessage.success;
      this.userContextService.username = signalingMessage.username;
      this.coreAppUtilService.setStorageValue(
        AppConstants.STORAGE_USER,
        signalingMessage.username
      );
      this.closeDialog();

      /**
       *
       * onopen event handler won't be needed after user is registered as even
       * in the disconnect cases we will manage reconnect handler only
       *
       */
      this.signalingService.signalingRouter.off("connect");
      try {
        await this.registerApplicationUser(
          AppConstants.APPLICATION_NAMES.FILE_TRANSFER
        );
        await this.fetchActiveUsersList();
      } catch (error) {
        LoggerUtil.logAny(error);
        this.router.navigateByUrl("app");
      }
    } else {
      /**
       * user registeration failed case -
       *
       * close current progress dialog and open app login dialog again
       **/
      this.openDialog(DialogType.APP_LOGIN);
    }
  }

  /**
   * open appropriate dialog
   *
   * @param dialogType type of dialog
   * @param data data to be passed to close handler
   */
  openDialog(dialogType: DialogType, data = {}) {
    this.closeDialog();
    switch (dialogType) {
      case DialogType.APP_LOGIN:
        this.dialogRef = this.dialog.open(AppLoginDialogComponent, {
          disableClose: true,
          panelClass: "dialog-class",
          data,
          width: this.userContextService.isMobile ? "300px" : undefined,
        });
        break;

      case DialogType.PROGRESS:
        this.dialogRef = this.dialog.open(ProgressDialogComponent, {
          disableClose: true,
          data,
        });
        break;

      case DialogType.INFORMATIONAL:
        break;

      case DialogType.ICONS_POPUP:
        this.dialogRef = this.dialog.open(IconsDialogComponent, {
          data,
          width: this.userContextService.isMobile ? "300px" : undefined,
        });
        break;

      default:
      //do nothing here
    }
    this.dialogRef.afterClosed().subscribe(this.handleDialogClose.bind(this));
  }

  /**
   * this will handle dialog close
   * @param dialogCloseResult result data sent by the component contained in the dialog which got closed
   *
   */
  handleDialogClose(dialogCloseResult?: DialogCloseResult) {
    if (dialogCloseResult === undefined) {
      return;
    }
    LoggerUtil.logAny(
      `dialog got closed with result: ${JSON.stringify(dialogCloseResult)}`
    );
    switch (dialogCloseResult.type) {
      case DialogCloseResultType.APP_LOGIN:
        this.openDialog(DialogType.PROGRESS, {
          message: "login in progress",
        });
        this.signalingService.registerOnSignalingServer(
          dialogCloseResult.data.username,
          true
        );
        break;

      case DialogCloseResultType.MEDIA_VIEWER:
        LoggerUtil.logAny(
          `media viewer dialog closed for content type: ${dialogCloseResult.data.contentType}`
        );
        break;

      default:
      //do nothing here
    }
  }

  /**
   * close currently open dialog with appropriate data
   *
   * @param data data to be passed to close handler
   *
   */
  closeDialog(data = {}) {
    if (this.dialogRef) {
      this.dialogRef.close(data);
    }
  }

  /**
   * event handler for tab selection
   * @param selectedTab
   */
  selectTab(selectedTab: string) {
    this.currentTab = selectedTab;
    const userToChat: string = this.userContextService.userToChat;
    if (
      selectedTab === "chat" &&
      this.userContextService.hasUserWebrtcContext(userToChat)
    ) {
      this.userContextService.getUserWebrtcContext(userToChat).unreadCount = 0;
    }
  }

  /**
   * this will handle selecting user from sidepanel
   * @param username
   */
  selectUser(username: string) {
    if (username !== this.userContextService.userToChat) {
      LoggerUtil.logAny(`user selected: ${username}`);
      this.userContextService.userToChat = username;
      this.selectTab("chat");
    }
  }

  /**
   * back to contacts click handler
   * this button is available only on mobile screen view
   */
  backToContacts() {
    const userToChat = this.userContextService.userToChat;
    this.userContextService.userToChat = undefined;
  }

  /**
   * process received messages signaling message of type 'offer'
   * @param signalingMessage: received signaling message
   */
  async consumeWebrtcOffer(signalingMessage: any): Promise<void> {
    try {
      /**
       *
       * if this offer message is for renegotiating an already established connection
       *
       */
      if (signalingMessage.renegotiate) {
        this.coreWebrtcService.mediaContextInit(
          signalingMessage.channel,
          signalingMessage.from
        );
        const peerConnection: RTCPeerConnection =
          this.userContextService.getUserWebrtcContext(signalingMessage.from)[
            AppConstants.CONNECTION
          ];

        if (!signalingMessage.seekReturnTracks) {
          /**
           * handle the received webrtc offer 'sdp', set the remote description and
           * generate the answer sebsequently for sending it to the other user
           *
           * 'answerContainer' will contain the generated answer sdp and few other
           * properties which app utilizes to compose an answer signaling message
           * to be sent to other user
           *
           */
          const answerContainer: any =
            await this.coreWebrtcService.generateAnswer(
              peerConnection,
              signalingMessage.offer,
              signalingMessage.channel
            );

          /**
           * send the composed 'answer' signaling message to the other user from whom
           * we've received the offer message
           *
           */
          this.coreDataChannelService.sendPayload({
            type: AppConstants.ANSWER,
            answer: answerContainer.answerPayload.answer,
            channel: answerContainer.answerPayload.channel,
            from: this.userContextService.username,
            to: signalingMessage.from,
          });
        }
      } else {
        /**
         *
         * this will setup a new webrtc connection
         */
        this.fileTransferService.setUpWebrtcConnection(
          signalingMessage.from,
          signalingMessage
        );
      }
      return;
    } catch (e) {
      LoggerUtil.logAny(
        `there is an error while consuming webrtc offer received from ${signalingMessage.from}`
      );
      return;
    }
  }

  sendTextMessage(event?: KeyboardEvent): void {
    //get the currenty selected user
    const userToChat = this.userContextService.userToChat;

    /**
     * call made via keyup input message event
     */
    if (event) {
      //when user hits 'Enter' button to send message
      if (event.code === "Enter") {
        this.sendMessageOnChannel(
          this.messageInput.nativeElement.value,
          userToChat
        );
        this.renderer.setProperty(this.messageInput.nativeElement, "value", "");
        this.messageInput.nativeElement.focus();
      }
    } else {
      // when user hits the send message button
      this.sendMessageOnChannel(
        this.messageInput.nativeElement.value,
        userToChat
      );
      this.renderer.setProperty(this.messageInput.nativeElement, "value", "");
      this.messageInput.nativeElement.focus();
    }
  }

  /**
   * sent text message via data channel
   *
   * @param textMessage text message to be sent
   * @param userToChat username of the user to whom message has to be sent
   */
  async sendMessageOnChannel(
    textMessage: string,
    userToChat: string
  ): Promise<void> {
    try {
      if (textMessage !== "") {
        /**
         * initialize user's webrtc context for the user to whom you wanted to
         * send message, if it didn't exist
         *
         */
        if (!this.userContextService.hasUserWebrtcContext(userToChat)) {
          this.userContextService.initializeUserWebrtcContext(userToChat);
        }
        const webrtcContext: any =
          this.userContextService.getUserWebrtcContext(userToChat);

        //generate a new message identifier
        const messageId: any =
          await this.coreAppUtilService.generateIdentifier();

        //update message in chat window on UI
        this.updateChatMessages({
          id: messageId,
          status: AppConstants.CHAT_MESSAGE_STATUS.SENT,
          message: textMessage,
          username: userToChat,
          messageType: AppConstants.TEXT,
          isSent: true,
          timestamp: new Date().toLocaleDateString(),
        });

        //check if there is an open data channel
        if (
          this.coreAppUtilService.isDataChannelConnected(
            webrtcContext,
            AppConstants.TEXT
          )
        ) {
          // LoggerUtil.log('Found an open data channel already.');

          //send message on data channel
          webrtcContext[AppConstants.MEDIA_CONTEXT][
            AppConstants.TEXT
          ].dataChannel.send(
            JSON.stringify({
              id: messageId,
              message: textMessage,
              username: this.userContextService.username,
              type: AppConstants.TEXT,
              from: this.userContextService.username,
              to: userToChat,
            })
          );
        } else {
          LoggerUtil.logAny(
            "text data channel is not in open state for user: " + userToChat
          );

          if (!webrtcContext[AppConstants.MESSAGE_QUEUE]) {
            this.userContextService.initializeMessageQueue(userToChat);
          }

          // just queue the message and wait for data channel setup
          webrtcContext[AppConstants.MESSAGE_QUEUE].enqueue({
            id: messageId,
            message: textMessage,
            username: this.userContextService.username,
            type: AppConstants.TEXT,
            from: this.userContextService.username,
            to: userToChat,
          });

          // when data channel open request has already been raised, then just queue the messages
          if (
            this.coreAppUtilService.isDataChannelConnecting(
              webrtcContext,
              AppConstants.TEXT
            )
          ) {
            LoggerUtil.logAny(
              `text data channel is in connecting state for user: ${userToChat}`
            );

            /**
             * do nothing here as message has been queued and will be sent when
             * data channel comes in open state
             *
             * @TODO setup a timeout job here to check if datachannel is
             * connected after some time or not else try connecting it again
             */
          } else {
            const createDataChannelType: CreateDataChannelType = {
              username: userToChat,
              channel: AppConstants.TEXT,
            };

            //set up new data channel
            await this.fileTransferService.setUpDataChannel(
              createDataChannelType
            );
          }
        }
      }
    } catch (error) {
      LoggerUtil.logAny(error);
      LoggerUtil.logAny(
        `error occured while sending message: ${textMessage} to user: ${userToChat}`
      );
    }
  }

  async onWebrtcConnectionStateChange(
    stateChangeContext: ConnectionStateChangeContext
  ) {
    const webrtcContext: any = this.userContextService.getUserWebrtcContext(
      stateChangeContext.username
    );
    switch (stateChangeContext.connectionState) {
      case "disconnected":
        // handle the webrtc disconnection here
        await this.webrtcConnectionDisconnectHandler(
          stateChangeContext.username
        );
        break;

      case "connected":
        /**
         * make the connection status as 'connected' in the user's webrtc context
         */
        webrtcContext[AppConstants.CONNECTION_STATE] =
          AppConstants.CONNECTION_STATES.CONNECTED;
        break;
    }
  }

  async webrtcConnectionDisconnectHandler(username: string): Promise<void> {
    LoggerUtil.logAny(`handling webrtc connection disconnect for ${username}`);
    const webrtcContext: any =
      this.userContextService.getUserWebrtcContext(username);
    webrtcContext[AppConstants.CONNECTION].onconnectionstatechange = null;
    webrtcContext[AppConstants.RECONNECT] = false;
    const mediaContext: any = webrtcContext[AppConstants.MEDIA_CONTEXT];

    /**
     *
     * iterate whole media context and clean channel context for all the open channels
     */
    Object.keys(mediaContext).forEach((channel) => {
      /**
       *
       * choose appropriate clean up routine for each open channel
       */
      if (this.coreAppUtilService.isDataChannel(channel)) {
        this.fileTransferService.cleanDataChannelContext(
          channel,
          mediaContext[channel]
        );
        delete webrtcContext[AppConstants.MESSAGE_QUEUE];
        delete webrtcContext[AppConstants.FILE_QUEUE];
      }
    });

    //make media context empty
    webrtcContext[AppConstants.MEDIA_CONTEXT] = {};
    this.coreWebrtcService.cleanRTCPeerConnection(
      webrtcContext[AppConstants.CONNECTION]
    );
    webrtcContext[AppConstants.CONNECTION] = undefined;
    webrtcContext[AppConstants.CONNECTION_STATE] =
      AppConstants.CONNECTION_STATES.NOT_CONNECTED;
  }

  /**
   * this will update text message sent/received via data channel in the appropriate
   * user's message context and in the current chat window as well if message
   * sender is the currently selected user
   *
   * @param messageContext json payload containing the message
   * @return a promise containing the message read status i.e 'seen','received' etc
   */
  async updateChatMessages(messageContext: MessageContext): Promise<string> {
    /**
     * initialize the message status as 'NA' for a start and this will be
     * updated later on
     */
    let messageStatus: string = AppConstants.CHAT_MESSAGE_STATUS.NOT_APPLICABLE;
    this.contextService.initializeMessageContext(
      messageContext[AppConstants.USERNAME]
    );

    /**
     * if the message is received then,
     * a. play the message received app sound
     * b. update the peviously initialized message status to 'DELIVERED'
     */
    if (!messageContext.isSent) {
      this.playIncomeingMessageTune(true);
      messageStatus = AppConstants.CHAT_MESSAGE_STATUS.DELIVERED;
      messageContext.status = AppConstants.CHAT_MESSAGE_STATUS.DELIVERED;
    }

    if (
      this.userContextService.userToChat ===
      messageContext[AppConstants.USERNAME]
    ) {
      /**
       * if user is currently chatting with the user with whom this message
       * has been exchanged then update previously initialized message status as seen
       *
       */
      if (!messageContext.isSent) {
        messageStatus = AppConstants.CHAT_MESSAGE_STATUS.SEEN;
        messageContext.status = AppConstants.CHAT_MESSAGE_STATUS.DELIVERED;
      }
    } else {
      /**
       * if the user with whom this message has been exchanged is not visible
       * in viewport then update user's position to the top in the online
       * active users list
       *
       */
      const listElement: any = this.renderer.selectRootElement(
        `#contact-${messageContext[AppConstants.USERNAME]}`,
        true
      );
      let isUserVisibleInViewport: any =
        await this.utilityService.isElementInViewport(listElement);
      if (!isUserVisibleInViewport) {
        LoggerUtil.logString(
          `user ${messageContext.username} is not visible in viewport`
        );
        this.coreAppUtilService.updateElemntPositionInArray(
          this.contextService.activeUsers,
          messageContext[AppConstants.USERNAME],
          0
        );
      }

      //increment unread messages count
      this.userContextService.getUserWebrtcContext(
        messageContext[AppConstants.USERNAME]
      ).unreadCount++;
    }

    /**
     * store message in user's message context
     */
    this.contextService
      .getMessageContext(messageContext[AppConstants.USERNAME])
      .push(messageContext);
    this.scrollMessages();
    this.applicationRef.tick();
    return messageStatus;
  }

  scrollMessages(): void {
    const scrollHeight = this.renderer.selectRootElement(
      "#message-history-div",
      true
    ).scrollHeight;
    this.renderer.setProperty(
      this.messageHistoryDiv.nativeElement,
      "scrollTop",
      scrollHeight
    );
  }

  /**
   * this is onmessage event handler for data channel
   * @param jsonMessage message received via webrtc datachannel
   */
  async onDataChannelMessage(jsonMessage: string): Promise<void> {
    LoggerUtil.logAny(`message received on data channel : ${jsonMessage}`);
    const message: any = JSON.parse(jsonMessage);
    switch (message.type) {
      //handle signaling messages
      case AppConstants.SIGNALING:
        this.onRouterMessage(message.message);
        break;

      //handle message acknowledgement
      case AppConstants.MESSAGE_ACKNOWLEDGEMENT:
        this.utilityService.updateChatMessageStatus(message);
        this.applicationRef.tick();
        break;

      //handle received text data messages
      default:
        message.sent = false;
        const messageStatus: string = await this.updateChatMessages(message);
        if (messageStatus !== AppConstants.CHAT_MESSAGE_STATUS.NOT_APPLICABLE) {
          this.utilityService.sendMessageAcknowledgement(
            message,
            messageStatus,
            message.type
          );
        }
    }
  }

  /**
   * this will send all the queued messages to a user over via an data channel
   * for that user
   *
   * @param dataChannelInfo received data channel meta info
   */
  async sendQueuedMessagesOnChannel(
    dataChannelInfo: DataChannelInfo
  ): Promise<void> {
    const webrtcContext: any = this.userContextService.getUserWebrtcContext(
      dataChannelInfo.channelOpenedWith
    );
    const dataChannel: RTCDataChannel =
      webrtcContext[AppConstants.MEDIA_CONTEXT][AppConstants.TEXT][
        AppConstants.DATACHANNEL
      ];

    /**
     * iterate message queue and send all the messages via data channel
     */
    while (
      webrtcContext[AppConstants.MESSAGE_QUEUE] &&
      !webrtcContext[AppConstants.MESSAGE_QUEUE].isEmpty()
    ) {
      dataChannel.send(
        JSON.stringify(webrtcContext[AppConstants.MESSAGE_QUEUE].dequeue())
      );
    }
  }

  /**
   * this will play or pause incoming message tune
   *
   * @param playFlag flag to distinguish between play or stop
   *
   * @TODO refactor it afterwards, see if this can be done in an easy way
   */
  playIncomeingMessageTune(playFlag: boolean): void {
    if (playFlag) {
      this.renderer.selectRootElement("#messageTune", true).play();
    } else {
      this.renderer.selectRootElement("#messageTune", true).pause();
    }
  }

  /**
   * this will handle webrtc events
   * @param signalingMessage received signaling message
   */
  handleWebrtcEvent(signalingMessage: any): void {
    LoggerUtil.logAny(`handling webrtc event: ${signalingMessage.event}`);
    const webrtcContext: any = this.userContextService.getUserWebrtcContext(
      signalingMessage.from
    );
    switch (signalingMessage.event) {
      /**
       *
       * webrtc data channel open event received from remote user's end
       */
      case AppConstants.WEBRTC_EVENTS.CHANNEL_OPEN:
        LoggerUtil.logAny(
          `${signalingMessage.channel} data channel has been opened with user: ${signalingMessage.from}`
        );
        webrtcContext[AppConstants.MEDIA_CONTEXT][signalingMessage.channel][
          AppConstants.CONNECTION_STATE
        ] = AppConstants.CONNECTION_STATES.CONNECTED;

        switch (signalingMessage.channel) {
          case AppConstants.TEXT:
            this.sendQueuedMessagesOnChannel({
              channel: signalingMessage.channel,
              channelOpenAt: new Date(),
              channelOpenedWith: signalingMessage.from,
            });
            break;
          default:
          //do nothing here
        }
    }
  }

  /**
   * this will open the file explorer to choose files to be sent
   */
  async openFileDialog() {
    this.renderer.selectRootElement("#file-input", true).click();
  }

  /**
   * start sharing selected files
   * @event change event object
   */
  async startSharingFile(event: any) {
    const userToChat: string = this.userContextService.userToChat;
    this.userContextService.initializeUserWebrtcContext(userToChat);
    const webrtcContext: any =
      this.userContextService.getUserWebrtcContext(userToChat);

    // initialize required context for file transfer
    this.contextService.initializeFileQueue(userToChat);
    this.contextService.initializeFileContext(userToChat);

    const fileContext: TransferredFileContext[] =
      this.contextService.getFileContext(userToChat);
    const fileQueue: QueueStorage<File> =
      this.contextService.getFileQueue(userToChat);

    /**
     *
     * @TODO implement allowed file type validation here
     *
     */
    for (let i = 0; i < event.target.files.length; i++) {
      const file: File = event.target.files[i];
      // LoggerUtil.logAny(event.target.files[i]);

      fileQueue.enqueue(file);
      const fileExtension:string = file.type.split("/")[1];

      fileContext.push({
        id: String(await this.coreAppUtilService.generateIdentifier()),
        fileName: file.name,
        isSent: true,
        uploadProgress: 0,
        fileExtension: fileExtension,
        isFragmented: true,
        fragmentOffset: 0,
        totalFragments: 0, //just a default value, this will be updated later once file is being sent
        lastPartReceivedAt: null,
        lastAcknowledgementAt: null,
        from: this.userContextService.username,
        isPaused: true,
        size: file.size,
        icon: this.fileTransferService.getMappedFileIcon(file.type),
      });
    }
    LoggerUtil.logAny(fileContext);
  }

  async logout(): Promise<void> {
    try {
      LoggerUtil.logAny("logging out from file-transfer");
      /**
       * send de-register message to server to notify that user has opted to
       * logout
       */
      this.signalingService.deRegisterOnSignalingServer(
        this.userContextService.getUserName()
      );
      this.userContextService.applicationSignOut();
      this.userContextService.resetCoreAppContext();
      this.router.navigateByUrl("login");
    } catch (error) {
      LoggerUtil.logAny("error encounterd while resetting webrtc context");
      this.router.navigateByUrl("login");
    }
  }
}
