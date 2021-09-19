import { DataChannelMessageStatusType } from "../enum/DataChannelMessageStatusType";
import { MediaChannelType } from "../enum/MediaChannelType";
import { BaseDataChannelMessage } from "./BaseDataChannelMessage";

export interface AcknowledgementDataChannelMessage extends BaseDataChannelMessage {

    //message status
    status: DataChannelMessageStatusType;

    time: any;

    messageType: MediaChannelType;

    messageId: any
}