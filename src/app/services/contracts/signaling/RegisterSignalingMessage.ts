import { BaseSignalingMessage } from "./BaseSignalingMessage";

export interface RegisterSignalingMessage extends BaseSignalingMessage {

    //flag to specify whether registration is successful or not
    success: Boolean;
}