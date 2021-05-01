export interface MediaContextUpdateEventType {
    /**
     * name of the property in media context which is being updated
     */
    property: string;

    /**
     * 
     * updated property value 
     */
    value: any;

    /**
     * name of the channel for which the property value has been updated
     */
    channel: string;
}