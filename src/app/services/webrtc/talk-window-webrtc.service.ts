import { Injectable } from '@angular/core';
import { LoggerUtil } from '../logging/LoggerUtil';
import { AppConstants } from '../AppConstants';
import { UserContextService } from '../context/user.context.service';
import { TalkWindowUtilityService } from '../util/talk-window-utility.service';
import { SignalingService } from '../signaling/signaling.service';
import { NativeRemoteAccessService } from '../../native-app-services/native-remote-access.service';
import { CoreWebrtcService } from './core-webrtc.service';
import { CoreAppUtilityService } from '../util/core-app-utility.service';
import { TalkWindowContextService } from '../context/talk-window-context.service';
import { MessageService } from '../message/message.service';
import { CreateDataChannelType } from '../contracts/CreateDataChannelType';
import { CallbackContextType } from '../contracts/WebrtcCallbackContextType';

/**
 * this service contains all the webrtc related reusable logic chunks which app
 * utilises in order to process various types of user requests from UI
 *
 *
 */
@Injectable({
  providedIn: 'root'
})
export class TalkWindowWebrtcService {

  /**
   * this is talk window component's on router message function
   */
  talkWindowOnRouterMessageFn: any;

  /**
   * this is talk window component's update chat messages function
   */
  talkWindowUpdateChatMessagesFn: any;

  /**
   * this is talk window component's on media stream received function
   */
  talkWindowOnMediaStreamReceivedFn: any;

  /**
   * this is talk window component's set remote volume function
   */
  talkWindowSetRemoteVolumeFn: any;

  /**
   * this is talk window component's play or stop tune function
   */
  talkWindowPlayOrStopTuneFn: any;

  /**
   * this is talk window component's set central icons popup function
   */
  talkWindowSetCentralIconsPopupFn: any;

  constructor(
    private userContextService: UserContextService,
    private talkWindowContextService: TalkWindowContextService,
    private appUtilService: TalkWindowUtilityService,
    private signalingService: SignalingService,
    private remoteAccessService: NativeRemoteAccessService,
    private coreAppUtilService: CoreAppUtilityService,
    private coreWebrtcService: CoreWebrtcService,
    private messageService: MessageService
  ) { }

  /**
   * this will setup a recurring job to check if a data connection is being idle for specified 
   * amount of time, if it is found to be idle then close the connection else do nothing
   * 
   * @param channel webrtc cnonection's media type for connection means the type
   * of media data that we will relay on this connection e.g 'text','video' or 'audio'
   *
   * @param username username of the user with whom connection has to be established
   * 
   */
  setupJobToCleanIdleDataConnection(channel: string, username: string) {
    const userWebrtcContext: any = this.userContextService.getUserWebrtcContext(username);
    const recurringJobId: any = setInterval(() => {
      LoggerUtil.log('running recurring job to clean up idle ' + channel + ' connection for user: ' + username);
      const dataChannel: any = this.coreAppUtilService
        .getNestedValue(userWebrtcContext, AppConstants.MEDIA_CONTEXT, channel, AppConstants.DATACHANNEL);

      if (dataChannel && this.coreAppUtilService.isDataChannelConnected(userWebrtcContext, channel)
        && dataChannel.bufferedAmount === 0) {
        const lastUsedTime: any = userWebrtcContext[AppConstants.MEDIA_CONTEXT][channel][AppConstants.LAST_USED];

        const idleTime: any = Date.now() - lastUsedTime;
        LoggerUtil.log(channel + ' connection with user ' + username + ' has been idle for: ' + idleTime + 'ms');
        /**
         * if data channel is being idle after some time then clean up the webrtc connection 
         * and close the data channel 
         * 
         */
        if (idleTime > AppConstants.DATACHANNEL_IDLE_THRESHOLD) {
          LoggerUtil.log(channel + ' data channel with user ' + username + ' was idle so cleaning it up');
          this.cleanWebrtcDataConnection(channel, userWebrtcContext[AppConstants.MEDIA_CONTEXT][channel], username);
        }
      } else {
        const recurringJobId: any = this.coreAppUtilService
          .getNestedValue(userWebrtcContext, AppConstants.MEDIA_CONTEXT, channel, AppConstants.RECURRING_JOB_ID);
        if (recurringJobId) {
          LoggerUtil.log('removed recurring job for ' + channel + ' connection with user ' + username);
          //clear the interval job
          clearInterval(recurringJobId);
        }
      }

    }, AppConstants.IDLE_CONN_CLEAN_UP_JOB_TIME);

    LoggerUtil.log('a recurring job has been setup to clean up idle ' + channel + ' connection for user ' + username);

    /**
     * set recurring job id in user's webrtc context so that it can be later
     * utilized by clearInterval(....) to clear the job
     */
    userWebrtcContext[AppConstants.MEDIA_CONTEXT][channel][AppConstants.RECURRING_JOB_ID] = recurringJobId;
  }

  /**
   * this will register all the necessary webrtc and data channel event listeners
   * on a peer connection for a particular channel.
   *
   *
   * @param peerConnection webrtc connection on which the handler is to be registered
   *
   * @param userToChat username of the user with whom connection has to be established
   *
   */
  registerWebrtcEventListeners(peerConnection: any, userToChat: any) {
    return new Promise<void>((resolve, reject) => {
      LoggerUtil.log('registering webrtc events on webrtc connection for ' + userToChat);
      LoggerUtil.log(this.userContextService.getUserWebrtcContext(userToChat));
      try {


        /**
         * 
         * process onnegotiationneeded event here
         */
        peerConnection.onnegotiationneeded = async (event) => {
          LoggerUtil.log(userToChat + ' webrtc connection needs renegotiation');
        };

        /**
         * 
         * process onsignalingstatechange event here
         * 
         */
        peerConnection.onsignalingstatechange = () => {
          LoggerUtil.log(userToChat + ' webrtc connection signaling state: ' + peerConnection.signalingState);
          const webrtcContext = this.userContextService.getUserWebrtcContext(userToChat);
          switch (peerConnection.signalingState) {

            /**
             * 
             * There is no ongoing exchange of offer and answer underway. This may mean that the RTCPeerConnection 
             * object is new, in which case both the localDescription and remoteDescription are null; it may also mean 
             * that negotiation is complete and a connection has been established.
             * 
             */
            case 'stable':
              /**
               * 
               * make the connection status as 'connected' in the user's webrtc context
               * 
               */
              webrtcContext[AppConstants.CONNECTION_STATE] = AppConstants.CONNECTION_STATES.CONNECTED;

              /**
               * 
               * execute all the callback functions wih provided callback context
               * 
               */
              while (!webrtcContext[AppConstants.WEBRTC_ON_CONNECT_QUEUE].isEmpty()) {
                const callback: CallbackContextType = <CallbackContextType>webrtcContext[AppConstants.WEBRTC_ON_CONNECT_QUEUE].dequeue();
                try {
                  callback.callbackFunction(callback.callbackContext);
                } catch (e) {
                  LoggerUtil.log(e);
                }
              }
              break;
          }
        };

        /**
         * 
         * process connection state change event here
         */
        peerConnection.onconnectionstatechange = async () => {
          LoggerUtil.log(userToChat + ' webrtc connection state change: ' + peerConnection.connectionState);

          const webrtcContext = this.userContextService.getUserWebrtcContext(userToChat);

          switch (peerConnection.connectionState) {
            case 'disconnected':

              /**
               * 
               * make the connection status as 'connected' in the user's webrtc context
               * 
               */
              webrtcContext[AppConstants.CONNECTION_STATE] = AppConstants.CONNECTION_STATES.NOT_CONNECTED;
              break;

            case 'connected':
              /**
               * 
               * make the connection status as 'connected' in the user's webrtc context
               * 
               */
              webrtcContext[AppConstants.CONNECTION_STATE] = AppConstants.CONNECTION_STATES.CONNECTED;

              /**
               * 
               * execute all the callback functions wih provided callback context
               * 
               */
              while (!webrtcContext[AppConstants.WEBRTC_ON_CONNECT_QUEUE].isEmpty()) {
                const callback: CallbackContextType = <CallbackContextType>webrtcContext[AppConstants.WEBRTC_ON_CONNECT_QUEUE].dequeue();
                try {
                  callback.callbackFunction(callback.callbackContext);
                } catch (e) {
                  LoggerUtil.log(e);
                }
              }
          }
        }

        /**
         * handle ice candidate event
         *
         * compose the 'candidate' type signaling message using the generated
         * candidate and send it to the other user
         *
         * @property isSender will notify receiver of this message that, message
         * is sent by a sender webrtc connection and is meant for recieve webrtc
         * connection
         *
         */
        peerConnection.onicecandidate = (event: any) => {
          if (event.candidate) {
            const iceCandidatePayload = {
              type: AppConstants.CANDIDATE,
              candidate: event.candidate,
              from: this.userContextService.username,
              to: userToChat
            };
            this.sendPayload(iceCandidatePayload);
          }
        }

        /**
         * 
         * register data channel related events
         */
        this.registerDataChannelEvents(peerConnection, userToChat);

        /**
         * register ontrack listner for 'audio','video' and 'screen' on reciver
         * peer connection
         *
         */
        peerConnection.ontrack = async (event: any) => {
          let channel: string;
          const kind: string = event.track.kind;

          /**
           * 
           * derive the channel here
           */
          if (kind === AppConstants.AUDIO) {
            switch (this.talkWindowContextService.mediaStreamRequestContext[AppConstants.CHANNEL]) {
              case AppConstants.VIDEO:
                channel = AppConstants.AUDIO;
                break;
              case AppConstants.AUDIO:
                channel = AppConstants.AUDIO;
                break;
              case AppConstants.SOUND:
                channel = AppConstants.SOUND;
                break;
            }
          } else {
            //kind === AppConstants.VIDEO
            switch (this.talkWindowContextService.mediaStreamRequestContext[AppConstants.CHANNEL]) {
              case AppConstants.VIDEO:
                channel = AppConstants.VIDEO;
                break;
              case AppConstants.SCREEN:
                channel = AppConstants.SCREEN;
                break;
            }
          }
          LoggerUtil.log(channel + ' stream track received');

          switch (channel) {
            case AppConstants.AUDIO:
              /**
               * reduce audio volume to 0 initially and then increase it after
               * a timeout as there is received audio sometimes makes a noisy
               * start
               *
               */
              this.talkWindowSetRemoteVolumeFn(0.0);
              setTimeout(() => { this.talkWindowSetRemoteVolumeFn(1.0); }, 2000);

              /**
               * update 'haveRemoteAudioStream' media call context flag to
               * keep track that a remote audio stream has been received
               *
               */
              this.talkWindowContextService.updateBindingFlag('haveRemoteAudioStream', true, channel);
              break;

            case AppConstants.VIDEO:

              /**
               * update 'haveRemoteVideoStream' media call context flag to
               * keep track that a remote video stream has been received
               *
               */
              this.talkWindowContextService.updateBindingFlag('haveRemoteVideoStream', true, channel);
              break;

            case AppConstants.SCREEN:

              /**
               * update 'haveRemoteVideoStream' media call context flag to
               * keep track that a remote video stream has been received
               *
               */
              this.talkWindowContextService.updateBindingFlag('haveRemoteVideoStream', true, channel);
          }
          /**
           * attach remote media stream in appropriate media tag on UI
           *
           */
          this.talkWindowOnMediaStreamReceivedFn(new MediaStream([event.track]), channel, false);

          /**
           * 
           * send remote track received event message to other peer 
           */
          this.sendPayload({
            type: AppConstants.WEBRTC_EVENT,
            channel: channel,
            event: AppConstants.WEBRTC_EVENTS.REMOTE_TRACK_RECEIVED,
            from: this.userContextService.username,
            to: userToChat
          });
        }
        resolve();
      } catch (error) {
        LoggerUtil.log('there is an error while registering events on peer connection');
        reject(error);
      }
    });
  }

  /**
   * this will add event listeners on a data peer connection
   *
   * @param peerConnection webrtc peer connection on which the data channel
   * handler has to be registered
   *
   * @param isSenderConnection boolean flag to distinguish between sender and
   * receive audio video peer connections
   *
   * @param userToChat username of the user with whom connection has to be established
   *
   */
  registerDataChannelEvents(peerConnection: any, userToChat: any) {
    peerConnection.ondatachannel = (event: any) => {

      /**
       * when a remote data channel is received then set it in user's webrtc context
       *
       */
      const dataChannel = event.channel;
      const channel: string = dataChannel.label;
      this.coreWebrtcService.mediaContextInit(channel, userToChat);
      LoggerUtil.log(channel + ' data channel has been received');
      const webrtcContext: any = this.userContextService.getUserWebrtcContext(userToChat);

      webrtcContext[AppConstants.MEDIA_CONTEXT][channel][AppConstants.DATACHANNEL] = dataChannel;

      /**
       * register onmessage listener on received data channel
       *
       */
      dataChannel.onmessage = (msgEvent: any) => {
        this.onDataChannelMessage(msgEvent.data);
      }

      LoggerUtil.log('message listener registered on received ' + channel + ' data channel');

      /**
       * if this data channel is meant for sending text messages then register
       * an onopen listner also which will send any queued text messages
       *
       */
      dataChannel.onopen = () => {
        LoggerUtil.log(channel + ' data channel has been opened');

        /**
         * 
         * send onopen data channel event message to other peer 
         */
        const dataChannelOnOpenPayload = {
          type: AppConstants.WEBRTC_EVENT,
          channel: channel,
          event: AppConstants.WEBRTC_EVENTS.CHANNEL_OPEN,
          from: this.userContextService.username,
          to: userToChat
        };
        this.sendPayload(dataChannelOnOpenPayload);

        webrtcContext[AppConstants.MEDIA_CONTEXT][channel][AppConstants.CONNECTION_STATE] = AppConstants.CONNECTION_STATES.CONNECTED;

        /**
         * set shared remote control flag to true
         */
        if (channel === AppConstants.REMOTE_CONTROL) {
          this.talkWindowContextService.bindingFlags.haveSharedRemoteAccess = true;
        }
        if (channel === AppConstants.TEXT) {
          this.sendQueuedMessagesOnChannel(userToChat);
        }
      }
    }
  }

  /**
   * this will handle processing for 'callRequest' type received messages they
   * are exchanged usually for media stream requests
   *
   * @param signalingMessage received signaling message
   *
   */
  handleMediaStreamRequests(signalingMessage: any) {
    switch (signalingMessage.request) {
      case AppConstants.INVITE:

        /**
         * 
         * @value 'invite' means that user has received a media stream request so
         * appropriate response has to be send to sender
         *
         * a. if user has selected 'do not option' then send the decline response
         *
         * b. if app is currenly cleaning media call context due to some prior
         * media stream request then send decline response
         *                                                                                                                                                                                                [description]
         */
        if (this.talkWindowContextService.bindingFlags.isDndOn || this.talkWindowContextService.popupContext.size !== 0) {
          this.sendCallInviteResponse(signalingMessage.channel, signalingMessage.from, false, AppConstants.CALL_REQUEST);
        } else {

          this.talkWindowContextService.mediaStreamRequestContext[AppConstants.USERNAME] = signalingMessage.from;
          this.talkWindowContextService.mediaStreamRequestContext[AppConstants.CHANNEL] = signalingMessage.channel;

          /**
           * populate this to know whether other peer can share remote access or not 
           */
          this.talkWindowContextService.remoteAccessContext['canAccessRemote'] = signalingMessage.isNativeApp;


          /**
           * if UI is currently displaying the icons popup then hide it, then set
           * the media call context with info from request message
           *
           * display appropriate modal popup message on UI
           *
           */
          this.appUtilService.setIconsPopup(true);
          this.appUtilService.addPopupContext({
            type: AppConstants.POPUP_TYPE.INVITE + signalingMessage.channel,
            modalText: signalingMessage.from + ' calling...',
            channel: signalingMessage.channel,
            accept: true,
            decline: true
          });

          /**
           * play the caller tune
           *
           */
          this.talkWindowPlayOrStopTuneFn('caller', true);
        }
        break;

      case AppConstants.ACCEPT:

        /**
         * 
         * @value 'accept' means that media stream request has been accepted by
         * other user then do appropriate processing
         *
         * a. check if caller himself/herself hasn't disconnected the media stream
         * request yet by checking if 'user' property is not undefined in media
         * stream request context if not then do the call accept processing else do nothing
         *
         */
        if (this.talkWindowContextService.mediaStreamRequestContext[AppConstants.USERNAME]) {

          /**
           *
           *
           * b. get the media stream request type from media call context
           *
           */
          const channel = this.talkWindowContextService.mediaStreamRequestContext[AppConstants.CHANNEL];

          /**
           * remove the connect modal popup message from UI and dispaly connecting
           * popup message as media stream request has been accepted by user
           *
           */
          this.appUtilService.removePopupContext([
            AppConstants.POPUP_TYPE.CONNECT + channel
          ]);
          this.appUtilService.addPopupContext({
            type: AppConstants.POPUP_TYPE.CONNECTING + channel,
            modalText: 'connecting....',
            channel: channel
          });
        }
        break;

      case AppConstants.DECLINE:

        /**
         * @value 'decline' means that, the sent media stream request has been
         * declined so if user himself/herself has already disconnected the
         * request then do nothing else dislay appropriate modal popup message
         * on UI
         *
         */
        if (this.talkWindowContextService.mediaStreamRequestContext[AppConstants.USERNAME]) {
          const channel = this.talkWindowContextService.mediaStreamRequestContext[AppConstants.CHANNEL];
          this.appUtilService.removePopupContext([
            AppConstants.POPUP_TYPE.CONNECT + channel
          ]);
          this.appUtilService.addPopupContext({
            type: AppConstants.POPUP_TYPE.DECLINE + channel,
            modalText: 'call declined',
            channel: channel,
            close: true
          });
        }
        break;

      default:// do nothing here
    }
  }

  /**
   * this will clean whole webrtc context i.e
   *
   * a. clean all the connections with all the users
   * b. clean all chat history maintained so far
   * c. clean any other context maintained by app for current logged in session
   *
   */
  cleanWebrtcContext() {
    return new Promise<void>((resolve, reject) => {
      try {
        const webrtcContext = this.userContextService.webrtcContext;
        const userToChat = this.userContextService.userToChat;
        const userContext = webrtcContext[userToChat];

        /**
         * stop any ongoing media streaming
         * 
         * @TODO see if this logic can be removed
         *
         */
        if (userContext) {

          /**
           * @TODO abstract away this logic and add a filter argument for
           * connection types which souldn't be terminated/closed
           */
          Object.keys(userContext[AppConstants.MEDIA_CONTEXT]).forEach((channel) => {
            if (channel !== AppConstants.TEXT) {
              this.stopMediaStream(channel, userToChat, true);
            }
          });
        }

        /**
         * iterate through webrtc context
         */
        Object.keys(webrtcContext).forEach(async (user: string) => {
          const userContext = webrtcContext[user];

          /**
           * iterate through each user's all connections for all channels and
           * then call the appropriate peer connections cleanup routine to close
           * all the connections
           *
           */
          Object.keys(userContext[AppConstants.MEDIA_CONTEXT]).forEach((channel: string) => {
            const mediaContext = userContext[AppConstants.MEDIA_CONTEXT][channel];
            if (channel === AppConstants.TEXT || channel === AppConstants.FILE) {
              this.cleanWebrtcDataConnection(channel, mediaContext, user);
            } else {
              this.coreWebrtcService.cleanWebrtcMediaConnection(channel, mediaContext, true);
              this.coreWebrtcService.cleanWebrtcMediaConnection(channel, mediaContext, false);
            }
            delete userContext[AppConstants.MEDIA_CONTEXT][channel];
          });
          delete this.userContextService.webrtcContext[user];
        });

        /**
         * @TODO remove all timeout jobs as well
         * 
         */
        resolve();
      } catch (error) {
        LoggerUtil.log(error);
        reject(error);
      }
    });
  }

  /**
   * this will send all the queued messages to a user over via an data channel
   * for that user
   *
   * @param username username of the user whose queued messages has to be sent
   */
  sendQueuedMessagesOnChannel(username: string) {
    const webrtcContext = this.userContextService.getUserWebrtcContext(username);
    const dataChannel = webrtcContext[AppConstants.MEDIA_CONTEXT][AppConstants.TEXT][AppConstants.DATACHANNEL];

    /**
     * iterate message queue and send all the messages via data channel
     */
    while (webrtcContext[AppConstants.MESSAGE_QUEUE] && !webrtcContext[AppConstants.MESSAGE_QUEUE].isEmpty()) {
      dataChannel.send(JSON.stringify(webrtcContext[AppConstants.MESSAGE_QUEUE].dequeue()));
    }
  }

  /**
   * this will stop any ongoing media streaming
   *
   * @param channel type of media i.e audio, video, screen or sound
   * 
   * @param username currently selected user with whom you're streaming media
   * 
   * @param sendDisonnectNotification flag to specify whether to send disconnect notification 
   * to other user
   * 
   * @param popupContext informational modal popup context that needs to be shown
   */
  stopMediaStream(channel: string, username: string, sendDisonnectNotification: boolean, popupContext?: any) {
    try {

      /**
       * send appropriate disconnect message to other peer
       */
      this.processChannelDisconnect(channel, username, sendDisonnectNotification, popupContext);

      /**
       * call the media stream disconnect handler with appropriate media type
       * which will properly stop the media streaming and clean the webrtc
       * connections
       *
       * clean the webrtc peer connections from user's webrtc context
       */
      const userContext = this.userContextService.getUserWebrtcContext(username);
      userContext[AppConstants.RECONNECT] = false;
      this.mediaConnectionDisconnectHandler(false, channel, username, true, userContext);
      this.mediaConnectionDisconnectHandler(false, channel, username, false, userContext);
      delete userContext[AppConstants.MEDIA_CONTEXT][channel];
    } catch (e) {
      LoggerUtil.log('unable to stop ' + channel + ' stream for user ' + username);
    }
  }

  /***
   * this will send appropriate disconnect message to other peer and display 
   * provided popup on UI 
   * 
   * @param channel type of media i.e audio, video, screen or sound
   * 
   * @param username currently selected user with whom you're streaming media
   * 
   * @param sendDisonnectNotification flag to specify whether to send disconnect notification 
   * to other user
   * 
   * @param popupContext informational modal popup context that needs to be shown
   */
  processChannelDisconnect(channel: string, username: string, sendDisonnectNotification: boolean, popupContext?: any) {
    LoggerUtil.log('stopping ' + channel + ' stream session with ' + username);

    /**
     * send appropriate media stream disconnect message to other peer
     */
    if (sendDisonnectNotification) {
      this.sendPayload({
        type: AppConstants.DISCONNECT,
        channel: channel,
        from: this.userContextService.getUserName(),
        to: username
      });
    }

    /**
     * show informational modal popup message
     */
    if (popupContext) {
      this.appUtilService.addPopupContext(popupContext);

      /**
       * @TODO see if this can be refactored
       */
      if (channel === AppConstants.REMOTE_CONTROL) {
        //reset the remote access context
        this.talkWindowContextService.resetRemoteAccessContext();
        setTimeout(() => {
          this.appUtilService.removePopupContext([
            AppConstants.POPUP_TYPE.DISCONNECT + channel,
            AppConstants.POPUP_TYPE.DISCONNECTING + channel
          ]);
        }, AppConstants.CALL_DISCONNECT_POPUP_TIMEOUT);
      }
    }
  }

  /**
   * this will handle any media webrtc peer connection's(connections that were
   * meant to carry media data like 'audio' or 'video' streams) disconnect state event
   *
   * @param autoDisconnected this will be set when connection is auto disconnected
   * and not disconnected deliberetely though some user action
   *
   * @param channel webrtc connection's media type for connection means the
   * type of media data that we will relay on this connection e.g 'text','video'
   * or 'audio'
   *
   * @param username username of the user with whom this connection was connected
   *
   * @param isSenderConnection boolean flag to distinguish between sender and
   * receive audio/video peer connections
   *
   * @param userContext user's webrtc context
   *
   * @param popupContext an optional popup context if any modal popup message
   * has to be displayed after handling the disconnection
   *
   * @return a promise
   */
  mediaConnectionDisconnectHandler(autoDisconnected: boolean, channel: string,
    username: string, isSenderConnection: boolean, userContext: any, popupContext?: any) {
    return new Promise<void>((resolve) => {

      const connectionType: string = this.coreAppUtilService.getConnectionIdentifier(channel, isSenderConnection);
      const mediaContext: any = this.coreAppUtilService.getNestedValue(userContext, AppConstants.MEDIA_CONTEXT, channel);

      /**
       * if connection is deliberetely closed through some user action then remove
       * the disconnect listener from peer connection
       *
       */
      if (!autoDisconnected) {

        // get peer connection
        const peerConnection: any = this.coreAppUtilService.getNestedValue(mediaContext, connectionType);
        if (peerConnection) {
          peerConnection.onconnectionstatechange = null;
        }
      }

      /**
       * if popup context has been supplied then add it in popup context and register
       * a timeout job to remove the modal popup from UI after the specified time
       *
       */
      if (popupContext !== undefined) {

        this.appUtilService.addPopupContext(popupContext);
        setTimeout(() => {

          //stop the caller tune
          this.talkWindowPlayOrStopTuneFn('caller', false);

          /**
           * clear the media stream request context
           */
          this.talkWindowContextService.mediaStreamRequestContext[AppConstants.USERNAME] = undefined;
          this.talkWindowContextService.mediaStreamRequestContext[AppConstants.CHANNEL] = undefined;

          this.appUtilService.removePopupContext([
            AppConstants.POPUP_TYPE.UNABLE_TO_CONNECT + channel,
            AppConstants.POPUP_TYPE.DISCONNECT + channel
          ]);
        }, AppConstants.CALL_DISCONNECT_POPUP_TIMEOUT);
      }

      /**
       * call appropriate webrtc connections cleanup routine                                                                                              [description]
       */
      if (mediaContext) {
        this.coreWebrtcService.cleanWebrtcMediaConnection(channel, mediaContext, isSenderConnection);

        /**
         * clean the webrtc peer connections from webrtc context
         *
         */
        delete mediaContext[connectionType];
      }

      /**
       * configure appropriate flags in media call context
       */
      switch (channel) {
        case AppConstants.SCREEN:
          if (isSenderConnection) {
            this.talkWindowContextService.updateBindingFlag('haveLocalVideoStream', false, channel);
          } else {
            this.talkWindowContextService.updateBindingFlag('haveRemoteVideoStream', false, channel);
          }
          this.talkWindowContextService.updateBindingFlag('isScreenSharing', false, channel);
          break;

        case AppConstants.SOUND:
          this.talkWindowContextService.updateBindingFlag('isSoundSharing', false, channel);
          break;

        case AppConstants.AUDIO:
          if (isSenderConnection) {
            this.talkWindowContextService.updateBindingFlag('haveLocalAudioStream', false, channel);
          } else {
            this.talkWindowContextService.updateBindingFlag('haveRemoteAudioStream', false, channel);
          }
          break;

        case AppConstants.VIDEO:
          if (isSenderConnection) {
            this.talkWindowContextService.updateBindingFlag('haveLocalVideoStream', false, channel);
          } else {
            this.talkWindowContextService.updateBindingFlag('haveRemoteVideoStream', false, channel);
          }
      }
      this.appUtilService.appRef.tick();
      resolve();
    });
  }

  /**
   * this will handle any data webrtc peer connection's(connections that were
   * meant to carry text data via data channel) disconnect state event
   *
   * @param autoDisconnected this will be set when connection is auto disconnected
   * and not disconnected deliberetely though some user action
   *
   * @param channel webrtc connection's media type for connection means the
   * type of media data that we will relay on this connection e.g 'text','video'
   * or 'audio'
   *
   * @param username username of the user with whom this connection was connected
   *
   * @return a promise
   */
  dataConnectionDisconnectHandler(autoDisconnected: boolean, channel: string, username: string) {
    return new Promise<void>((resolve) => {
      const mediaContext: any = this.coreAppUtilService.getNestedValue
        (this.userContextService.getUserWebrtcContext(username), AppConstants.MEDIA_CONTEXT, channel);
      if (mediaContext) {
        this.cleanWebrtcDataConnection(channel, mediaContext, username);
      }
      resolve();
    });
  }

  /**
   * this will handle any data webrtc peer connection's(connections that were
   * meant to carry remote access related data via data channel) disconnect state event
   * 
   * @param autoDisconnected this will be set when connection is auto disconnected
   * and not disconnected deliberetely though some user action
   *
   * @param channel webrtc connection's media type for connection means the
   * type of media data that we will relay on this connection e.g 'text','video'
   * , 'audio' or 'remoteControl'
   *
   * @param username username of the user with whom this connection was connected
   * 
   * @param sendDisonnectNotification flag to specify whether to send disconnect notification 
   * to other user
   *
   * @return a promise
   */
  remoteAccessConnectionDisconnectHandler(autoDisconnected: boolean, channel: string, username: string,
    sendDisonnectNotification: boolean, popupContext?: any) {
    return new Promise<void>(async (resolve) => {
      LoggerUtil.log("ending remote access session");

      /**
       * if connection is deliberetely closed through some user action then remove
       * the disconnect listener from peer connection
       *
       */
      if (!autoDisconnected) {
        const peerConnection: any = await this.coreAppUtilService.getAppropriatePeerConnection(username, AppConstants.REMOTE_CONTROL, true);
        if (peerConnection) {
          peerConnection.onconnectionstatechange = null;
        }
      }

      /**
       * if user is accessing remote machine then remove all the event listners 
       * remove all event listeners from canvas
       */
      if (this.talkWindowContextService.bindingFlags.isAccessingRemote) {
        this.talkWindowContextService.bindingFlags.isAccessingRemote = false;
        this.appUtilService.removeRemoteAccessEventListeners(this.talkWindowContextService.canvasUnlistenFunctions);
      }

      if (this.talkWindowContextService.bindingFlags.haveSharedRemoteAccess) {
        this.talkWindowContextService.bindingFlags.haveSharedRemoteAccess = false;
      }

      this.processChannelDisconnect(channel, username, sendDisonnectNotification, popupContext);
      // this.appUtilService.appRef.tick();

      /**
       * disconnect remote control connection
       */
      let mediaContext: any = this.coreAppUtilService.getNestedValue(
        this.userContextService.getUserWebrtcContext(username), AppConstants.MEDIA_CONTEXT);
      if (mediaContext[channel]) {
        await this.coreWebrtcService.cleanDataChannel(mediaContext[channel].dataChannel);
        await this.coreWebrtcService.cleanRTCPeerConnection(mediaContext[channel][AppConstants.SENDER], false);
        delete mediaContext[channel];
      }
      resolve();
    });
  }

  /**
   * this is the cleanup routine for cleaning webrtc peer connections which carries
   * data via webrtc data channels
   *
   * @param channel webrtc connection's media type for connection means the
   * type of media data that we will relay on this connection e.g 'text','video'
   * or 'audio'
   *
   * @param mediaContext appropriate webrtc media context from user's webrtc context
   *
   * @param username username of the user with whom this connection was connected
   *
   * @return a promise
   */
  cleanWebrtcDataConnection(channel: string, mediaContext: any, username: string) {
    return new Promise<void>((resolve) => {
      LoggerUtil.log('cleaning ' + channel + ' connection');

      /**
       * a. call the webrtc data channel cleanup routine
       *
       * b. call the webrtc peer connection cleanup routine
       *
       */
      this.coreWebrtcService.cleanDataChannel(mediaContext.dataChannel);

      /**
       * 
       * @TODO restore or remove it afterwards
       * 
       */
      //this.coreWebrtcService.cleanRTCPeerConnection(mediaContext[AppConstants.SENDER], false);

      /**
       * if this peer connection was carrying file data via data channels then
       * additionally clean all the queues as well which usually used for sending
       * and receiving files over data channel
       *
       */
      if (channel === AppConstants.FILE) {

        const recurringJobId: any = this.coreAppUtilService.getNestedValue(mediaContext, AppConstants.RECURRING_JOB_ID);
        /**
         * remove the recurring job
         */
        if (recurringJobId) {
          LoggerUtil.log('removed recurring job for ' + channel + ' connection with user ' + username);
          clearInterval(mediaContext[AppConstants.RECURRING_JOB_ID]);
        }
        if (this.userContextService.getUserWebrtcContext(username)[AppConstants.FILE_QUEUE]) {
          delete this.userContextService.getUserWebrtcContext(username)[AppConstants.FILE_QUEUE];
        }
        delete mediaContext[AppConstants.RECURRING_JOB_ID];
        delete mediaContext[AppConstants.IMAGE];
        delete mediaContext[AppConstants.AUDIO];
        delete mediaContext[AppConstants.VIDEO];
        LoggerUtil.log(this.userContextService.webrtcContext);
      }
      resolve();
    });
  }

  /**
   * this will be used to respond back to any media stream request received
   *
   * @param channel type of received media stream request
   *
   * @param username username of the user from whom we've received the request
   *
   * @param acceptFlag flag to distinguish whether to accept the request or decline
   * 
   * @param responseType type of response which needed to be sent i.e 'remoteAccess' or 'callRequest'
   * 
   */
  sendCallInviteResponse(channel: string, username: string, acceptFlag: boolean, responseType: string) {
    this.sendPayload({
      type: responseType,
      channel: channel,
      from: this.userContextService.username,
      to: username,
      request: acceptFlag ? AppConstants.ACCEPT : AppConstants.DECLINE,
      os: this.appUtilService.getOSType(),
      devicePixelRatio: window.devicePixelRatio
    });
  }

  /**
   * this will clean any registered timeout job using timeout job id saved in
   * timer context for supplied media type's sender or receiver peer connection
   *
   * @param username username of the user with whom this connection was connected
   *
   * @param channel webrtc connection's media type for connection means the
   * type of media data that we will relay on this connection e.g 'text','video'
   * or 'audio'
   *
   * @param isSenderConnection boolean flag to distinguish between sender and
   * receive audio/video peer connections
   *
   * @return a promise
   */

  /**
   * this will send the signaling message on the dataChannel if found open else
   * send it via signaling server i.e socket server
   *
   * @param signalingMessage json signaling message payload nedded to be sent
   */
  sendPayload(signalingMessage: any) {
    const webrtcContext: any = this.userContextService.getUserWebrtcContext(signalingMessage.to);

    /**
     * if there is already an open data channel b/w users then send signaling
     * payload via data channel only by wrapping whole message in a top container
     * and adding a 'via' property in top container so that data channel on the
     * other can know that this message is a signaling payload
     *
     * 
     * @TODO see if this can be removed
     */
    if (this.coreAppUtilService.isDataChannelConnected(webrtcContext, AppConstants.TEXT)) {
      LoggerUtil.log('sent payload via data channel : ' + JSON.stringify(signalingMessage));
      signalingMessage['via'] = 'dataChannel';
      webrtcContext[AppConstants.MEDIA_CONTEXT][AppConstants.TEXT].dataChannel.send(JSON.stringify({
        type: AppConstants.SIGNALING,
        message: signalingMessage
      }));
    } else {

      /**
       * if there is no open data channel found then just route/send message via
       * signaling server
       *
       */
      LoggerUtil.log('sent payload via signaling server ' + JSON.stringify(signalingMessage));
      signalingMessage['via'] = 'signaling server';
      this.signalingService.sendPayload(signalingMessage);
    }
  }

  /**
   * this will send a json message via data channel of specified channel
   * 
   * @param jsonMessage message that needs to be sent via data channel
   * 
   * @param channel webrtc connection's media type for connection means the
   * type of media data that we will relay on this connection e.g 'text','video'
   * or 'audio'
   * 
   */
  sendMessageOnDataChannel(jsonMessage: any, channel: string) {
    try {
      LoggerUtil.log(jsonMessage);
      const webrtcContext: any = this.userContextService.getUserWebrtcContext(jsonMessage.to);
      webrtcContext[AppConstants.MEDIA_CONTEXT][channel].dataChannel.send(JSON.stringify(jsonMessage));
    } catch (e) {
      LoggerUtil.log('error occured while sending following message via data channel');
      LoggerUtil.log(JSON.stringify(jsonMessage));
    }
  }

  /**
   * this is onmessage event handler for data channel
   *
   * @param jsonMessage message received via webrtc datachannel
   * 
   */
  async onDataChannelMessage(jsonMessage: string) {
    LoggerUtil.log('message received on data channel : ' + jsonMessage);
    const message: any = JSON.parse(jsonMessage);
    switch (message.type) {

      //handle file data transfer message
      case AppConstants.FILE:
        // LoggerUtil.log(message[AppConstants.CONTENT_TYPE] + " file received: " + message.message);
        this.processFileMessage(message);
        break;

      //handle signaling messages
      case AppConstants.SIGNALING:
        this.talkWindowOnRouterMessageFn(message.message);
        break;

      //handle message acknowledgement
      case AppConstants.MESSAGE_ACKNOWLEDGEMENT:
        this.appUtilService.updateChatMessageStatus(message);
        break;

      //handle native keyboard and mouse events 
      case AppConstants.REMOTE_CONTROL:
        this.remoteAccessService.handleNativeEvents(message);
        break;

      //handle received text data messages
      default:
        message.sent = false;
        const messageStatus: string = await this.talkWindowUpdateChatMessagesFn(message);
        if (messageStatus !== AppConstants.CHAT_MESSAGE_STATUS.NOT_APPLICABLE) {
          this.appUtilService.sendMessageAcknowledgement(message, messageStatus, message.type);
        }
    }
  }

  /**
   * this will handle 'file' type messages received via data channel
   *
   * @param message message received via data channel
   *
   */
  async processFileMessage(message: any) {

    //buffer to hold file data
    let buffer: any[];
    let messageStatus: string;
    const webrtcContext: any = this.userContextService.getUserWebrtcContext(message[AppConstants.USERNAME]);

    /**
     * 
     * update last data exchanged timestamp in user's webrtc context
     */
    webrtcContext[AppConstants.MEDIA_CONTEXT][AppConstants.FILE][AppConstants.LAST_USED] = Date.now();

    switch (message.chunkType) {

      /**
       * case - when whole file's content is received within a single message
       *
       */
      case AppConstants.CHUNK_TYPE.WHOLE:
        if (message[AppConstants.USERNAME] === this.userContextService.userToChat) {
          messageStatus = AppConstants.CHAT_MESSAGE_STATUS.SEEN;
        } else {
          messageStatus = AppConstants.CHAT_MESSAGE_STATUS.DELIVERED;
        }

        /**
         * send appropriate acknowledgement for received message
         */
        this.appUtilService.sendMessageAcknowledgement(message, messageStatus, message.type);
        const id = this.talkWindowContextService.contentIdsMap[message[AppConstants.CONTENT_ID]];
        delete this.talkWindowContextService.contentIdsMap[message[AppConstants.CONTENT_ID]];
        this.talkWindowContextService.sharedContent[id] = message.message;
        break;

      case AppConstants.CHUNK_TYPE.START:
        // LoggerUtil.log(message);

        /**
         * generate new content id for this file
         */
        const contentId: any = await this.coreAppUtilService.generateIdentifier();

        /**
         * keep a mapping between contentId received in message -> new content id generated
         * until receives all the file chunks
         *  
         * when whole file is received then only we'll load whole file contents in sharedContent
         * app repository from where it will get rendered on UI
         * 
         */
        this.talkWindowContextService.contentIdsMap[message[AppConstants.CONTENT_ID]] = contentId;
        // LoggerUtil.log(this.talkWindowContextService.contentIdsMap);

        delete message.message;
        message[AppConstants.CONTENT_ID] = contentId;
        message.sent = false;
        this.talkWindowUpdateChatMessagesFn(message);

        /**
         * app will keep a mapping to undefined in sharedContent for newly genrated 
         * contentId until all the file chunks are received 
         */
        this.talkWindowContextService.sharedContent[contentId] = undefined;
        break;

      case AppConstants.CHUNK_TYPE.INTERMEDIATE:
        /**
         * all the intermediate file chunks will get stored in appropriate file 
         * buffers available within user's webrtc context 
         */
        buffer = webrtcContext[AppConstants.MEDIA_CONTEXT][AppConstants.FILE][message[AppConstants.CONTENT_TYPE]];
        buffer.push(message.message);
        break;

      /**
       * case - when all the chunks of a file has been received
       *
       */
      case AppConstants.CHUNK_TYPE.END:
        if (message[AppConstants.USERNAME] === this.userContextService.userToChat) {
          messageStatus = AppConstants.CHAT_MESSAGE_STATUS.SEEN;
        } else {
          messageStatus = AppConstants.CHAT_MESSAGE_STATUS.DELIVERED;
        }

        /**
         * send appropriate acknowledgement for received message
         */
        this.appUtilService.sendMessageAcknowledgement(message, messageStatus, message.type);

        /**
         * get all file chunks from buffer
         */
        buffer = webrtcContext[AppConstants.MEDIA_CONTEXT][AppConstants.FILE][message[AppConstants.CONTENT_TYPE]];

        /**
         * get the newly generated contentId
         */
        const newContentId = this.talkWindowContextService.contentIdsMap[message[AppConstants.CONTENT_ID]];

        /**
         * remove the stored old -> new content id mapping
         */
        delete this.talkWindowContextService.contentIdsMap[message[AppConstants.CONTENT_ID]];

        /**
         * join all file chunks
         */
        this.talkWindowContextService.sharedContent[newContentId] = buffer.join('');

        //reset file buffer
        webrtcContext[AppConstants.MEDIA_CONTEXT][AppConstants.FILE][message[AppConstants.CONTENT_TYPE]] = [];
        // LoggerUtil.log(this.talkWindowContextService.contentIdsMap);
        setTimeout(() => { this.appUtilService.appRef.tick() }, 1000);
    }
  }

  /**
   * this is just a logical wrapper function used for setting properties in media call 
   * context to trigger cascading processing 
   * 
   * @param  eventObj : event object
   */
  mediaCallContextUpdateHandler(eventObj: any) {
    LoggerUtil.log('media context for property: ' + eventObj.property + ' with value: ' + eventObj.value);
    switch (eventObj.property) {
      case 'isSoundSharing':
        if (eventObj.value) {
          this.talkWindowContextService.bindingFlags.isAudioSharing = eventObj.value;
        } else {
          if (!this.talkWindowContextService.bindingFlags.haveLocalAudioStream &&
            !this.talkWindowContextService.bindingFlags.haveRemoteAudioStream) {
            this.talkWindowContextService.bindingFlags.isAudioSharing = eventObj.value;
          }
        }
        break;

      case 'haveLocalAudioStream':
        if (eventObj.value) {
          this.talkWindowContextService.bindingFlags.isAudioCalling = eventObj.value;
          this.talkWindowContextService.bindingFlags.isAudioSharing = eventObj.value;
        } else {
          setTimeout(() => {
            if (!this.talkWindowContextService.bindingFlags.haveLocalAudioStream &&
              !this.talkWindowContextService.bindingFlags.haveRemoteAudioStream) {
              this.talkWindowContextService.bindingFlags.isAudioCalling = eventObj.value;
            }
            if (!this.talkWindowContextService.bindingFlags.isSoundSharing) {
              this.talkWindowContextService.bindingFlags.isAudioSharing = eventObj.value;
            }
            this.appUtilService.removePopupContext([
              AppConstants.POPUP_TYPE.DISCONNECTING + eventObj.channel
            ]);
          }, 2000);
        }
        break;

      case 'haveRemoteAudioStream':
        if (eventObj.value) {
          this.talkWindowContextService.bindingFlags.isAudioCalling = eventObj.value;
          this.talkWindowContextService.bindingFlags.isAudioSharing = eventObj.value;
        } else {
          setTimeout(() => {
            if (!this.talkWindowContextService.bindingFlags.haveLocalAudioStream &&
              !this.talkWindowContextService.bindingFlags.haveRemoteAudioStream) {
              this.talkWindowContextService.bindingFlags.isAudioCalling = eventObj.value;
            }
            if (!this.talkWindowContextService.bindingFlags.isSoundSharing) {
              this.talkWindowContextService.bindingFlags.isAudioSharing = eventObj.value;
            }
            this.appUtilService.removePopupContext([
              AppConstants.POPUP_TYPE.DISCONNECTING + eventObj.channel
            ]);
          }, 2000);
        }
        break;

      case 'haveLocalVideoStream':
        if (eventObj.value) {
          this.talkWindowContextService.bindingFlags.isVideoCalling = eventObj.value;
          this.talkWindowContextService.bindingFlags.isVideoSharing = eventObj.value;
        } else {
          setTimeout(() => {
            if (!this.talkWindowContextService.bindingFlags.haveLocalVideoStream &&
              !this.talkWindowContextService.bindingFlags.haveRemoteVideoStream) {
              this.talkWindowContextService.bindingFlags.isVideoCalling = eventObj.value;
              this.talkWindowContextService.bindingFlags.isVideoSharing = eventObj.value;
            }
            this.appUtilService.removePopupContext([
              AppConstants.POPUP_TYPE.DISCONNECTING + eventObj.channel
            ]);
            this.appUtilService.appRef.tick();
          }, 2000);
          if (!this.userContextService.isMobile && this.talkWindowContextService.bindingFlags.isFullScreenMode) {
            this.talkWindowSetCentralIconsPopupFn(false);
            this.talkWindowContextService.bindingFlags.isFullScreenMode = false;
          }
        }
        break;

      case 'haveRemoteVideoStream':
        if (eventObj.value) {
          this.talkWindowContextService.bindingFlags.isVideoCalling = eventObj.value;
          this.talkWindowContextService.bindingFlags.isVideoSharing = eventObj.value;
        } else {
          setTimeout(() => {
            if (!this.talkWindowContextService.bindingFlags.haveLocalVideoStream &&
              !this.talkWindowContextService.bindingFlags.haveRemoteVideoStream) {
              this.talkWindowContextService.bindingFlags.isVideoCalling = eventObj.value;
              this.talkWindowContextService.bindingFlags.isVideoSharing = eventObj.value;
            }
            this.appUtilService.removePopupContext([
              AppConstants.POPUP_TYPE.DISCONNECTING + eventObj.channel
            ]);
            this.appUtilService.appRef.tick();
          }, 2000);
          if (!this.userContextService.isMobile && this.talkWindowContextService.bindingFlags.isFullScreenMode) {
            this.talkWindowSetCentralIconsPopupFn(false);
            this.talkWindowContextService.bindingFlags.isFullScreenMode = false;
          }
        }
    }
    this.appUtilService.appRef.tick();
  }

  /**
   * 
   * this will setup a webrtc connection with provided user
   * 
   * @param username username of the user with whom webrtc connection have to be established
   * 
   *  @param offerMessage this is an optional offer signaling message
   */
  setUpWebrtcConnection(username: string, offerMessage?: any) {
    return new Promise<void>(async (resolve, reject) => {
      try {

        LoggerUtil.log('setting up new webrtc connection');

        /**
         * 
         * initialize webrtc context if not yet initialized
         */
        if (!this.userContextService.hasUserWebrtcContext(username)) {
          this.userContextService.initializeUserWebrtcContext(username);
        }
        const webrtcContext: any = this.userContextService.getUserWebrtcContext(username);

        if (webrtcContext[AppConstants.CONNECTION_STATE] === AppConstants.CONNECTION_STATES.NOT_CONNECTED) {

          /**
           * 
           * initialize webrtc peer connection
           */
          const initializedConnection: boolean = await this.coreWebrtcService.rtcConnectionInit(username);

          /**
           * 
           * update webrtc connection state to connecting so that not other flow can update it further
           */
          webrtcContext[AppConstants.CONNECTION_STATE] = AppConstants.CONNECTION_STATES.CONNECTING;
          const peerConnection: any = webrtcContext[AppConstants.CONNECTION];

          /**
           * 
           * register webrtc connection if new webrtc conection has been initialized
           */
          if (initializedConnection) {
            this.registerWebrtcEventListeners(peerConnection, username);
          }

          /**
           * 
           * create the offer for the peer connection and send it to other peer
           */
          if (offerMessage === undefined) {
            peerConnection.createOffer().then((offer: any) => {
              peerConnection.setLocalDescription(offer);

              /**
               * 
               * send the offer payload
               */
              this.sendPayload({
                from: this.userContextService.username,
                to: username,
                channel: AppConstants.CONNECTION,
                type: AppConstants.OFFER,
                offer: offer
              });
            }).catch((error: any) => {
              LoggerUtil.log(error);
              reject('There is an error while generating offer on peer connection');
            });
          } else {
            peerConnection.setRemoteDescription(new RTCSessionDescription(offerMessage.offer));
            peerConnection.createAnswer().then((answer: any) => {
              peerConnection.setLocalDescription(answer);

              /**
               * 
               * send the answer payload
               */
              this.sendPayload({
                from: this.userContextService.username,
                to: username,
                channel: AppConstants.CONNECTION,
                type: AppConstants.ANSWER,
                answer: answer
              });
            }).catch((error: any) => {
              LoggerUtil.log('there is an error while generating answer');
              reject(error);
            }); // Here ends create answer
          }
        } else {
          /**
           * 
           * already in connecting/connected state so do nothing here
           */
        }
      } catch (e) {
        LoggerUtil.log(e);
        reject('there is an exception occured while establishing connection with ' + username);
      }
    });
  }

  /**
   * setup datachannel with a user
   *
   * @param createDataChannelType create data channel request type
   *
   */
  setUpDataChannel(createDataChannelType: CreateDataChannelType) {
    return new Promise<void>(async (resolve, reject) => {
      try {
        /**
         * 
         * initialize the webrtc context if not yet initialized
         */
        if (!this.userContextService.hasUserWebrtcContext(createDataChannelType.username)) {
          this.userContextService.initializeUserWebrtcContext(createDataChannelType.username);
        }
        this.coreWebrtcService.mediaContextInit(createDataChannelType.channel, createDataChannelType.username);

        const webrtcContext: any = this.userContextService.getUserWebrtcContext(createDataChannelType.username);

        /**
         * 
         * mark data channel state as connecting for provided channel in user's webrtc media context
         */
        webrtcContext[AppConstants.MEDIA_CONTEXT][createDataChannelType.channel][AppConstants.CONNECTION_STATE] = AppConstants.CONNECTION_STATES.CONNECTING;
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
          const offerContainer: any = await this.coreWebrtcService.getDataChannelOffer(peerConnection, createDataChannelType.channel);;
          const dataChannel: any = offerContainer.dataChannel;
          LoggerUtil.log('registered message listener on ' + createDataChannelType.channel + ' data channel');

          // remote datachannel onmessage listener
          dataChannel.onmessage = (msgEvent: any) => {
            this.onDataChannelMessage(msgEvent.data);
          };

          /**
           * send the composed 'offer' signaling message to the other user
           */
          this.sendPayload({
            type: offerContainer.offerPayload.type,
            offer: offerContainer.offerPayload.offer,
            channel: offerContainer.offerPayload.channel,
            from: this.userContextService.username,
            to: createDataChannelType.username,
            renegotiate: true
          });

          /**
           * set the datachannel in user's webrtc context
           */
          webrtcContext[AppConstants.MEDIA_CONTEXT][createDataChannelType.channel][AppConstants.DATACHANNEL] = dataChannel;
        } else {
          /**
           * 
           * if webrtc connection is not in connetcted state then add the setup data channel function 
           * along with the calling context in the webrtc on connect queue
           */
          const webrtcCallbackContextType: CallbackContextType = {
            callbackFunction: this.setUpDataChannel.bind(this),
            callbackContext: createDataChannelType
          };
          webrtcContext[AppConstants.WEBRTC_ON_CONNECT_QUEUE].enqueue(webrtcCallbackContextType);
          if (webrtcContext[AppConstants.CONNECTION_STATE] === AppConstants.CONNECTION_STATES.NOT_CONNECTED) {
            this.setUpWebrtcConnection(createDataChannelType.username);
          }
        }
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  }
}
