export interface CreateDataChannelType {

    /**
     * username of the user with whom the datachannel is to be setup
     */
    username: string;

    /**
     * channel type of data for which this datachannel will be used like
       * 'data' or 'file'
     */
    channel: string;
}