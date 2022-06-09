import { ChannelBufferData } from "./../../services/contracts/datachannel/datachannel-spec";
import { InformationDialogComponent } from "./../information-dialog/information-dialog.component";
import {
  AfterViewInit,
  ApplicationRef,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  Renderer2,
  ViewChild,
} from "@angular/core";
import { MatDialog, MatDialogRef } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { Router } from "@angular/router";
import { GoogleAnalyticsService } from "ngx-google-analytics";
import { firstValueFrom, Subscription } from "rxjs";
import { environment } from "src/environments/environment";
import { AppLoginDialogComponent } from "../app-login-dialog/app-login-dialog.component";
import { IconsDialogComponent } from "../icons-dialog/icons-dialog.component";
import { ProgressDialogComponent } from "../progress-dialog/progress-dialog.component";
import { ApiService } from "src/app/services/api/api.service";
import { AppConstants } from "src/app/services/AppConstants";
import { FileTransferContextService } from "src/app/services/context/file-transfer/file-transfer-context.service";
import { UserContextService } from "src/app/services/context/user.context.service";
import { ComponentSpec } from "src/app/services/contracts/component/component-specs";
import { MessageContext } from "src/app/services/contracts/context/MessageContext";
import { CreateDataChannelType } from "src/app/services/contracts/CreateDataChannelType";
import { DataChannelInfo } from "src/app/services/contracts/datachannel/DataChannelInfo";
import {
  DialogCloseResult,
  InfoDialogContext,
} from "src/app/services/contracts/dialog/dialog";
import { DialogCloseResultType } from "src/app/services/contracts/enum/DialogCloseResultType";
import { DialogType } from "src/app/services/contracts/enum/DialogType";
import { ConnectionStateChangeContext } from "src/app/services/contracts/event/ConnectionStateChangeContext";
import {
  FileTransferTabType,
  TransferredFileContext,
  FileData,
  FileShareProgress,
  FileShareError,
  FileFragmentType,
} from "src/app/services/contracts/file/file-transfer";
import { CoreDataChannelService } from "src/app/services/data-channel/core-data-channel.service";
import { CoreFileSharingService } from "src/app/services/file-sharing/core-file-sharing.service";
import { LoggerUtil } from "src/app/services/logging/LoggerUtil";
import { SignalingService } from "src/app/services/signaling/signaling.service";
import { CoreAppUtilityService } from "src/app/services/util/core-app-utility.service";
import { FileTransferUtilityService } from "src/app/services/util/file-transfer-utility.service";
import { CoreWebrtcService } from "src/app/services/webrtc/core-webrtc.service";
import { FileTransferService } from "src/app/services/webrtc/file-transfer-webrtc.service";

@Component({
  selector: "app-file-transfer-window",
  templateUrl: "./file-transfer-window.component.html",
  styleUrls: ["./file-transfer-window.component.scss"],
})
export class FileTransferWindowComponent
  implements OnInit, OnDestroy, AfterViewInit, ComponentSpec
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
    private fileSharingService: CoreFileSharingService,
    private apiService: ApiService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private router: Router,
    private gaService: GoogleAnalyticsService,
    private applicationRef: ApplicationRef,
    private renderer: Renderer2,
    private zoneRef: NgZone
  ) {}

  @ViewChild("textMessage", { static: false }) messageInput: ElementRef;
  @ViewChild("messageHistoryDiv", { static: false })
  messageHistoryDiv: ElementRef;

  // list of all the subsciptions
  subscriptions: Subscription[] = [];

  currentDialogRef: MatDialogRef<any>;

  //assets path
  assetsPath = environment.is_native_app ? "assets/" : "../../../assets/";

  // selected tab on file transfer window
  currentTab: FileTransferTabType = FileTransferTabType.UPLOADS;

  // component scheduled job id
  scheduledJobId: any;

  async ngOnInit(): Promise<void> {
    this.gaService.pageView("/file-transfer", "File Transfer");
    await this.setupSignaling();

    // subscribe to connection related custom events
    this.subscriptions.push(
      this.fileTransferService.onDataChannelMessageEvent.subscribe(
        this.onDataChannelMessage.bind(this)
      )
    );
    this.subscriptions.push(
      this.fileTransferService.onDataChannelReceiveEvent.subscribe(
        this.onDataChannelReceive.bind(this)
      )
    );

    this.fileTransferService.onWebrtcConnectionStateChangeEvent.subscribe(
      this.onWebrtcConnectionStateChange.bind(this)
    );

    // subcribe to file sharing related events
    this.subscriptions.push(
      this.fileSharingService.onFileProgress.subscribe(
        this.handleFileProgress.bind(this)
      )
    );
    this.subscriptions.push(
      this.fileSharingService.onFileShareError.subscribe(
        this.handleFileShareError.bind(this)
      )
    );
    this.subscriptions.push(
      this.fileSharingService.onFileMetadata.subscribe(
        this.handleFileMetaData.bind(this)
      )
    );

    if (this.userContextService.isMobile) {
      LoggerUtil.logAny("app rendered on mobile device");
    }

    this.scheduledJobId = setInterval(() => {
      this.fileTransferService.scheduledCleanerJob();
    }, AppConstants.CLEANUP_JOB_INTERVAL);
    LoggerUtil.logAny(
      `scheduled job with id: ${this.scheduledJobId} is scheduled`
    );
  }

  ngAfterViewInit() {}

  ngOnDestroy(): void {
    // unregister the periodic cleanup job
    if (this.scheduledJobId) {
      clearInterval(this.scheduledJobId);
    }

    // unsubscribe all the subscriptions
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
    this.subscriptions = [];
  }

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
   * handle connection open event with signaling server
   */
  async onRouterConnect(): Promise<void> {
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
   * while sending any message to other user app gives first priority to existing
   * datachannel between two users to exchange any messages(see the existing
   * supported message types below) between them if it found one else it will
   * send the messages to other user via signaling server only
   *
   * @param signalingMessage received signaling message
   *
   */
  async onRouterMessage(signalingMessage: any): Promise<void> {
    try {
      LoggerUtil.logAny(
        `received message via ${signalingMessage.via} of type: ${signalingMessage.type}`
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
   * @param signalingMessage received signaling message
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
       * close current progress dialog and open app login dialog again
       **/
      this.openDialog(DialogType.APP_LOGIN);
    }
  }

  /**
   * open appropriate dialog
   * @param dialogType type of dialog
   * @param data data to be passed to close handler
   */
  async openDialog(dialogType: DialogType, data = {}): Promise<void> {
    this.closeDialog();
    switch (dialogType) {
      case DialogType.APP_LOGIN:
        this.currentDialogRef = this.dialog.open(AppLoginDialogComponent, {
          disableClose: true,
          panelClass: "dialog-class",
          data,
          width: this.userContextService.isMobile ? "300px" : undefined,
        });
        break;

      case DialogType.PROGRESS:
        this.currentDialogRef = this.dialog.open(ProgressDialogComponent, {
          disableClose: true,
          data,
        });
        break;

      case DialogType.INFORMATIONAL:
        this.currentDialogRef = this.dialog.open(InformationDialogComponent, {
          panelClass: "dialog-class",
          data,
        });
        break;

      case DialogType.ICONS_POPUP:
        this.currentDialogRef = this.dialog.open(IconsDialogComponent, {
          data,
          width: this.userContextService.isMobile ? "300px" : undefined,
        });
        break;

      default:
      //do nothing here
    }
    this.currentDialogRef
      .afterClosed()
      .subscribe(this.handleDialogClose.bind(this));
  }

  /**
   * this will handle dialog close
   * @param dialogCloseResult data emitted by dialog component
   */
  async handleDialogClose(
    dialogCloseResult?: DialogCloseResult
  ): Promise<void> {
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
   * @param data data to be passed to close handler
   */
  async closeDialog(data = {}): Promise<void> {
    if (this.currentDialogRef) {
      this.currentDialogRef.close(data);
    }
  }

  /**
   * event handler for tab selection
   * @param selectedTab
   */
  async selectTab(selectedTab: string): Promise<void> {
    this.currentTab = selectedTab as FileTransferTabType;
    const userToChat: string = this.userContextService.userToChat;
    if (this.userContextService.hasUserWebrtcContext(userToChat)) {
      this.userContextService.getUserWebrtcContext(userToChat).unreadCount = 0;
    }
    if (this.contextService.hasBadgeConfig(userToChat)) {
      switch (this.currentTab) {
        case FileTransferTabType.CHAT:
          this.contextService.getBadgeConfig(userToChat).chat = 0;
          break;
        case FileTransferTabType.DOWNLOADS:
          this.contextService.getBadgeConfig(userToChat).file = 0;
          break;
        default: // do nothing
      }
    }
  }

  /**
   * this will handle selecting user from sidepanel
   * @param username
   */
  async selectUser(username: string): Promise<void> {
    if (username !== this.userContextService.userToChat) {
      LoggerUtil.logAny(`selected user: ${username}`);
      this.userContextService.userToChat = username;
      this.selectTab(FileTransferTabType.UPLOADS);
    }
  }

  /**
   * back to contacts click handler button is available only on mobile screen view
   */
  async backToContacts(): Promise<void> {
    const userToChat: string = this.userContextService.userToChat;
    this.userContextService.userToChat = undefined;
  }

  /**
   * process received messages signaling message of type 'offer'
   * @param signalingMessage: received signaling message
   */
  async consumeWebrtcOffer(signalingMessage: any): Promise<void> {
    try {
      /**
       * if this offer message is for renegotiating an already established connection
       */
      if (signalingMessage.renegotiate) {
        this.coreWebrtcService.mediaContextInit(
          signalingMessage.channel,
          signalingMessage.from
        );
        const peerConnection: RTCPeerConnection =
          this.userContextService.getUserConnection(signalingMessage.from);

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
         */
        this.coreDataChannelService.sendPayload({
          type: AppConstants.ANSWER,
          answer: answerContainer.answerPayload.answer,
          channel: answerContainer.answerPayload.channel,
          from: this.userContextService.username,
          to: signalingMessage.from,
        });
      } else {
        /**
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

  async sendTextMessage(event?: KeyboardEvent): Promise<void> {
    //get the currenty selected user
    const userToChat: string = this.userContextService.userToChat;

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
        const messageId: string = this.coreAppUtilService.generateIdentifier();

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
  ): Promise<void> {
    this.zoneRef.run(async () => {
      const webrtcContext: any = this.userContextService.getUserWebrtcContext(
        stateChangeContext.username
      );
      switch (stateChangeContext.connectionState) {
        case "disconnected":
          // handle the webrtc disconnection here
          await this.handleWebrtcDisconnect(stateChangeContext.username);
          break;

        case "connected":
          /**
           * make the connection status as 'connected' in the user's webrtc context
           */
          webrtcContext[AppConstants.CONNECTION_STATE] =
            AppConstants.CONNECTION_STATES.CONNECTED;
          break;
      }
    });
  }

  async handleWebrtcDisconnect(username: string): Promise<void> {
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

    /**
     * mark files with error or isResendEnable
     *
     * 'error' & 'isResendEnable' flags in file context are being used to
     * compose appropriate view for user on connection disconnect
     */
    const fileContext: Map<string, TransferredFileContext> =
      this.contextService.getFileContext(username);
    if (fileContext && fileContext.size > 0) {
      for (const file of fileContext.values()) {
        if (file.isSent) {
          if (file.error) {
            file.isResendEnable = true;
          }
        } else {
          if (!file.isComplete) {
            file.error = true;
          }
        }
      }
    }
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
        LoggerUtil.logAny(
          `user ${messageContext.username} is not visible in viewport`
        );
        this.coreAppUtilService.updateElemntPositionInArray(
          this.contextService.activeUsers,
          messageContext[AppConstants.USERNAME],
          0
        );
      }

      // increment unread messages count
      this.userContextService.getUserWebrtcContext(
        messageContext[AppConstants.USERNAME]
      ).unreadCount++;

      // increment chat specic unread count for showing badge
      this.contextService.initializeBadgeConfig(
        messageContext[AppConstants.USERNAME]
      );
      this.contextService.getBadgeConfig(messageContext[AppConstants.USERNAME])
        .chat++;
    }

    /**
     * store message in user's message context
     */
    this.contextService
      .getMessageContext(messageContext[AppConstants.USERNAME])
      .push(messageContext);
    this.scrollMessages();
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
   * handle data channel receive event here
   * @param dataChannelInfo received data channel info
   */
  async onDataChannelReceive(dataChannelInfo: DataChannelInfo): Promise<void> {
    switch (dataChannelInfo.channel) {
      case AppConstants.TEXT:
        this.sendQueuedMessagesOnChannel(dataChannelInfo);
        break;

      case AppConstants.FILE:
        // @TODO do some processing here
        break;
    }
  }

  /**
   * this is onmessage event handler for data channel
   * @param channelMessage message received via webrtc datachannel
   */
  async onDataChannelMessage(
    channelMessage: string | ChannelBufferData
  ): Promise<void> {
    this.zoneRef.run(async () => {
      // when received a json string
      if (typeof channelMessage === "string") {
        const message: any = JSON.parse(channelMessage);
        if (message.type !== AppConstants.FILE) {
          LoggerUtil.logAny(
            `message received on data channel : ${channelMessage}`
          );
        }
        switch (message.type) {
          //handle signaling messages
          case AppConstants.SIGNALING:
            this.onRouterMessage(message.message);
            break;

          //handle message acknowledgement
          case AppConstants.MESSAGE_ACKNOWLEDGEMENT:
            this.utilityService.updateChatMessageStatus(message);
            break;

          case AppConstants.FILE:
            this.fileSharingService.handleReceivedFileMessage(
              <FileData>message
            );
            break;

          case AppConstants.TEXT:
            message.sent = false;
            const messageStatus: string = await this.updateChatMessages(
              message
            );
            if (
              messageStatus !== AppConstants.CHAT_MESSAGE_STATUS.NOT_APPLICABLE
            ) {
              this.utilityService.sendMessageAcknowledgement(
                message,
                messageStatus,
                message.type
              );
            }
            break;

          default:
            LoggerUtil.logAny(
              `unkown message type recived on dataChannel from: ${
                message.from ? message.from : message.username
              }`
            );
        }
      } else {
        // handle buffer data here
        // LoggerUtil.logAny(`received buffer data from: ${channelMessage.from}`);
        this.fileSharingService.handleReceivedFileBufferData(channelMessage);
      }
    });
  }

  /**
   * this will send all the queued messages to a user over via an data channel
   * for that user
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
   * @param playFlag flag to distinguish between play or stop
   */
  async playIncomeingMessageTune(playFlag: boolean): Promise<void> {
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
  async handleWebrtcEvent(signalingMessage: any): Promise<void> {
    LoggerUtil.logAny(`handling webrtc event: ${signalingMessage.event}`);
    const webrtcContext: any = this.userContextService.getUserWebrtcContext(
      signalingMessage.from
    );
    switch (signalingMessage.event) {
      /**
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
          // handle text datachannel open processing
          case AppConstants.TEXT:
            this.sendQueuedMessagesOnChannel({
              channel: signalingMessage.channel,
              channelOpenAt: new Date(),
              channelOpenedWith: signalingMessage.from,
            });
            break;

          // handle file datachannel open processing
          case AppConstants.FILE:
            this.fileSharingService.startSharing(signalingMessage.from);
            break;
          default:
          //do nothing here
        }
    }
  }

  /**
   * handle file share progress event from file sharing service
   * @param fileShareProgressEvent event data
   */
  async handleFileProgress(
    fileShareProgressEvent: FileShareProgress
  ): Promise<void> {
    this.zoneRef.run(() => {
      const fileContext: TransferredFileContext = this.contextService
        .getFileContext(fileShareProgressEvent.username)
        .get(fileShareProgressEvent.id);
      fileContext.progress = fileShareProgressEvent.progress;
      fileContext.fragmentOffsetAt = fileShareProgressEvent.fragmentOffset;
      fileContext.lastPartReceivedAt = new Date();
    });
  }

  /**
   * handle file share error event from file sharing service
   * @param errorData
   */
  async handleFileShareError(errorData: FileShareError): Promise<void> {
    LoggerUtil.logAny(
      `error occured while sending file with id: ${errorData.fileId} with error code: ${errorData.errorCode}`
    );
    this.contextService
      .getFileContext(errorData.to)
      .get(errorData.fileId).error = true;
  }

  /**
   * handle file metadata receive event from file sharing service
   * @param fileMetadata
   */
  async handleFileMetaData(fileMetadata: FileData): Promise<void> {
    LoggerUtil.logAny(`file metadata event: ${JSON.stringify(fileMetadata)}`);
    this.contextService.initializeFileContext(fileMetadata.from);
    const fileContext: Map<string, TransferredFileContext> =
      this.contextService.getFileContext(
        fileMetadata.sent ? fileMetadata.to : fileMetadata.from
      );

    switch (fileMetadata.fileFragmentType) {
      case FileFragmentType.START:
        // start metadata is for sent file
        if (fileMetadata.sent) {
          fileContext.get(fileMetadata.fileId).startedAt = new Date();
        } else {
          // start metadata is for received file
          fileContext.set(fileMetadata.fileId, {
            id: fileMetadata.fileId,
            fileName: fileMetadata.fileName,
            isSent: false,
            progress: 0,
            fileType: fileMetadata.fileType,
            isFragmented:
              fileMetadata.fileSize >
              CoreFileSharingService.MAX_FILE_CHUNK_SIZE,
            fragmentOffsetAt: 0,
            totalFragments: fileMetadata.totalFragments,
            lastPartReceivedAt: null,
            from: fileMetadata.from,
            isPaused: false,
            size: fileMetadata.fileSize,
            icon: this.fileTransferService.getMappedFileIcon(
              fileMetadata.fileName
            ),
            isComplete: false,
            error: false,
            isResendEnable: false,
            startedAt: new Date(),
            completedAt: null,
          });
          if (this.userContextService.userToChat !== fileMetadata.from) {
            this.userContextService.getUserWebrtcContext(fileMetadata.from)
              .unreadCount++;

            // increment file specic unread count for showing badge
            this.contextService.initializeBadgeConfig(fileMetadata.from);
            this.contextService.getBadgeConfig(fileMetadata.from).file++;
            this.playIncomeingMessageTune(true);
          }
        }
        break;

      /**
       *
       * this payload can be received for sent as well as for received files,
       * see CoreFileSharingService implementation for more details
       *
       */
      case FileFragmentType.END:
        fileContext.get(fileMetadata.fileId).isComplete = true;
        fileContext.get(fileMetadata.fileId).completedAt = new Date();
        break;

      default:
        LoggerUtil.logAny(
          `unkown file metadata received from: ${fileMetadata.from}`
        );
    }
  }

  /**
   * this will open the file explorer to choose files to be sent
   */
  async openFileDialog(): Promise<void> {
    this.renderer.selectRootElement("#file-input", true).click();
  }

  /**
   * retry sharing files with specified user
   * @param username
   */
  async retrySharingFiles(username: string, fileId?: string): Promise<void> {
    LoggerUtil.logAny(`retrying sending files with ${username}`);
    if (fileId) {
      const transferredFile: TransferredFileContext = this.contextService
        .getFileContext(username)
        .get(fileId);
      transferredFile.error = false;
      transferredFile.isResendEnable = false;
    }
    // trigger file sending flow
    this.startSendingFiles(username);
  }

  /**
   * start sharing selected files
   * @event change event object
   */
  async sendFiles(event: any): Promise<void> {
    const userToChat: string = this.userContextService.userToChat;
    this.userContextService.initializeUserWebrtcContext(userToChat);

    // initialize required context for file transfer
    this.contextService.initializeFileContext(userToChat);

    const fileContext: Map<string, TransferredFileContext> =
      this.contextService.getFileContext(userToChat);

    /**
     *
     * @TODO implement allowed file type validation here
     *
     */
    for (const file of event.target.files) {
      // LoggerUtil.logAny(event.target.files[i]);
      const uniqueFileId: string = this.coreAppUtilService.generateIdentifier();

      /**
       *
       * submit file for sharing to file sharing service,
       * progress of sent file can be in an async way via listening to
       * 'onFileProgress' event from file sharing service
       *
       */
      await this.fileSharingService.submitFileToSend({
        id: uniqueFileId,
        channelToSendFile: AppConstants.FILE,
        file,
        to: userToChat,
      });

      fileContext.set(uniqueFileId, {
        id: uniqueFileId,
        fileName: file.name,
        isSent: true,
        progress: 0,
        fileType: file.type,
        isFragmented: file.size > CoreFileSharingService.MAX_FILE_CHUNK_SIZE,
        fragmentOffsetAt: 0,
        totalFragments: Math.ceil(
          file.size / CoreFileSharingService.MAX_FILE_CHUNK_SIZE
        ),
        lastPartReceivedAt: null,
        from: this.userContextService.username,
        isPaused: false,
        size: file.size,
        icon: this.fileTransferService.getMappedFileIcon(file.name),
        isComplete: false,
        error: false,
        isResendEnable: false,
        startedAt: null,
        completedAt: null,
      });
    }
    this.startSendingFiles(userToChat);
    event.target.value = null;
  }

  /**
   * start sharing files with the specified user
   * @param username
   */
  async startSendingFiles(username: string): Promise<void> {
    const webrtcContext: any =
      this.userContextService.getUserWebrtcContext(username);
    if (
      this.coreAppUtilService.isDataChannelConnected(
        webrtcContext,
        AppConstants.FILE
      )
    ) {
      LoggerUtil.logAny("file data channel found open");
      /**
       *  trigger file sender job
       */
      this.fileSharingService.startSharing(username);
    } else {
      LoggerUtil.logAny(
        `file data channel is not in open state for user: ${username}`
      );

      if (
        this.coreAppUtilService.isDataChannelConnecting(
          webrtcContext,
          AppConstants.FILE
        )
      ) {
        /**
         * do nothing here as files has been queued and will be sent when
         * data channel comes in open state
         *
         * @TODO setup a timeout job here to check if datachannel is
         * connected after some time or not else try connecting it again
         */
      } else {
        const createDataChannelType: CreateDataChannelType = {
          username,
          channel: AppConstants.FILE,
        };

        //open data channel here
        this.fileTransferService.setUpDataChannel(createDataChannelType);
      }
    }
  }

  /**
   * log out from the app
   */
  async logout(): Promise<void> {
    try {
      LoggerUtil.logAny("logging out from file-transfer");
      await this.contextService.cleanup();
      this.signalingService.deRegisterOnSignalingServer(
        this.userContextService.getUserName()
      );
      this.userContextService.applicationSignOut();
      this.userContextService.resetCoreAppContext();
      this.userContextService.userSignOut();
      this.router.navigateByUrl("app");
    } catch (error) {
      LoggerUtil.logAny("error encounterd while resetting webrtc context");
      this.router.navigateByUrl("login");
    }
  }

  /**
   * download file using fileId
   * @param username username of the user from whom file is received
   * @param fileId
   */
  async downloadFile(username: string, fileId: string): Promise<void> {
    try {
      const fileBlob: Blob = new Blob(
        this.fileSharingService.getReceivedFileData(fileId)
      );
      const url: string = window.URL.createObjectURL(fileBlob);
      const downloadAnchor: HTMLAnchorElement =
        this.renderer.createElement("a");
      this.renderer.setProperty(downloadAnchor, "href", url);
      this.renderer.setProperty(
        downloadAnchor,
        "download",
        this.contextService.getFileContext(username).get(fileId).fileName
      );
      downloadAnchor.click();
    } catch (e) {
      LoggerUtil.logAny(
        `error occured while downloading file with id: ${fileId}`
      );
      LoggerUtil.logAny(e);
    }
  }

  /**
   * delete file using fileId
   * @param username username of the user with whom file has been shared
   * @param fileId
   */
  async deleteFile(username: string, fileId: string): Promise<void> {
    this.contextService.getFileContext(username).delete(fileId);
    this.fileSharingService.removeReceivedFiledData(fileId);
  }

  /**
   * show file details in the dialog
   * @param username
   * @param fileId
   */
  async showFileDetails(username: string, fileId: string): Promise<void> {
    if (this.contextService.hasFileContext(username)) {
      const file: TransferredFileContext = this.contextService
        .getFileContext(username)
        .get(fileId);

      // if file details exist then show it a info dialog
      if (file) {
        const infoDialogContext: InfoDialogContext =
          await this.utilityService.buildFileInfoDialogContext(file);
        this.openDialog(DialogType.INFORMATIONAL, infoDialogContext);
      }
    } else {
      LoggerUtil.logAny(`file details doesn't exist for file id: ${fileId}`);
    }
  }
}
