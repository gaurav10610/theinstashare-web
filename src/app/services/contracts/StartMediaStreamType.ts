export interface StartMediaStreamType {
  /**
      * username of the user with whom the datachannel is to be setup
      */
  username?: string;

  /**
   * channel type of data for which this datachannel will be used like
     * 'data' or 'file'
   */
  channel: string;

  /**
   * 
   * list of required media stream tracks which needs to be added on webrtc peer connection 
   */
   requiredMediaTracks: string[];
}