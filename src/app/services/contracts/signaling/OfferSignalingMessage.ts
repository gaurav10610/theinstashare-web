import { MediaChannelType } from "../enum/MediaChannelType";
import { BaseSignalingMessage } from "./BaseSignalingMessage";

export interface OfferSignalingMessage extends BaseSignalingMessage {

    //offer session description
    offer: RTCSessionDescriptionInit;

    //specifies whether the offer is intended for an already established connection or not
    renegotiate: Boolean;

    //array of channels to specify that which channel tracks are  expected in return
    seekReturnTracks?: MediaChannelType[];
}