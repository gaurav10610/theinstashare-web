import { APP_BASE_HREF } from '@angular/common';
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
    return (channel === AppConstants.TEXT || channel === AppConstants.FILE || needSendPeer)
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
  isDataChannelConnected(webrtcContext: any, channel: string) {
    return this.getNestedValue(webrtcContext, AppConstants.MEDIA_CONTEXT, channel, AppConstants.CONNECTION_STATE) === AppConstants.CONNECTION_STATES.CONNECTED;
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
    return this.getNestedValue(webrtcContext, AppConstants.MEDIA_CONTEXT, channel, AppConstants.CONNECTION_STATE) === AppConstants.CONNECTION_STATES.CONNECTING;
  }

  /**
   * to check whether the webrtc peer connection(send or receive peer) with the
   * provide user is in connected state the user who's username is passed as
   * an argument
   *
   * @param webrtcContext user's webrtc context
   *
   * @return a boolean result
   * 
   */
  isWebrtcConnectionConnected(webrtcContext: any) {
    return this.getNestedValue(webrtcContext, AppConstants.CONNECTION_STATE) === AppConstants.CONNECTION_STATES.CONNECTING;
  }

  /**
   * check if webrtc connection with a user is in connecting state using it's provided
   * webrtc context
   *
   * @param webrtcContext user's webrtc context
   *
   */
  isWebrtcConnectionConnecting(webrtcContext: any) {
    return this.getNestedValue(webrtcContext, AppConstants.CONNECTION_STATE) === AppConstants.CONNECTION_STATES.CONNECTING;
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
      if (this.getNestedValue(webrtcContext, AppConstants.MEDIA_CONTEXT, channel)) {
        const connectionType: string = this.getConnectionIdentifier(channel, needSender);
        resolve(webrtcContext[AppConstants.MEDIA_CONTEXT][channel][connectionType]);
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

  /**
   * this will return the media type for sdp modification so that app can apply 
   * max bitrate limit for a webrtc connection
   *  
   * @param channel: media type audio/video/text 
   * 
   */
  getMediaTypeForSdpModification(channel: string) {
    if (channel === AppConstants.VIDEO || channel === AppConstants.SCREEN) {
      return AppConstants.VIDEO;
    } else if (channel === AppConstants.FILE || channel === AppConstants.TEXT
      || channel === AppConstants.REMOTE_CONTROL) {
      return AppConstants.APPLICATION;
    } else if (channel === AppConstants.AUDIO || channel === AppConstants.SOUND) {
      return AppConstants.AUDIO;
    }
  }

  /**
   * this will return the max bitrate to configure in the SDP
   * 
   * @param channel: media type audio/video/text 
   * 
   */
  getMaxBitrateForSdpModification(channel: string) {
    let bitrate = 500;
    switch (channel) {
      case AppConstants.VIDEO:
        bitrate = AppConstants.MEDIA_BITRATES.VIDEO;
        break;
      case AppConstants.SCREEN:
        bitrate = AppConstants.MEDIA_BITRATES.SCREEN;
        break;
      case AppConstants.AUDIO:
        bitrate = AppConstants.MEDIA_BITRATES.AUDIO
        break;
      case AppConstants.SOUND:
        bitrate = AppConstants.MEDIA_BITRATES.SOUND
        break;
      case AppConstants.FILE:
        bitrate = AppConstants.MEDIA_BITRATES.FILE;
        break;
      case AppConstants.REMOTE_CONTROL:
        bitrate = AppConstants.MEDIA_BITRATES.REMOTE_CONTROL;
        break;
      case AppConstants.TEXT:
        bitrate = AppConstants.MEDIA_BITRATES.DATA;
        break;
    }
    return bitrate;
  }

  /**
   * 
   * check if provided channel uses data channel
   * 
   * @param channel type of media i.e 'text', 'file' or 'remoteControl'
   */
  isDataChannel(channel: string): boolean {
    return [AppConstants.TEXT, AppConstants.FILE, AppConstants.REMOTE_CONTROL].indexOf(channel) > -1;
  }

  /**
   * 
   * check if provided channel uses data channel
   * 
   * @param channel type of media i.e 'audio', 'video' etc
   */
  isMediaChannel(channel: string): boolean {
    return [AppConstants.VIDEO, AppConstants.AUDIO, AppConstants.SCREEN, AppConstants.SOUND].indexOf(channel) > -1;
  }

  /**
   * this will check if a certain value is in the specified array or not
   * 
   * @param value value to check in the array
   * @param array array of values
   * @returns boolean specifying whether value exist in array or not
   * 
   */
  checkMember(value: any, array: any[]): boolean {
    const index: number = array.indexOf(value);
    if (index > -1)
      return true;
    return false;
  }
}
