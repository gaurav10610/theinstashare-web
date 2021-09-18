import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { ApiService } from '../services/api/api.service';
import { AppConstants } from '../services/AppConstants';
import { UserContextService } from '../services/context/user.context.service';
import { LoggerUtil } from '../services/logging/LoggerUtil';
import { SignalingService } from '../services/signaling/signaling.service';
import { CoreAppUtilityService } from '../services/util/core-app-utility.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BaseSignalingMessage } from '../services/contracts/signaling/BaseSignalingMessage';
import { MediaChannelType } from '../services/contracts/enum/MediaChannelType';
import { SignalingMessageType } from '../services/contracts/enum/SignalingMessageType';
import { UserType } from '../services/contracts/enum/UserType';
import { CoreDataChannelService } from '../services/data-channel/core-data-channel.service';
import { GroupChatWebrtcService } from '../services/webrtc/group-chat-webrtc.service';
import { CreateDataChannelType } from '../services/contracts/CreateDataChannelType';
import { CoreWebrtcService } from '../services/webrtc/core-webrtc.service';

@Component({
  selector: 'app-group-chat-login',
  templateUrl: './group-chat-login.component.html',
  styleUrls: ['./group-chat-login.component.scss']
})
export class GroupChatLoginComponent implements OnInit {

  constructor(
    private apiService: ApiService,
    private router: Router,
    public signalingService: SignalingService,
    private userContextService: UserContextService,
    private coreAppUtilService: CoreAppUtilityService,
    private snackBar: MatSnackBar,
    private coreDataChannelService: CoreDataChannelService,
    private groupChatWebrtcService: GroupChatWebrtcService,
    private coreWebrtcService: CoreWebrtcService
  ) { }

  //assets path
  assetsPath = environment.is_native_app ? 'assets/' : '../../assets/';
  inputFieldLabel: String = 'Enter group name';
  isRegistering: Boolean = false;

  @ViewChild('groupNameInput', { static: false }) groupNameInput: ElementRef;

  //this will specify the mode which user selects i.e either to join an existing group or create a new one
  mode: String;

  async ngOnInit() {
    //remove existing signaling event listeners
    this.signalingService.signalingRouter.off('connect');
    this.signalingService.signalingRouter.off('disconnect');
    this.signalingService.signalingRouter.off('message');
    this.signalingService.signalingRouter.off('reconnect');
    await this.setUpSignaling();
  }

  /**
   * This will register all the event listeners
   */
  async setUpSignaling() {
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
      if (this.userContextService.selectedApp === undefined) {
        try {
          await this.registerApplicationUser(AppConstants.APPLICATION_NAMES.GROUP_CHAT);
        } catch (error) {
          LoggerUtil.log(error);
          this.router.navigateByUrl('app');
        }
      }
      const createDataChannelType: CreateDataChannelType = {
        username: AppConstants.MEDIA_SERVER,
        channel: AppConstants.TEXT
      }
      this.groupChatWebrtcService.setUpDataChannel(createDataChannelType);
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
      const username = this.userContextService.getUserName();
      if (username) {
        const eventsConfig = {
          onopen: this.onRouterConnect.bind(this),
          onreconnect: this.onRouterConnect.bind(this),
          onmessage: this.onRouterMessage.bind(this),
          onclose: () => {
            this.snackBar.open('disconnected from server....');
          }
        };
        this.signalingService.registerEventListeners(eventsConfig);
      } else {

        /**
         * route user to login page as username isn't available for registering
         */
        this.router.navigateByUrl('login');
      }
    }
  }

  /*
   * handler to handle connection open event with server
   */
  onRouterConnect() {
    this.signalingService.registerOnSignalingServer(this.userContextService.getUserName(), true);
    this.snackBar.dismiss();
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
      LoggerUtil.log('received message via ' + signalingMessage.via + ': ' + JSON.stringify(signalingMessage));
      switch (signalingMessage.type) {
        case AppConstants.REGISTER:
          await this.handleRegister(signalingMessage);
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
          LoggerUtil.log('received unknown signaling message with type: ' + signalingMessage.type);
      }
    } catch (err) {
      LoggerUtil.log('error occured while handling received signaling message');
      LoggerUtil.log(JSON.stringify(signalingMessage));
      LoggerUtil.log(err);
    }
  }

  /**
   * handle to handle received messages of type 'register'
   * 
   * @param signalingMessage received signaling message
   * 
   */
  handleRegister(signalingMessage: any) {
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
         * d. fetch all the active users
         */
        this.signalingService.isRegistered = signalingMessage.success;
        this.userContextService.username = signalingMessage.username;
        this.coreAppUtilService.setStorageValue(AppConstants.STORAGE_USER, signalingMessage.username);

        /**
         * 
         * onopen event handler won't be needed after user is registered as even
         * in the disconnect cases we will manage reconnect handler only
         * 
         */
        this.signalingService.signalingRouter.off('connect');
        try {
          await this.registerApplicationUser(AppConstants.APPLICATION_NAMES.GROUP_CHAT);
        } catch (error) {
          LoggerUtil.log(error);
          this.router.navigateByUrl('app');
        }
        const createDataChannelType: CreateDataChannelType = {
          username: AppConstants.MEDIA_SERVER,
          channel: AppConstants.TEXT
        }
        this.groupChatWebrtcService.setUpDataChannel(createDataChannelType);
      } else {

        /**
         * this is the case when user registration with server gets failed
         *
         * redirect the user to login page
         */
        this.router.navigateByUrl('login');
      }
      resolve();
    });
  }

  /**
   * join or create a new group 
   * @param operation 
   */
  createOrJoinGroup(operation: String) {
    const groupName = this.groupNameInput.nativeElement.value;
    LoggerUtil.log(`user selected operation: ${operation} with group name: ${groupName}`);
    this.isRegistering = true;
    if (operation === AppConstants.GROUP_CHAT_MODES.EXISTING) {
      this.mode = AppConstants.GROUP_CHAT_MODES.EXISTING;
    } else if (operation === AppConstants.GROUP_CHAT_MODES.NEW) {
      this.mode = AppConstants.GROUP_CHAT_MODES.NEW;
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
   * 
   * this will handle webrtc events 
   * 
   * @param signalingMessage received signaling message 
   */
  handleWebrtcEvent(signalingMessage: any) {
    LoggerUtil.log('handling webrtc event: ' + signalingMessage.event);
    const webrtcContext: any = this.userContextService.getUserWebrtcContext(signalingMessage.from);
    switch (signalingMessage.event) {

      /**
       * 
       * webrtc data channel open event received from remote user's end
       */
      case AppConstants.WEBRTC_EVENTS.CHANNEL_OPEN:
        LoggerUtil.log(signalingMessage.channel + ' data channel has been opened with user: ' + signalingMessage.from);
        webrtcContext[AppConstants.MEDIA_CONTEXT][signalingMessage.channel][AppConstants.CONNECTION_STATE] = AppConstants.CONNECTION_STATES.CONNECTED;
        switch (signalingMessage.channel) {

          case AppConstants.TEXT:
            this.groupChatWebrtcService.sendQueuedMessagesOnChannel(signalingMessage.from);
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
}
