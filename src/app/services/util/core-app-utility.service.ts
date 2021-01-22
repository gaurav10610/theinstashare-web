import { Injectable } from '@angular/core';
import { AppConstants } from '../AppConstants';
import { UserContextService } from '../context/user.context.service';

@Injectable({
  providedIn: 'root'
})
export class CoreAppUtilityService {

  constructor(private userContextService: UserContextService) { }

  /**
   * get stored value from browser storage
   *
   * @param  key key to get value from storage
   *
   * @return value stored at sprecified key
   */
  getStorageValue(key: string) {
    return sessionStorage.getItem(key);
  }

  /**
   * set value in browser storage at specified key
   *
   * @param key key with which value have to be stored
   *
   * @param value value that needed to be set
   */
  setStorageValue(key: string, value: string) {
    sessionStorage.setItem(key, value);
  }

  /**
   * remove value stored at provided key from storage
   * 
   * @param key key corresponding to which a value is stored
   */
  removeStorageValue(key: string) {
    sessionStorage.removeItem(key);
  }

  /**
   * this will return identifier for webrtc connection within webrtcContext
   * i.e 'send' or 'receive'
   *
   * @param channel webrtc connection's media type for connection means the type
   * of media data that we will relay on this connection e.g 'text','video' or 'audio'
   *
   * @param needSender boolean value to determine whether sender or receive peer
   * connection has to be initialized. Applicable only for media webrtc connection
   * i.e connections other than 'data' or 'file'
   *
   *
   */
  getConnectionIdentifier(channel: string, needSendPeer: boolean) {
    return (channel === AppConstants.DATA || channel === AppConstants.FILE || needSendPeer)
      ? AppConstants.SENDER : AppConstants.RECEIVER;
  }

  /**
   * check if there is an open data channel with a user using it's provided webrtc
   * context
   *
   * @param webrtcContext user's webrtc context
   *
   * @param channel webrtc connection's media type for connection means the
   * type of media data that we will relay on this connection e.g 'text','video'
   * or 'audio'
   *
   */
  isDataChannelOpen(webrtcContext: any, channel: string) {
    return this.getNestedValue(webrtcContext, AppConstants.CONNECTIONS, channel, AppConstants.DATACHANNEL, 'readyState') === 'open';
  }

  /**
   * check if dataChannel with a user is in connecting state using it's provided
   * webrtc context
   *
   * @param webrtcContext user's webrtc context
   *
   * @param channel webrtc connection's media type for connection means the
   * type of media data that we will relay on this connection e.g 'text','video'
   * or 'audio'
   *
   */
  isDataChannelConnecting(webrtcContext: any, channel: string) {
    return this.getNestedValue(webrtcContext, AppConstants.CONNECTIONS, channel, 'state') === AppConstants.CHANNEL_STATUS.CONNECTING;
  }

  /**
   * to check whether the webrtc peer connection(send or receive peer) with the
   * provide user is in connected state the user who's username is passed as
   * an argument
   *
   * @param channel webrtc connection's media type for connection means the
   * type of media data that we will relay on this connection e.g 'text','video'
   * or 'audio'
   *
   * @param username username of the user with whom the connection's state need
   * needs to be tested
   *
   * @param isSenderConnection boolean flag to distinguish between sender and
   * receive audio video peer connections
   *
   * @return a boolean result
   */
  isConnectedWithUser(channel: string, username: string, isSenderConnection: boolean) {
    return new Promise<boolean>(async (resolve) => {
      const peerConnection: any = await this.getAppropriatePeerConnection(username, channel, isSenderConnection);
      if (peerConnection) {

        /**
         * check peer connection state here
         * 
         * for macOS chrome 'connectionState' doesn't seems to change so for now checking 
         * 'iceConnectionSate' instead
         */
        if (peerConnection.connectionState === 'connected'
          || peerConnection.iceConnectionState === 'connected'
          || peerConnection.iceConnectionState === 'completed') {
          resolve(true);
        } else {
          resolve(false);
        }
      } else {
        resolve(false);
      }
    });
  }

  /**
   * get appropriate webrtc peer connection for a user from webrtc context
   *
   * @param username username of the user
   *
   * @param channel: media type audio/video/text
   *
   * @param needSender boolean flag to distinguish b/w send and receiver
   */
  getAppropriatePeerConnection(username: string, channel: string, needSender: boolean) {
    return new Promise<any>((resolve) => {
      const webrtcContext = this.userContextService.getUserWebrtcContext(username);
      if (this.getNestedValue(webrtcContext, AppConstants.CONNECTIONS, channel)) {
        const connectionType: string = this.getConnectionIdentifier(channel, needSender);
        resolve(webrtcContext[AppConstants.CONNECTIONS][channel][connectionType]);
      } else {
        resolve(undefined);
      }
    });
  }

  /**
   * update an element's position in an array to provided newIndex
   *
   * @param array given array of element
   *
   * @param elementValue element of the array
   *
   * @param  newIndex new position for the array element
   *
   * @return a promise
   */
  updateElemntPositionInArray(array: any, elementValue: any, newIndex: number) {
    return new Promise<void>((resolve) => {
      const oldIndex = array.indexOf(elementValue);
      if (newIndex >= array.length) {
        var k = newIndex - array.length + 1;
        while (k--) {
          array.push(undefined);
        }
      }
      array.splice(newIndex, 0, array.splice(oldIndex, 1)[0]);
      resolve();
    });
  }

  /**
   * delay implementatio
   * 
   * @param timeToSleep time in ms to sleep
   */
  delay(timeToSleep: number) {
    return new Promise(resolve => setTimeout(resolve, timeToSleep));
  }

  /**
   * this will generate a unique identifier
   *
   * @return a promise containing a unique numberic identifier
   */
  generateIdentifier() {
    return new Promise<number>((resolve) => {
      resolve(Date.now());
    });
  }

  /**
   * this will return a deep nested value
   *
   * @param object object in which value has to be checked
   *
   * @param levels rest of the property names
   *
   * @return value of deep nested property else undefined
   */
  getNestedValue(object: any, ...levels: any) {
    return levels.reduce((object: any, level: any) => object && object[level], object);
  }
}
