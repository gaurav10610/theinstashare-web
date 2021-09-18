import { Injectable } from '@angular/core';
import { AppConstants } from '../AppConstants';
import { UserContextService } from '../context/user.context.service';
import { CallbackContextType } from '../contracts/CallbackContextType';
import { CreateDataChannelType } from '../contracts/CreateDataChannelType';
import { MediaChannelType } from '../contracts/enum/MediaChannelType';
import { SignalingMessageType } from '../contracts/enum/SignalingMessageType';
import { UserType } from '../contracts/enum/UserType';
import { BaseSignalingMessage } from '../contracts/signaling/BaseSignalingMessage';
import { CoreDataChannelService } from '../data-channel/core-data-channel.service';
import { LoggerUtil } from '../logging/LoggerUtil';
import { CoreAppUtilityService } from '../util/core-app-utility.service';
import { TalkWindowUtilityService } from '../util/talk-window-utility.service';
import { CoreWebrtcService } from './core-webrtc.service';

/**
 * this service contains all the webrtc related reusable logic chunks which app
 * utilises in order to process various types of user requests from UI
 *
 *
 */
@Injectable({
    providedIn: 'root'
})
export class GroupChatWebrtcService {

    constructor(
        private coreWebrtcService: CoreWebrtcService,
        private userContextService: UserContextService,
        private coreDataChannelService: CoreDataChannelService,
        private appUtilService: TalkWindowUtilityService,
        private coreAppUtilService: CoreAppUtilityService
    ) { }

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
                    const offerContainer: any = await this.coreWebrtcService.getDataChannelOffer(peerConnection, createDataChannelType.channel);
                    const dataChannel: any = offerContainer.dataChannel;
                    LoggerUtil.log('registered message listener on ' + createDataChannelType.channel + ' data channel');

                    // remote datachannel onmessage listener
                    dataChannel.onmessage = (msgEvent: any) => {
                        this.onDataChannelMessage(msgEvent.data);
                    };

                    /**
                     * send the composed 'offer' signaling message to the other user
                     */
                    this.coreDataChannelService.sendPayload({
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
                    LoggerUtil.log('webrtc connection is not in connected state for user: ' + createDataChannelType.username);
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

            //handle received text data messages
            default:
        }
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
                            this.coreDataChannelService.sendPayload({
                                from: this.userContextService.username,
                                to: username,
                                channel: AppConstants.CONNECTION,
                                type: AppConstants.OFFER,
                                offer: offer
                            });
                        }).catch((error) => {
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
                            this.coreDataChannelService.sendPayload({
                                from: this.userContextService.username,
                                to: username,
                                channel: AppConstants.CONNECTION,
                                type: AppConstants.ANSWER,
                                answer: answer
                            });
                        }).catch((error) => {
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

                            // handle the webrtc disconnection here 
                            await this.webrtcConnectionDisconnectHandler(userToChat, [{
                                type: AppConstants.POPUP_TYPE.DISCONNECT + AppConstants.CONNECTION,
                                channel: AppConstants.CONNECTION,
                                modalText: 'disconnected from ' + userToChat
                            }]);
                            break;

                        case 'connected':
                            /**
                             * 
                             * make the connection status as 'connected' in the user's webrtc context
                             */
                            webrtcContext[AppConstants.CONNECTION_STATE] = AppConstants.CONNECTION_STATES.CONNECTED;
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
                            to: userToChat,
                            channel: AppConstants.CONNECTION
                        };
                        this.coreDataChannelService.sendPayload(iceCandidatePayload);
                    }
                }

                // register data channel related event handlers
                this.registerDataChannelEvents(peerConnection, userToChat);

                // register media track related event handlers
                this.registerMediaTrackEvents(peerConnection, userToChat);
                resolve();
            } catch (error) {
                LoggerUtil.log('there is an error while registering events on peer connection');
                reject(error);
            }
        });
    }

    /**
     * this will add media track related event listeners on webrtc peer connection
     *
     * @param peerConnection webrtc peer connection on which event handler has to be registered
     *
     * @param userToChat username of the user with whom connection has to be established
     *
     */
    registerMediaTrackEvents(peerConnection: any, userToChat: any) {
        /**
         * 
         * @TODO do appropriate handling here
         */
    }

    /**
     * this will add data channel reltaed event listeners on webrtc peer connection
     *
     * @param peerConnection webrtc peer connection on which the data channel
     * handler has to be registered
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
                this.coreDataChannelService.sendPayload({
                    type: AppConstants.WEBRTC_EVENT,
                    channel: channel,
                    event: AppConstants.WEBRTC_EVENTS.CHANNEL_OPEN,
                    from: this.userContextService.username,
                    to: userToChat
                });

                webrtcContext[AppConstants.MEDIA_CONTEXT][channel][AppConstants.CONNECTION_STATE] = AppConstants.CONNECTION_STATES.CONNECTED;
                if (channel === AppConstants.TEXT) {
                    this.sendQueuedMessagesOnChannel(userToChat);
                }
            }
        }
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
     * this will handle any webrtc peer connection's disconnect state event
     *
     * @param username username of the user with whom this connection was connected
     *
     * @param popupContexts an optional array of popup contexts if any modal popup message
     * has to be displayed after handling the disconnection
     * 
     * @TODO refactor it afterwards if needed
     *
     * @return a promise
     */
    webrtcConnectionDisconnectHandler(username: string, popupContexts?: any[]) {
        return new Promise<void>((resolve) => {
            LoggerUtil.log('handling webrtc connection disconnect for ' + username);
            const webrtcContext: any = this.userContextService.getUserWebrtcContext(username);

            /**
             * remove the disconnect listener from peer connection
             */

            webrtcContext[AppConstants.CONNECTION].onconnectionstatechange = null;
            webrtcContext[AppConstants.RECONNECT] = false;

            const mediaContext: any = webrtcContext[AppConstants.MEDIA_CONTEXT];

            /**
             * 
             * iterate whole media context and clean channel context for all the open channels 
             */
            Object.keys(mediaContext).forEach(channel => {

                /**
                 * 
                 * choose appropriate clean up routine for each open channel 
                 */
                if (this.coreAppUtilService.isDataChannel(channel)) {
                    this.cleanDataChannelContext(channel, mediaContext[channel]);
                    delete webrtcContext[AppConstants.MESSAGE_QUEUE];
                    delete webrtcContext[AppConstants.FILE_QUEUE];
                } else if (this.coreAppUtilService.isMediaChannel(channel)) {

                    // remove the track from peer connection
                    if (mediaContext[channel][AppConstants.TRACK_SENDER]) {
                        webrtcContext[AppConstants.CONNECTION].removeTrack(mediaContext[channel][AppConstants.TRACK_SENDER]);
                    }
                    this.cleanMediaStreamContext(channel, mediaContext[channel]);
                }
            });

            //make media context empty
            webrtcContext[AppConstants.MEDIA_CONTEXT] = {};
            this.coreWebrtcService.cleanRTCPeerConnection(webrtcContext[AppConstants.CONNECTION]);
            webrtcContext[AppConstants.CONNECTION] = undefined;
            webrtcContext[AppConstants.CONNECTION_STATE] = AppConstants.CONNECTION_STATES.NOT_CONNECTED;
            resolve();
        });
    }

    /**
     * this will stop any ongoing media streaming for provided channel and clean the corresponding channel context
     *
     * @param channel type of media i.e audio, video, screen or sound
     * 
     * @param mediaChannelContext media channel context
     */
    cleanMediaStreamContext(channel: string, mediaChannelContext: any) {
        return new Promise<void>((resolve, reject) => {
            try {

                if (mediaChannelContext) {

                    // stop media track capturing
                    if (mediaChannelContext[AppConstants.TRACK]) {
                        mediaChannelContext[AppConstants.TRACK].stop();
                    }

                    // /**
                    //  * configure appropriate flags in media call context
                    //  */
                    // if (channel === AppConstants.SCREEN || channel === AppConstants.VIDEO) {
                    //     this.talkWindowContextService.updateBindingFlag('haveLocalVideoStream', false, channel);
                    //     this.talkWindowContextService.updateBindingFlag('haveRemoteVideoStream', false, channel);
                    // } else if (channel === AppConstants.SOUND || channel === AppConstants.AUDIO) {
                    //     this.talkWindowContextService.updateBindingFlag('haveLocalAudioStream', false, channel);
                    //     this.talkWindowContextService.updateBindingFlag('haveRemoteAudioStream', false, channel);
                    // }
                    /**
                     * @TODO see if this even needed
                     */
                    this.appUtilService.appRef.tick();
                }

                //remove any of the popup context
                this.appUtilService.removePopupContext([AppConstants.POPUP_TYPE.CONNECTING + channel]);
                resolve();
            } catch (error) {
                LoggerUtil.log('there is an error occured while cleaning media channel context for channel: ' + channel);
                reject(error);
            }
        });
    }

    /**
     * this will clean the data channel for provided channel and clean the corresponding channel context
     *
     * @param channel type of media i.e audio, video, screen or sound
     * 
     * @param mediaChannelContext media channel context
     * 
     */
    cleanDataChannelContext(channel: string, mediaChannelContext: string) {
        return new Promise<void>((resolve, reject) => {
            try {
                if (mediaChannelContext && mediaChannelContext[AppConstants.DATACHANNEL]) {
                    this.coreWebrtcService.cleanDataChannel(mediaChannelContext[AppConstants.DATACHANNEL]);
                    mediaChannelContext[AppConstants.DATACHANNEL] = undefined;
                    mediaChannelContext[AppConstants.CONNECTION_STATE] = AppConstants.CONNECTION_STATES.NOT_CONNECTED;

                    if (channel === AppConstants.REMOTE_CONTROL) {
                        /**
                         * if user is accessing remote machine then remove all the event listners 
                         * remove all event listeners from canvas
                         */
                        // if (this.talkWindowContextService.bindingFlags.isAccessingRemote) {
                        //     this.talkWindowContextService.bindingFlags.isAccessingRemote = false;
                        //     this.appUtilService.removeRemoteAccessEventListeners(this.talkWindowContextService.canvasUnlistenFunctions);
                        // }

                        // if (this.talkWindowContextService.bindingFlags.haveSharedRemoteAccess) {
                        //     this.talkWindowContextService.bindingFlags.haveSharedRemoteAccess = false;
                        // }
                    }
                }
                resolve();
            } catch (error) {
                LoggerUtil.log('there is an error occured while cleaning data channel context for channel: ' + channel);
                reject(error);
            }
        });
    }

    /**
     * 
     * @TODO this method will be moved afterwards, right now it's just for testing
     * 
     */
    createUserGoup() {
        const signalingMessage: BaseSignalingMessage = {
            channel: MediaChannelType.CONNECTION,
            from: this.userContextService.username,
            to: AppConstants.MEDIA_SERVER,
            type: SignalingMessageType.CREATE_GROUP,
            userGroup: 'default-group',
            userType: UserType.GROUP_CALL_USER,
        };
        this.coreDataChannelService.sendPayload(signalingMessage);
    }

    /**
     * 
     * @TODO this method will be moved afterwards, right now it's just for testing
     * 
     */
    registerUserInGroup() {
        const signalingMessage: BaseSignalingMessage = {
            channel: MediaChannelType.CONNECTION,
            from: this.userContextService.username,
            to: AppConstants.MEDIA_SERVER,
            type: SignalingMessageType.REGISTER_USER_IN_GROUP,
            userGroup: 'default-group',
            userType: UserType.GROUP_CALL_USER,
        };
        this.coreDataChannelService.sendPayload(signalingMessage);
    }
}