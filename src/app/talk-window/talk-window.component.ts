import { Component, OnInit, ElementRef, ViewChild, Renderer2, AfterViewInit } from '@angular/core';
import { SignalingService } from '../services/signaling/signaling.service';
import { LoggerUtil } from '../services/logging/LoggerUtil';
import { ApiService } from '../services/api/api.service';
import { TalkWindowWebrtcService } from '../services/webrtc/talk-window-webrtc.service';
import { AppConstants } from '../services/AppConstants';
import { Router } from '@angular/router';
import { TalkWindowUtilityService } from '../services/util/talk-window-utility.service';
import { UserContextService } from '../services/context/user.context.service';
import { environment } from '../../environments/environment';
import { WebRemoteAccessService } from '../services/remote-access/web-remote-access.service';
import { CoreWebrtcService } from '../services/webrtc/core-webrtc.service';
import { CoreAppUtilityService } from '../services/util/core-app-utility.service';
import { TalkWindowContextService } from '../services/context/talk-window-context.service';
import { MessageService } from '../services/message/message.service';
import { CreateDataChannelType } from '../services/contracts/CreateDataChannelType';
import { StartMediaStreamType } from '../services/contracts/StartMediaStreamType';
import { CallbackContextType } from '../services/contracts/WebrtcCallbackContextType';

@Component({
  selector: 'app-talk-window',
  templateUrl: './talk-window.component.html',
  styleUrls: ['./talk-window.component.css']
})
export class TalkWindowComponent implements OnInit, AfterViewInit {

  constructor(
    public signalingService: SignalingService,
    private apiService: ApiService,
    private webrtcService: TalkWindowWebrtcService,
    private router: Router,
    private talkWindowUtilService: TalkWindowUtilityService,
    public userContextService: UserContextService,
    public talkWindowContextService: TalkWindowContextService,
    private renderer: Renderer2,
    private webRemoteAccessService: WebRemoteAccessService,
    private coreWebrtcService: CoreWebrtcService,
    private coreAppUtilService: CoreAppUtilityService,
    private messageService: MessageService
  ) { }

  showLoader: boolean = false;

  fileReader: any;

  //assets path
  assetsPath = environment.is_native_app ? 'assets/' : '../../assets/';

  @ViewChild('msg_history', { static: false }) messageHistoryDiv: ElementRef;
  @ViewChild('message_history', { static: false }) messageHistoryBox: ElementRef;
  @ViewChild('text_msg', { static: false }) messageInput: ElementRef;
  @ViewChild('remote_video_div', { static: false }) remoteVideoDiv: ElementRef;
  @ViewChild('remoteVideo', { static: false }) remoteVideo: ElementRef;
  @ViewChild('remoteAudio', { static: false }) remoteAudio: ElementRef;
  @ViewChild('localVideo', { static: false }) localVideo: ElementRef;
  @ViewChild('remoteSound', { static: false }) remoteSound: ElementRef;
  @ViewChild('remote_video_canvas', { static: false }) remoteVideoCanvas: ElementRef;
  @ViewChild('chat_div', { static: false }) chatDiv: ElementRef;

  /**
   * Renderer2 unlisten functions
   */
  remoteVideoUnlistenFn: () => void;
  messageHistoryUnlistenFn: () => void;
  remoteVideoDivUnlistenFn: () => void;

  /*
   * angular OnInit hook
   */
  ngOnInit() {

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
        onmessage: this.onRouterMessage.bind(this)
      };

      this.signalingService.registerEventListeners(eventsConfig);
      this.fetchActiveUsersList();

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
          onmessage: this.onRouterMessage.bind(this)
        };
        this.signalingService.registerEventListeners(eventsConfig);

      } else {

        /**
         * route user to login page as username isn't available for registering
         */
        this.router.navigateByUrl('login');
      }
    }

    /**
     * if message history is available in the storage variable then load the
     * message context with it
     *
     *
     * usually the case when user reloads the page as app always store message
     * history in a storage variable before unloading the app window
     */
    const messageContext = this.coreAppUtilService.getStorageValue(AppConstants.CHAT_MESSAGES);
    if (messageContext) {
      this.talkWindowContextService.messageContext = JSON.parse(messageContext);
      this.coreAppUtilService.removeStorageValue(AppConstants.CHAT_MESSAGES);
    }

    /**
     * this is being done just to reuse some code available in this component
     * within webrtc service
     *
     */
    this.webrtcService.talkWindowOnRouterMessageFn = this.onRouterMessage.bind(this);
    this.webrtcService.talkWindowUpdateChatMessagesFn = this.updateChatMessages.bind(this);
    this.webrtcService.talkWindowOnMediaStreamReceivedFn = this.onMediaStreamReceived.bind(this);
    this.webrtcService.talkWindowSetRemoteVolumeFn = this.setRemoteAudioVolume.bind(this);
    this.webrtcService.talkWindowPlayOrStopTuneFn = this.playOrStopTune.bind(this);
    this.webrtcService.talkWindowSetCentralIconsPopupFn = this.setCentralIconsPopup.bind(this);

    /**
     * subscribe to event emitter in order to do some cascading processing when
     * something changed in user's media context
     *
     *
     * @TODO try to find a better way to achieve this
     */
    this.talkWindowContextService.mediaContextUpdateEventEmitter
      .subscribe(this.webrtcService.mediaCallContextUpdateHandler.bind(this.webrtcService));

    /**
     * window before unload hook, in order to process something before browser
     * reloads the page
     * 
     * @TODO use renderer2 here and verify
     * 
     */
    window.onbeforeunload = function () {

      if (environment.production) {

        /**
         * store the message history in a storage variable before app gets
         * reloaded in browser
         *
         * this will be used to initialize message context in the onit section
         * to if app has been reloaded in the browser
         */
        this.appUtilService.setStorageValue(AppConstants.CHAT_MESSAGES,
          JSON.stringify(this.userContextService.messageContext));
      }
    }.bind(this);

    /**
     * populate os type to be utilised by remote access mechanism later on 
     */
    this.talkWindowContextService.remoteAccessContext['localOS'] = this.talkWindowUtilService.getOSType();
    LoggerUtil.log('local operating system: ' + this.talkWindowContextService.remoteAccessContext['localOS']);

    this.fileReader = new FileReader();
  }

  ngAfterViewInit(): void {

    /**
     * if page is rendered on a mobile device screen then enable opening feature
     * options popup on screen tap of chat window
     *
     */
    if (this.userContextService.isMobile) {
      this.setCentralIconsPopup(true);
    }

    //Set initial volume for audio tag
    this.setRemoteAudioVolume(0.0);

    //get remote video height and width
    this.renderer.listen(this.remoteVideo.nativeElement, 'loadedmetadata', (event: any) => {
      if (this.talkWindowContextService.bindingFlags.isScreenSharing) {
        LoggerUtil.log('remote screen video stream has been loaded');
        this.renderer.removeClass(this.remoteVideo.nativeElement, 'full-height-width');
        this.renderer.addClass(this.remoteVideo.nativeElement, 'center-screen-video');
        this.webRemoteAccessService.calculateRemoteAccessParameters(this.remoteVideo.nativeElement.videoWidth,
          this.remoteVideo.nativeElement.videoHeight,
          this.remoteVideoDiv.nativeElement.clientWidth,
          this.remoteVideoDiv.nativeElement.clientHeight,
          this.remoteVideo, this.remoteVideoCanvas);
      } else {
        LoggerUtil.log('remote video stream has been loaded');
        this.renderer.removeClass(this.remoteVideo.nativeElement, 'center-screen-video');
        this.renderer.addClass(this.remoteVideo.nativeElement, 'full-height-width');
      }
    });

    //window resize event
    this.renderer.listen(window, 'resize', (event: any) => {
      LoggerUtil.log('window resize event fired');

      /**
       * only handle this event if user is in screen sharing seesion to re-calulate some 
       * coordinate translation ratios used by remote access mechanism
       *  
       */
      if (this.talkWindowContextService.bindingFlags.isScreenSharing &&
        this.talkWindowContextService.bindingFlags.haveRemoteVideoStream) {
        this.webRemoteAccessService.calculateRemoteAccessParameters(this.talkWindowContextService.remoteAccessContext['remoteWidth'],
          this.talkWindowContextService.remoteAccessContext['remoteHeight'],
          this.remoteVideoDiv.nativeElement.clientWidth,
          this.remoteVideoDiv.nativeElement.clientHeight,
          this.remoteVideo, this.remoteVideoCanvas);
      }
    });
  }

  /*
   * handler to handle connection open event with server
   */
  onRouterConnect() {
    this.signalingService.registerOnSignalingServer(this.userContextService.getUserName(), true);
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

        case AppConstants.DISCONNECT:
          this.handleDisconnectionRequest(signalingMessage);
          break;

        case AppConstants.RECONNECT:
          this.handleReconnectionRequest(signalingMessage);
          break;

        case AppConstants.CALL_REQUEST:
          await this.handleMediaStreamRequests(signalingMessage);
          break;

        case AppConstants.REMOTE_ACCESS_REQUEST:
          this.handleRemoteAccessRequest(signalingMessage);
          break;

        case AppConstants.USER_ACTIVE_STATUS:
          this.talkWindowUtilService.updateUserStatus(signalingMessage.connected, signalingMessage.username);
          break;

        case AppConstants.WEBRTC_EVENT:
          this.handleWebrtcEvent(signalingMessage);
          break;

        default:
          LoggerUtil.log('received unknown signaling message with type: ' + signalingMessage.type);
      }
      this.talkWindowUtilService.appRef.tick();
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
    return new Promise<void>((resolve) => {
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
        this.fetchActiveUsersList();

        /**
         * 
         * onopen event hanler won't be needed after user is registered as even
         * in the disconnect cases we will manage reconnect handler only
         * 
         */
        this.signalingService.signalingRouter.off('connect');

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
   * this will process received messages of type 'offer'
   *
   *
   * @param signalingMessage: received signaling message
   */
  async consumeWebrtcOffer(signalingMessage: any) {
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

          if (signalingMessage.seekReturnTracks) {

            signalingMessage.seekReturnTracks.forEach((mediaChannel: string) => {
              this.coreWebrtcService.mediaContextInit(mediaChannel, signalingMessage.from);
            });

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
              .generateAnswerWithTracks(peerConnection, signalingMessage.offer, signalingMessage.channel, signalingMessage.seekReturnTracks);


            /**
             * send the composed 'answer' signaling message to the other user from whom
             * we've received the offer message
             *
             */
            this.webrtcService.sendPayload({
              type: AppConstants.ANSWER,
              answer: answerContainer.answerPayload.answer,
              channel: answerContainer.answerPayload.channel,
              from: this.userContextService.username,
              to: signalingMessage.from
            });

            const webrtcContext: any = this.userContextService.getUserWebrtcContext(signalingMessage.from);
            /**
             * 
             * process here on the basis of captured video streams
             * 
             * @TODO wrap this in a function call afterwards
             */
            answerContainer.mediaStreams.forEach((streamContext: any) => {
              /**
               * set local media stream in user's context
               */
              webrtcContext[AppConstants.MEDIA_CONTEXT][streamContext.channel][AppConstants.TRACK] = streamContext[AppConstants.TRACK];
              webrtcContext[AppConstants.MEDIA_CONTEXT][streamContext.channel][AppConstants.TRACK_SENDER] = streamContext[AppConstants.TRACK_SENDER];

              /**
               * set some values values in the media call context which will be used to
               * compose appropriate view on UI for the user
               *
               * 'channel' property in the signaling message will specify the kind of
               * media stream we will be relaying over this webrtc peer connection
               *
               * channel: 1. screen - set in messages for screen sharing
               *          2. sound - set in messages for system sound sharing
               *          3. video - set in messages for video calling
               *          4. audio - set in messages for audio calling
               *
               *
               */
              switch (streamContext.channel) {
                case AppConstants.AUDIO:
                  this.talkWindowContextService.updateBindingFlag('haveLocalAudioStream', true, streamContext.channel);
                  break;

                case AppConstants.VIDEO:
                  this.talkWindowContextService.updateBindingFlag('haveLocalVideoStream', true, streamContext.channel);

                  /**
                   * set local media stream in appropriate media tag on UI
                   *
                   */
                  this.onMediaStreamReceived(streamContext[AppConstants.STREAM], AppConstants.VIDEO, true);
              }
            });
          } else {
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
            this.webrtcService.sendPayload({
              type: AppConstants.ANSWER,
              answer: answerContainer.answerPayload.answer,
              channel: answerContainer.answerPayload.channel,
              from: this.userContextService.username,
              to: signalingMessage.from
            });
          }
        } else {

          /**
           * 
           * this will setup a new webrtc connection 
           */
          this.webrtcService.setUpWebrtcConnection(signalingMessage.from, signalingMessage);
        }
        resolve();
      } catch (e) {
        LoggerUtil.log('there is an error while consuming webrtc offer received from ' + signalingMessage.from);
        reject(e);
      }
    });
  }

  /**
   * fetch list of all the active users from server and update them in the
   * contact list view with their connected status
   *
   */
  async fetchActiveUsersList() {
    let data: any = await this.apiService
      .get(AppConstants.API_ENDPOINTS.GET_ALL_ACTIVE_USERS).toPromise();

    //clear userStatus object
    this.talkWindowContextService.userStatus.clear();
    //clear active users list
    this.talkWindowContextService.activeUsers = [];
    data.users.forEach((user: string) => {
      this.talkWindowUtilService.updateUserStatus(true, user);
    });
  }

  /**
   * event handler when user click on any media start/stop icon on UI
   *
   * @param clickedIcon unique string identifier of clicked icon on screen
   * 
   * @TODO refactor this whole approach
   */
  async handleMediaStreaming(clickedIcon: string) {

    /**
     * if app is rendered on a mobile screen then feature menu shows up on
     * screen tap, so once user has clicked on an icon then we should hide the
     * modal popup
     *
     * @TODO refactor it afterwards and replace it by keeping a boolean flag to
     * hide and show the modal popup
     *
     */
    if (this.userContextService.isMobile) {
      this.setIconsPopup(true);
    }

    // get the username of the currently selected user
    const userToChat = this.userContextService.userToChat;
    const webrtcContext: any = this.userContextService.getUserWebrtcContext(userToChat);

    const tokens: string[] = clickedIcon.split('-');
    const channel: string = tokens[tokens.length - 1];
    let isStopRequest: boolean = tokens.length > 1;

    if (isStopRequest) {
      LoggerUtil.log('handling media stream stop request for channel: ' + channel);

      /**
       * set the informational disconnect modal popup for user
       */
      const stopAudioPopupContext: any = this.messageService
        .buildPopupContext(AppConstants.POPUP_TYPE.DISCONNECTING, channel);
      // remove the track from peer connection
      if (webrtcContext[AppConstants.MEDIA_CONTEXT][channel][AppConstants.TRACK_SENDER]) {
        webrtcContext[AppConstants.CONNECTION].removeTrack(webrtcContext[AppConstants.MEDIA_CONTEXT][channel][AppConstants.TRACK_SENDER]);
      }
      this.webrtcService.processMediaStreamDisconnect(channel, userToChat, true, [stopAudioPopupContext]);
      await this.webrtcService.cleanMediaStreamContext(channel, webrtcContext[AppConstants.MEDIA_CONTEXT][channel]);
      delete webrtcContext[AppConstants.MEDIA_CONTEXT][channel];

      /**
       * 
       * @TODO segregate this logic in a function afterwards
       */
      if (channel === AppConstants.SCREEN) {
        /**
         * stop system sound sharing as well along with screen
         * sharing
         *
         */
        if (this.talkWindowContextService.bindingFlags.isSoundSharing) {
          if (webrtcContext[AppConstants.MEDIA_CONTEXT][AppConstants.SOUND][AppConstants.TRACK_SENDER]) {
            webrtcContext[AppConstants.CONNECTION].removeTrack(webrtcContext[AppConstants.MEDIA_CONTEXT][AppConstants.SOUND][AppConstants.TRACK_SENDER]);
          }
          /**
           * 
           * @TODO verify it afterwards if notification is really necessary or not
           */
          this.webrtcService.processMediaStreamDisconnect(AppConstants.SOUND, userToChat, true, [stopAudioPopupContext]);
          await this.webrtcService.cleanMediaStreamContext(AppConstants.SOUND, webrtcContext[AppConstants.MEDIA_CONTEXT][AppConstants.SOUND]);
          delete webrtcContext[AppConstants.MEDIA_CONTEXT][AppConstants.SOUND];
        }

        /**
         * if remote access with screen sharing
         */
        if (this.talkWindowContextService.bindingFlags.isAccessingRemote ||
          this.talkWindowContextService.bindingFlags.haveSharedRemoteAccess) {
          /**
           * display appropriate modal popup message on UI
           */
          const remoteAccessPopupContext = this.messageService
            .buildPopupContext(AppConstants.POPUP_TYPE.DISCONNECTING, AppConstants.REMOTE_CONTROL);
          this.webrtcService.processMediaStreamDisconnect(channel, userToChat, true, [remoteAccessPopupContext]);
          await this.webrtcService.cleanDataChannelContext(AppConstants.REMOTE_CONTROL, webrtcContext[AppConstants.MEDIA_CONTEXT][AppConstants.REMOTE_CONTROL]);
          delete webrtcContext[AppConstants.MEDIA_CONTEXT][AppConstants.REMOTE_CONTROL];
        }
      }

    } else {
      LoggerUtil.log('handling media stream start request for channel: ' + channel);
      /**
       * 
       * handle media stream start request
       */
      this.setMediaStreamRequest(channel);
    }
    this.talkWindowUtilService.appRef.tick();
  }

  /**
   * this will set the media stream request in the media call context for
   * currently selected user whenever user want to start streaming any type
   * of media and send the media stream request to currently selected user
   *
   *
   * @param channel type of media user selected to stream i.e video, audio,
   * screen and sound
   */
  async setMediaStreamRequest(channel: string) {

    /**
     * exception flow for sharing system sound on web app
     *
     */
    if (channel === AppConstants.SOUND && !this.userContextService.isNativeApp) {
      let isSoundAvailable = await this.talkWindowUtilService.isScreenSoundAvailable();
      if (!isSoundAvailable) {
        return;
      }
    }

    /**
     * set media call context for selected media
     *
     * media call context will be used once app receiveS sent call request's
     * response from the other user
     *
     */
    this.talkWindowContextService.mediaStreamRequestContext[AppConstants.USERNAME] = this.userContextService.userToChat;
    this.talkWindowContextService.mediaStreamRequestContext[AppConstants.CHANNEL] = channel;

    /**
     * set the informational calling modal popup for user
     */
    this.talkWindowUtilService.addPopupContext({
      type: AppConstants.POPUP_TYPE.CONNECT + channel,
      modalText: 'calling ' + this.userContextService.userToChat + '...',
      disconnect: true,
      channel: channel
    });

    /**
     * send the media call request to the currently selected user
     *
     */
    this.webrtcService.sendPayload({
      type: AppConstants.CALL_REQUEST,
      channel: channel,
      from: this.userContextService.username,
      to: this.userContextService.userToChat,
      request: AppConstants.INVITE,
      isNativeApp: environment.is_native_app
    });
  }

  /**
   * this will start the media streaming for required media type specfied by channel
   *
   * @param startMediaStreamType start media stream request type
   */
  async startMediaStream(startMediaStreamType: StartMediaStreamType) {
    try {
      LoggerUtil.log('handling media stream start request for accepted call ' + startMediaStreamType.requiredMediaTracks.toString());
      const username = startMediaStreamType.username ? startMediaStreamType.username : this.userContextService.userToChat;

      /**
       * initialize user's webrtc context for the user with whom you wanted to
       * start media streaming, if it didn't exist
       *
       */
      if (!this.userContextService.hasUserWebrtcContext(username)) {
        this.userContextService.initializeUserWebrtcContext(username);
      }

      /**
       * 
       * initialize the media context for all the required media tracks
       */
      startMediaStreamType.requiredMediaTracks.forEach((mediaChannel) => {
        this.coreWebrtcService.mediaContextInit(mediaChannel, username);
      });

      const webrtcContext: any = this.userContextService.getUserWebrtcContext(username);
      webrtcContext[AppConstants.RECONNECT] = true;

      if (webrtcContext[AppConstants.CONNECTION_STATE] === AppConstants.CONNECTION_STATES.CONNECTED) {
        const peerConnection: any = webrtcContext[AppConstants.CONNECTION];

        /**
         *
         * generate the appropriate 'offer' for sending it to the other user
         *
         * 'offerContainer' will contain the genrated offer sdp and few other
         * properties which app utilizes to compose an offer signaling message
         * to be sent to other user
         *
         */
        const offerContainer: any = await this.coreWebrtcService
          .generateOfferWithMediaTracks(peerConnection, startMediaStreamType.channel, startMediaStreamType.requiredMediaTracks);

        /**
         *  compose 'offer' signaling message
         *
         * @property 'seekReturnTracks' will be used by receiving peer user to
         * check what all tracks has to be send for audio and video calls we'll 
         * use different webrtc connections to send and recive media media streams.
         *
         * Currently, this property is set for audio and video calls as screen
         * sharing and system sound sharing is one way streaming
         */
        let offerPayload = {
          type: offerContainer.offerPayload.type,
          offer: offerContainer.offerPayload.offer,
          channel: offerContainer.offerPayload.channel,
          from: this.userContextService.username,
          to: username,
          renegotiate: true,
          seekReturnTracks: startMediaStreamType.requiredMediaTracks
        };

        /**
         * screen and sound streaming is one way only, so don't seek any tracks in return
         */
        if (startMediaStreamType.channel === AppConstants.SCREEN || startMediaStreamType.channel === AppConstants.SOUND) {
          delete offerPayload['seekReturnTracks'];
        }
        this.webrtcService.sendPayload(offerPayload);

        /**
         * 
         * process here on the basis of captured video streams
         */
        offerContainer.mediaStreams.forEach((streamContext: any) => {
          /**
           * set local media stream in user's context
           */
          webrtcContext[AppConstants.MEDIA_CONTEXT][streamContext.channel][AppConstants.TRACK] = streamContext[AppConstants.TRACK];
          webrtcContext[AppConstants.MEDIA_CONTEXT][streamContext.channel][AppConstants.TRACK_SENDER] = streamContext[AppConstants.TRACK_SENDER];

          /**
           * set some values values in the media call context which will be used to
           * compose appropriate view on UI for the user
           *
           * 'channel' property in the signaling message will specify the kind of
           * media stream we will be relaying over this webrtc peer connection
           *
           * channel: 1. screen - set in messages for screen sharing
           *          2. sound - set in messages for system sound sharing
           *          3. video - set in messages for video calling
           *          4. audio - set in messages for audio calling
           *
           *
           */
          if (streamContext.channel === AppConstants.SCREEN || streamContext.channel === AppConstants.VIDEO) {
            this.talkWindowContextService.updateBindingFlag('haveLocalVideoStream', false, streamContext.channel);
          } else if (streamContext.channel === AppConstants.SOUND || streamContext.channel === AppConstants.AUDIO) {
            this.talkWindowContextService.updateBindingFlag('haveLocalAudioStream', false, streamContext.channel);
          }
          /**
           * set local media stream in appropriate media tag on UI
           */
          if (streamContext.channel === AppConstants.VIDEO) {
            this.onMediaStreamReceived(streamContext[AppConstants.STREAM], AppConstants.VIDEO, true);
          }
        });
      } else {

        /**
         * 
         * if webrtc connection is not in connetcted state then add the startMediaStream(...) function 
         * along with the calling context in the webrtc on connect queue
         */
        const webrtcCallbackContextType: CallbackContextType = {
          callbackFunction: this.startMediaStream.bind(this),
          callbackContext: startMediaStreamType
        };
        webrtcContext[AppConstants.WEBRTC_ON_CONNECT_QUEUE].enqueue(webrtcCallbackContextType);
        if (webrtcContext[AppConstants.CONNECTION_STATE] === AppConstants.CONNECTION_STATES.NOT_CONNECTED) {
          this.webrtcService.setUpWebrtcConnection(username);
        }
      }
    } catch (e) {
      LoggerUtil.log('there is an error encountered while starting ' + startMediaStreamType.channel + ' media stream');
      LoggerUtil.log(e);
    }
  }

  /**
   * on click handler when user selects a user from active user's list
   *
   * @param selectedUser username of the selected user
   * 
   */
  async startTextChat(selectedUser: string) {

    /**
     * if user is currenty in a video streaming session then do nothing. User
     * has to stop video sharing to chat with other user
     *
     */
    if (!this.talkWindowContextService.bindingFlags.isVideoSharing) {

      /**
       * set the chat window for user
       */
      this.setChatWindow(false);

      LoggerUtil.log('selected user: ' + selectedUser);
      LoggerUtil.log('previous selected user: ' + this.userContextService.userToChat);

      /**
       * when user want to chat with a person other than the currently selected
       * user
       */
      if (selectedUser !== this.userContextService.userToChat) {

        /**
         * set the currenty selected user in context, this will be used
         * everywhere
         */
        this.userContextService.userToChat = selectedUser;
        await this.talkWindowUtilService.loadChatHistory(selectedUser);

        //if user's webrtc context exist then make the unread count 0
        if (this.userContextService.getUserWebrtcContext(selectedUser)) {
          this.userContextService.getUserWebrtcContext(selectedUser).unreadCount = 0;
        }
        this.talkWindowUtilService.appRef.tick();
        this.scrollMessages();
      } else {
        LoggerUtil.log('already connected with user: ' + selectedUser);
      }
    } else {

      /**
       * @TODO show appropriate message popup message here
       */
    }
  }

  /**
   * on click handler to send text message input
   *
   * @param event
   */
  sendTextMessage(event?: any) {
    //get the currenty selected user
    const userToChat = this.userContextService.userToChat;

    if (event !== undefined) {
      // when user hits enter
      if (event.keyCode === 13) {
        /**
         * send typed text message over webrtc datachannel
         */
        this.sendMessageOnChannel(this.messageInput.nativeElement.value, userToChat);
        //clear the text box
        this.renderer.setProperty(this.messageInput.nativeElement, 'value', '');
        /**
         * @TODO see if this is a good practice
         */
        this.messageInput.nativeElement.focus();
      }
    } else {
      // when user hits the submit button
      this.sendMessageOnChannel(this.messageInput.nativeElement.value, userToChat);
      this.renderer.setProperty(this.messageInput.nativeElement, 'value', '');
      /**
       * @TODO see if this is a good practice
       */
      this.messageInput.nativeElement.focus();
    }
  }

  /**
   * this will send the text message over data channel to currently selected
   * user
   *
   * @param textMessage text message that needed to be sent
   * 
   * @param userToChat username of the user to whom message has to be sent
   */
  async sendMessageOnChannel(textMessage: any, userToChat: string) {
    try {
      if (textMessage !== '') {

        /**
         * initialize user's webrtc context for the user to whom you wanted to
         * send message, if it didn't exist
         *
         */
        if (!this.userContextService.hasUserWebrtcContext(userToChat)) {
          this.userContextService.initializeUserWebrtcContext(userToChat);
        }
        const webrtcContext = this.userContextService.getUserWebrtcContext(userToChat);

        //generate a new message identifier
        const messageId: any = await this.coreAppUtilService.generateIdentifier();

        //update message in chat window on UI
        this.updateChatMessages({
          id: messageId,
          status: AppConstants.CHAT_MESSAGE_STATUS.SENT,
          message: textMessage,
          username: userToChat,
          type: AppConstants.TEXT,
          sent: true
        });

        //check if there is an open data channel
        if (this.coreAppUtilService.isDataChannelConnected(webrtcContext, AppConstants.TEXT)) {
          // LoggerUtil.log('Found an open data channel already.');

          //send message on data channel
          webrtcContext[AppConstants.MEDIA_CONTEXT][AppConstants.TEXT].dataChannel.send(JSON.stringify({
            id: messageId,
            message: textMessage,
            username: this.userContextService.username,
            type: AppConstants.TEXT
          }));
        } else {

          LoggerUtil.log('text data channel is not in open state for user: ' + userToChat);

          if (webrtcContext[AppConstants.MESSAGE_QUEUE] === undefined) {
            this.userContextService.initializeMessageQueue(userToChat);
          }

          // just queue the message and wait for data channel setup
          webrtcContext[AppConstants.MESSAGE_QUEUE].enqueue({
            id: messageId,
            message: textMessage,
            username: this.userContextService.username,
            type: AppConstants.TEXT
          });

          // when data channel open request has already been raised, then just queue the messages
          if (this.coreAppUtilService.isDataChannelConnecting(webrtcContext, AppConstants.TEXT)) {
            LoggerUtil.log('text data channel is in connecting state for user: ' + userToChat);

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
              channel: AppConstants.TEXT
            }

            //set up new data channel
            await this.webrtcService.setUpDataChannel(createDataChannelType);
          }
        }
      }
    } catch (e) {
      LoggerUtil.log(e);
    }
  }

  /**
   * this will open the file explorer to choose file to be sent
   */
  openFileDialog() {
    this.renderer.selectRootElement('#file_input', true).click();
  }

  /**
   * this will share the file over a data channel and then clean it
   * @param event event object
   *
   */
  async startSharingFile(event: any) {
    // LoggerUtil.log(event.target.files);
    const areFilesAllowedToShare: boolean = await this.talkWindowUtilService.areAllowedFileTypes(event.target.files);
    if (areFilesAllowedToShare) {
      const userToChat = this.userContextService.userToChat;
      if (!this.userContextService.hasUserWebrtcContext(userToChat)) {
        this.userContextService.initializeUserWebrtcContext(userToChat);
      }
      const webrtcContext = this.userContextService.getUserWebrtcContext(userToChat);
      let dataChannel: any;
      if (!webrtcContext[AppConstants.FILE_QUEUE]) {
        this.userContextService.initializeFileQueue(userToChat);
      }

      for (let i = 0; i < event.target.files.length; i++) {
        const contentType = await this.talkWindowUtilService.resolveFileType(event.target.files[i].type.split('/')[1]);
        const contentId: any = await this.coreAppUtilService.generateIdentifier();
        webrtcContext[AppConstants.FILE_QUEUE].enqueue({
          id: contentId,
          file: event.target.files[i],
          username: userToChat,
          type: AppConstants.FILE,
          sent: true,
          contentType: contentType,
          contentId: contentId,
          fileName: event.target.files[i].name
        });

        this.updateChatMessages({
          id: contentId,
          status: AppConstants.CHAT_MESSAGE_STATUS.SENT,
          username: userToChat,
          type: AppConstants.FILE,
          sent: true,
          contentType: contentType,
          contentId: contentId,
          fileName: event.target.files[i].name
        });
        this.talkWindowContextService.sharedContent[contentId] = '';
      }

      if (this.coreAppUtilService.isDataChannelConnected(webrtcContext, AppConstants.FILE)) {

        LoggerUtil.log('file data channel found open');
        this.talkWindowUtilService.readFile(this.fileReader, webrtcContext[AppConstants.FILE_QUEUE].front());
      } else {

        LoggerUtil.log('file data channel is not in open state for user: ' + userToChat);

        if (this.coreAppUtilService.isDataChannelConnecting(webrtcContext, AppConstants.FILE)) {

          /**
           * do nothing here as files has been queued and will be sent when
           * data channel comes in open state
           *
           * @TODO setup a timeout job here to check if datachannel is
           * connected after some time or not else try connecting it again
           */
        } else {

          const createDataChannelType: CreateDataChannelType = {
            username: userToChat,
            channel: AppConstants.FILE
          }

          //open data channel here
          this.webrtcService.setUpDataChannel(createDataChannelType);
        }
      }

      this.fileReader.onload = async (event: any) => {
        const fileRecord: any = webrtcContext[AppConstants.FILE_QUEUE].dequeue();
        this.talkWindowContextService.sharedContent[fileRecord[AppConstants.CONTENT_ID]] = event.target.result;
        // LoggerUtil.log(fileRecord);
        // LoggerUtil.log("Blob size: " + event.target.result.length);

        if (event.target.result.length < AppConstants.CHUNK_SIZE) {

          //sending file start meta data
          this.talkWindowUtilService.sendMessageOnDataChannel(fileRecord[AppConstants.USERNAME],
            {
              id: fileRecord[AppConstants.CONTENT_ID],
              message: 'start',
              username: this.userContextService.username,
              type: AppConstants.FILE,
              contentType: fileRecord[AppConstants.CONTENT_TYPE],
              chunkType: AppConstants.CHUNK_TYPE.START,
              contentId: fileRecord[AppConstants.CONTENT_ID],
              fileName: fileRecord[AppConstants.FILE_NAME]
            }, AppConstants.FILE);

          //update last data exchanged timestamp in user's webrtc context
          webrtcContext[AppConstants.MEDIA_CONTEXT][AppConstants.FILE][AppConstants.LAST_USED] = Date.now();

          //stop sending file data if data channel buffer is already crossed threshold
          while (dataChannel.bufferedAmount > AppConstants.DATACHANNEL_BUFFER_THRESHOLD) {
            await this.coreAppUtilService.delay(AppConstants.DATACHANNEL_FILE_SEND_TIMEOUT);
          }

          //send file data
          this.talkWindowUtilService.sendMessageOnDataChannel(fileRecord[AppConstants.USERNAME],
            {
              id: fileRecord[AppConstants.CONTENT_ID],
              message: event.target.result,
              username: this.userContextService.username,
              type: AppConstants.FILE,
              contentType: fileRecord[AppConstants.CONTENT_TYPE],
              chunkType: AppConstants.CHUNK_TYPE.WHOLE,
              contentId: fileRecord[AppConstants.CONTENT_ID],
              fileName: fileRecord[AppConstants.FILE_NAME]
            }, AppConstants.FILE);

          //update last data exchanged timestamp in user's webrtc context
          webrtcContext[AppConstants.MEDIA_CONTEXT][AppConstants.FILE][AppConstants.LAST_USED] = Date.now();
        } else {
          //for bigger file size, send it in chunks
          await this.sendFileDataInChunks(fileRecord, event.target.result);
        }
        //Send file data
        if (!webrtcContext[AppConstants.FILE_QUEUE].isEmpty()) {
          this.talkWindowUtilService.readFile(this.fileReader, webrtcContext[AppConstants.FILE_QUEUE].front());
        }
      } //here ends onload
    } else {
      let allowedFileTypes = (AppConstants.SUPPORTED_IMAGE_FORMATS
        .concat(AppConstants.SUPPORTED_VIDEO_FORMATS)).concat(AppConstants.SUPPORTED_AUDIO_FORMATS);
      this.talkWindowUtilService.flagError('error: file type you selected is not allowed');
      this.talkWindowUtilService.flagError('allowed file types: ' + allowedFileTypes.join(' | '));
    }
    event.target.value = '';
  }

  /**
   * this will send file data in chunks
   * 
   * @param  fileRecord :file data record
   * 
   * @param fileBlob    :file data blob
   * 
   * @return promise after sending all chunks
   */
  sendFileDataInChunks(fileRecord: any, fileBlob: any) {
    return new Promise<void>(async (resolve) => {
      const userContext: any = this.userContextService.getUserWebrtcContext(fileRecord[AppConstants.USERNAME]);
      const dataChannel: any = userContext[AppConstants.MEDIA_CONTEXT][AppConstants.FILE].dataChannel;
      const chunks: any[] = this.talkWindowUtilService.chunkString(fileBlob, AppConstants.CHUNK_SIZE);
      const totalChunks: number = chunks.length;

      //sending file start meta data
      this.talkWindowUtilService.sendMessageOnDataChannel(fileRecord[AppConstants.USERNAME],
        {
          id: fileRecord[AppConstants.CONTENT_ID],
          message: 'start',
          username: this.userContextService.username,
          type: AppConstants.FILE,
          contentType: fileRecord[AppConstants.CONTENT_TYPE],
          chunkType: AppConstants.CHUNK_TYPE.START,
          contentId: fileRecord[AppConstants.CONTENT_ID],
          fileName: fileRecord[AppConstants.FILE_NAME]
        }, AppConstants.FILE);

      /**
       * @TODO refactor this afterwards
       * update last data exchanged timestamp in user's webrtc context
       * 
       */
      userContext[AppConstants.MEDIA_CONTEXT][AppConstants.FILE][AppConstants.LAST_USED] = Date.now();

      //send file data chunks one by one
      for (let i = 0; i < totalChunks; i++) {
        while (dataChannel.bufferedAmount > AppConstants.DATACHANNEL_BUFFER_THRESHOLD) {
          await this.coreAppUtilService.delay(AppConstants.DATACHANNEL_FILE_SEND_TIMEOUT);
        }

        //sending file data
        this.talkWindowUtilService.sendMessageOnDataChannel(fileRecord[AppConstants.USERNAME],
          {
            message: chunks[i],
            username: this.userContextService.username,
            type: AppConstants.FILE,
            contentType: fileRecord[AppConstants.CONTENT_TYPE],
            chunkType: AppConstants.CHUNK_TYPE.INTERMEDIATE,
            contentId: fileRecord[AppConstants.CONTENT_ID],
            fileName: fileRecord[AppConstants.FILE_NAME]
          }, AppConstants.FILE);
      }

      //update last data exchanged timestamp in user's webrtc context
      userContext[AppConstants.MEDIA_CONTEXT][AppConstants.FILE][AppConstants.LAST_USED] = Date.now();

      while (dataChannel.bufferedAmount > AppConstants.DATACHANNEL_BUFFER_THRESHOLD) {
        await this.coreAppUtilService.delay(AppConstants.DATACHANNEL_FILE_SEND_TIMEOUT);
      }

      //sending end of file meta data
      this.talkWindowUtilService.sendMessageOnDataChannel(fileRecord[AppConstants.USERNAME],
        {
          id: fileRecord[AppConstants.CONTENT_ID],
          message: 'EOF',
          username: this.userContextService.username,
          type: AppConstants.FILE,
          contentType: fileRecord[AppConstants.CONTENT_TYPE],
          chunkType: AppConstants.CHUNK_TYPE.END,
          contentId: fileRecord[AppConstants.CONTENT_ID],
          fileName: fileRecord[AppConstants.FILE_NAME]
        }, AppConstants.FILE);

      //update last data exchanged timestamp in user's webrtc context
      userContext[AppConstants.MEDIA_CONTEXT][AppConstants.FILE][AppConstants.LAST_USED] = Date.now();
      resolve();
    });
  }

  /**
   * this will handle any media stream request acceptance
   * 
   * @param channel media type i.e 'audio', 'video' etc.
   *
   */
  async acceptCall(channel: string) {

    /**
     * stop the request caller tune
     */
    this.playOrStopTune('caller', false);

    /**
     * in case user hasn't selected anybody for chat yet then set chat window
     */
    this.setChatWindow(false);

    let userToChat: string;
    let responseType: string;
    if (channel === AppConstants.REMOTE_CONTROL) {
      userToChat = this.talkWindowContextService.remoteAccessContext[AppConstants.USERNAME];
      responseType = AppConstants.REMOTE_ACCESS_REQUEST;
    } else {
      userToChat = this.talkWindowContextService.mediaStreamRequestContext[AppConstants.USERNAME];
      responseType = AppConstants.CALL_REQUEST;
    }

    /**
     * in case media stream request received from user different than currently
     * selected one, then
     *
     * a. load chat history in chat window
     *
     * b. stop any ongoing media streaming as user now wants to call/share media
     * stream with some other user
     *
     */
    if (this.userContextService.userToChat !== userToChat) {

      // stop any ongoing media sharing
      const webrtcContext = this.userContextService.getUserWebrtcContext(this.userContextService.userToChat);
      if (webrtcContext && webrtcContext[AppConstants.MEDIA_CONTEXT]) {

        /**
         * @TODO abstract away this logic and add a filter argument for
         * connection types which souldn't be terminated/closed
         *
         */
        Object.keys(webrtcContext[AppConstants.MEDIA_CONTEXT]).forEach((connectionType) => {
          if (connectionType !== AppConstants.TEXT) {
            if (this.coreAppUtilService.isDataChannel(connectionType)) {
              this.webrtcService.cleanDataChannelContext(connectionType, webrtcContext[AppConstants.MEDIA_CONTEXT][connectionType]);
              if (connectionType === AppConstants.FILE) {
                delete webrtcContext[AppConstants.FILE_QUEUE];
              }
            } else if (this.coreAppUtilService.isMediaChannel(connectionType)) {

              // remove the track from peer connection
              if (webrtcContext[AppConstants.MEDIA_CONTEXT][connectionType][AppConstants.TRACK_SENDER]) {
                webrtcContext[AppConstants.CONNECTION].removeTrack(webrtcContext[AppConstants.MEDIA_CONTEXT][connectionType][AppConstants.TRACK_SENDER]);
              }
              //send disconnect notification
              this.webrtcService.processMediaStreamDisconnect(connectionType, this.userContextService.userToChat, true);
              this.webrtcService.cleanMediaStreamContext(connectionType, webrtcContext[AppConstants.MEDIA_CONTEXT][connectionType]);
            }
          }
          delete webrtcContext[AppConstants.MEDIA_CONTEXT][connectionType];
        });
      }
      await this.talkWindowUtilService.loadChatHistory(userToChat);
      if (this.userContextService.getUserWebrtcContext(userToChat)) {
        this.userContextService.getUserWebrtcContext(userToChat).unreadCount = 0;
      }
      this.talkWindowUtilService.appRef.tick();
      this.scrollMessages();
      this.userContextService.userToChat = userToChat;
    }

    /**
     * send media stream request's acceptance response to the other user
     */
    this.webrtcService.sendCallInviteResponse(channel, userToChat, true, responseType);

    /**
     * remove media stream request modal popup from screen
     */
    this.talkWindowUtilService.removePopupContext([
      AppConstants.POPUP_TYPE.INVITE + channel
    ]);

    /**
     * show connecting... modal popup on screen
     *
     */
    this.talkWindowUtilService.addPopupContext({
      type: AppConstants.POPUP_TYPE.CONNECTING + channel,
      modalText: 'connecting....',
      channel: channel
    });
  }

  /**
  * handler to decline/cancel media stream request
  *
  * @param action type of action i.e 'disconnect', 'close' or 'decline'
  * 
  * @param channel media type i.e 'audio', 'video' etc.
  */
  closeCall(action: string, channel: string) {

    let userToChat: string;
    let responseType: string;
    if (channel === AppConstants.REMOTE_CONTROL) {
      userToChat = this.talkWindowContextService.remoteAccessContext[AppConstants.USERNAME];
      responseType = AppConstants.REMOTE_ACCESS_REQUEST;
    } else {
      userToChat = this.talkWindowContextService.mediaStreamRequestContext[AppConstants.USERNAME];
      responseType = AppConstants.CALL_REQUEST;
    }

    /**
     * if the selected action is decline, then send the decline media response
     * to the other user
     *
     */
    if (action === AppConstants.DECLINE) {
      // Sending call request as decline to user
      this.webrtcService.sendCallInviteResponse(channel, userToChat, false, responseType);
    }

    /**
     * remove any active modal popup from UI                                                                                                                         [description]
     */
    this.talkWindowUtilService.removePopupContext([
      AppConstants.POPUP_TYPE.INVITE + channel,
      AppConstants.POPUP_TYPE.DECLINE + channel,
      AppConstants.POPUP_TYPE.CONNECT + channel
    ]);

    //stop the caller tune
    this.playOrStopTune('caller', false);

    /**
     * @TODO refactor it afterwards, optimize it afterwards
     */
    if (channel === AppConstants.REMOTE_CONTROL) {
      /**
       * clear the remote access request context
       */
      this.talkWindowContextService.remoteAccessContext[AppConstants.USERNAME] = undefined;
    } else {
      /**
       * clear the media stream request context
       */
      this.talkWindowContextService.mediaStreamRequestContext[AppConstants.USERNAME] = undefined;
      this.talkWindowContextService.mediaStreamRequestContext[AppConstants.CHANNEL] = undefined;
    }
  }

  /**
   * handle do not disturb click event
   */
  handleDnd() {
    this.talkWindowContextService.bindingFlags.isDndOn = !this.talkWindowContextService.bindingFlags.isDndOn;
    this.talkWindowUtilService.appRef.tick();
  }

  /**
   * back to contacts click handler
   *
   * this button is available only on mobile screen view
   */
  backToContacts() {
    const userToChat = this.userContextService.userToChat;
    const userContext = this.userContextService.getUserWebrtcContext(userToChat);

    /**
     * stop any ongoing media streaming as user now wants to call/share media
     * stream with some other user
     *
     *
     */
    if (userContext !== null) {

      /**
       * @TODO abstract away this logic and add a filter argument for
       * connection types which souldn't be terminated/closed
       */
      Object.keys(userContext[AppConstants.MEDIA_CONTEXT]).forEach((connectionType) => {
        if (connectionType !== AppConstants.TEXT && connectionType !== AppConstants.FILE) {
          this.webrtcService.cleanMediaStreamContext(connectionType, userToChat);
        }
      });
    }
    this.setChatWindow(true);
    this.userContextService.userToChat = undefined;
  }

  /**
   * handle user logout and redirect to login page
   */
  async logout() {
    try {
      this.showLoader = true;

      /**
       * send de-register message to server to notify that user has opted to
       * logout
       */
      this.signalingService.deRegisterOnSignalingServer(this.userContextService.getUserName());

      /**
       * stop any ongoing media streaming as user now wants to call/share media
       * stream with some other user
       *
       */
      const userToChat = this.userContextService.userToChat;
      const userContext = this.userContextService.getUserWebrtcContext(userToChat);
      if (userContext !== null) {

        /**
         * @TODO abstract away this logic and add a filter argument for
         * connection types which souldn't be terminated/closed
         */
        Object.keys(userContext[AppConstants.MEDIA_CONTEXT]).forEach((channel) => {
          if (channel !== AppConstants.TEXT) {
            this.webrtcService.cleanMediaStreamContext(channel, userToChat);
          }
        });
        // this.appUtilService.appRef.tick();
      }
      await this.webrtcService.cleanWebrtcContext();

      //reset all the maintained contexts
      this.talkWindowContextService.resetAppContext();
      this.showLoader = false;

      LoggerUtil.log('selected user while logging out: ' + this.userContextService.userToChat);
      this.router.navigateByUrl('login');
    } catch (error) {
      LoggerUtil.log('error encounterd while resetting webrtc context.');
      this.router.navigateByUrl('login');
    }
  }

  /**
   * this will set menu icons modal popup on UI
   *
   * @param  hideFlag flag to distinguish whether to hide/show the popup
   */
  setIconsPopup(hideFlag?: boolean) {
    this.talkWindowUtilService.setIconsPopup(hideFlag);
  }

  /**
   * on click handler of modal popup frame
   * @param  event
   *
   * @TODO recheck it afterwards
   */
  onFrameClick(event: any) {
    if (event.target.id === 'icons_modal') {
      this.setIconsPopup(true);
    }
  }

  /**
   * on click handler for microphone mute
   */
  handleMute() {
    /**
     * invert the microphone mute state in media call context and mute the
     * audio stream
     *
     */
    this.talkWindowContextService.bindingFlags.isOnMute = !this.talkWindowContextService.bindingFlags.isOnMute;
    const webrtcContext: any = this.userContextService.getUserWebrtcContext(this.userContextService.userToChat);

    /**
     * get user's local audio track and then enable/disable the track
     */
    const localAudioTrack: any = webrtcContext[AppConstants.MEDIA_CONTEXT][AppConstants.AUDIO][AppConstants.TRACK];
    localAudioTrack.enabled = !this.talkWindowContextService.bindingFlags.isOnMute;
    this.talkWindowUtilService.appRef.tick();
  }

  /**
   * this will handle processing for 'callRequest' type received messages.
   * Usually all the messages related to media stream request
   *
   * @param signalingMessage received signaling message
   */
  handleMediaStreamRequests(signalingMessage: any) {
    return new Promise<void>((resolve) => {

      /**
       * delegate core request processing to service method
       *
       */
      this.webrtcService.handleMediaStreamRequests(signalingMessage);

      /**
       * if the received message is the acceptance of any media stream request
       * sent & user still hasn't cancelled it's media stream request then,
       * start the media streaming by calling start media streaming method with
       * appropriate mediaType param
       * 
       */
      if (signalingMessage.request === AppConstants.ACCEPT &&
        this.talkWindowContextService.mediaStreamRequestContext[AppConstants.USERNAME]) {

        const mediaType: string = this.talkWindowContextService.mediaStreamRequestContext[AppConstants.CHANNEL];
        const requiredMediaTracks: string[] = [];
        requiredMediaTracks.push(mediaType);

        /**
         * if the received call acceptance was for video call then firstly by
         * default we'll start streaming microphone audio as well.
         *
         */
        if (mediaType === AppConstants.VIDEO && !this.talkWindowContextService.bindingFlags.isAudioCalling) {
          requiredMediaTracks.push(AppConstants.AUDIO);
        }

        /**
         * get the media type from media call context for which user has
         * previuosly sent the media stream request to the other user
         *
         * invoke the start the media streaming mechanism
         *
         */
        const startMediaStreamType: StartMediaStreamType = {
          channel: mediaType,
          requiredMediaTracks: requiredMediaTracks
        };
        this.startMediaStream(startMediaStreamType);
      }
      resolve();
    });
  }

  /**
   * handler to handle camera flip event
   *
   * camera flip feature is available on mobile view. event is triggered when
   * user switches default camera(like switching from rear camera to front)
   * while streaming video captured from camera
   *
   * @TODO refactor it afterwards and
   */
  async handleCameraFlip() {
    LoggerUtil.log('flipping the camera');

    // remove the menu icons modal popup after selecting camera flip
    this.setIconsPopup(true);

    /**
     * flip the default camera to capture video
     *
     */
    const currentCamera = this.userContextService.defaultCamera;
    const userToChat: string = this.userContextService.userToChat;
    this.userContextService.defaultCamera = currentCamera === 'user' ? 'environment' : 'user';
    const webrtcContext: any = this.userContextService.getUserWebrtcContext(userToChat);

    /**
     * as video stream from different camera has to be captured then we also
     * need to renegotiate the webrtc connection again and for that firstly
     * existing media stream track needs to be stopped
     *
     */
    webrtcContext[AppConstants.MEDIA_CONTEXT][AppConstants.VIDEO][AppConstants.TRACK].stop();
    webrtcContext[AppConstants.CONNECTION].removeTrack(webrtcContext[AppConstants.MEDIA_CONTEXT][AppConstants.VIDEO][AppConstants.TRACK_SENDER]);

    /**
     *
     * generate the appropriate 'offer' for sending it to the other user
     *
     * 'offerContainer' will contain the genrated offer sdp and few other
     * properties which app utilizes to compose an offer signaling message
     * to be sent to other user
     *
     */
    const offerContainer: any = await this.coreWebrtcService
      .generateOfferWithMediaTracks(webrtcContext[AppConstants.CONNECTION], AppConstants.VIDEO, [AppConstants.VIDEO]);

    /**
     * send the composed 'offer' signaling message to the other user
     *
     * @property 'renegotiate' will be set in the 'offer' signaling message in
     * order to notify receiver that, this offer message is meant for renegotiating
     * an existing webrtc connection
     *
     */
    this.webrtcService.sendPayload({
      type: offerContainer.offerPayload.type,
      offer: offerContainer.offerPayload.offer,
      channel: offerContainer.offerPayload.channel,
      from: this.userContextService.username,
      to: this.userContextService.userToChat,
      renegotiate: true
    });

    /**
     * set the local media stream track in user's webrtc context
     */
    webrtcContext[AppConstants.MEDIA_CONTEXT][AppConstants.VIDEO][AppConstants.TRACK] = offerContainer.mediaStreams[0][AppConstants.TRACK];
    webrtcContext[AppConstants.MEDIA_CONTEXT][AppConstants.VIDEO][AppConstants.TRACK_SENDER] = offerContainer.mediaStreams[0][AppConstants.TRACK_SENDER];

    /**
     * render the local media stream appropriate media tag on UI
     */
    this.onMediaStreamReceived(offerContainer.mediaStreams[0][AppConstants.STREAM], AppConstants.VIDEO, true);
  }

  /**
   * on click handler to handle make fullscreen event
   *
   * this feature is available only on desktop view
   *
   * @param makeFullScreenFlag flag to make remote video full screen
   */
  handleVideoFullScreen(makeFullScreenFlag: boolean) {
    this.talkWindowContextService.bindingFlags.isFullScreenMode = makeFullScreenFlag;
    this.setCentralIconsPopup(makeFullScreenFlag);
    this.resizeRemoteVideo(false);
    this.talkWindowUtilService.appRef.tick();
  }

  /**
   * this will open the media viewer in the chat window when a media is selcted
   * to be viewed. Appropriate view will be displayed on UI on the basis of
   * provided contentType
   *
   * @param  contentType contentType of the media that needs to be viewed
   *                     like 'audio', 'video' or 'image'
   *
   * @param  contentId   content identifier of the media data in sharedContent
   *                     in userContext
   *
   */
  openMediaViewer(contentType: string, contentId: number) {

    /**
     * set provided contentType and contentId in mediaViewerContext so that
     * content data can be loaded in appropriate HTML tags on UI
     *
     *
     */
    this.talkWindowContextService.mediaViewerContext[AppConstants.CONTENT_TYPE] = contentType;
    this.talkWindowContextService.mediaViewerContext[AppConstants.CONTENT_ID] = contentId;
    this.talkWindowUtilService.appRef.tick();
  }

  /**
   * this will close the media viewer on the chat window
   *
   * @param event HTML event
   */
  closeMediaViewer(event: any) {
    event.stopImmediatePropagation();
    LoggerUtil.log('close media viewer action triggered');
    if (event.target.id.includes(AppConstants.VIDEO)) {
      this.renderer.selectRootElement('#viewer_video', true).pause();
    } else {
      this.talkWindowContextService.mediaViewerContext[AppConstants.CONTENT_TYPE] = undefined;
      this.talkWindowContextService.mediaViewerContext[AppConstants.CONTENT_ID] = undefined;
    }
    this.talkWindowUtilService.appRef.tick();
  }

  /**
   * this will handle resizing of remote video window on UI
   *
   * @param minimizeFlag boolean flag to distinguish whether to minimize or
   * maximize the remote video
   *
   */
  resizeRemoteVideo(minimizeFlag: boolean) {
    this.talkWindowContextService.bindingFlags.minimizeVideo = minimizeFlag;
    if (minimizeFlag) {

      /**
       * set click listener function video div to enable maximizing remote video
       * on click
       *
       */
      this.remoteVideoDivUnlistenFn = this.renderer.listen(this.remoteVideoDiv.nativeElement,
        'click', () => {
          this.resizeRemoteVideo(false);
        });


    } else {
      if (this.remoteVideoDivUnlistenFn) {
        this.remoteVideoDivUnlistenFn();
      }
    }
    if (this.userContextService.isMobile && minimizeFlag) {
      this.setIconsPopup(true);
    }
    this.talkWindowUtilService.appRef.tick();
  }

  /**
   * this will handle any reconnection request received
   *
   * @param signalingMessage received signaling message
   */
  async handleReconnectionRequest(signalingMessage: any) {

    /**
     * reconnect only when reconnection is required with the currently selected
     * user else do nothing
     *
     */
    if (this.userContextService.userToChat === signalingMessage.from) {
      LoggerUtil.log('attempting ' + signalingMessage.channel + ' stream sender reconnection');
      const userWebrtcContext: any = this.userContextService.getUserWebrtcContext(this.userContextService.userToChat);

      /**
       * check value of reconnection flag available in userWebrtcContext
       */
      if (userWebrtcContext[AppConstants.RECONNECT]) {
        /**
         * setup a webrtc send peer connection from this side
         *
         * @TODO fix it afterwards
         */
        // this.createWebrtcSendPeerConnection(signalingMessage);
      }
    }
  }

  /**
   * this will handle any disconnection request received
   *
   * @param signalingMessage received signaling message
   */
  async handleDisconnectionRequest(signalingMessage: any) {
    const channel = signalingMessage.channel;
    const username = signalingMessage.from;

    // Handle video/audio stopping here
    const webrtcContext: any = this.userContextService.getUserWebrtcContext(username);

    /**
     * display appropriate modal popup message on UI
     *
     */
    const popupContext = this.messageService
      .buildPopupContext(AppConstants.POPUP_TYPE.DISCONNECT, channel, username);

    if (channel === AppConstants.REMOTE_CONTROL) {
      this.webrtcService.processMediaStreamDisconnect(channel, username, false, [popupContext]);
      await this.webrtcService.cleanDataChannelContext(AppConstants.REMOTE_CONTROL, webrtcContext[AppConstants.MEDIA_CONTEXT][AppConstants.REMOTE_CONTROL]);
      delete webrtcContext[AppConstants.MEDIA_CONTEXT][AppConstants.REMOTE_CONTROL];
    } else {

      /**
       * clear the media stream request context
       * 
       * @TODO refactor it afterwards 
       */
      this.talkWindowContextService.mediaStreamRequestContext[AppConstants.USERNAME] = undefined;
      this.talkWindowContextService.mediaStreamRequestContext[AppConstants.CHANNEL] = undefined;

      this.webrtcService.processMediaStreamDisconnect(channel, username, false, [popupContext]);
      // remove the track from peer connection
      if (webrtcContext[AppConstants.MEDIA_CONTEXT][channel][AppConstants.TRACK_SENDER]) {
        webrtcContext[AppConstants.CONNECTION].removeTrack(webrtcContext[AppConstants.MEDIA_CONTEXT][channel][AppConstants.TRACK_SENDER]);
      }
      await this.webrtcService.cleanMediaStreamContext(channel, webrtcContext[AppConstants.MEDIA_CONTEXT][channel]);
      //clean the the connections from user's webrtc context
      delete webrtcContext[AppConstants.MEDIA_CONTEXT][channel];
    }
  }

  /**
   * this will set icons modal popup click handlers
   *
   * @param setFlag boolean flag to distingush whether to set the handler or to
   * remove it
   * 
   */
  setCentralIconsPopup(setFlag: boolean) {
    if (setFlag) {

      /**
       * @TODO refactor it afterwards, see if this can be done in an easy way
       * 
       */
      const setCentralIconFunction = (event: any) => {
        if (event.target.id) {
          if (!event.target.id.includes('media') && !event.target.id.includes('viewer')
            && (!this.talkWindowContextService.bindingFlags.minimizeVideo
              || (event.target.id !== 'remote_video_div' && event.target.id !== 'remoteVideo'))) {
            this.setIconsPopup();
          }
        } else {
          this.setIconsPopup();
        }
      };

      this.remoteVideoUnlistenFn = this.renderer.listen(this.remoteVideo.nativeElement, 'click', setCentralIconFunction);
      this.messageHistoryUnlistenFn = this.renderer.listen(this.messageHistoryDiv.nativeElement, 'click', setCentralIconFunction);
    } else {

      /**
       * remove the click event listners from message history and remote video
       */
      this.remoteVideoUnlistenFn();
      this.messageHistoryUnlistenFn();
      this.setIconsPopup(true);
    }
  }

  /**
   * this will set the display of chat window on UI
   *
   * @param hideFlag boolean flag to distinguish whether to hide or show the
   * chat window
   *
   */
  setChatWindow(hideFlag: boolean) {
    this.talkWindowContextService.bindingFlags.showChatWindow = !hideFlag;
    if (this.userContextService.isMobile) {
      this.talkWindowContextService.bindingFlags.showSidepanel = hideFlag;
    }
    this.talkWindowUtilService.appRef.tick();
  }

  /**
   * this will update text message sent/received via data channel in the appropriate
   * user's message context and in the current chat window as well if message
   * sender is the currently selected user
   *
   * @param messagePayload json payload containing the message
   *
   * @return a promise containing the message read status i.e 'seen','received' etc
   */
  async updateChatMessages(messagePayload: any) {
    return new Promise<string>(async (resolve) => {

      /**
       * initialize the message status as 'NA' for a start and this will be
       * updated later on
       */
      let messageStatus: string = AppConstants.CHAT_MESSAGE_STATUS.NOT_APPLICABLE;
      if (!this.talkWindowContextService.hasMessageContext(messagePayload[AppConstants.USERNAME])) {
        this.talkWindowContextService.initializeMessageContext(messagePayload[AppConstants.USERNAME]);
      }

      /**
       * if the message is received then,
       * a. play the message received app sound
       * b. update the peviously initialized message status to 'DELIVERED'
       *
       */
      if (!messagePayload.sent) {
        this.playOrStopTune('message', true);
        messageStatus = AppConstants.CHAT_MESSAGE_STATUS.DELIVERED;
        messagePayload.status = AppConstants.CHAT_MESSAGE_STATUS.DELIVERED;
      }

      if (this.userContextService.userToChat === messagePayload[AppConstants.USERNAME]) {

        /**
         * if user is currently chatting with the user with whom this message 
         * has been exchanged then update previously initialized message status as seen
         *
         */
        if (!messagePayload.sent) {
          messageStatus = AppConstants.CHAT_MESSAGE_STATUS.SEEN;
          messagePayload.status = AppConstants.CHAT_MESSAGE_STATUS.DELIVERED;
        }
      } else {

        /**
         * if the user with whom this message has been exchanged is not visible
         * in viewport then update user's position to the top in the online
         * active users list
         *
         */
        const listElement: any = this.renderer.selectRootElement('#' + messagePayload[AppConstants.USERNAME] + '_contact', true);
        let isUserVisibleInViewport: any = await this.talkWindowUtilService.isElementInViewport(listElement);
        if (!isUserVisibleInViewport) {
          LoggerUtil.log('user ' + messagePayload.user + ' is not visible in viewport');
          this.coreAppUtilService.updateElemntPositionInArray(this.talkWindowContextService.activeUsers, messagePayload[AppConstants.USERNAME], 0);
        }

        //increment unread messages count
        this.userContextService.getUserWebrtcContext(messagePayload[AppConstants.USERNAME]).unreadCount++;
      }

      /**
       * store message in user's message context
       */
      this.talkWindowContextService.getMessageContext(messagePayload[AppConstants.USERNAME]).push(messagePayload);

      //refresh dom
      this.talkWindowUtilService.appRef.tick();
      this.scrollMessages();
      resolve(messageStatus);
    });
  }

  /**
   * this will scroll down chat message window
   *
   */
  scrollMessages() {
    const scrollHeight = this.renderer.selectRootElement('#message_history', true).scrollHeight;
    this.renderer.setProperty(this.messageHistoryBox.nativeElement, 'scrollTop', scrollHeight);
  }

  /**
   * this will set local/remote media streams in appropriate html media tags on UI
   *
   * @param mediaStream media stream that needed to be set
   *
   * @param streamType type of mediaStream received i.e 'audio', 'video', 'sound'
   *
   * @param isLocalMediaStream boolean flag to distinguish between local/remote
   * media stream
   *
   */
  onMediaStreamReceived(mediaStream: any, streamType: string, isLocalMediaStream: boolean) {
    let mediaElementRef: ElementRef;
    if (streamType === AppConstants.AUDIO) {
      mediaElementRef = this.remoteAudio;
    } else if (streamType === AppConstants.VIDEO || streamType === AppConstants.SCREEN) {
      if (isLocalMediaStream) {
        mediaElementRef = this.localVideo;
      } else {
        mediaElementRef = this.remoteVideo;
      }
    } else if (streamType === AppConstants.SOUND) {
      mediaElementRef = this.remoteSound;
    }
    try {
      this.renderer.setProperty(mediaElementRef.nativeElement, 'srcObject', mediaStream);
    } catch (error) {
      this.renderer.setProperty(mediaElementRef.nativeElement, 'src', URL.createObjectURL(mediaStream));
    }
    setTimeout(() => { this.talkWindowUtilService.appRef.tick(); }, 2000);
  }


  /**
   * this will play or stop tunes in app
   *
   * @param tuneIdentifier identifier for tune to be played or stopped
   *
   * @param playFlag flag to distinguish between play or stop
   *
   * @TODO refactor it afterwards, see if this can be done in an easy way
   */
  playOrStopTune(tuneIdentifier: string, playFlag: boolean) {
    const tagIdentifier: string = tuneIdentifier === 'caller' ? 'callerTune' : 'messageTune';
    if (playFlag) {
      this.renderer.selectRootElement('#' + tagIdentifier, true).play();
    } else {
      this.renderer.selectRootElement('#' + tagIdentifier, true).pause();
    }
  }

  /**
   * this will set the volume of remote audio tag
   *
   * @param volume volume level needed to be set
   * 
   */
  setRemoteAudioVolume(volume: Number) {
    this.renderer.setProperty(this.remoteAudio.nativeElement, 'volume', volume);
  }

  /**
   * this will download any received file
   * 
   * @param event html event object
   * 
   * @param contentId content id of received blob in sharedContent
   * 
   * @param fileName name of the received file
   */
  downloadFile(contentId: string, fileName: string, event: any) {
    event.stopImmediatePropagation();
    const downloadAnchor = this.renderer.createElement('a');
    this.renderer.setProperty(downloadAnchor, 'href', this.talkWindowContextService.sharedContent[contentId]);
    this.renderer.setProperty(downloadAnchor, 'download', fileName);
    downloadAnchor.click();
  }

  /**
   * this will download the all the chat transcripts in text format
   * 
   * @TODO refactor it afterwards to support multiple file formats
   * 
   */
  downloadChatTranscripts() {
    var text = 'Some data I want to export\nMy name is gaurav';
    var data = new Blob([text], { type: 'text/plain' });
    var url = window.URL.createObjectURL(data);
    const downloadAnchor = this.renderer.createElement('a');
    this.renderer.setProperty(downloadAnchor, 'href', url);
    this.renderer.setProperty(downloadAnchor, 'download', 'MyTextFile.Txt');
    downloadAnchor.click();
  }

  /**
   * this will handle remote access start/stop requests for a screen sharing session
   * 
   * @param action string param to distinguish whether to start/stop the remote access
   * possible values => 'start', 'stop'
   * 
   */
  handleRemoteAccess(action: string) {

    // remove the menu icons modal popup
    this.setIconsPopup(true);

    let popupContext: any;
    switch (action) {

      /**
       * start remote access
       */
      case 'start':
        LoggerUtil.log("request for remote access has been sent");

        /**
         * set remote access request context
         *
         * remote access request context will be used once app receive response for 
         * sent remote access request from other user 
         *
         */
        this.talkWindowContextService.remoteAccessContext[AppConstants.USERNAME] = this.userContextService.userToChat;

        /**
         * set informational modal popup message on UI 
         */
        popupContext = this.messageService
          .buildPopupContext(AppConstants.POPUP_TYPE.CONNECT, AppConstants.REMOTE_CONTROL, this.userContextService.userToChat);
        popupContext['disconnect'] = true;
        this.talkWindowUtilService.addPopupContext(popupContext);

        /**
         * send remote access request to the selected user
         * 
         */
        this.webrtcService.sendPayload({
          from: this.userContextService.getUserName(),
          to: this.userContextService.userToChat,
          type: AppConstants.REMOTE_ACCESS_REQUEST,
          request: AppConstants.INVITE,
          channel: AppConstants.REMOTE_CONTROL
        });
        break;

      /**
       * stop remote access
       */
      case 'stop':
        /**
         * display appropriate modal popup message on UI & disconnect the the remote 
         * access connection
         *
         */
        popupContext = this.messageService
          .buildPopupContext(AppConstants.POPUP_TYPE.DISCONNECTING, AppConstants.REMOTE_CONTROL);
        /**
         * 
         * 
         * @TODO fix it afterwards
         */
        // this.webrtcService.remoteAccessConnectionDisconnectHandler(false, AppConstants.REMOTE_CONTROL,
        //   this.userContextService.userToChat, true, popupContext);
        break;

      default:
      //do nothing here 
    }
  }

  /**
   * this will handle processing for 'remoteAccess' type received messages.
   * Usually all the messages related to remote access requests
   * 
   * @param signalingMessage received signaling message
   * 
   */
  handleRemoteAccessRequest(signalingMessage: any) {
    switch (signalingMessage.request) {

      /**
       * @value 'invite' means that user has received a remote access request so
       * appropriate response has to be send to sender
       * 
       */
      case AppConstants.INVITE:
        LoggerUtil.log('received remote access request from: ' + signalingMessage.from);

        /**
         * process this message only if user is in screen sharing seesion
         * 
         */
        if (this.talkWindowContextService.bindingFlags.isScreenSharing) {
          /**
           * if UI is currently displaying the icons popup then hide it, then set
           * the remote access request context with info from request message
           *
           * display appropriate modal popup message on UI
           *
           */
          this.talkWindowUtilService.setIconsPopup(true);
          this.talkWindowContextService.remoteAccessContext[AppConstants.USERNAME] = signalingMessage.from;
          this.talkWindowUtilService.addPopupContext({
            type: AppConstants.POPUP_TYPE.INVITE + signalingMessage.channel,
            modalText: signalingMessage.from + ' has requested remote access',
            channel: signalingMessage.channel,
            accept: true,
            decline: true
          });

          /**
           * play the caller tune
           *
           */
          this.playOrStopTune('caller', true);
        }
        break;

      /**
       * 
       * @value 'accept' means that remote access request has been accepted by
       * other user then do appropriate processing
       *
       * a. check if user himself/herself hasn't disconnected the remote access
       * request yet by checking if 'user' property is not undefined in remote access
       * request context if not then start establishing remote access connection else do nothing
       *
       */
      case AppConstants.ACCEPT:
        LoggerUtil.log('remote access request has been accepted by ' + signalingMessage.from);

        if (this.talkWindowContextService.remoteAccessContext[AppConstants.USERNAME]) {
          /**
           * 
           * get the username of the user to whom remote access request has been made
           *
           */
          const userToChat = this.talkWindowContextService.remoteAccessContext[AppConstants.USERNAME];

          /**
           * remove the 'connect' modal popup message from UI and dispaly connecting
           * popup message as media stream request has been accepted by user
           *
           */
          this.talkWindowUtilService.removePopupContext([
            AppConstants.POPUP_TYPE.CONNECT + signalingMessage.channel
          ]);
          this.talkWindowUtilService.addPopupContext({
            type: AppConstants.POPUP_TYPE.CONNECTING + signalingMessage.channel,
            modalText: 'connecting....',
            channel: signalingMessage.channel
          });

          //populate the remote os type
          this.talkWindowContextService.remoteAccessContext['remoteOS'] = signalingMessage.os;

          /**
           * remote machine's devicePixelRatio more than 1 means that remote machine is having 
           * zoom more than 100%, so calculate actual remote screen resolution
           * 
           */
          if (signalingMessage.devicePixelRatio > 1) {
            this.talkWindowContextService.remoteAccessContext['remoteHeight'] =
              this.talkWindowContextService.remoteAccessContext['remoteHeight'] * signalingMessage.devicePixelRatio;
            this.talkWindowContextService.remoteAccessContext['remoteWidth'] =
              this.talkWindowContextService.remoteAccessContext['remoteWidth'] * signalingMessage.devicePixelRatio;
          }

          /**
           * @TODO start establishing remote access connection here 
           * 
           */
          this.setUpRemoteAccessConnection();
        }
        break;

      /**
       * @value 'decline' means that, the sent remote access request has been
       * declined so if user himself/herself has already disconnected the
       * request then do nothing else display appropriate modal popup message
       * on UI
       *
       */
      case AppConstants.DECLINE:
        LoggerUtil.log('remote access request has been declined by ' + signalingMessage.from);
        if (this.talkWindowContextService.remoteAccessContext[AppConstants.USERNAME]) {
          this.talkWindowUtilService.removePopupContext([
            AppConstants.POPUP_TYPE.CONNECT + signalingMessage.channel
          ]);
          this.talkWindowUtilService.addPopupContext({
            type: AppConstants.POPUP_TYPE.DECLINE + signalingMessage.channel,
            modalText: 'remote access request has been declined by ' + signalingMessage.from,
            channel: signalingMessage.channel,
            close: true
          });
        }
        break;

      default:
      //don't do anything here 
    }
  }

  /**
   * this will setup a webRTC connection for relaying mouse and keyboard events 
   * over data channel to other peer whose screen user is currently viewing 
   * 
   */
  async setUpRemoteAccessConnection() {

    /**
     * get username of the user with whom remote access connection needs to be established
     *  
     */
    const userToChat: string = this.talkWindowContextService.remoteAccessContext[AppConstants.USERNAME];

    const createDataChannelType: CreateDataChannelType = {
      username: userToChat,
      channel: AppConstants.REMOTE_CONTROL
    }

    //set up new data channel
    this.webrtcService.setUpDataChannel(createDataChannelType);
  }

  /**
   * 
   * this will handle webrtc events 
   * 
   * @param signalingMessage received signaling message 
   */
  handleWebrtcEvent(signalingMessage: any) {
    LoggerUtil.log('handling webrtc event: ' + signalingMessage.event);
    const webrtcContext = this.userContextService.getUserWebrtcContext(signalingMessage.from);

    switch (signalingMessage.event) {

      /**
       * 
       * webrtc data channel open event received from remote user's end
       */
      case AppConstants.WEBRTC_EVENTS.CHANNEL_OPEN:
        LoggerUtil.log(signalingMessage.channel + ' data channel has been opened');
        webrtcContext[AppConstants.MEDIA_CONTEXT][signalingMessage.channel][AppConstants.CONNECTION_STATE] = AppConstants.CONNECTION_STATES.CONNECTED;
        switch (signalingMessage.channel) {

          case AppConstants.TEXT:
            this.webrtcService.sendQueuedMessagesOnChannel(signalingMessage.from);
            break;

          case AppConstants.FILE:
            this.talkWindowUtilService.readFile(this.fileReader, webrtcContext[AppConstants.FILE_QUEUE].front());
            break;

          case AppConstants.REMOTE_CONTROL:

            /**
             * set remote access flag
             */
            this.talkWindowContextService.bindingFlags.isAccessingRemote = true;

            //register event listners for remote access
            this.webRemoteAccessService.registerRemoteAccessEventListeners(this.remoteVideoCanvas);

            /**
             * Remote machine can be accessed only in full screen mode as of now,
             * this will probably be changed afterwards
             * 
             * @TODO see if this can be changed by calculating the relative coordinates
             * on canvas
             * 
             */
            this.handleVideoFullScreen(true);

            /**
             * calculate the remote access params
             */
            this.webRemoteAccessService.calculateRemoteAccessParameters(
              this.talkWindowContextService.remoteAccessContext['remoteWidth'],
              this.talkWindowContextService.remoteAccessContext['remoteHeight'],
              this.remoteVideoDiv.nativeElement.clientWidth,
              this.remoteVideoDiv.nativeElement.clientHeight,
              this.remoteVideo, this.remoteVideoCanvas);
        }
        break;

      case AppConstants.WEBRTC_EVENTS.REMOTE_TRACK_RECEIVED:
        this.talkWindowUtilService.removePopupContext([AppConstants.POPUP_TYPE.CONNECTING + signalingMessage.channel]);
        break;
      default:
      //do nothing here
    }
  }
}
