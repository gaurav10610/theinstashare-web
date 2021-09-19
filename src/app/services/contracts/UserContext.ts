import { UserType } from "./enum/UserType";
import { ConnectionStatesType } from "./enum/ConnectionStatesType";
import { QueueStorage } from '../util/QueueStorage';

export interface UserContext {

    //registered username of the user
    username: String;

    //webrtc connection of the user
    connection: RTCPeerConnection;

    //audio track of the user
    audioTrack: MediaStreamTrack;

    //video track of the user
    videoTrack: MediaStreamTrack;

    //data channel
    dataChannel: RTCDataChannel;

    //first connection timestamp
    firstConnectedAt: Date;

    //last connection timestamp
    lastConnectedAt: Date;

    //type of user
    userType: UserType;

    //user group - name of the user group
    userGroup?: String;

    //webrtc connection state
    webrtcConnectionState: ConnectionStatesType;

    //webrtc data channel state
    dataChannelConnectionState: ConnectionStatesType;

    //queue for storing function calls to execute on webrtc connection on connect event
    webrtcOnConnectQueue: QueueStorage;

    //queue for storing data channel messages
    msgQueue: QueueStorage;
}