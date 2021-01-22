import { Injectable } from '@angular/core';
import { AppConstants } from '../AppConstants';
import { UserContextService } from '../context/user.context.service';
import { LoggerUtil } from '../logging/LoggerUtil';
import { CoreAppUtilityService } from '../util/core-app-utility.service';

@Injectable({
  providedIn: 'root'
})
export class CoreWebrtcService {

  constructor(
    private userContextService: UserContextService,
    private coreAppUtilService: CoreAppUtilityService) { }

  /**
   * initializing a webrtc peer connection and store it user's webrtc connection
   *
   * @param channel webrtc cnonection's media type for connection means the type
   * of media data that we will relay on this connection e.g 'text','video' or 'audio'
   *
   * @param username username of the user with whom connection has to be established
   *
   * @param needSender boolean value to determine whether sender or receive peer
   * connection has to be initialized. Applicable only for media webrtc connection
   * i.e connections other than 'data' or 'file'
   *
   */
  rtcConnectionInit(channel: string, username: string, needSendPeer: boolean) {
    return new Promise<void>((resolve, reject) => {
      try {
        const PeerConnection = RTCPeerConnection || webkitRTCPeerConnection;
        const userContext = this.userContextService.getUserWebrtcContext(username);

        /**
         * initialize empty connections container if it does not exist yet
         *
         */
        if (userContext[AppConstants.CONNECTIONS][channel] === undefined) {
          userContext[AppConstants.CONNECTIONS][channel] = {};
        }

        const connectionType: string = this.coreAppUtilService.getConnectionIdentifier(channel, needSendPeer);

        //initialize a new webrtc peer connection
        userContext[AppConstants.CONNECTIONS][channel][connectionType] = new PeerConnection(AppConstants.STUN_CONFIG);

        /**
         * 
         * @TODO optimize switch statements here
         * 
         */
        switch (channel) {
          case AppConstants.DATA:
            userContext[AppConstants.CONNECTIONS][channel].state = AppConstants.CHANNEL_STATUS.NEW;
            userContext[AppConstants.CONNECTIONS][channel][AppConstants.DATACHANNEL] = undefined;
            break;

          case AppConstants.FILE:
            userContext[AppConstants.CONNECTIONS][channel].state = AppConstants.CHANNEL_STATUS.NEW;
            userContext[AppConstants.CONNECTIONS][channel][AppConstants.DATACHANNEL] = undefined;
            userContext[AppConstants.CONNECTIONS][channel][AppConstants.IMAGE] = [];
            userContext[AppConstants.CONNECTIONS][channel][AppConstants.AUDIO] = [];
            userContext[AppConstants.CONNECTIONS][channel][AppConstants.VIDEO] = [];
            userContext[AppConstants.CONNECTIONS][channel][AppConstants.LAST_USED] = undefined;
            userContext[AppConstants.CONNECTIONS][channel][AppConstants.RECURRING_JOB_ID] = undefined;
            break;

          case AppConstants.REMOTE_CONTROL:
            userContext[AppConstants.CONNECTIONS][channel].state = AppConstants.CHANNEL_STATUS.NEW;
            userContext[AppConstants.CONNECTIONS][channel][AppConstants.DATACHANNEL] = undefined;
            break;

          default:
          //do nothing here
        }
        resolve();
      } catch (error) {
        LoggerUtil.log('there is an error while initializing peer connection');
        reject(error);
      }
    });
  }

  /**
   * this will handle the processing of any 'answer' type message received
   *
   * @param signalingMessage received signaling message
   *
   */
  handleAnswer(signalingMessage: any) {
    return new Promise<void>(async (resolve) => {
      const peerConnection = await this.coreAppUtilService
        .getAppropriatePeerConnection(signalingMessage.from, signalingMessage.channel, true);
      // set remote description on peer connection
      peerConnection.setRemoteDescription(new RTCSessionDescription(signalingMessage.answer));
      resolve();
    });
  }

  /**
   * this will handle the processing of any 'offer' type message received
   *
   * @param signalingMessage received signaling message
   *
   */
  async handleOffer(signalingMessage: any) {
    const peerConnection = await this.coreAppUtilService
      .getAppropriatePeerConnection(signalingMessage.from, signalingMessage.channel, false);
    return this.generateAnswer(peerConnection, signalingMessage.offer, signalingMessage.channel);
  }

  /**
   * this will handle the processing of any 'candidate' type message received
   *
   * @param signalingMessage received signaling message
   *
   */
  handleCandidate(signalingMessage: any) {
    return new Promise<void>(async (resolve) => {
      const peerConnection: any = await this.coreAppUtilService.getAppropriatePeerConnection(signalingMessage.from,
        signalingMessage.channel, !signalingMessage.isSender);
      // set ice candidate on peer connection
      peerConnection.addIceCandidate(new RTCIceCandidate(signalingMessage.candidate));
      resolve();
    });
  }

  /**
   * this will generate appropriate offer on provided webrtc peer connection on
   * the basis of supplied media type
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
  generateOffer(peerConnection: any, mediaChannel: string) {
    return new Promise(async (resolve, reject) => {
      try {
        /**
         * @TODO convert to switch statement later afterwards
         */
        if (mediaChannel === AppConstants.DATA || mediaChannel === AppConstants.FILE || mediaChannel === AppConstants.REMOTE_CONTROL) {
          const offerPayload = await this.getDataChannelOffer(peerConnection, mediaChannel);
          resolve(offerPayload);
        } else {
          const stream: any = await this.getMediaStream(mediaChannel);
          const offerPayload = await this.getMediaStreamOffer(peerConnection, stream, mediaChannel);
          resolve(offerPayload);
        }
      } catch (error) {
        LoggerUtil.log('There is an error while generating offer on peer connection');
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
  private getDataChannelOffer(peerConnection: any, mediaChannel: string) {
    return new Promise(async (resolve, reject) => {
      /**
       * open data channe here
       */
      const dataChannel = await this.openDataChannel(peerConnection);
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
        LoggerUtil.log('There is an error while generating offer on peer connection.');
        reject(error);
      });
    });
  }

  /**
   * this will attach a media stream on the webrtc peer connection and then
   * generate an offer after that
   *
   * @param peerConnection webrtc peer connection for which offer has to be generated
   *
   * @param mediaStream captured media stream that needs to be attached
   *
   * @param mediaChannel webrtc connection's media type for connection means the
   * type of media data that we will relay on this connection e.g 'text','video'
   * or 'audio'
   *
   * @return a promise containing generated offer payload
   */
  private getMediaStreamOffer(peerConnection: any, mediaStream: any, mediaChannel: string) {
    return new Promise((resolve, reject) => {
      switch (mediaChannel) {
        case AppConstants.AUDIO:
          peerConnection.addTrack(mediaStream.getAudioTracks()[0]);
          break;
        case AppConstants.SOUND:
          peerConnection.addTrack(mediaStream.getAudioTracks()[0]);
          break;
        default:
          peerConnection.addTrack(mediaStream.getVideoTracks()[0]);
      }
      peerConnection.createOffer().then((offer: any) => {
        peerConnection.setLocalDescription(offer);
        resolve({
          offerPayload: {
            type: AppConstants.OFFER,
            offer: offer,
            channel: mediaChannel
          },
          stream: mediaStream
        });
      }).catch((error: any) => {
        LoggerUtil.log('There is an error while generating offer on peer connection.');
        reject(error);
      });
    });
  }

  /**
   * capture appropriate media stream for supplied media type
   *
   * @param mediaChannel media type i.e 'audio', 'video' etc.
   *
   * @return captured media stream
   */
  private getMediaStream(mediaChannel: string) {
    return new Promise(async (resolve, reject) => {
      try {
        let stream: any;
        let mediaDevices: any = navigator.mediaDevices;
        let mediaContraints = await this.getMediaConstraints(mediaChannel);
        if (mediaChannel === AppConstants.SCREEN && !this.userContextService.isNativeApp) {
          stream = await mediaDevices.getDisplayMedia(mediaContraints);
          this.userContextService.screenStream = stream;
        } else if (mediaChannel === AppConstants.SOUND && !this.userContextService.isNativeApp) {
          stream = this.userContextService.screenStream;
        } else {
          stream = await mediaDevices.getUserMedia(mediaContraints);
        }
        resolve(stream);
      } catch (e) {
        // this.appUtilService.flagError('error: unable to access ' + mediaChannel + ' device');
        reject(e);
      }
    });
  }

  /**
   * retreive appropriate media constraints for get user media api to capture media
   * stream based on supplied media channel
   *
   * @param mediaChannel media type i.e 'audio', 'video' etc.
   */
  private getMediaConstraints(channel: string) {
    return new Promise((resolve) => {
      let constraints: any;
      if (channel === AppConstants.AUDIO) {
        constraints = AppConstants.AUDIO_CONSTRAINTS;
      } else if (channel === AppConstants.VIDEO && this.userContextService.isMobile) {
        constraints = AppConstants.MOBILE_CONSTRAINTS;
        constraints.video.facingMode = this.userContextService.defaultCamera;
      } else if (channel === AppConstants.VIDEO && !this.userContextService.isMobile) {
        constraints = AppConstants.VIDEO_CONSTRAINTS;
      } else if (channel === AppConstants.SCREEN) {
        if (this.userContextService.isNativeApp) {
          constraints = AppConstants.SCREEN_SHARING_CONSTRAINTS;
        } else {
          constraints = AppConstants.WEB_SCREEN_SHARING_CONSTRAINTS;
        }
      } else if (channel === AppConstants.SOUND) {
        constraints = AppConstants.SYSTEM_SOUND_CONSTRAINTS;
      }
      resolve(constraints);
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
        let answer: any = newAnswer;
        let modifiedSdp: any;

        /**
         * before setting local session description on webrtc peer connection app
         * will modify the max bitrate that webrtc peer connection can use
         *
         */
        switch (mediaChannel) {
          case AppConstants.VIDEO:
            modifiedSdp = await this.setMediaBitrate(answer.sdp, AppConstants.VIDEO,
              AppConstants.MEDIA_BITRATES.SCREEN);
            answer = new RTCSessionDescription({ type: 'answer', sdp: modifiedSdp });
            break;

          case AppConstants.SCREEN:
            modifiedSdp = await this.setMediaBitrate(answer.sdp, AppConstants.VIDEO,
              AppConstants.MEDIA_BITRATES.SCREEN);
            answer = new RTCSessionDescription({ type: 'answer', sdp: modifiedSdp });
            break;

          case AppConstants.FILE:
            modifiedSdp = await this.setMediaBitrate(answer.sdp, AppConstants.APPLICATION,
              AppConstants.MEDIA_BITRATES.FILE);
            answer = new RTCSessionDescription({ type: 'answer', sdp: modifiedSdp });
            break;

          case AppConstants.DATA:
            modifiedSdp = await this.setMediaBitrate(answer.sdp, AppConstants.APPLICATION,
              AppConstants.MEDIA_BITRATES.DATA);
            answer = new RTCSessionDescription({ type: 'answer', sdp: modifiedSdp });
            break;
        }

        peerConnection.setLocalDescription(answer);
        resolve({
          answerPayload: {
            type: AppConstants.ANSWER,
            answer: answer,
            channel: mediaChannel
          }
        });
      }).catch((error: any) => {
        LoggerUtil.log('there is an error while generating answer');
        reject(error);
      }); // Here ends create answer
    });
  }

  /**
   * this will open a data channel on supplied webrtc peer connection
   *
   * @param peerConnection webrtc peer connection on data channel has to be opened
   *
   * @return newly opened webrtc datachannel
   */
  openDataChannel(peerConnection: any) {
    return new Promise((resolve, reject) => {
      try {
        if (peerConnection == null) {
          reject('peer connection is not yet initialized to open data channel');
        }
        const dataChannel = peerConnection.createDataChannel('myDataChannel');
        dataChannel.onerror = (error: any) => {
          LoggerUtil.log(error);
        };
        resolve(dataChannel);
      } catch (error) {
        reject('opening datachannel failed');
      }
    });
  }

  /**
   * this is the cleanup routine for cleaning webrtc peer connections which carries
   * media data i.e 'audio' or 'video' media tracks
   *
   * @param channel webrtc connection's media type for connection means the
   * type of media data that we will relay on this connection e.g 'text','video'
   * or 'audio'
   *
   * @param mediaContext appropriate webrtc media context from user's webrtc context
   * 
   * @param isSenderConnection boolean flag to distinguish between sender and
   * receive audio/video peer connections
   *
   * @return a promise
   */
  cleanWebrtcMediaConnection(channel: string, mediaContext: any, isSenderConnection: boolean) {
    return new Promise<void>((resolve) => {
      const connectionType = this.coreAppUtilService.getConnectionIdentifier(channel, isSenderConnection);
      if (mediaContext[connectionType]) {
        LoggerUtil.log('cleaning ' + channel + ' ' + connectionType + ' connection');

        /**
         * call the webrtc peer connection cleanup routine
         */
        this.cleanRTCPeerConnection(mediaContext[connectionType], true);

        /**
         * if we're cleaning the sender webrtc peer connection then stop the
         * local stream capturing
         *
         */
        if (isSenderConnection && (!this.userContextService.isNativeApp && channel !== AppConstants.SOUND)) {
          this.stopLocalStream(mediaContext[AppConstants.STREAM]);
        }
      }
      resolve();
    });
  }

  /**
   * this will stop capturing supplied local stream
   *
   * @param stream local media stream that needs to be stoppped
   *
   */
  stopLocalStream(stream: any) {
    stream.getTracks().forEach((track: any) => {
      track.stop();
    });
  }

  /**
   * this is just cleanup subroutine for cleaning any webrtc peer connection
   *
   * @param peerConnection webrtc peer connection that needs to be cleaned
   *
   * @param isMediaConnection flag to specify if the connection that needs to be
   * cleaned was meant to carry media data i.e 'audio' or 'video' media stream tracks
   *
   * @return a promise
   */
  cleanRTCPeerConnection(peerConnection: any, isMediaConnection: boolean) {
    return new Promise<void>((resolve) => {
      if (isMediaConnection) {
        peerConnection.ontrack = null;
      }
      peerConnection.onicecandidate = null;
      peerConnection.onconnectionstatechange = null;
      peerConnection.close();
      peerConnection = null;
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
    return new Promise(() => {
      dataChannel.onerror = null;
      dataChannel.onmessage = null;
      dataChannel.close();
      dataChannel = null;
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
        LoggerUtil.log('Could not find the m line for: ' + media);
        resolve(sdp);
      }
      LoggerUtil.log('Found the m line for: ' + media + ' at line: ' + line);
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
