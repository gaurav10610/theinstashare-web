import { EventEmitter, Injectable } from "@angular/core";
import { AppConstants } from "../AppConstants";
import { UserContextService } from "../context/user.context.service";
import { CallbackContextType } from "../contracts/CallbackContextType";
import { ComponentServiceSpec } from "../contracts/component/ComponentServiceSpec";
import { CreateDataChannelType } from "../contracts/CreateDataChannelType";
import { DataChannelInfo } from "../contracts/datachannel/DataChannelInfo";
import { ConnectionStateChangeContext } from "../contracts/event/ConnectionStateChangeContext";
import { CoreDataChannelService } from "../data-channel/core-data-channel.service";
import { LoggerUtil } from "../logging/LoggerUtil";
import { FileTransferUtilityService } from "../util/file-transfer-utility.service";
import { CoreWebrtcService } from "./core-webrtc.service";

@Injectable({
  providedIn: "root",
})
export class FileTransferService implements ComponentServiceSpec {
  onDataChannelMessageEvent: EventEmitter<any>;
  onDataChannelReceiveEvent: EventEmitter<DataChannelInfo>;
  onWebrtcConnectionStateChangeEvent: EventEmitter<ConnectionStateChangeContext>;

  fileIconsMapping: object = {
    generic: "generic_file_icon",
    pdf: "pdf_file_icon",
    image: "image_file_icon",
    video: "video_file_icon",
    audio: "audio_file_icon",
    text: "text_file_icon",
    zip: "zip_file_icon",
  };

  constructor(
    private userContextService: UserContextService,
    private coreWebrtcService: CoreWebrtcService,
    private coreDataChannelService: CoreDataChannelService,
    private utilityService: FileTransferUtilityService
  ) {
    this.onDataChannelMessageEvent = new EventEmitter(true);
    this.onDataChannelReceiveEvent = new EventEmitter(true);
    this.onWebrtcConnectionStateChangeEvent = new EventEmitter(true);
  }

  /**
   * get appropriate icon for a file type
   * @param fileName name of the file
   * @returns
   */
  getMappedFileIcon(fileName: string): string {
    const fileExtension: string = fileName.split('.').pop();
    let fileCategory: string = "generic";

    for (const knownCategory of Object.keys(AppConstants.SUPPORTED_FILES)) {
      let index =
        AppConstants.SUPPORTED_FILES[knownCategory].indexOf(fileExtension);
      if (index > -1) {
        fileCategory = knownCategory;
        break;
      }
    }
    return this.fileIconsMapping[fileCategory];
  }

  /**
   * register all webrtc listeners on peer connection for a user
   * @param peerConnection
   * @param username
   * @returns
   */
  async registerWebrtcEventListeners(
    peerConnection: RTCPeerConnection,
    username: string
  ): Promise<void> {
    this.registerCommonWebrtcEvents(peerConnection, username);
    this.registerSignalingStateChangeTrackEvent(peerConnection, username);
    this.registerDataChannelEvents(peerConnection, username);
    this.registerMediaTrackEvents(peerConnection, username);
    return;
  }

  registerCommonWebrtcEvents(
    peerConnection: RTCPeerConnection,
    username: string
  ): void {
    peerConnection.onnegotiationneeded = async () => {
      LoggerUtil.logAny(`${username} webrtc connection needs renegotiation`);
    };

    peerConnection.onconnectionstatechange = async () => {
      LoggerUtil.logAny(
        `${username} webrtc connection state change: ${peerConnection.connectionState}`
      );
      if (
        peerConnection.connectionState === "connected" ||
        peerConnection.connectionState === "disconnected"
      ) {
        this.onWebrtcConnectionStateChangeEvent.emit({
          connectionState: peerConnection.connectionState,
          username,
        });
      }
    };

    /**
     * handle ice candidate event
     *
     * compose the 'candidate' type signaling message using the generated
     * candidate and send it to the other user
     */
    peerConnection.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      if (event.candidate) {
        const iceCandidatePayload = {
          type: AppConstants.CANDIDATE,
          candidate: event.candidate,
          from: this.userContextService.username,
          to: username,
          channel: AppConstants.CONNECTION,
        };
        this.coreDataChannelService.sendPayload(iceCandidatePayload);
      }
    };
  }

  registerSignalingStateChangeTrackEvent(
    peerConnection: RTCPeerConnection,
    username: string
  ): void {
    peerConnection.onsignalingstatechange = () => {
      LoggerUtil.logAny(
        `${username} webrtc connection signaling state: ${peerConnection.signalingState}`
      );
      const webrtcContext: any =
        this.userContextService.getUserWebrtcContext(username);
      switch (peerConnection.signalingState) {
        /**
         *
         * There is no ongoing exchange of offer and answer underway. This may mean that the RTCPeerConnection
         * object is new, in which case both the localDescription and remoteDescription are null; it may also mean
         * that negotiation is complete and a connection has been established
         *
         */
        case "stable":
          /**
           * make the connection status as 'connected' in the user's webrtc context
           */
          webrtcContext[AppConstants.CONNECTION_STATE] =
            AppConstants.CONNECTION_STATES.CONNECTED;

          /**
           * execute all the callback functions wih provided callback context
           */
          while (
            !webrtcContext[AppConstants.WEBRTC_ON_CONNECT_QUEUE].isEmpty()
          ) {
            const callback: CallbackContextType = <CallbackContextType>(
              webrtcContext[AppConstants.WEBRTC_ON_CONNECT_QUEUE].dequeue()
            );
            try {
              callback.callbackFunction(callback.callbackContext);
            } catch (e) {
              LoggerUtil.logAny(e);
            }
          }
          break;
      }
    };
  }

  registerDataChannelEvents(
    peerConnection: RTCPeerConnection,
    username: string
  ): void {
    peerConnection.ondatachannel = (event: RTCDataChannelEvent) => {
      /**
       * when a remote data channel is received then set it in user's webrtc context
       */
      const dataChannel: RTCDataChannel = event.channel;
      const channel: string = dataChannel.label;
      this.coreWebrtcService.mediaContextInit(channel, username);
      LoggerUtil.logAny(`${channel} data channel has been received`);
      const webrtcContext: any =
        this.userContextService.getUserWebrtcContext(username);
      webrtcContext[AppConstants.MEDIA_CONTEXT][channel][
        AppConstants.DATACHANNEL
      ] = dataChannel;

      /**
       * register onmessage listener on received data channel
       */
      dataChannel.onmessage = (msgEvent: MessageEvent) => {
        this.onDataChannelMessageEvent.emit(msgEvent.data);
      };

      LoggerUtil.logAny(
        `message listener registered on received ${channel} data channel`
      );

      /**
       * if this data channel is meant for sending text messages then register
       * an onopen listner also which will send any queued text messages
       *
       */
      dataChannel.onopen = () => {
        LoggerUtil.logAny(`${channel} data channel has been opened`);

        /**
         * send onopen data channel event message to other peer
         */
        this.coreDataChannelService.sendPayload({
          type: AppConstants.WEBRTC_EVENT,
          channel: channel,
          event: AppConstants.WEBRTC_EVENTS.CHANNEL_OPEN,
          from: this.userContextService.username,
          to: username,
        });

        webrtcContext[AppConstants.MEDIA_CONTEXT][channel][
          AppConstants.CONNECTION_STATE
        ] = AppConstants.CONNECTION_STATES.CONNECTED;
        if (channel === AppConstants.TEXT) {
          this.onDataChannelReceiveEvent.emit({
            channel,
            channelOpenedWith: username,
            channelOpenAt: new Date(),
          });
        }
      };
    };
  }

  registerMediaTrackEvents(
    peerConnection: RTCPeerConnection,
    username: string
  ): void {
    /**
     * @NOTE - Not to be implemented by file transfer application
     **/
    return;
  }

  /**
   * setup datachannel with a user
   * @param createDataChannelType create data channel request type
   */
  async setUpDataChannel(
    createDataChannelType: CreateDataChannelType
  ): Promise<void> {
    this.userContextService.initializeUserWebrtcContext(
      createDataChannelType.username
    );
    this.coreWebrtcService.mediaContextInit(
      createDataChannelType.channel,
      createDataChannelType.username
    );
    const webrtcContext: any = this.userContextService.getUserWebrtcContext(
      createDataChannelType.username
    );

    /**
     * mark data channel state as connecting for provided channel in user's webrtc media context
     */
    webrtcContext[AppConstants.MEDIA_CONTEXT][createDataChannelType.channel][
      AppConstants.CONNECTION_STATE
    ] = AppConstants.CONNECTION_STATES.CONNECTING;
    if (
      webrtcContext[AppConstants.CONNECTION_STATE] ===
      AppConstants.CONNECTION_STATES.CONNECTED
    ) {
      const peerConnection: RTCPeerConnection =
        webrtcContext[AppConstants.CONNECTION];
      /**
       *
       * generate the appropriate 'offer' for sending it to the other user
       *
       * 'offerContainer' will contain the genrated offer sdp and few other
       * properties which app utilizes to compose an offer signaling message
       * to be sent to other user
       *
       */
      const offerContainer: any =
        await this.coreWebrtcService.getDataChannelOffer(
          peerConnection,
          createDataChannelType.channel
        );
      const dataChannel: RTCDataChannel = offerContainer.dataChannel;
      LoggerUtil.logAny(
        `registered message listener on ${createDataChannelType.channel} data channel`
      );

      // remote datachannel onmessage listener
      dataChannel.onmessage = (msgEvent: any) => {
        this.onDataChannelMessageEvent.emit(msgEvent.data);
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
        renegotiate: true,
      });

      /**
       * set the datachannel in user's webrtc context
       */
      webrtcContext[AppConstants.MEDIA_CONTEXT][createDataChannelType.channel][
        AppConstants.DATACHANNEL
      ] = dataChannel;
    } else {
      LoggerUtil.logAny(
        `webrtc connection is not in connected state for user: ${createDataChannelType.username}`
      );
      /**
       * if webrtc connection is not in connetcted state then add the setup data channel function
       * along with the calling context in the webrtc on connect queue
       */
      const webrtcCallbackContextType: CallbackContextType = {
        callbackFunction: this.setUpDataChannel.bind(this),
        callbackContext: createDataChannelType,
      };
      webrtcContext[AppConstants.WEBRTC_ON_CONNECT_QUEUE].enqueue(
        webrtcCallbackContextType
      );
      if (
        webrtcContext[AppConstants.CONNECTION_STATE] ===
        AppConstants.CONNECTION_STATES.NOT_CONNECTED
      ) {
        this.setUpWebrtcConnection(createDataChannelType.username);
      }
    }
  }

  /**
   * this will setup a webrtc connection with provided user
   *
   * @param username username of the user with whom webrtc connection have to be established
   * @param offerMessage this is an optional offer signaling message
   */
  async setUpWebrtcConnection(
    username: string,
    offerMessage?: any
  ): Promise<void> {
    LoggerUtil.logAny(
      `setting up new webrtc connection with user: ${username}`
    );
    this.userContextService.initializeUserWebrtcContext(username);
    const webrtcContext: any =
      this.userContextService.getUserWebrtcContext(username);

    if (
      webrtcContext[AppConstants.CONNECTION_STATE] ===
      AppConstants.CONNECTION_STATES.NOT_CONNECTED
    ) {
      /**
       *
       * initialize webrtc peer connection
       */
      const initializedConnection: boolean =
        await this.coreWebrtcService.rtcConnectionInit(username);

      /**
       *
       * update webrtc connection state to connecting so that not other flow can update it further
       */
      webrtcContext[AppConstants.CONNECTION_STATE] =
        AppConstants.CONNECTION_STATES.CONNECTING;
      const peerConnection: RTCPeerConnection =
        webrtcContext[AppConstants.CONNECTION];

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
        peerConnection
          .createOffer()
          .then((offer: RTCSessionDescriptionInit) => {
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
              offer: offer,
            });
          })
          .catch((error) => {
            LoggerUtil.logAny(error);
            throw Error(
              "There is an error while generating offer on peer connection"
            );
          });
      } else {
        peerConnection.setRemoteDescription(
          new RTCSessionDescription(offerMessage.offer)
        );
        peerConnection
          .createAnswer()
          .then((answer: RTCSessionDescriptionInit) => {
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
              answer: answer,
            });
          })
          .catch((error) => {
            LoggerUtil.logAny("there is an error while generating answer");
            throw Error(error);
          }); // Here ends create answer
      }
    } else {
      /**
       *
       * already in connecting/connected state so do nothing here
       */
    }
  }

  async cleanDataChannelContext(
    channel: string,
    mediaChannelContext: any
  ): Promise<void> {
    try {
      if (
        mediaChannelContext &&
        mediaChannelContext[AppConstants.DATACHANNEL]
      ) {
        this.coreWebrtcService.cleanDataChannel(
          mediaChannelContext[AppConstants.DATACHANNEL]
        );
        mediaChannelContext[AppConstants.DATACHANNEL] = undefined;
        mediaChannelContext[AppConstants.CONNECTION_STATE] =
          AppConstants.CONNECTION_STATES.NOT_CONNECTED;
      }
      return;
    } catch (error) {
      LoggerUtil.logAny(
        `error occured while cleaning data channel context for channel: ${channel}`
      );
      return;
    }
  }

  async cleanMediaStreamContext(
    channel: string,
    mediaChannelContext: any
  ): Promise<void> {
    // @NOTE - Not implemented for file transfer application
    return;
  }
}
