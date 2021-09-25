import { Component, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { environment } from 'src/environments/environment';
import { AppLoginDialogComponent } from '../app-login-dialog/app-login-dialog.component';
import { GroupLoginDialogComponent } from '../group-login-dialog/group-login-dialog.component';
import { ProgressDialogComponent } from '../progress-dialog/progress-dialog.component';
import { UserContextService } from '../services/context/user.context.service';
import { DialogCloseResult } from '../services/contracts/dialog/DialogCloseResult';
import { DialogType } from '../services/contracts/enum/DialogType';
import { LoggerUtil } from '../services/logging/LoggerUtil';

@Component({
  selector: 'app-group-chat-window',
  templateUrl: './group-chat-window.component.html',
  styleUrls: ['./group-chat-window.component.scss']
})
export class GroupChatWindowComponent implements OnInit {

  constructor(
    private userContextService: UserContextService,
    public dialog: MatDialog
  ) { }

  dialogRef: MatDialogRef<any>;

  //assets path
  assetsPath = environment.is_native_app ? 'assets/' : '../../assets/';

  activeUsers: any[] = [
    { name: 'gaurav', status: 'online' },
    { name: 'suman', status: 'online' },
    { name: 'tillu', status: 'online' },
    { name: 'billu', status: 'offline' },
    { name: 'shikha', status: 'offline' },
    { name: 'prabhat', status: 'offline' }
  ];

  messages: any[] = [
    { name: 'gaurav', message: 'I am good. How\'re you?', received: new Date().toLocaleString('en-US') },
    { name: 'suman', message: 'I am good. How\'re you?', received: new Date().toLocaleString('en-US') },
    { name: 'tillu', message: 'I am good. How\'re you?', received: new Date().toLocaleString('en-US') },
    { name: 'prabhat', message: 'This is the last message', received: new Date().toLocaleString('en-US') }
  ];

  streams: any[] = [
    { text: 'One', cols: 1, rows: 1 },
    { text: 'Two', cols: 1, rows: 1 },
    { text: 'Three', cols: 1, rows: 1 },
    { text: 'Four', cols: 1, rows: 1 }
  ];

  totalsVideoStreamsColumns: Number;

  currentTab: String = 'contacts'; // or 'chat'
  groupName: String = 'My Group'

  ngOnInit(): void {
    if (this.userContextService.isMobile) {
      this.totalsVideoStreamsColumns = 1;
    } else {
      this.totalsVideoStreamsColumns = 2;
    }

    this.openDialog(DialogType.APP_LOGIN);
  }

  /**
   * event handler for tab selection
   * @param selectedTab 
   */
  selectTab(selectedTab: String) {
    this.currentTab = selectedTab;
  }

  /**
   * open appropriate dialog
   * 
   * @param dialogType type of dialog
   * @param data data to be passed to close handler
   */
  openDialog(dialogType: DialogType, data = {}) {
    switch (dialogType) {
      case DialogType.APP_LOGIN:
        this.dialogRef = this.dialog.open(AppLoginDialogComponent, {
          disableClose: true,
          panelClass: 'dialog-class',
          data
        });
        break;

      case DialogType.GROUP_LOGIN:
        this.dialogRef = this.dialog.open(GroupLoginDialogComponent, {
          disableClose: true,
          panelClass: 'dialog-class',
          data
        });
        break;

      case DialogType.PROGRESS:
        this.dialogRef = this.dialog.open(ProgressDialogComponent, {
          disableClose: true,
          data
        });
        break;

      case DialogType.INFORMATIONAL:
        break;

      default:
      //do nothing here
    }
    this.dialogRef.afterClosed().subscribe(this.handleDialogClose.bind(this));
  }

  /**
   * close currently open dialog with appropriate data
   * 
   * @param dialogType type of dialog
   * @param data data to be passed to close handler
   * 
   */
  closeDialog(dialogType: DialogType, data = {}) {
    this.dialogRef.close(data);
  }

  /**
   * this will handle dialog close
   * @param dialogueCloseResult result data sent by the component contained in the dialog which got closed
   * 
   */
  handleDialogClose(dialogueCloseResult: DialogCloseResult) {
    LoggerUtil.log(`dialog got closed with result: ${JSON.stringify(dialogueCloseResult)}`);
    switch (dialogueCloseResult.type) {
      case DialogType.APP_LOGIN:
        this.openDialog(DialogType.PROGRESS, {
          message: 'login in progress'
        });
        break;

      case DialogType.GROUP_LOGIN:
        break;

      default:
      //do nothing here
    }
  }
}
