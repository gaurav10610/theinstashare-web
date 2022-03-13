export interface MessageContext {
    message: string;
    timestamp: Date;
    messageType: string;
    isSent: boolean; // flag determines whether message is sent or recieved
    contentId: string; //id to determine data for file type messages
    status: string; // status of message
}