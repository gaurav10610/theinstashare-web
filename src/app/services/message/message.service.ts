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
    'disconnecting_screen': 'disconnecting screen stream connection',
    'disconnecting_audio': 'disconnecting audio stream connection',
    'disconnecting_video': 'disconnecting video stream connection',
    'disconnecting_remoteControl': 'disconnecting remote access connection',
    'disconnect_screen': 'screen stream connection disconnected by ',
    'disconnect_audio': 'audio stream connection disconnected by ',
    'disconnect_video': 'video stream connection disconnected by ',
    'connect_remoteControl': 'remote access has been requested to ',
    'reconnect_audio': 'reconnecting audio stream connection ',
    'reconnect_video': 'reconnecting video stream connection ',
    'reconnect_screen': 'reconnecting screen stream connection ',
    'noconnect_audio': 'unable to establish audio stream connection',
    'noconnect_video': 'unable to establish video stream connection',
    'noconnect_screen': 'unable to establish screen stream connection'
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
    let modalText: string = this.getModalText(popupType + '_' + channel);
    if (messageSuffix) {
      modalText = modalText + messageSuffix;
    }
    return {
      type: popupType + channel,
      modalText: modalText,
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
