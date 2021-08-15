import { SignalingMessageType } from '../enum/SignalingMessageType';
import { MediaChannelType } from '../enum/MediaChannelType';
import { UserType } from '../enum/UserType';

export interface BaseSignalingMessage {
    //username of the sender
    from: String;

    //username of the recipient
    to: String;

    //type of the signaling message
    type: SignalingMessageType;

    /**
     * this will specify whether the signaling message is 
     * routed/received via signaling router or via webrtc data channel
     * 
     */
    via?: String;

    // media channel i.e - 'audio', 'video' or 'text'
    channel: MediaChannelType;

    //user group
    userGroup?: String;

    //user type
    userType?: UserType;
}