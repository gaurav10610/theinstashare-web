import { Injectable } from '@angular/core';
import { LoggerUtil } from '../logging/LoggerUtil';

@Injectable({
  providedIn: 'root'
})
export class MessageService {

  constructor() { }

  /**
   * this will keep messages against keys as (key,value) pairs
   * 
   */
  private messageMappings = {
    'disconnecting_screen': 'disconnecting screen stream',
    'disconnecting_audio': 'disconnecting audio stream',
    'disconnecting_video': 'disconnecting video stream',
    'disconnecting_sound': 'disconnecting sound stream',
    'disconnecting_remoteControl': 'disconnecting remote access',
    'disconnect_screen': 'screen stream disconnected by ',
    'disconnect_audio': 'audio stream disconnected by ',
    'disconnect_video': 'video stream disconnected by ',
    'disconnect_sound': 'sound stream disconnected by ',
    'connect_remoteControl': 'remote access has been requested to ',
    'reconnect_audio': 'reconnecting audio stream',
    'reconnect_video': 'reconnecting video stream',
    'reconnect_screen': 'reconnecting screen stream ',
    'noconnect_audio': 'unable to connect audio stream',
    'noconnect_video': 'unable to connect video stream',
    'noconnect_screen': 'unable to connect screen stream',
    'noconnect_sound': 'unable to connect sound stream',
    'timeout_all':'connection timeout has occured please try again'
  }

  /**
   * this will build popup context for showing up modal popup on UI
   * 
   * @param popupType specify type of popup context to be built 
   * 
   * @param channel media type i.e 'audio', 'video' etc.
   * 
   * @param messageSuffix optional suffix for modal text
   */
  buildPopupContext(popupType: string, channel: string, messageSuffix?: string) {
    const modalText: string = this.getModalText(popupType + '_' + channel);
    return {
      type: popupType + channel,
      modalText: messageSuffix ? (modalText + messageSuffix) : modalText,
      channel: channel
    };
  }

  /**
   * this will retrieve modal text from 'messageMappings' on the basis of provided key
   * 
   * if key does not exist then return the key itself
   * 
   * @param key 
   */
  private getModalText(key: string) {
    if (this.messageMappings.hasOwnProperty(key)) {
      return this.messageMappings[key];
    } else {
      LoggerUtil.log('message key not found: ' + key);
      return key;
    }
  }
}
