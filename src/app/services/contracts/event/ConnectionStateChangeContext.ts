import { ConnectionStatesType } from "../enum/ConnectionStatesType";

export interface ConnectionStateChangeContext {
    connectionState: string,
    username: string,
}