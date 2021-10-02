import { Component, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { environment } from 'src/environments/environment';
import { AppLoginDialogComponent } from '../app-login-dialog/app-login-dialog.component';
import { GroupLoginDialogComponent } from '../group-login-dialog/group-login-dialog.component';
import { ProgressDialogComponent } from '../progress-dialog/progress-dialog.component';
import { ApiService } from '../services/api/api.service';
import { AppConstants } from '../services/AppConstants';
import { GroupChatContextService } from '../services/context/group-chat-window/group-chat-context.service';
import { UserContextService } from '../services/context/user.context.service';
import { CreateDataChannelType } from '../services/contracts/CreateDataChannelType';
import { DialogCloseResult } from '../services/contracts/dialog/DialogCloseResult';
import { DialogType } from '../services/contracts/enum/DialogType';
import { CoreDataChannelService } from '../services/data-channel/core-data-channel.service';
import { LoggerUtil } from '../services/logging/LoggerUtil';
import { SignalingService } from '../services/signaling/signaling.service';
import { CoreAppUtilityService } from '../services/util/core-app-utility.service';
import { CoreWebrtcService } from '../services/webrtc/core-webrtc.service';
import { GroupChatWebrtcService } from '../services/webrtc/group-chat-webrtc.service';

@Component({
  selector: 'app-group-chat-window',
  templateUrl: './group-chat-window.component.html',
  styleUrls: ['./group-chat-window.component.scss']
})
export class GroupChatWindowComponent implements OnInit {

  constructor(
    private userContextService: UserContextService,
    private coreAppUtilService: CoreAppUtilityService,
    private signalingService: SignalingService,
    private coreDataChannelService: CoreDataChannelService,
    private groupChatWebrtcService: GroupChatWebrtcService,
    private coreWebrtcService: CoreWebrtcService,
    public groupChatContextService: GroupChatContextService,
    private apiService: ApiService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private router: Router
  ) { }

  dialogRef: MatDialogRef<any>;

  //assets path
  assetsPath = environment.is_native_app ? 'assets/' : '../../assets/';

  activeUsers: any[] = [
    { name: 'gaurav', status: 'online' }
  ];

  messages: any[] = [
    { name: 'gaurav', message: 'I am good. How\'re you?', received: new Date().toLocaleString('en-US') }
  ];

  streams: any[] = [
    { text: 'One', cols: 1, rows: 1 },
    { text: 'Two', cols: 1, rows: 1 }
  ];

  totalsVideoStreamsColumns: Number;

  currentTab: String = 'contacts'; // or 'chat'

  ngOnInit(): void {

    //remove existing signaling event listeners
    this.signalingService.signalingRouter.off('connect');
    this.signalingService.signalingRouter.off('disconnect');
    this.signalingService.signalingRouter.off('message');
    this.signalingService.signalingRouter.off('reconnect');

    if (this.userContextService.isMobile) {
      this.totalsVideoStreamsColumns = 1;
    } else {
      this.totalsVideoStreamsColumns = 2;
    }

    this.groupChatWebrtcService.onDataChannelMessage = this.onDataChannelMessage.bind(this);

    this.setUpSignaling();
  }

  /**
   * setup signaling mechanism for this component
   */
  async setUpSignaling() {

    // check if router is connected to server
    if (!this.signalingService.signalingRouter.connected) {
      this.snackBar.open('disconnected from server....', undefined, {
        panelClass: ['snackbar-class']
      });
    }

    if (this.signalingService.isRegistered) {

      /**
       * this is the case when user has already been registered with server,
       * usually the scenario when user is routed to this component after logging
       * in via login page
       *
       *
       * a. register the 'reconnect' and 'onmessage' handlers only in this scenario
       * 
       */
      const eventsConfig = {
        onmessage: this.onRouterMessage.bind(this),
        onreconnect: this.onRouterConnect.bind(this),
        onclose: () => {
          this.snackBar.open('disconnected from server....');
        }
      };
      this.signalingService.registerEventListeners(eventsConfig);

      try {
        await this.registerApplicationUser(AppConstants.APPLICATION_NAMES.GROUP_CHAT);
      } catch (error) {
        LoggerUtil.log(error);
        this.router.navigateByUrl('app');
      }
    } else {

      /**
       * this is the case when user either reloads this page or directly came on
       * this page via its url
       *
       *
       * if username is available then app will try to register user with that
       * username only on to the server else user will be routed to login page
       * to login again
       *
       *
       * a. if username is available then register open, reconnect and message
       * handlers in this scenario
       */
      const eventsConfig = {
        onopen: this.onRouterConnect.bind(this),
        onreconnect: this.onRouterConnect.bind(this),
        onmessage: this.onRouterMessage.bind(this),
        onclose: () => {
          this.snackBar.open('disconnected from server....');
        }
      };
      this.signalingService.registerEventListeners(eventsConfig);
    }
  }

  /**
   * handler to handle messages received via server or via webrtc datachannel
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
      LoggerUtil.log(`received message via ${signalingMessage.via}: ${JSON.stringify(signalingMessage)}`);
      switch (signalingMessage.type) {
        case AppConstants.REGISTER:
          await this.handleApplicationRegister(signalingMessage);
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

        default:
          LoggerUtil.log(`received unknown signaling message with type: ${signalingMessage.type}`);
      }
    } catch (err) {
      LoggerUtil.log(`error occured while handling received signaling message: ${JSON.stringify(signalingMessage)}`);
      LoggerUtil.log(err);
    }
  }

  /**
   * 
   * this will handle webrtc events 
   * 
   * @param signalingMessage received signaling message 
   */
  async handleWebrtcEvent(signalingMessage: any) {
    LoggerUtil.log(`handling webrtc event from : ${signalingMessage.from}`);
    const webrtcContext: any = this.userContextService.getUserWebrtcContext(signalingMessage.from);
    switch (signalingMessage.event) {

      /**
       * 
       * webrtc data channel open event received from remote user's end
       */
      case AppConstants.WEBRTC_EVENTS.CHANNEL_OPEN:
        LoggerUtil.log(`${signalingMessage.channel} data channel has been opened with user: ${signalingMessage.from}`);
        webrtcContext[AppConstants.MEDIA_CONTEXT][signalingMessage.channel][AppConstants.CONNECTION_STATE] = AppConstants.CONNECTION_STATES.CONNECTED;
        switch (signalingMessage.channel) {

          case AppConstants.TEXT:
            this.groupChatWebrtcService.sendQueuedMessagesOnChannel(signalingMessage.from);
            const groupName: String = this.groupChatContextService.getGroupName();

            /**
             * if group name available in session storage then join in that group else open 
             * appropiate dialog screen for user to choose whether to create a new group or join an existing group
             * 
             */
            if (groupName) {
              const groupExist: Boolean = await this.groupChatWebrtcService.checkIfGroupExist(groupName);
              if (groupExist) {
                this.groupChatWebrtcService.registerUserInGroup(groupName);
              } else {
                this.openDialog(DialogType.GROUP_LOGIN);
              }
            } else {
              this.openDialog(DialogType.GROUP_LOGIN);
            }
            break;

          default:
          //do nothing here
        }
    }
  }

  /**
   * this will process received messages of type 'offer'
   *
   *
   * @param signalingMessage: received signaling message
   */
  async consumeWebrtcOffer(signalingMessage: any): Promise<void> {
    return new Promise<void>(async (resolve, reject) => {
      try {

        /**
         * 
         * if this offer message is for renegotiating an already established connection
         * 
         */
        if (signalingMessage.renegotiate) {

          this.coreWebrtcService.mediaContextInit(signalingMessage.channel, signalingMessage.from);
          const peerConnection: any = this.userContextService.getUserWebrtcContext(signalingMessage.from)[AppConstants.CONNECTION];

          /**
           * handle the received webrtc offer 'sdp', set the remote description and
           * generate the answer sebsequently for sending it to the other user
           *
           * 'answerContainer' will contain the generated answer sdp and few other
           * properties which app utilizes to compose an answer signaling message
           * to be sent to other user
           *
           */
          const answerContainer: any = await this.coreWebrtcService
            .generateAnswer(peerConnection, signalingMessage.offer, signalingMessage.channel);

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
            to: signalingMessage.from
          });
        } else {

          /**
           * 
           * this will setup a new webrtc connection 
           */
          this.groupChatWebrtcService.setUpWebrtcConnection(signalingMessage.from, signalingMessage);
        }
        resolve();
      } catch (e) {
        LoggerUtil.log('there is an error while consuming webrtc offer received from ' + signalingMessage.from);
        reject(e);
      }
    });
  }

  /*
   * handler to handle connection open event with server
   * @TODO this can be removed later 
   */
  onRouterConnect() {
    const username: String = this.userContextService.getUserName()
      ? this.userContextService.getUserName().trim()
      : undefined;
    if (username) {
      this.openDialog(DialogType.PROGRESS, {
        message: 'login in progress'
      });
      this.signalingService.registerOnSignalingServer(username, true);
    } else {
      this.openDialog(DialogType.APP_LOGIN);
    }
    this.snackBar.dismiss();
  }

  /**
   * handle to handle received messages of type 'register'
   * 
   * @param signalingMessage received signaling message
   * @TODO remove it afterwards as this is a common module
   */
  handleApplicationRegister(signalingMessage: any) {
    return new Promise<void>(async (resolve) => {
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
         * d. close current progress dialog
         */
        this.signalingService.isRegistered = signalingMessage.success;
        this.userContextService.username = signalingMessage.username;
        this.coreAppUtilService.setStorageValue(AppConstants.STORAGE_USER, signalingMessage.username);
        try {
          await this.registerApplicationUser(AppConstants.APPLICATION_NAMES.GROUP_CHAT);
        } catch (error) {
          LoggerUtil.log(error);
          this.router.navigateByUrl('app');
        }
      } else {

        /**
         * user registeration failed case - 
         * 
         * close current progress dialog and open app login dialog again
         **/
        this.closeDialog();
        this.openDialog(DialogType.APP_LOGIN);
      }
      resolve();
    });
  }

  /**
   * register user in selected application
   * @param applicationName name of the selected application
   */
  async registerApplicationUser(applicationName: String) {
    return new Promise(async (resolve, reject) => {
      try {
        const data: any = await this.apiService.post(AppConstants.API_ENDPOINTS.REGISTER_APP_USER, {
          username: this.userContextService.username,
          groupName: applicationName
        }).toPromise();

        if (data && data.registered) {
          LoggerUtil.log(`user was succussfully registered for app: ${applicationName}`);
          this.userContextService.selectedApp = applicationName;
          this.coreAppUtilService.setStorageValue(AppConstants.STORAGE_APPLICATION, applicationName.toString());
          /**
           * show the progress bar with appropriate message for connecting with media server
           */
          this.openDialog(DialogType.PROGRESS, {
            message: 'establishing connection with media server'
          });

          /**
           * establish webrtc data channel connection with media server
           *  
           */
          const createDataChannel: CreateDataChannelType = {
            channel: AppConstants.TEXT,
            username: AppConstants.MEDIA_SERVER
          }
          this.groupChatWebrtcService.setUpDataChannel(createDataChannel);
          resolve('user application registration was successful');
        } else {
          this.userContextService.selectedApp = undefined;
          reject('user application registration was unsuccessful');
        }
      } catch (e) {
        LoggerUtil.log(e);
        this.userContextService.selectedApp = undefined;
        reject('user applcation registration was unsuccessful');
      }
    });
  }

  /**
   * event handler for tab selection
   * @param selectedTab 
   */
  selectTab(selectedTab: String) {
    this.currentTab = selectedTab;
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
          panelClass: 'dialog-class',
          data
        });
        break;

      case DialogType.GROUP_LOGIN:
        this.dialogRef = this.dialog.open(GroupLoginDialogComponent, {
          disableClose: true,
          panelClass: 'dialog-class',
          data
        });
        break;

      case DialogType.PROGRESS:
        this.dialogRef = this.dialog.open(ProgressDialogComponent, {
          disableClose: true,
          data
        });
        break;

      case DialogType.INFORMATIONAL:
        break;

      default:
      //do nothing here
    }
    this.dialogRef.afterClosed().subscribe(this.handleDialogClose.bind(this));
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
   * this will handle dialog close
   * @param dialogueCloseResult result data sent by the component contained in the dialog which got closed
   * 
   */
  handleDialogClose(dialogueCloseResult: DialogCloseResult) {
    LoggerUtil.log(`dialog got closed with result: ${JSON.stringify(dialogueCloseResult)}`);
    switch (dialogueCloseResult.type) {
      case DialogType.APP_LOGIN:
        this.openDialog(DialogType.PROGRESS, {
          message: 'login in progress'
        });
        this.signalingService.registerOnSignalingServer(dialogueCloseResult.data.username, true);
        break;

      case DialogType.GROUP_LOGIN:
        break;

      default:
      //do nothing here
    }
  }

  /**
   * logout from theinstshare
   */
  logout() {
    LoggerUtil.log('logging out.........');
    /**
     * send de-register message to server to notify that user has opted to
     * logout
     */
    this.signalingService.deRegisterOnSignalingServer(this.userContextService.getUserName());
    this.userContextService.applicationSignOut();
    this.userContextService.resetCoreAppContext();
    this.router.navigateByUrl('login');
  }

  /**
   * this is onmessage event handler for data channel
   *
   * @param jsonMessage message received via webrtc datachannel
   * 
   */
  async onDataChannelMessage(jsonMessage: string) {
    LoggerUtil.log(`message received on data channel: ${jsonMessage}`);
    const message: any = JSON.parse(jsonMessage);
    switch (message.type) {

      case AppConstants.SIGNALING:
        this.onRouterMessage(message.message);
        break;

      //handle received text data messages
      default:
    }
  }
}
