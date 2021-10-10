import { BaseSignalingMessage } from "./BaseSignalingMessage";
import { WebRTCEventType } from '../enum/WebRTCEventType';

export interface WebRTCEventSignalingMessage extends BaseSignalingMessage {
    event: WebRTCEventType
}