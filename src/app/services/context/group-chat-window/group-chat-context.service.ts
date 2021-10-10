import { Injectable } from "@angular/core";
import { AppConstants } from "../../AppConstants";

@Injectable({
    providedIn: 'root'
})
export class GroupChatContextService {

    constructor() { }

    isGroupMember: Boolean = false;
    groupName: String = undefined;

    getGroupName() {
        return this.groupName ? this.groupName : sessionStorage.getItem(AppConstants.STORAGE_GROUP);
    }

    setGroupName(groupName: String) {
        this.groupName = groupName;
        sessionStorage.setItem(AppConstants.STORAGE_GROUP, groupName.toString());
    }
}