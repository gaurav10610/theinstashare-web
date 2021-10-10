import { MediaChannelType } from "../enum/MediaChannelType";
import { SignalingMessageType } from "../enum/SignalingMessageType";

export interface BaseDataChannelMessage {

    //identifier for message, this will be used for acknowledgment
    id: any;

    //username of the sender
    from: String;

    //username of the recipient
    to: String;

    //type of the signaling message
    type: MediaChannelType;

    message: any;

    /**
     * username of the sender 
     * 
     * this will be removed after some time
     * 
     * @deprecated
     */
    username: String;
}