import { BaseSignalingMessage } from "./BaseSignalingMessage";

export interface CandidateSignalingMessage extends BaseSignalingMessage {
    candidate: RTCIceCandidate
}