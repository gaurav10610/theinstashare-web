/**
 * This contains all global constants of Peer-Talk
 *
 **/
export class AppConstants {

  public static DATACHANNEL = 'dataChannel';

  public static WEBRTC_EVENTS = {
    CHANNEL_OPEN: 'channelOpen',
    REMOTE_TRACK_RECEIVED: 'remoteTrack'
  };

  // User's chatMessages
  public static CHAT_MESSAGES = 'chatMessages';

  // User's message queue
  public static MESSAGE_QUEUE = 'msgQueue';

  public static FILE_QUEUE = 'fileQueue';

  public static WEBRTC_ON_CONNECT_QUEUE = 'webrtcOnConnectQueue';

  // OFFER constant
  public static OFFER = 'offer';

  // ANSWER constant
  public static ANSWER = 'answer';

  // CANDIDATE constant
  public static CANDIDATE = 'candidate';

  // REGISTER constant
  public static REGISTER = 'register';

  // DEREGISTER constant
  public static DEREGISTER = 'deregister';

  // CALL_REQUEST constant
  public static CALL_REQUEST = 'callRequest';

  public static INVITE = 'invite';

  public static REMOTE_CONTROL = 'remoteControl';

  public static CHANNEL = 'channel';

  public static DISCONNECT = 'disconnect';

  public static RECONNECT = 'reconnect';

  public static REMOTE_ACCESS_REQUEST = 'remoteAccess';

  public static ACCEPT = 'accept';

  public static DECLINE = 'decline';

  public static TRACK = 'track';

  public static STREAM = 'stream';

  public static TRACK_SENDER = 'trackSender';

  public static MODAL_TEXT = 'modalText';

  public static SIGNALING = 'signal';

  public static MESSAGE_ACKNOWLEDGEMENT = 'msgack';

  public static RECURRING_JOB_ID = 'job-id';

  public static LAST_USED = 'last-used';

  public static SENDER = 'sender';

  public static RECEIVER = 'receiver';

  public static WEBRTC_EVENT = 'rtcEvent';

  // TEXT constant
  public static TEXT = 'text';

  public static FILE = 'file';

  //file start event identifier
  public static FILE_START = 'file-start';

  //file end event identifier
  public static FILE_END = 'file-end';

  // VIDEO channel constant
  public static VIDEO = 'video';

  // AUDIO channel constant
  public static AUDIO = 'audio';

  // SCREEN channel constant
  public static SCREEN = 'screen';

  public static SOUND = 'sound';

  public static IMAGE = 'image';

  public static STOP_VIDEO = 'stop-video';

  public static STOP_AUDIO = 'stop-audio';

  public static STOP_SCREEN = 'stop-screen';

  public static STOP_SOUND = 'stop-sound';

  // Session variable that holds username
  public static STORAGE_USER = 'webrtc';

  public static USERNAME = 'username';

  public static USER_ACTIVE_STATUS = 'user';

  // RTC server constant
  public static RTC_SERVER = 'rtc_server';

  public static MEDIA_CONTEXT = 'mediaContext';

  public static CONNECTION = 'connection';

  public static CONNECTION_STATE = 'connectionState';

  // Signaling RTC constant
  public static SIGNALING_RTC = 'signaling_rtc';

  public static CONNECTION_TIMEOUT = 15000;

  public static ERROR_FLAG_TIMEOUT = 5000;

  public static DATACHANNEL_IDLE_THRESHOLD = 30000;

  public static IDLE_CONN_CLEAN_UP_JOB_TIME = 30000;

  public static APPLICATION = 'application';

  public static TIMEOUT_JOB = 'timeout_job';

  /* User status constants*/
  public static USER_STATUSES = {
    BUSY: 'busy',
    AVAILABLE: 'available',
    OFFLINE: 'offline'
  };

  //This will contains the max bitrates for webrtc connections
  public static MEDIA_BITRATES = {
    VIDEO: 1000,
    SCREEN: 3000,
    FILE: 100000,
    DATA: 1000,
    REMOTE_CONTROL: 3000,
    AUDIO: 500,
    SOUND: 1000
  };

  public static VIDEO_CONSTRAINTS = {
    audio: false,
    video: {
      // width: { max: 1920 },
      // height: { max: 1080 },
      frameRate: { max: 30 }
    }
  };

  public static MOBILE_CONSTRAINTS = {
    audio: false,
    video: {
      facingMode: 'user',
      // width: { max: 1920 },
      // height: { max: 1080 },
      frameRate: { max: 30 }
    }
  };

  public static AUDIO_CONSTRAINTS = {
    audio: {
      channelCount: 2,
      echoCancellation: true,
      noiseSuppression: true
    },
    video: false
  };

  public static SCREEN_SHARING_CONSTRAINTS = {
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        maxFrameRate: 30
      }
    }
  };

  public static WEB_SCREEN_SHARING_CONSTRAINTS = {
    video: {
      cursor: "always"
    },
    audio: false
  };

  public static SYSTEM_SOUND_CONSTRAINTS = {
    audio: {
      mandatory: {
        chromeMediaSource: 'desktop'
      }
    },
    video: {
      mandatory: {
        chromeMediaSource: 'desktop'
      }
    }
  };

  // STUN Config to instantiate webrtc peer connection
  public static STUN_CONFIG = {
    iceServers:
      [
        {
          urls: 'stun:stun.l.google.com:19302'
        },
        {
          urls: 'stun:numb.viagenie.ca:3478'
        },
        {
          urls: 'turn:numb.viagenie.ca:3478',
          credential: 'sharepro@012',
          username: 'ironman0693@gmail.com'
        }
      ]
  };

  public static CONTENT_TYPE = 'contentType';

  public static CONTENT_ID = 'contentId';

  public static FILE_NAME = 'fileName';

  public static SUPPORTED_IMAGE_FORMATS = ['apng', 'bmp', 'gif', 'x-icon', 'jpeg', 'png', 'svg+xml', 'webp'];

  public static SUPPORTED_VIDEO_FORMATS = ['mp4'];

  public static SUPPORTED_AUDIO_FORMATS = ['mp3'];

  public static VIDEO_START = 100;

  public static VIDEO_STOP = 101;

  public static AUDIO_START = 110;

  public static AUDIO_STOP = 111;

  public static CHUNK_SIZE = 7000;

  public static CHUNK_TYPE = {
    START: 1,
    INTERMEDIATE: 2,
    END: 3,
    WHOLE: 4,
  };

  public static DATACHANNEL_BUFFER_THRESHOLD = 65535;

  public static DATACHANNEL_FILE_SEND_TIMEOUT = 50;

  public static CALL_DISCONNECT_POPUP_TIMEOUT = 3000;

  public static POPUP_TYPE = {
    INVITE: 'invite',
    DECLINE: 'decline',
    ACCEPT: 'accept',
    RECONNECT: 'reconnect',
    CONNECT: 'connect',
    CONNECTING: 'connecting',
    UNABLE_TO_CONNECT: 'noconnect',
    DISCONNECT: 'disconnect',
    DISCONNECTING: 'disconnecting',
    WARNING: 'warning',
    CONNECTION_TIMEOUT: 'timeout'
  }

  public static CHAT_MESSAGE_STATUS = {
    DELIVERED: 'delivered',
    SEEN: 'seen',
    SENT: 'sent',
    NOT_APPLICABLE: 'na' //if message is not a received message
  };

  public static API_ENDPOINTS = {
    GET_ALL_ACTIVE_USERS: 'active/users'
  };

  public static MOUSE_BUTTONS_MAP = {
    0: 'left',
    1: 'middle',
    2: 'right'
  };

  public static REMOTE_ACCESS_HANDLER_IDS = {
    WHEEL: 'wheel',
    MOUSE_MOVE: 'mousemove',
    MODIFIER_KEY_DOWN: 'modifierKeyDown',
    KEY_DOWN: 'keyDown',
    PASTE: 'paste',
    COPY: 'copy',
    DOUBLE_CLICK_MOUSE_DOWN: 'doubleClickMouseDown',
    MOUSE_DOWN: 'mouseDown',
    MOUSE_UP: 'mouseUp',
    SELECT: 'select'
  };

  public static CONNECTION_STATES = {
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    NOT_CONNECTED: 'notconnected',
    CLEANING: 'cleaning'
  };
}
