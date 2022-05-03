import { Injectable } from '@angular/core';
import { AppConstants } from '../AppConstants';
import { UserContextService } from '../context/user.context.service';
import { LoggerUtil } from '../logging/LoggerUtil';
import { CoreMediaCaptureService } from '../media-capture/core-media-capture.service';
import { CoreAppUtilityService } from '../util/core-app-utility.service';

@Injectable({
  providedIn: 'root'
})
export class CoreWebrtcService {

  constructor(
    private userContextService: UserContextService,
    private coreAppUtilService: CoreAppUtilityService,
    private coreMediaCaptureService: CoreMediaCaptureService
  ) { }

  /**
   * initializing a webrtc peer connection and store it user's webrtc connection
   *
   * @param username username of the user with whom connection has to be established
   *
   */
  rtcConnectionInit(username: string) {
    return new Promise<boolean>((resolve, reject) => {
      try {
        let initializedConnection = false;
        const webrtcContext = this.userContextService.getUserWebrtcContext(username);

        let connectionStatus = webrtcContext[AppConstants.CONNECTION_STATE];
        /**
         *
         * @TODO Fix this flow afterwards
         *
         */
        if (connectionStatus === AppConstants.CONNECTION_STATES.NOT_CONNECTED) {
          initializedConnection = true;
          //initialize a new webrtc peer connection
          webrtcContext[AppConstants.CONNECTION] = new RTCPeerConnection(AppConstants.STUN_CONFIG);
          webrtcContext[AppConstants.CONNECTION_STATE] = AppConstants.CONNECTION_STATES.NOT_CONNECTED;
        }
        resolve(initializedConnection);
      } catch (error) {
        LoggerUtil.logAny(error);
        reject('there is an error while initializing peer connection');
      }
    });
  }

  /**
   * initializing a webrtc peer connection and store it user's webrtc connection
   *
   * @param channel webrtc cnonection's media type for connection means the type
   * of media data that we will relay on this connection e.g 'text','video' or 'audio'
   *
   * @param username username of the user with whom connection has to be established
   *
   */
  mediaContextInit(channel: string, username: string): void {

    const webrtcContext: any = this.userContextService.getUserWebrtcContext(username);

    /**
     * initialize empty connections container if it does not exist yet
     *
     */
    if (webrtcContext[AppConstants.MEDIA_CONTEXT][channel] === undefined) {
      webrtcContext[AppConstants.MEDIA_CONTEXT][channel] = {};

      /**
       *
       * @TODO refactor it afterwards
       */
      if (channel === AppConstants.TEXT || channel === AppConstants.FILE || channel === AppConstants.REMOTE_CONTROL) {
        webrtcContext[AppConstants.MEDIA_CONTEXT][channel][AppConstants.CONNECTION_STATE] = AppConstants.CONNECTION_STATES.NOT_CONNECTED;
      }
    }

    if (channel === AppConstants.FILE) {
      if (webrtcContext[AppConstants.MEDIA_CONTEXT][channel][AppConstants.IMAGE] === undefined) {
        webrtcContext[AppConstants.MEDIA_CONTEXT][channel][AppConstants.IMAGE] = [];
        webrtcContext[AppConstants.MEDIA_CONTEXT][channel][AppConstants.AUDIO] = [];
        webrtcContext[AppConstants.MEDIA_CONTEXT][channel][AppConstants.VIDEO] = [];
        webrtcContext[AppConstants.MEDIA_CONTEXT][channel][AppConstants.GENERIC_FILE] = [];
        webrtcContext[AppConstants.MEDIA_CONTEXT][channel][AppConstants.LAST_USED] = undefined;
        webrtcContext[AppConstants.MEDIA_CONTEXT][channel][AppConstants.RECURRING_JOB_ID] = undefined;
      }
    }
  }

  /**
   * handle the processing of 'answer' type message received
   * @param signalingMessage received signaling message
   */
  async handleAnswer(signalingMessage: any): Promise<void> {
    const peerConnection: RTCPeerConnection = this.userContextService.getUserWebrtcContext(signalingMessage.from)[AppConstants.CONNECTION];
    peerConnection.setRemoteDescription(new RTCSessionDescription(signalingMessage.answer));
    return;
  }

  /**
   * this will handle the processing of any 'candidate' type message received
   * @param signalingMessage received signaling message
   */
  async handleCandidate(signalingMessage: any): Promise<void> {
    const peerConnection: RTCPeerConnection = this.userContextService.getUserWebrtcContext(signalingMessage.from)[AppConstants.CONNECTION];
    peerConnection.addIceCandidate(new RTCIceCandidate(signalingMessage.candidate));
    return;
  }

  /**
   * this will generate appropriate offer on provided webrtc peer connection on
   * the basis of supplied media type
   *
   * @param peerConnection webrtc peer connection for which offer has to be generated
   *
   * @param channel channel for generating webrtc offer
   *
   * @param requiredMediaTracks required media tracks which needs to captured and has to be added on the peer connection
   *
   * @return a promise containing generated offer payload
   *
   */
  generateOfferWithMediaTracks(peerConnection: any, channel: string, requiredMediaTracks: string[]) {
    return new Promise(async (resolve, reject) => {
      try {
        const mediaStreams: any[] = [];
        for (let i = 0; i < requiredMediaTracks.length; i++) {

          /**
           *
           * @TODO check for individual stream error here and build the resolve response accordingly
           */
          const stream: any = await this.coreMediaCaptureService.getMediaStream(requiredMediaTracks[i]);
          const streamContext: any = {};
          streamContext[AppConstants.STREAM] = stream;
          /**
           *
           * add media stream track on the webrtc peer connecion
           */
          switch (requiredMediaTracks[i]) {
            case AppConstants.AUDIO:
              streamContext[AppConstants.TRACK] = stream.getAudioTracks()[0];
              streamContext[AppConstants.TRACK_SENDER] = peerConnection.addTrack(stream.getAudioTracks()[0]);
              break;
            case AppConstants.SOUND:
              streamContext[AppConstants.TRACK] = stream.getAudioTracks()[0];
              streamContext[AppConstants.TRACK_SENDER] = peerConnection.addTrack(stream.getAudioTracks()[0]);
              break;
            default:
              streamContext[AppConstants.TRACK] = stream.getVideoTracks()[0];
              streamContext[AppConstants.TRACK_SENDER] = peerConnection.addTrack(stream.getVideoTracks()[0]);
          }
          streamContext[AppConstants.CHANNEL] = requiredMediaTracks[i];
          mediaStreams.push(streamContext);
        }
        peerConnection.createOffer().then((offer: any) => {
          peerConnection.setLocalDescription(offer);
          resolve({
            offerPayload: {
              type: AppConstants.OFFER,
              offer: offer,
              channel: channel
            },
            mediaStreams: mediaStreams
          });
        }).catch((error: any) => {
          LoggerUtil.logAny('There is an error while generating offer on peer connection.');
          reject(error);
        });
      } catch (error) {
        LoggerUtil.logAny('There is an error while generating offer on peer connection');
        reject(error);
      }
    });
  }

  /**
   * this will open a data channel on the webrtc peer connection and then
   * generate an offer after that
   *
   * @param peerConnection webrtc peer connection for which offer has to be generated
   *
   * @param mediaChannel webrtc connection's media type for connection means the
   * type of media data that we will relay on this connection e.g 'text','video'
   * or 'audio'
   *
   * @return a promise containing generated offer payload
   *
   */
  public getDataChannelOffer(peerConnection: any, mediaChannel: string) {
    return new Promise(async (resolve, reject) => {
      /**
       * open data channe here
       */
      const dataChannel = await this.openDataChannel(peerConnection, mediaChannel);
      peerConnection.createOffer().then((offer: any) => {
        peerConnection.setLocalDescription(offer);
        resolve({
          offerPayload: {
            type: AppConstants.OFFER,
            offer: offer,
            channel: mediaChannel
          },
          dataChannel: dataChannel
        });
      }).catch((error: any) => {
        LoggerUtil.logAny('There is an error while generating offer on peer connection.');
        reject(error);
      });
    });
  }

  /**
   * this will generate appropriate answer on provided webrtc peer connection on
   * the basis of supplied media type
   *
   * @param offer received webrtc offer
   *
   * @param peerConnection webrtc peer connection for which answer has to be generated
   *
   * @param mediaChannel webrtc connection's media type for connection means the
   * type of media data that we will relay on this connection e.g 'text','video'
   * or 'audio'
   *
   * @return a promise with generated answer
   */
  generateAnswer(peerConnection: any, offer: RTCSessionDescriptionInit, mediaChannel: string) {
    return new Promise((resolve, reject) => {
      peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      peerConnection.createAnswer().then(async (newAnswer: any) => {

        /**
         * before setting local session description on webrtc peer connection, app
         * will modify the max bitrate that webrtc peer connection can use
         *
         */
        const maxBitrate = this.coreAppUtilService.getMaxBitrateForSdpModification(mediaChannel);
        const sdpMediaType = this.coreAppUtilService.getMediaTypeForSdpModification(mediaChannel);
        const modifiedSdp: any = await this.setMediaBitrate(newAnswer.sdp, sdpMediaType, maxBitrate);
        const answer: any = new RTCSessionDescription({ type: 'answer', sdp: modifiedSdp });

        peerConnection.setLocalDescription(answer);
        resolve({
          answerPayload: {
            type: AppConstants.ANSWER,
            answer: answer,
            channel: mediaChannel
          }
        });
      }).catch((error: any) => {
        LoggerUtil.logAny('there is an error while generating answer');
        reject(error);
      }); // Here ends create answer
    });
  }

  /**
  * this will generate appropriate answer on provided webrtc peer connection on
  * the basis of supplied media type
  *
  * @param offer received webrtc offer
  *
  * @param peerConnection webrtc peer connection for which answer has to be generated
  *
  * @param mediaChannel media channel for which the webrtc answer needs to be generated
  *
  * @param requiredMediaTracks required media tracks which needs to be captured and added on webrtc connection
  *
  * @return a promise with generated answer
  */
  generateAnswerWithTracks(peerConnection: any, offer: RTCSessionDescriptionInit, channel: string, requiredMediaTracks: string[]) {
    return new Promise(async (resolve, reject) => {
      peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const mediaStreams: any[] = [];
      for (let i = 0; i < requiredMediaTracks.length; i++) {
        const stream: any = await this.coreMediaCaptureService.getMediaStream(requiredMediaTracks[i]);
        const streamContext: any = {};
        streamContext[AppConstants.STREAM] = stream;
        /**
         *
         * add media stream track on the webrtc peer connecion
         */
        switch (requiredMediaTracks[i]) {
          case AppConstants.AUDIO:
            streamContext[AppConstants.TRACK] = stream.getAudioTracks()[0];
            streamContext[AppConstants.TRACK_SENDER] = peerConnection.addTrack(stream.getAudioTracks()[0]);
            break;
          case AppConstants.SOUND:
            streamContext[AppConstants.TRACK] = stream.getAudioTracks()[0];
            streamContext[AppConstants.TRACK_SENDER] = peerConnection.addTrack(stream.getAudioTracks()[0]);
            break;
          default:
            streamContext[AppConstants.TRACK] = stream.getVideoTracks()[0];
            streamContext[AppConstants.TRACK_SENDER] = peerConnection.addTrack(stream.getVideoTracks()[0]);
        }
        streamContext[AppConstants.CHANNEL] = requiredMediaTracks[i];
        mediaStreams.push(streamContext);
      }

      peerConnection.createAnswer().then(async (newAnswer: any) => {

        /**
         * before setting local session description on webrtc peer connection, app
         * will modify the max bitrate that webrtc peer connection can use
         *
         */
        const maxBitrate = this.coreAppUtilService.getMaxBitrateForSdpModification(channel);
        const sdpMediaType = this.coreAppUtilService.getMediaTypeForSdpModification(channel);
        const modifiedSdp: any = await this.setMediaBitrate(newAnswer.sdp, sdpMediaType, maxBitrate);
        const answer: any = new RTCSessionDescription({ type: 'answer', sdp: modifiedSdp });

        peerConnection.setLocalDescription(answer);
        resolve({
          answerPayload: {
            type: AppConstants.ANSWER,
            answer: answer,
            channel: channel
          },
          mediaStreams: mediaStreams
        });
      }).catch((error: any) => {
        LoggerUtil.logAny('there is an error while generating answer');
        reject(error);
      }); // Here ends create answer
    });
  }

  /**
   * this will open a data channel on supplied webrtc peer connection
   *
   * @param peerConnection webrtc peer connection on data channel has to be opened
   *
   * @param channelId webrtc data channel id
   *
   * @return newly opened webrtc datachannel
   */
  openDataChannel(peerConnection: any, channelId: string) {
    return new Promise((resolve, reject) => {
      try {
        if (peerConnection == null) {
          reject('peer connection is not yet initialized to open data channel');
        }
        const dataChannel = peerConnection.createDataChannel(channelId);
        dataChannel.onerror = (error: any) => {
          LoggerUtil.logAny(error);
        };
        resolve(dataChannel);
      } catch (error) {
        reject('opening datachannel failed');
      }
    });
  }

  /**
   * this is just cleanup subroutine for cleaning any webrtc peer connection
   *
   * @param peerConnection webrtc peer connection that needs to be cleaned
   *
   * @return a promise
   */
  cleanRTCPeerConnection(peerConnection: any) {
    return new Promise<void>((resolve) => {
      peerConnection.ondatachannel = null;
      peerConnection.ontrack = null;
      peerConnection.onicecandidate = null;
      peerConnection.onconnectionstatechange = null;
      peerConnection.onsignalingstatechange = null;
      peerConnection.onnegotiationneeded = null;
      peerConnection.close();
      resolve();
    });
  }

  /**
   * this is just cleanup subroutine for cleaning any webrtc data channel
   *
   * @param dataChannel webrtc data channel that needs to be reset
   *
   * @return a promise
   */
  cleanDataChannel(dataChannel: any) {
    return new Promise<void>((resolve) => {
      dataChannel.onerror = null;
      dataChannel.onmessage = null;
      dataChannel.close();
      resolve();
    });
  }

  /**
   * this is a webrc sdp parsing logic to set the max bitrate that webrtc connection
   * can use
   *
   * @param sdp webrtc sdp that needed to be updated
   *
   * @param media type of media for which bitrate has to be set i.e 'audio' or 'video'
   *
   * @param bitrate max bitrate that to be set
   *
   * @return a promise with updated sdp
   */
  setMediaBitrate(sdp: any, media: string, bitrate: number) {
    return new Promise((resolve) => {
      let lines = sdp.split('\n');
      let line = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].indexOf('m=' + media) === 0) {
          line = i;
          break;
        }
      }
      if (line === -1) {
        LoggerUtil.logAny('Could not find the m line for: ' + media);
        resolve(sdp);
      }
      LoggerUtil.logAny('Found the m line for: ' + media + ' at line: ' + line);
      line++;
      while (lines[line].indexOf('i=') === 0 || lines[line].indexOf('c=') === 0) {
        line++;
      }
      if (lines[line].indexOf("b") === 0) {
        //LoggerUtil.log('Replaced b line at line: ' + line);
        lines[line] = 'b=AS:' + bitrate;
        resolve(lines.join('\n'));
      }
      //LoggerUtil.log('Adding new b line before line: ' + line);
      let newLines = lines.slice(0, line);
      newLines.push('b=AS:' + bitrate);
      newLines = newLines.concat(lines.slice(line, lines.length));
      resolve(newLines.join('\n'));
    });
  }
}
