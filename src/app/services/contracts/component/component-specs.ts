import { EventEmitter } from "@angular/core";
import { CreateDataChannelType } from "../CreateDataChannelType";
import { DataChannelInfo } from "../datachannel/DataChannelInfo";

export interface ComponentServiceSpec {
  // custom event emitters
  onDataChannelMessageEvent: EventEmitter<any>;
  onDataChannelReceiveEvent: EventEmitter<DataChannelInfo>;
  onWebrtcConnectionStateChangeEvent: EventEmitter<any>;

  scheduledCleanerJob(): Promise<void>;
  setUpDataChannel(createDataChannelType: CreateDataChannelType): Promise<void>;
  setUpWebrtcConnection(username: string, offerMessage?: any): Promise<void>;
  registerWebrtcEventListeners(
    peerConnection: RTCPeerConnection,
    username: string
  ): Promise<void>;
  registerCommonWebrtcEvents(
    peerConnection: RTCPeerConnection,
    username: string
  ): void;
  registerDataChannelEvents(
    peerConnection: RTCPeerConnection,
    username: string
  ): void;
  registerMediaTrackEvents(
    peerConnection: RTCPeerConnection,
    username: string
  ): void;
  registerSignalingStateChangeTrackEvent(
    peerConnection: RTCPeerConnection,
    username: string
  ): void;
  cleanDataChannelContext(
    channel: string,
    mediaChannelContext: any
  ): Promise<void>;
  cleanMediaStreamContext(
    channel: string,
    mediaChannelContext: any
  ): Promise<void>;
}

export interface ComponentSpec {
  logout(): Promise<void>;
}
