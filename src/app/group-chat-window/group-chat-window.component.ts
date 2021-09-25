import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { environment } from 'src/environments/environment';
import { GroupLoginDialogComponent } from '../group-login-dialog/group-login-dialog.component';
import { UserContextService } from '../services/context/user.context.service';

@Component({
  selector: 'app-group-chat-window',
  templateUrl: './group-chat-window.component.html',
  styleUrls: ['./group-chat-window.component.scss']
})
export class GroupChatWindowComponent implements OnInit {

  //assets path
  assetsPath = environment.is_native_app ? 'assets/' : '../../assets/';

  activeUsers: any[] = [
    { name: 'gaurav', status: 'online' },
    { name: 'suman', status: 'online' },
    { name: 'tillu', status: 'online' },
    { name: 'billu', status: 'offline' },
    { name: 'shikha', status: 'offline' },
    { name: 'prabhat', status: 'offline' },
    { name: 'paras', status: 'online' },
    { name: 'billu', status: 'online' },
    { name: 'shikha', status: 'online' },
    { name: 'prabhat', status: 'online' },
    { name: 'paras', status: 'online' },
    { name: 'billu', status: 'online' },
    { name: 'shikha', status: 'online' },
    { name: 'prabhat', status: 'online' },
    { name: 'paras', status: 'online' },
    { name: 'shikha', status: 'online' },
    { name: 'prabhat', status: 'online' },
    { name: 'paras', status: 'online' },
    { name: 'billu', status: 'online' },
    { name: 'shikha', status: 'online' },
    { name: 'prabhat', status: 'online' },
    { name: 'paras', status: 'online' }
  ];

  messages: any[] = [
    { name: 'gaurav', message: 'I am good. How\'re you?', received: new Date().toLocaleString('en-US') },
    { name: 'suman', message: 'I am good. How\'re you?', received: new Date().toLocaleString('en-US') },
    { name: 'tillu', message: 'I am good. How\'re you?', received: new Date().toLocaleString('en-US') },
    { name: 'billu', message: 'I am good. How\'re you?', received: new Date().toLocaleString('en-US') },
    { name: 'shikha', message: 'I am good. How\'re you?', received: new Date().toLocaleString('en-US') },
    { name: 'prabhat', message: 'I am good. How\'re you?', received: new Date().toLocaleString('en-US') },
    { name: 'gaurav', message: 'I am good. How\'re you?', received: new Date().toLocaleString('en-US') },
    { name: 'suman', message: 'I am good. How\'re you?', received: new Date().toLocaleString('en-US') },
    { name: 'tillu', message: 'I am good. How\'re you?', received: new Date().toLocaleString('en-US') },
    { name: 'billu', message: 'I am good. How\'re you?', received: new Date().toLocaleString('en-US') },
    { name: 'shikha', message: 'I am good. How\'re you?', received: new Date().toLocaleString('en-US') },
    { name: 'prabhat', message: 'I am good. How\'re you?', received: new Date().toLocaleString('en-US') },
    { name: 'gaurav', message: 'I am good. How\'re you?', received: new Date().toLocaleString('en-US') },
    { name: 'suman', message: 'I am good. How\'re you?', received: new Date().toLocaleString('en-US') },
    { name: 'tillu', message: 'I am good. How\'re you?', received: new Date().toLocaleString('en-US') },
    { name: 'billu', message: 'I am good. How\'re you?', received: new Date().toLocaleString('en-US') },
    { name: 'shikha', message: 'I am good. How\'re you?', received: new Date().toLocaleString('en-US') },
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

  constructor(
    private userContextService: UserContextService,
    public dialog: MatDialog
  ) { }

  ngOnInit(): void {
    if (this.userContextService.isMobile) {
      this.totalsVideoStreamsColumns = 1;
    } else {
      this.totalsVideoStreamsColumns = 2;
    }
    // this.dialog.open(GroupLoginDialogComponent, {
    //   disableClose: true,
    //   panelClass: 'dialog-class'
    // });
  }

  /**
   * event handler for tab selection
   * @param selectedTab 
   */
  selectTab(selectedTab: String) {
    this.currentTab = selectedTab;
  }

}
