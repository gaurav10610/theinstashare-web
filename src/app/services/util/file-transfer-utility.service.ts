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

    /**
     * this will check if an HTML element is in viewport or not
     *
     * @param htmlElement html dom element that needed to be checked
     * 
     * @TODO move it to a common class
     *
     * @return a promise
     */
    async isElementInViewport(htmlElement: any): Promise<boolean> {
        const rect = htmlElement.getBoundingClientRect();
        return rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth);
    }
}