import { LoggerUtil } from "src/app/services/logging/LoggerUtil";
import { Injectable } from "@angular/core";
import { AppConstants } from "../AppConstants";
import { UserContextService } from "../context/user.context.service";

@Injectable({
  providedIn: "root",
})
export class CoreAppUtilityService {
  constructor(private userContextService: UserContextService) {}

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
   * check if there is an open data channel with a user using it's provided webrtc
   * context
   * @param webrtcContext user's webrtc context
   * @param channel webrtc connection's media type for connection means the
   * type of media data that we will relay on this connection e.g 'text','video'
   * or 'audio'
   *
   */
  isDataChannelConnected(webrtcContext: any, channel: string) {
    return (
      this.getNestedValue(
        webrtcContext,
        AppConstants.MEDIA_CONTEXT,
        channel,
        AppConstants.CONNECTION_STATE
      ) === AppConstants.CONNECTION_STATES.CONNECTED
    );
  }

  /**
   * check if dataChannel with a user is in connecting state using it's provided
   * webrtc context
   * @param webrtcContext user's webrtc context
   * @param channel webrtc connection's media type for connection means the
   * type of media data that we will relay on this connection e.g 'text','video'
   * or 'audio'
   *
   */
  isDataChannelConnecting(webrtcContext: any, channel: string) {
    return (
      this.getNestedValue(
        webrtcContext,
        AppConstants.MEDIA_CONTEXT,
        channel,
        AppConstants.CONNECTION_STATE
      ) === AppConstants.CONNECTION_STATES.CONNECTING
    );
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
    return (
      this.getNestedValue(webrtcContext, AppConstants.CONNECTION_STATE) ===
      AppConstants.CONNECTION_STATES.CONNECTING
    );
  }

  /**
   * check if webrtc connection with a user is in connecting state using it's provided
   * webrtc context
   *
   * @param webrtcContext user's webrtc context
   *
   */
  isWebrtcConnectionConnecting(webrtcContext: any) {
    return (
      this.getNestedValue(webrtcContext, AppConstants.CONNECTION_STATE) ===
      AppConstants.CONNECTION_STATES.CONNECTING
    );
  }

  /**
   * update an element's position in an array to provided newIndex
   * @param array given array of element
   * @param elementValue element of the array
   * @param  newIndex new position for the array element
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
    return new Promise((resolve) => setTimeout(resolve, timeToSleep));
  }

  /**
   * this will generate a unique identifier
   * @return a promise containing a unique numberic identifier
   */
  generateIdentifier(): string {
    return "_" + Math.random().toString(36).slice(2, 9);
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
    return levels.reduce(
      (object: any, level: any) => object && object[level],
      object
    );
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
    } else if (
      channel === AppConstants.FILE ||
      channel === AppConstants.TEXT ||
      channel === AppConstants.REMOTE_CONTROL
    ) {
      return AppConstants.APPLICATION;
    } else if (
      channel === AppConstants.AUDIO ||
      channel === AppConstants.SOUND
    ) {
      return AppConstants.AUDIO;
    }
  }

  /**
   * this will return the max bitrate to configure in the SDP
   * @param channel: media type audio/video/text
   * @TODO fix it afterwards
   */
  getMaxBitrateForSdpModification(channel: string) {
    return channel === AppConstants.FILE || channel === AppConstants.TEXT
      ? 100000
      : 10000;
  }

  /**
   * check if provided channel uses data channel
   * @param channel type of media i.e 'text', 'file' or 'remoteControl'
   */
  isDataChannel(channel: string): boolean {
    return this.checkMember(channel, [
      AppConstants.TEXT,
      AppConstants.FILE,
      AppConstants.REMOTE_CONTROL,
    ]);
  }

  /**
   *
   * check if provided channel uses data channel
   *
   * @param channel type of media i.e 'audio', 'video' etc
   */
  isMediaChannel(channel: string): boolean {
    return this.checkMember(channel, [
      AppConstants.VIDEO,
      AppConstants.AUDIO,
      AppConstants.SCREEN,
      AppConstants.SOUND,
    ]);
  }

  /**
   * this will check if a certain value is in the specified array or not
   * @param value value to check in the array
   * @param array array of values
   * @returns boolean specifying whether value exist in array or not
   */
  checkMember(value: any, array: any[]): boolean {
    return array.indexOf(value) > -1;
  }

  /**
   * this will resolve the media file type i.e 'audio', 'video' or 'image' with
   * the provided file extension
   *
   * @param fileExtension file extension
   *
   * @return a promise containing the file type
   *
   * @TODO refactor it afterwards, this can be done in an easy way
   */
  resolveFileType(fileExtension: string): string {
    let index = AppConstants.SUPPORTED_IMAGE_FORMATS.indexOf(fileExtension);
    if (index > -1) {
      return AppConstants.IMAGE;
    }
    index = AppConstants.SUPPORTED_VIDEO_FORMATS.indexOf(fileExtension);
    if (index > -1) {
      return AppConstants.VIDEO;
    }
    index = AppConstants.SUPPORTED_AUDIO_FORMATS.indexOf(fileExtension);
    if (index > -1) {
      return AppConstants.AUDIO;
    }
  }

  /**
   * convert an array buffer to string
   * @param arrayBuffer
   * @returns
   */
  arrayBufferToString(arrayBuffer: ArrayBuffer): string {
    return String.fromCharCode.apply(null, new Uint8Array(arrayBuffer));
  }

  /**
   * convert string to unit-8 array buffer
   * @param stringData
   * @returns
   */
  stringToArrayBuffer(stringData: string): ArrayBuffer {
    let dataLength: number = stringData.length;
    let buf = new ArrayBuffer(dataLength); // 2 bytes for each char
    let bufView = new Uint8Array(buf);
    for (let i = 0; i < dataLength; i++) {
      bufView[i] = stringData.charCodeAt(i);
    }
    return buf;
  }

  // arrayBufferToString(arrayBuffer: ArrayBuffer): string {
  //   return new TextDecoder("utf-8").decode(new Uint8Array(arrayBuffer));
  // }

  // /**
  //  * convert string to unit-16 array buffer
  //  * @param stringData
  //  * @returns
  //  */
  // stringToArrayBuffer(stringData: string): ArrayBuffer {
  //   return new TextEncoder().encode(stringData).buffer;
  // }

  /**
   * format size in to higher terms
   * @param bytes
   * @param decimals
   * @returns
   */
  formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return "0 Bytes";
    const k: number = 1024;
    const dm: number = decimals < 0 ? 0 : decimals;
    const sizes: string[] = [
      "Bytes",
      "KB",
      "MB",
      "GB",
      "TB",
      "PB",
      "EB",
      "ZB",
      "YB",
    ];
    const i: number = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  }
}
