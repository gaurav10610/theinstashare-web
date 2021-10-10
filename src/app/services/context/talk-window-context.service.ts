import { EventEmitter, Injectable } from '@angular/core';
import { MediaContextUpdateEventType } from '../contracts/MediaContextUpdateEventType';
import { UserContextService } from './user.context.service';

@Injectable({
  providedIn: 'root'
})
export class TalkWindowContextService {

  constructor(private userContextService: UserContextService) { }

  /**
   * event emitter for any property update in media call context
   * 
   */
  mediaContextUpdateEventEmitter: EventEmitter<any> = new EventEmitter(true);

  /**
   * this contains list of all online users and their status mappings
   * 
   * 'username1' -> true //online
   * 'username2' -> false //offline
   * 
   */
  userStatus = new Map();

  /**
   * list of all active users
   * 
   */
  activeUsers = [];

  //This will contain the
  sharedContent: Object = {};

  /**
   * this will be used by media viewer to store selected media's details
   * to display on UI 
   *  
   */
  mediaViewerContext = {
    contentType: undefined,
    contentId: undefined
  };

  /**
   * context holder for modal popup on UI
   */
  popupContext = new Map();

  /**
   * this will store the message context for users,
   * will keep mappings like below 
   * 
   * 'username' -> [{message:'message1',sent:false}, {message:'message2',sent:true}]
   *  
   */
  messageContext: Object = {};

  /**
   * this will store binary data messages against content id's
   * 
   * 'contentId1' -> 'base64encodedString'
   */
  contentIdsMap: Object = {};

  //This contains any errors encountered within app
  errors = [];

  /**
   * this context will store timeout job ids against channel so that it can be 
   * used to disable the timeout job later on in certain flows
   * 
   * i.e 'video' -> {'send' -> 1234, 'receive' -> 4321}
   *  
   */
  timeoutJobContext = {
    video: {
      sender: undefined,
      receiver: undefined
    },
    audio: {
      sender: undefined,
      receiver: undefined
    },
    screen: {
      sender: undefined,
      receiver: undefined
    },
    sound: {
      sender: undefined,
      receiver: undefined
    }
  };

  /**
   * this will be used to store media stream request context
   */
  mediaStreamRequestContext = {
    channel: undefined,
    username: undefined
  }

  /**
   * this context will be used by remote access mechanism
   */
  remoteAccessContext = {
    remoteHeight: undefined,
    remoteWidth: undefined,
    widthScalingRatio: undefined,
    heightScalingRatio: undefined,
    offsetLeft: undefined,
    offsetTop: undefined,
    username: undefined,
    localOS: undefined,
    remoteOS: undefined,
    canAccessRemote: undefined
  }

  // Call request context
  bindingFlags = {
    minimizeVideo: false,
    isAudioSharing: false, // this flag is set when user is sharing an audio
    isVideoSharing: false, // this flag is set when user is sharing video
    haveRemoteVideoStream: false, // this flag is set when user have remote stream
    haveLocalVideoStream: false, // this flag is set when user have local stream
    isScreenSharing: false, // this flag is set when user is sharing screen
    isSoundSharing: false, // this flag is set when user is sharing system sound
    isVideoCalling: false, // this flag is set when user is video calling
    isAudioCalling: false, // this flag is set when user is audio calling
    haveLocalAudioStream: false,// this flag is set when user have local stream
    haveRemoteAudioStream: false,// this flag is set when user have remote stream
    isAccessingRemote: false, // this flag is set when user is accessing a remote machine
    haveSharedRemoteAccess: false,//this flag is set when user has given his/her remote control to other peer
    isFullScreenMode: false, // this flag is set when user is viewing video stream in full screen
    isDndOn: false, // do not disturb flag
    isOnMute: false, // mute microphone flag
    showVolumeSlider: false,
    showSidepanel: true,
    showChatWindow: false
  };

  /**
   * array to keep all the render2 unlisten function for remote access canvas
   *  
   */
  canvasUnlistenFunctions: any[] = [];

  /**
   * update any property in media call context and emit an event
   * 
   * @param  propertyName  name of the property which is to be set
   * 
   * @param  propertyValue value of the property which is to be set
   * 
   * @param channel 
   * 
   * @param senderUpdate
   * 
   */
  updateBindingFlag(propertyName: string, propertyValue: any, channel: string) {
    this.bindingFlags[propertyName] = propertyValue;
    const eventObject: MediaContextUpdateEventType = {
      property: propertyName,
      value: propertyValue,
      channel: channel
    };
    this.mediaContextUpdateEventEmitter.emit(eventObject);
  }

  getUserStatus(username: string) {
    return this.userStatus.get(username);
  }

  initializeMessageContext(username: string) {
    this.messageContext[username] = [];
  }

  getMessageContext(username: string) {
    return this.messageContext[username];
  }

  hasMessageContext(username: string) {
    return this.messageContext.hasOwnProperty(username);
  }

  /**
  * this will reset values of all remote access context properties
  * 
  */
  resetRemoteAccessContext() {
    this.remoteAccessContext = {
      remoteHeight: undefined,
      remoteWidth: undefined,
      widthScalingRatio: undefined,
      heightScalingRatio: undefined,
      offsetLeft: undefined,
      offsetTop: undefined,
      username: undefined,
      remoteOS: undefined,
      localOS: this.remoteAccessContext.localOS,
      canAccessRemote: undefined
    };
  }

  /**
   * this will reset values of all the instance variables in this service
   * 
   */
  resetAppContext() {

    this.resetRemoteAccessContext();
    this.canvasUnlistenFunctions = [];

    this.bindingFlags = {
      minimizeVideo: false,
      isAudioSharing: false,
      isVideoSharing: false,
      haveRemoteVideoStream: false,
      haveLocalVideoStream: false,
      isScreenSharing: false,
      isSoundSharing: false,
      isVideoCalling: false,
      isAudioCalling: false,
      haveLocalAudioStream: false,
      haveRemoteAudioStream: false,
      isAccessingRemote: false,
      haveSharedRemoteAccess: false,
      isFullScreenMode: false,
      isDndOn: false,
      isOnMute: false,
      showVolumeSlider: false,
      showSidepanel: true,
      showChatWindow: false
    };

    this.userStatus.clear();
    this.activeUsers = [];
    this.sharedContent = {};
    this.mediaViewerContext = {
      contentType: undefined,
      contentId: undefined
    };
    this.popupContext.clear();
    this.messageContext = {};
    this.contentIdsMap = {};

    this.timeoutJobContext = {
      video: {
        sender: undefined,
        receiver: undefined
      },
      audio: {
        sender: undefined,
        receiver: undefined
      },
      screen: {
        sender: undefined,
        receiver: undefined
      },
      sound: {
        sender: undefined,
        receiver: undefined
      }
    };

    /**
     * @TODO see if this can be removed
     */
    this.userContextService.resetCoreAppContext();
  }
}
