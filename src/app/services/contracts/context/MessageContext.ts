export interface MessageContext {
    id: string; // identifier for message
    message: string;
    timestamp: string;
    messageType: string;
    isSent: boolean; // flag determines whether message is sent or recieved
    contentId?: string; //id to determine data for file type messages
    status: string; // status of message
    username: string // username if the user with whom this message has been exchanged
}