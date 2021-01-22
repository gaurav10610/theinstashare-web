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
        .getNestedValue(userWebrtcContext, AppConstants.CONNECTIONS, channel, AppConstants.DATACHANNEL);

      if (dataChannel && this.coreAppUtilService.isDataChannelOpen(userWebrtcContext, channel)
        && dataChannel.bufferedAmount === 0) {
        const lastUsedTime: any = userWebrtcContext[AppConstants.CONNECTIONS][channel][AppConstants.LAST_USED];

        const idleTime: any = Date.now() - lastUsedTime;
        LoggerUtil.log(channel + ' connection with user ' + username + ' has been idle for: ' + idleTime + 'ms');
        /**
         * if data channel is being idle after some time then clean up the webrtc connection 
         * and close the data channel 
         * 
         */
        if (idleTime > AppConstants.DATACHANNEL_IDLE_THRESHOLD) {
          LoggerUtil.log(channel + ' data channel with user ' + username + ' was idle so cleaning it up');
          this.cleanWebrtcDataConnection(channel, userWebrtcContext[AppConstants.CONNECTIONS][channel], username);
        }
      } else {
        const recurringJobId: any = this.coreAppUtilService
          .getNestedValue(userWebrtcContext, AppConstants.CONNECTIONS, channel, AppConstants.RECURRING_JOB_ID);
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
    userWebrtcContext[AppConstants.CONNECTIONS][channel][AppConstants.RECURRING_JOB_ID] = recurringJobId;
  }

  /**
   * this will register all the necessary webrtc and data channel event listeners
   * on a peer connection for a particular channel.
   *
   *
   * @param peerConnection webrtc connection on which the handler is to be registered
   *
   * @param channel webrtc connection's media type for connection means the type
   * of media data that we will relay on this connection e.g 'text','video' or 'audio'
   *
   * @param isSenderConnection boolean flag to distinguish between sender and
   * receive audio/video peer connections
   *
   * @param userToChat username of the user with whom connection has to be established
   *
   * @param isReconnectRequired an optional flag which can be set if a webrtc
   * connection has to be re-established, once it is disconnected
   *
   */
  registerWebrtcEventListeners(peerConnection: any, channel: string, isSenderConnection: boolean,
    userToChat: any) {
    return new Promise<void>((resolve, reject) => {
      try {

        /**
         * process connection state change event here
         */
        peerConnection.onconnectionstatechange = async () => {
          // LoggerUtil.log('new peer connection state: ' + peerConnection.connectionState);

          switch (peerConnection.connectionState) {
            case 'disconnected':

              /**
               * @TODO convert this to switch case afterwards
               * 
               */
              if (channel === AppConstants.DATA || channel === AppConstants.FILE) {

                /**
                 *
                 * if disconnected webrtc connection was 'data'(webrtc connection
                 * used for sending text data) or 'file'(webrtc connection used
                 * for sending/receiving files) connection, then simply cleanup
                 * the webrtc connection and datachannel appropriately from user's
                 * webrtc context.
                 *
                 *
                 * when user again wanted to send some 'text' or 'file' data then
                 * app will simply establish a new connection and open a data
                 * channel on it.
                 *
                 */
                this.dataConnectionDisconnectHandler(true, channel, userToChat);
              } else if (channel === AppConstants.REMOTE_CONTROL) {

                /**
                 *
                 * if disconnected webrtc connection was being used for remote access
                 * purpose(sending remote control event over data channel) then delegate 
                 * the disconnect handling to asppropriate handler and display appropriate
                 * modal popup message on UI
                 *
                 *
                 * when user again wanted to send some 'text' or 'file' data then
                 * app will simply establish a new connection and open a data
                 * channel on it.
                 *
                 */
                const popupContext = {
                  type: AppConstants.POPUP_TYPE.DISCONNECT + channel,
                  modalText: channel + ' connection with ' + userToChat + ' has been disconnected',
                  channel: channel
                };
                this.remoteAccessConnectionDisconnectHandler(true, channel, userToChat, false, popupContext);
              } else {

                /**
                 * this is the case where disconnected webrtc connection was
                 * being used for streaming any kind of media data like 'audio' or 'video'
                 *
                 * a. display appropriate disconnect modal popup message on UI
                 *
                 * b. delegate the webrtc connection's disconnect handling to
                 * the 'mediaConnectionDisconnectHandler' with appropriate
                 * parameter arguments, so that the webrtc connection cleanup
                 * will be done appropriately
                 *
                 * @TODO compose the context using message service
                 */
                const popupContext = {
                  type: AppConstants.POPUP_TYPE.DISCONNECT + channel,
                  modalText: channel + ' stream with ' + userToChat + ' has disconnected',
                  channel: channel
                };
                const userContext = this.userContextService.getUserWebrtcContext(userToChat);
                await this.mediaConnectionDisconnectHandler(true, channel, userToChat, isSenderConnection, userContext, popupContext);

                //flag from context whether to reconect media stream connection or not
                const isReconnectionRequired: boolean = userContext[AppConstants.RECONNECT];

                if (isReconnectionRequired) {
                  /**
                   * if reconnection is required then process the reconnection logic
                   * 
                   * NOTE - only send reconnect request if the disconnected connection 
                   * was a receive connection
                   *
                   */
                  if (!isSenderConnection) {
                    LoggerUtil.log('attempting ' + channel + ' stream receiver reconnection');

                    /**
                     * send the reconnection request to the media call initiator
                     *
                     */
                    this.sendPayload({
                      type: AppConstants.RECONNECT,
                      from: this.userContextService.getUserName(),
                      to: userToChat,
                      channel: channel
                    });
                  }

                  /**
                   * display appropriate reconnect modal popup message on UI
                   *
                   */
                  const reconnectPopupContext = this.messageService
                    .buildPopupContext(AppConstants.POPUP_TYPE.RECONNECT, channel);
                  this.appUtilService.addPopupContext(reconnectPopupContext);

                  /**
                   * setup a timeout jobs to check if webrtc connetions come in
                   * connected state after a specified time else cleanup the
                   * connections appropriately
                   *
                   */
                  this.cleanWebrtcConnectionsIfNotConnected(channel, userToChat, AppConstants.CONNECTION_TIMEOUT, isSenderConnection);
                }
              }
              break;

            case 'connected':
              /**
               * when webrtc connection is established them remove any connecting
               * or reconnect popup messages from UI
               * 
               */
              this.appUtilService.removePopupContext([
                AppConstants.POPUP_TYPE.CONNECTING + channel,
                AppConstants.POPUP_TYPE.RECONNECT + channel
              ]);
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
              channel: channel,
              isSender: isSenderConnection,
              from: this.userContextService.username,
              to: userToChat
            };
            this.sendPayload(iceCandidatePayload);
          }
        }

        switch (channel) {

          /**
           * add datachannel onmessage event listener for 'data' connection
           *
           */
          case AppConstants.DATA:
            this.addDataChannelEvents(peerConnection, channel, userToChat);
            break;

          /**
           * add datachannel onmessage event listener for 'file' connection
           *
           */
          case AppConstants.FILE:
            this.addDataChannelEvents(peerConnection, channel, userToChat);
            break;

          case AppConstants.REMOTE_CONTROL:
            /**
             * add datachannel onmessage event listener for 'remoteControl' connection
             *
             */
            this.addDataChannelEvents(peerConnection, channel, userToChat);
            break;

          default:
            /**
             * register ontrack listner for 'audio','video' and 'screen' on reciver
             * peer connection
             *
             */
            if (!isSenderConnection) {
              peerConnection.ontrack = async (event: any) => {
                LoggerUtil.log(channel + ' stream received');
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
                    this.talkWindowContextService.updateBindingFlag('haveRemoteAudioStream', true, channel, isSenderConnection);
                    break;

                  case AppConstants.VIDEO:

                    /**
                     * update 'haveRemoteVideoStream' media call context flag to
                     * keep track that a remote video stream has been received
                     *
                     */
                    this.talkWindowContextService.updateBindingFlag('haveRemoteVideoStream', true, channel, isSenderConnection);
                    break;

                  case AppConstants.SCREEN:

                    /**
                     * update 'haveRemoteVideoStream' media call context flag to
                     * keep track that a remote video stream has been received
                     *
                     */
                    this.talkWindowContextService.updateBindingFlag('haveRemoteVideoStream', true, channel, isSenderConnection);
                }
                /**
                 * attach remote media stream in appropriate media tag on UI
                 *
                 */
                this.talkWindowOnMediaStreamReceivedFn(new MediaStream([event.track]), channel, false);
              }
            }
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
   * @param channel webrtc connection's media type for connection means the type
   * of media data that we will relay on this connection e.g 'text','video' or 'audio'
   *
   * @param isSenderConnection boolean flag to distinguish between sender and
   * receive audio video peer connections
   *
   * @param userToChat username of the user with whom connection has to be established
   *
   */
  addDataChannelEvents(peerConnection: any, channel: string, userToChat: any) {
    peerConnection.ondatachannel = (event: any) => {
      LoggerUtil.log(channel + ' data channel has been received');

      /**
       * when a remote data channel is received then set it in user's webrtc context
       *
       */
      const dataChannel = event.channel;
      this.userContextService.getUserWebrtcContext(userToChat)[AppConstants.CONNECTIONS]
      [channel].dataChannel = dataChannel;

      LoggerUtil.log('message listener registered on datachannel');
      /**
       * register onmessage listener on received data channel
       *
       */
      dataChannel.onmessage = (msgEvent: any) => {
        this.onDataChannelMessage(msgEvent.data);
      }

      /**
       * if this data channel is meant for sending text messages than register
       * an onopen listner also which will send any queued text messages
       *
       */
      dataChannel.onopen = () => {
        LoggerUtil.log(channel + ' data channel has been opened');

        /**
         * set shared remote control flag to true
         */
        if (channel === AppConstants.REMOTE_CONTROL) {
          this.talkWindowContextService.bindingFlags.haveSharedRemoteAccess = true;
        }
        if (channel === AppConstants.DATA) {
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
           * a. get the username of the user to whom media stream request has
           * been made
           *
           * b. get the media stream request type from media call context
           *
           */
          const userToChat = this.talkWindowContextService.mediaStreamRequestContext[AppConstants.USERNAME];
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

          /**
           * setup a timeout jobs to check if webrtc connetions come in connected state
           * after a specified time else cleanup the connections appropriately
           *
           */
          this.cleanWebrtcConnectionsIfNotConnected(channel, userToChat, AppConstants.CONNECTION_TIMEOUT, true);
          if (channel !== AppConstants.SCREEN && channel !== AppConstants.SOUND) {
            this.cleanWebrtcConnectionsIfNotConnected(channel, userToChat, AppConstants.CONNECTION_TIMEOUT, false);
          }

          /**
           * by default for a video call we start audio streaming/call also if it
           * is not going on, user will have option to disable them later on so
           * set up timeout jobs for audio also along with video in case user
           * has started a video call
           *
           */
          if ((this.talkWindowContextService.bindingFlags[AppConstants.CHANNEL] === AppConstants.VIDEO)
            && !this.talkWindowContextService.bindingFlags.isAudioCalling) {
            this.cleanWebrtcConnectionsIfNotConnected(AppConstants.AUDIO, userToChat, AppConstants.CONNECTION_TIMEOUT, true);
            this.cleanWebrtcConnectionsIfNotConnected(AppConstants.AUDIO, userToChat, AppConstants.CONNECTION_TIMEOUT, false);
          }
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
          Object.keys(userContext[AppConstants.CONNECTIONS]).forEach((channel) => {
            if (channel !== AppConstants.DATA) {
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
          Object.keys(userContext[AppConstants.CONNECTIONS]).forEach((channel: string) => {
            const mediaContext = userContext[AppConstants.CONNECTIONS][channel];
            if (channel === AppConstants.DATA || channel === AppConstants.FILE) {
              this.cleanWebrtcDataConnection(channel, mediaContext, user);
            } else {
              this.coreWebrtcService.cleanWebrtcMediaConnection(channel, mediaContext, true);
              this.coreWebrtcService.cleanWebrtcMediaConnection(channel, mediaContext, false);
            }
            delete userContext[AppConstants.CONNECTIONS][channel];
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
    const dataChannel = webrtcContext[AppConstants.CONNECTIONS][AppConstants.DATA].dataChannel;

    /**
     * iterate message queue and send all the messages via data channel
     */
    while (!webrtcContext[AppConstants.MESSAGE_QUEUE].isEmpty()) {
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
      delete userContext[AppConstants.CONNECTIONS][channel];
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
      const mediaContext: any = this.coreAppUtilService.getNestedValue(userContext, AppConstants.CONNECTIONS, channel);

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
       * clean any registered timout job -> job that checks connection's state
       * and do the cleanup processing if they aren't connected
       *
       */
      this.clearTimeoutJob(channel, username, isSenderConnection);

      /**
       * configure appropriate flags in media call context
       */
      switch (channel) {
        case AppConstants.SCREEN:
          if (isSenderConnection) {
            this.talkWindowContextService.updateBindingFlag('haveLocalVideoStream', false, channel, isSenderConnection);
          } else {
            this.talkWindowContextService.updateBindingFlag('haveRemoteVideoStream', false, channel, isSenderConnection);
          }
          this.talkWindowContextService.updateBindingFlag('isScreenSharing', false, channel, isSenderConnection);
          break;

        case AppConstants.SOUND:
          this.talkWindowContextService.updateBindingFlag('isSoundSharing', false, channel, isSenderConnection);
          break;

        case AppConstants.AUDIO:
          if (isSenderConnection) {
            this.talkWindowContextService.updateBindingFlag('haveLocalAudioStream', false, channel, isSenderConnection);
          } else {
            this.talkWindowContextService.updateBindingFlag('haveRemoteAudioStream', false, channel, isSenderConnection);
          }
          break;

        case AppConstants.VIDEO:
          if (isSenderConnection) {
            this.talkWindowContextService.updateBindingFlag('haveLocalVideoStream', false, channel, isSenderConnection);
          } else {
            this.talkWindowContextService.updateBindingFlag('haveRemoteVideoStream', false, channel, isSenderConnection);
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
        (this.userContextService.getUserWebrtcContext(username), AppConstants.CONNECTIONS, channel);
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
        this.userContextService.getUserWebrtcContext(username), AppConstants.CONNECTIONS);
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
      this.coreWebrtcService.cleanRTCPeerConnection(mediaContext[AppConstants.SENDER], false);

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
   * this will setup a cleanup timeout job for a particular webrtc peer connection,
   * which will check the state of the connection after the timeout and if it's
   * not connected then appropriate disconnect handling will be performed
   *
   * @param username username of the user with whom this connection was connected
   *
   * @param channel webrtc connection's media type for connection means the
   * type of media data that we will relay on this connection e.g 'text','video'
   * or 'audio'
   *
   * @param timeout timeout for setting up the timeout job
   * 
   * @param isSenderConnection boolean flag to distinguish between sender and
   * receive audio/video peer connections
   *
   * @return a promise
   */
  async cleanWebrtcConnectionsIfNotConnected(channel: string, username: string,
    timeout: number, isSenderConnection: boolean) {
    return new Promise<void>((resolve) => {
      const timerId = setTimeout(async () => {

        const connectionType = this.coreAppUtilService.getConnectionIdentifier(channel, isSenderConnection);

        /**
         * check if peer connection is in 'connected' state
         *
         */
        const isConnected: boolean = await this.coreAppUtilService.isConnectedWithUser(channel, username, isSenderConnection);
        if (isConnected) {

          /**
           * if connection is found connected then just remove the saved the timeout
           * job's timerId from timer context for supplied media channel
           *
           */
          this.clearTimeoutJob(channel, username, isSenderConnection);
          LoggerUtil.log(channel + ' stream ' + connectionType +
            ' connection found connected with ' + username + ' after timeout');
        } else {

          LoggerUtil.log(channel + ' stream ' + connectionType +
            ' connection not found connected with ' + username + ' after timeout');

          /**
           * if webrtc peer connection is not found in connected state then remove
           * any remove currently displayed 'connecting' or 'reconnecting' popup
           * from UI
           *
           * display unable to connect modal popup message on UI
           *
           */
          this.appUtilService.removePopupContext([
            AppConstants.POPUP_TYPE.CONNECTING + channel,
            AppConstants.POPUP_TYPE.RECONNECT + channel
          ]);

          const popupContext = this.messageService
            .buildPopupContext(AppConstants.POPUP_TYPE.UNABLE_TO_CONNECT, channel);
          const userContext = this.userContextService.getUserWebrtcContext(username);

          /**
           * a. call media webrtc peer connections disconnect routine for both the
           * sender and receiver peer connections
           *
           * b. clean the media context from user's webrtc context
           *
           */
          this.mediaConnectionDisconnectHandler(false, channel, username, true, userContext, popupContext);
          this.mediaConnectionDisconnectHandler(true, channel, username, false, userContext, popupContext);
          delete userContext[AppConstants.CONNECTIONS][channel];
        }
      }, timeout);

      /**
       * add the timeout job id in the timers context for supplied media channel
       * type so that it can be later used for cleaning this timeout job
       *
       */
      const connectionType = this.coreAppUtilService.getConnectionIdentifier(channel, isSenderConnection);
      this.talkWindowContextService.timeoutJobContext[channel][connectionType] = timerId;
      resolve();
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
   * remove appropriate registered timeout job and also remove the timeout job id from 
   * timeoutJobContext using supplied channel and isSenderConnection flag
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
   * @return a promise
   */
  clearTimeoutJob(channel: string, username: string, isSenderConnection: boolean) {
    const connectionType = this.coreAppUtilService.getConnectionIdentifier(channel, isSenderConnection);
    const timeoutJobId = this.talkWindowContextService.timeoutJobContext[channel][connectionType];
    if (timeoutJobId) {
      LoggerUtil.log('removed the ' + connectionType + ' ' + channel + ' stream timeout job for ' + username);
      clearTimeout(timeoutJobId);
      this.talkWindowContextService.timeoutJobContext[channel][connectionType] = undefined;
    }
  }

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
    if (this.coreAppUtilService.isDataChannelOpen(webrtcContext, AppConstants.DATA)) {
      LoggerUtil.log('sent payload via data channel : ' + JSON.stringify(signalingMessage));
      signalingMessage['via'] = 'dataChannel';
      webrtcContext[AppConstants.CONNECTIONS][AppConstants.DATA].dataChannel.send(JSON.stringify({
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
      webrtcContext[AppConstants.CONNECTIONS][channel].dataChannel.send(JSON.stringify(jsonMessage));
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

    //update last data exchanged timestamp in user's webrtc context
    this.updateLastSendTimestamp(AppConstants.FILE, message[AppConstants.USERNAME]);

    //buffer to hold file data
    let buffer: any[];
    let messageStatus: string;
    const webrtcContext: any = this.userContextService.getUserWebrtcContext(message[AppConstants.USERNAME]);
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
        buffer = webrtcContext[AppConstants.CONNECTIONS][AppConstants.FILE][message[AppConstants.CONTENT_TYPE]];
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
        buffer = webrtcContext[AppConstants.CONNECTIONS][AppConstants.FILE][message[AppConstants.CONTENT_TYPE]];

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
        webrtcContext[AppConstants.CONNECTIONS][AppConstants.FILE][message[AppConstants.CONTENT_TYPE]] = [];
        // LoggerUtil.log(this.talkWindowContextService.contentIdsMap);
        setTimeout(() => { this.appUtilService.appRef.tick() }, 1000);
    }
  }

  /**
   * this will update timestamp in user's webrtc context when data is send/receive over webrtc 
   * data channel, this will be used later to clean up idle connections 
   * 
   * @param channel webrtc cnonection's media type for connection means the type
   * of media data that we will relay on this connection e.g 'text','video' or 'audio'
   *
   * @param username username of the user with whom connection has to be established
   */
  updateLastSendTimestamp(channel: string, username: string) {
    const mediaContext: any = this.coreAppUtilService
      .getNestedValue(this.userContextService.getUserWebrtcContext(username), AppConstants.CONNECTIONS, channel);
    if (mediaContext) {
      mediaContext[AppConstants.LAST_USED] = Date.now();
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
   * setup datachannel with a user
   *
   * @param username username of the user with whom the datachannel is to be setup
   * 
   * @param channel type of data for which this datachannel will be used like
   * 'data' or 'file'
   *
   */
  setUpDataChannel(username: string, channel: string) {
    return new Promise(async (resolve, reject) => {
      try {
        const userContext = this.userContextService.getUserWebrtcContext(username);

        /**
         * initialize webrtc connection for datachannel
         */
        await this.coreWebrtcService.rtcConnectionInit(channel, username, true);

        /**
         * set the datachannel state in user's webrtc connection as 'connecting'
         * so no other setup datachannel request should be made
         *
         */
        userContext[AppConstants.CONNECTIONS][channel].state = AppConstants.CHANNEL_STATUS.CONNECTING;
        const peerConnection = userContext[AppConstants.CONNECTIONS][channel][AppConstants.SENDER];

        /**
         * register all the event listners on the webrtc peer connection
         */
        await this.registerWebrtcEventListeners(peerConnection, channel, true, username);

        /**
         *
         * generate the appropriate 'offer' for sending it to the other user
         *
         * 'offerContainer' will contain the genrated offer sdp and few other
         * properties which app utilizes to compose an offer signaling message
         * to be sent to other user
         *
         */
        const offerContainer: any = await this.coreWebrtcService.generateOffer(peerConnection, channel);

        /**
         * send the composed 'offer' signaling message to the other user
         */
        this.sendPayload({
          type: offerContainer.offerPayload.type,
          offer: offerContainer.offerPayload.offer,
          channel: offerContainer.offerPayload.channel,
          from: this.userContextService.username,
          to: username,
          seekReturnOffer: false
        });

        /**
         * set the datachannel in user's webrtc context
         */
        userContext[AppConstants.CONNECTIONS][channel].dataChannel = offerContainer.dataChannel;
        resolve(offerContainer.dataChannel);
      } catch (e) {
        reject(e);
      }
    });
  }
}
