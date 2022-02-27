import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { GoogleAnalyticsService } from 'ngx-google-analytics';
import { environment } from 'src/environments/environment';
import { ApiService } from '../services/api/api.service';
import { UserContextService } from '../services/context/user.context.service';
import { CoreDataChannelService } from '../services/data-channel/core-data-channel.service';
import { LoggerUtil } from '../services/logging/LoggerUtil';
import { SignalingService } from '../services/signaling/signaling.service';
import { CoreAppUtilityService } from '../services/util/core-app-utility.service';
import { CoreWebrtcService } from '../services/webrtc/core-webrtc.service';

@Component({
  selector: 'app-file-transfer-window',
  templateUrl: './file-transfer-window.component.html',
  styleUrls: ['./file-transfer-window.component.scss']
})
export class FileTransferWindowComponent implements OnInit, OnDestroy {

  constructor(
    private userContextService: UserContextService,
    private coreAppUtilService: CoreAppUtilityService,
    private signalingService: SignalingService,
    private coreDataChannelService: CoreDataChannelService,
    private coreWebrtcService: CoreWebrtcService,
    private apiService: ApiService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private router: Router,
    private gaService: GoogleAnalyticsService
  ) { }

  dialogRef: MatDialogRef<any>;

  //assets path
  assetsPath = environment.is_native_app ? 'assets/' : '../../assets/';

  activeUsers: any[] = [
    { name: 'gaurav', status: 'online' },
    { name: 'gaurav', status: 'online' },
    { name: 'gaurav', status: 'online' },
    { name: 'gaurav', status: 'online' }
  ];

  messages: any[] = [
    { name: 'gaurav', message: 'I am good. How\'re you?', received: new Date().toLocaleString('en-US') },
    { name: 'gaurav', message: 'I am good. How\'re you?', received: new Date().toLocaleString('en-US') },
    { name: 'gaurav', message: 'I am good. How\'re you?', received: new Date().toLocaleString('en-US') },
    { name: 'gaurav', message: 'I am good. How\'re you?', received: new Date().toLocaleString('en-US') }
  ];

  streams: any[] = [
    { text: 'One', cols: 1, rows: 1 },
    { text: 'Two', cols: 1, rows: 1 }
  ];

  totalVideoStreamsColumns: Number;

  currentTab: String = 'cloud-upload'; // or 'chat'

  ngOnInit(): void {
    this.gaService.pageView('/file-transfer', 'File Transfer');

    if (this.userContextService.isMobile) {
      this.totalVideoStreamsColumns = 1;
    } else {
      this.totalVideoStreamsColumns = 2;
    }
  }

  /**
   * do clean up here before this component  get destroyed
   */
  ngOnDestroy(): void {
  }

  /**
   * event handler for tab selection
   * @param selectedTab 
   */
  selectTab(selectedTab: String) {
    this.currentTab = selectedTab;
  }

  /**
   * logout from theinstshare
   */
  logout() {
    LoggerUtil.log('logging out.........');
    /**
     * send de-register message to server to notify that user has opted to
     * logout
     */
    this.signalingService.deRegisterOnSignalingServer(this.userContextService.getUserName());
    this.userContextService.applicationSignOut();
    this.userContextService.resetCoreAppContext();
    this.router.navigateByUrl('login');
  }

}
