import { BaseSignalingMessage } from "./BaseSignalingMessage";

export interface AnswerSignalingMessage extends BaseSignalingMessage {

    //answer session description
    answer: RTCSessionDescriptionInit;
}