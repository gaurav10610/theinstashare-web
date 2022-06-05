import { MessageContext } from "./MessageContext";

/**
 * this is a specification for keeping message context if any application supports text chat
 */
export interface MessageContextSpec {
    messageContext: Map<string, MessageContext[]>;
    hasMessageContext(username: string): boolean;
    initializeMessageContext(username: string): void;
    getMessageContext(username: string): MessageContext[];
}