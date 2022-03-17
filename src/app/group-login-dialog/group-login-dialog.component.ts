import { Component, ElementRef, Inject, OnInit, ViewChild } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { GroupChatWindowComponent } from '../group-chat-window/group-chat-window.component';
import { ApiService } from '../services/api/api.service';
import { AppConstants } from '../services/AppConstants';
import { DialogCloseResult } from '../services/contracts/dialog/DialogCloseResult';
import { DialogCloseResultType } from '../services/contracts/enum/DialogCloseResultType';
import { LoggerUtil } from '../services/logging/LoggerUtil';

@Component({
  selector: 'app-group-login-dialog',
  templateUrl: './group-login-dialog.component.html',
  styleUrls: ['./group-login-dialog.component.scss']
})
export class GroupLoginDialogComponent implements OnInit {

  constructor(
    public dialogRef: MatDialogRef<GroupChatWindowComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private apiService: ApiService
  ) { }

  inputFieldLabel: String = 'Enter group name';
  isRegistering: Boolean = false;
  //this will specify the mode which user selects i.e either to join an existing group or create a new one
  mode: String = undefined;
  errorMessage: String = undefined;

  @ViewChild('groupNameInput', { static: false }) groupNameInput: ElementRef;

  ngOnInit(): void {
  }

  /**
   * handle keyup event on input field
   */
  handleKeyUpEvent() {
    LoggerUtil.logAny('input field keyup event');
    this.errorMessage = undefined
  }

  /**
   * join or create a new group 
   * @param operation 
   */
  async createOrJoinGroup(operation: String) {
    const groupName: String = this.groupNameInput.nativeElement.value
      ? this.groupNameInput.nativeElement.value.trim()
      : undefined;

    if (groupName === undefined || groupName === '') {
      this.errorMessage = 'invalid group name';
      return;
    }
    LoggerUtil.logAny(`user selected operation: ${operation} with group name: ${groupName}`);
    this.isRegistering = true;

    /**
     * 
     * validate entered groupName
     * 
     */
    const isGroupExist: Boolean = await this.checkIfGroupExist(groupName.trim());

    if (operation === AppConstants.GROUP_CHAT_MODES.EXISTING) {
      this.mode = AppConstants.GROUP_CHAT_MODES.EXISTING;
      if (!isGroupExist) {
        this.errorMessage = 'group does not exist';
        this.mode = undefined;
        this.isRegistering = false;
        return;
      }
    } else if (operation === AppConstants.GROUP_CHAT_MODES.NEW) {
      this.mode = AppConstants.GROUP_CHAT_MODES.NEW;
      if (isGroupExist) {
        this.errorMessage = 'there already exist a group with same name';
        this.mode = undefined;
        this.isRegistering = false;
        return;
      }
    }

    /**
     * if no error then close this dialog and pass the group name to parent component
     */
    const result: DialogCloseResult = {
      type: DialogCloseResultType.APP_LOGIN,
      data: {
        groupName,
        mode: this.mode
      }
    };
    this.dialogRef.close(result)
  }

  /**
   * check if a group exist
   * @param groupName name of group to validate
   */
  checkIfGroupExist(groupName: String): Promise<Boolean> {
    return new Promise<Boolean>(async (resolve) => {
      try {
        await this.apiService.get(`group/${groupName}`, AppConstants.MEDIA_SERVER).toPromise();
        resolve(true);
      } catch (e) {
        LoggerUtil.logAny(`error occured while checking group existence for group: ${groupName}`);
        LoggerUtil.logAny(e);
        resolve(false);
      }
    });
  }

}
