import { Injectable } from '@angular/core';
import { LoggerUtil } from '../services/logging/LoggerUtil';

@Injectable({
  providedIn: 'root'
})
export class NativeRemoteAccessService {

  constructor() { }

  /**
   * this will simulate appropriate native mouse or keyboard event as per the received 
   * info from remote end 
   * 
   * @param nativeEventMessage message containing mouse and keyboard action info 
   * performed at remote end
   * 
   */
  handleNativeEvents(nativeEventMessage: any) {
    LoggerUtil.log('received native event message ' + JSON.stringify(nativeEventMessage));
  }

  /**
   * this will simpulate appropriate native mouse event as per the received info from remote end
   * 
   * @param mouseEventMessage message containing info about mouse event perform at remote end
   * 
   */
  private handleMouseEvent(mouseEventMessage: any) {
    //this will be implemented by theinstashare-desktop app as it required native modules
  }

  /**
   * this will simpulate appropriate native keboard event as per the received info from remote end
   * 
   * @param keyboardeventMessage message containing info about keyboard event perform at remote end
   */
  private handleKeyboardEvent(keyboardeventMessage: any) {
    //this will be implemented by theinstashare-desktop app as it required native modules
  }
}
