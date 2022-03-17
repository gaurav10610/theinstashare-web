import { Injectable } from '@angular/core';
import { AppConstants } from '../AppConstants';
import { QueueStorage } from '../util/QueueStorage';
import { environment } from '../../../environments/environment';
import { DeviceDetectorService } from 'ngx-device-detector';
import { LoggerUtil } from '../logging/LoggerUtil';

@Injectable({
  providedIn: 'root'
})
export class UserContextService {

  constructor(
    private deviceService: DeviceDetectorService
  ) {
    this.isMobile = this.deviceService.isMobile();
    if (this.isMobile) {
      LoggerUtil.logAny('this is a mobile device');
    }
  }

  selectedApp: String = undefined;

  /**
   * specify if viewing device is a mobile device
   * 
   */
  isMobile: boolean;

  //web app flag
  isNativeApp: boolean = environment.is_native_app;

  // Username of the user
  username: string = undefined;

  /* Username of the user to chat with */
  userToChat: string = undefined;

  /**
   * This will hold webrtc context for all users
   */
  webrtcContext: Object = {};

  defaultCamera: string = 'user' // 'user' for front camera or 'environment' for back, applicable only for mobile

  /**
   * this will hold screen media stream reference
   */
  screenStream: MediaStream = undefined;

  isCameraAccessible: boolean = false;

  isMicrophoneAccessible: boolean = false;

  /**
   * this will return the userContext
   * 
   * @param username: username of the user
   */
  getUserWebrtcContext(username: string) {
    return this.webrtcContext.hasOwnProperty(username) ? this.webrtcContext[username] : null;
  }

  /**
   * This will set the userContext
   * @param username: username of the user
   * @param context: user context to set
   */
  setUserWebrtcContext(username: string, context: any) {
    this.webrtcContext[username] = context;
  }

  /**
   * this will initialize the user context for a user
   * @param  username username of the user
   */
  initializeUserWebrtcContext(username: string) {
    this.setUserWebrtcContext(username, {
      mediaContext: {},
      connection: undefined,
      connectionState: AppConstants.CONNECTION_STATES.NOT_CONNECTED,
      unreadCount: 0,
      reconnect: true, // this flag is used in case of disconnect, whether to reconnect or not
      webrtcOnConnectQueue: new QueueStorage()
    });
  }

  initializeMessageQueue(username: string) {
    this.getUserWebrtcContext(username)[AppConstants.MESSAGE_QUEUE] = new QueueStorage();
  }

  initializeFileQueue(username: string) {
    this.getUserWebrtcContext(username)[AppConstants.FILE_QUEUE] = new QueueStorage();
  }

  hasUserWebrtcContext(username: string) {
    return this.webrtcContext.hasOwnProperty(username);
  }

  /**
   * this will return the registered username
   * 
   * @return username of the user
   */
  getUserName() {
    return this.username ? this.username : sessionStorage.getItem(AppConstants.STORAGE_USER);
  }

  /**
   * this will simply remove the username from browser storage
   */
  userSignOut() {
    this.username = undefined;
    sessionStorage.removeItem(AppConstants.STORAGE_USER);
  }

  applicationSignOut() {
    this.selectedApp = undefined;
    sessionStorage.removeItem(AppConstants.STORAGE_APPLICATION);
  }

  resetCoreAppContext() {
    this.userSignOut();
    this.userToChat = undefined;
    this.webrtcContext = {};
    this.screenStream = undefined;
    this.defaultCamera = 'user';
  }
}
