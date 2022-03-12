import { Injectable } from "@angular/core";
import { FileTransferContextService } from "../context/file-transfer/file-transfer-context.service";
import { UserContextService } from "../context/user.context.service";
import { CoreAppUtilityService } from "./core-app-utility.service";

@Injectable({
    providedIn: 'root'
})
export class FileTransferUtilityService {
    constructor(
        private coreAppUtilService: CoreAppUtilityService,
        private userContextService: UserContextService,
        private fileTransferContextService: FileTransferContextService
    ) { }

    /**
     * update user status in contact list
     * @param connected boolean flag to distinguish whether user is connected or
     * disconnected
     *
     * @param username username of the user whose status needs to be updated
     */
    updateUserStatus(connected: boolean, username: string) {
        if (username !== this.userContextService.username) {
            if (connected && !this.fileTransferContextService.userStatus.has(username)) {
                this.fileTransferContextService.activeUsers.push(username);
            }
            this.fileTransferContextService.userStatus.set(username, connected);
        }
    }
}