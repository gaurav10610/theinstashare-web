import { Injectable } from '@angular/core';
import { AppConstants } from '../AppConstants';
import { UserContextService } from '../context/user.context.service';
import { LoggerUtil } from '../logging/LoggerUtil';
import { SignalingService } from '../signaling/signaling.service';
import { CoreAppUtilityService } from '../util/core-app-utility.service';

@Injectable({
  providedIn: 'root'
})
export class CoreDataChannelService {

  constructor(
    private userContextService: UserContextService,
    private coreAppUtilService: CoreAppUtilityService,
    private signalingService: SignalingService,
  ) { }

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
      signalingMessage['via'] = 'dataChannel';
      this.sendMessageOnDataChannel({
        from: signalingMessage.from,
        to: signalingMessage.to,
        type: AppConstants.SIGNALING,
        message: signalingMessage
      }, AppConstants.TEXT);
    } else {

      /**
       * if there is no open data channel found then just route/send message via
       * signaling server
       *
       */
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
      const webrtcContext: any = this.userContextService.getUserWebrtcContext(jsonMessage.to);
      webrtcContext[AppConstants.MEDIA_CONTEXT][channel][AppConstants.DATACHANNEL].send(JSON.stringify(jsonMessage));
    } catch (e) {
      LoggerUtil.log('error occured while sending following message via data channel');
      LoggerUtil.log(JSON.stringify(jsonMessage));
    }
    LoggerUtil.log('sent payload via data channel : ' + JSON.stringify(jsonMessage));
  }
}
