import { Component, ElementRef, Inject, OnInit, ViewChild } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { AppConstants } from '../services/AppConstants';
import { LoggerUtil } from '../services/logging/LoggerUtil';

@Component({
  selector: 'app-group-login-dialog',
  templateUrl: './group-login-dialog.component.html',
  styleUrls: ['./group-login-dialog.component.scss']
})
export class GroupLoginDialogComponent implements OnInit {

  inputFieldLabel: String = 'Enter group name';
  isRegistering: Boolean = false;
  //this will specify the mode which user selects i.e either to join an existing group or create a new one
  mode: String;

  @ViewChild('groupNameInput', { static: false }) groupNameInput: ElementRef;

  /**
   * 
   * @TODO make an interface for data
   */
  constructor(
    public dialogRef: MatDialogRef<GroupLoginDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) { }

  ngOnInit(): void {
  }

  /**
   * join or create a new group 
   * @param operation 
   */
  createOrJoinGroup(operation: String) {
    const groupName = this.groupNameInput.nativeElement.value;
    LoggerUtil.log(`user selected operation: ${operation} with group name: ${groupName}`);
    this.isRegistering = true;
    if (operation === AppConstants.GROUP_CHAT_MODES.EXISTING) {
      this.mode = AppConstants.GROUP_CHAT_MODES.EXISTING;
    } else if (operation === AppConstants.GROUP_CHAT_MODES.NEW) {
      this.mode = AppConstants.GROUP_CHAT_MODES.NEW;
    }
  }

}
