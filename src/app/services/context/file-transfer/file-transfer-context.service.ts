import { Injectable } from "@angular/core";
import { UserContextService } from "../user.context.service";

@Injectable({
    providedIn: 'root'
})
export class FileTransferContextService {
    constructor(private userContextService: UserContextService) { }

    /**
     * this contains list of all online users and their status mappings
     * 
     * 'username1' -> true //online
     * 'username2' -> false //offline
     * 
     */
    userStatus = new Map();

    /**
     * list of all active users
     * 
     */
    activeUsers: string[] = [];
}