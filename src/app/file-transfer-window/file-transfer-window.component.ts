import { ApplicationRef, Component, OnDestroy, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { GoogleAnalyticsService } from 'ngx-google-analytics';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { AppLoginDialogComponent } from '../app-login-dialog/app-login-dialog.component';
import { IconsDialogComponent } from '../icons-dialog/icons-dialog.component';
import { MediaViewerDialogComponent } from '../media-viewer-dialog/media-viewer-dialog.component';
import { ProgressDialogComponent } from '../progress-dialog/progress-dialog.component';
import { ApiService } from '../services/api/api.service';
import { AppConstants } from '../services/AppConstants';
import { FileTransferContextService } from '../services/context/file-transfer/file-transfer-context.service';
import { UserContextService } from '../services/context/user.context.service';
import { DialogCloseResult } from '../services/contracts/dialog/DialogCloseResult';
import { DialogCloseResultType } from '../services/contracts/enum/DialogCloseResultType';
import { DialogType } from '../services/contracts/enum/DialogType';
import { CoreDataChannelService } from '../services/data-channel/core-data-channel.service';
import { LoggerUtil } from '../services/logging/LoggerUtil';
import { SignalingService } from '../services/signaling/signaling.service';
import { CoreAppUtilityService } from '../services/util/core-app-utility.service';
import { FileTransferUtilityService } from '../services/util/file-transfer-utility.service';
import { CoreWebrtcService } from '../services/webrtc/core-webrtc.service';
import { FileTransferService } from '../services/webrtc/file-transfer-webrtc.service';

@Component({
  selector: 'app-file-transfer-window',
  templateUrl: './file-transfer-window.component.html',
  styleUrls: ['./file-transfer-window.component.scss']
})
export class FileTransferWindowComponent implements OnInit, OnDestroy {

  constructor(
    private userContextService: UserContextService,
    private fileTransferContextService: FileTransferContextService,
    private fileTransferUtilService: FileTransferUtilityService,
    private fileTransferService: FileTransferService,
    private coreAppUtilService: CoreAppUtilityService,
    private signalingService: SignalingService,
    private coreDataChannelService: CoreDataChannelService,
    private coreWebrtcService: CoreWebrtcService,
    private apiService: ApiService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private router: Router,
    private gaService: GoogleAnalyticsService,
    private applicationRef: ApplicationRef,
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

  currentTab: String = 'cloud-upload'; // or 'chat'

  async ngOnInit(): Promise<void> {
    this.gaService.pageView('/file-transfer', 'File Transfer');
    await this.setupSignaling();
  }

  /**
   * do clean up here before this component  get destroyed
   */
  ngOnDestroy(): void {
  }

  /**
   * signaling setup
   */
  async setupSignaling(): Promise<void> {
    if (this.signalingService.isRegistered) {

      /**
       * this is the case when user has already been registered with server,
       * usually the scenario when user is routed to this component after logging
       * in via login page
       *
       *
       * a. register the 'reconnect' and 'onmessage' handlers only in this scenario
       *
       * b. fetch all the active users list from server
       */
      const eventsConfig = {
        onreconnect: this.onRouterConnect.bind(this),
        onmessage: this.onRouterMessage.bind(this),
        onclose: () => {
          this.snackBar.open('disconnected from server....');
        }
      };

      this.signalingService.registerEventListeners(eventsConfig);
      if (this.userContextService.selectedApp === undefined) {
        try {
          await this.registerApplicationUser(AppConstants.APPLICATION_NAMES.FILE_TRANSFER);
        } catch (error) {
          LoggerUtil.log(error);
          this.router.navigateByUrl('app');
        }
      }
      await this.fetchActiveUsersList();
    } else {

      /**
       * this is the case when user either reloads this page or directly came on
       * this page via its url
       * 
       */
      const eventsConfig = {
        onopen: this.onRouterConnect.bind(this),
        onreconnect: this.onRouterConnect.bind(this),
        onmessage: this.onRouterMessage.bind(this),
        onclose: () => {
          this.snackBar.open('disconnected from server....');
        }
      };
      this.signalingService.registerEventListeners(eventsConfig);
    }
  }

  /**
   * register user in selected application
   * @param applicationName name of the selected application
   */
  async registerApplicationUser(applicationName: String): Promise<String> {
    const data: any = await firstValueFrom(this.apiService.post(AppConstants.API_ENDPOINTS.REGISTER_APP_USER, {
      username: this.userContextService.username,
      groupName: applicationName
    }));

    if (data && data.registered) {
      LoggerUtil.log(`user was succussfully registered for app: ${applicationName}`);
      this.userContextService.selectedApp = applicationName;
      this.coreAppUtilService.setStorageValue(AppConstants.STORAGE_APPLICATION, applicationName.toString());
      return 'user application registration was successful';
    } else {
      this.userContextService.selectedApp = undefined;
      throw new Error('user application registration was unsuccessful');
    }
  }

  /**
   * fetch list of all the active users from server and update them in the
   * contact list view with their connected status
   *
   */
  async fetchActiveUsersList(): Promise<void> {
    const data: any = await this.apiService
      .get(`${AppConstants.API_ENDPOINTS.GET_ALL_ACTIVE_USERS}?groupName=${AppConstants.APPLICATION_NAMES.FILE_TRANSFER}`).toPromise();

    //clear userStatus object
    this.fileTransferContextService.userStatus.clear();
    //clear active users list
    this.fileTransferContextService.activeUsers = [];
    data.users.forEach((user: string) => {
      this.fileTransferUtilService.updateUserStatus(true, user);
    });
  }

  /*
   * handle connection open event with server
   */
  onRouterConnect() {
    const username: String = this.userContextService.getUserName()
      ? this.userContextService.getUserName().trim()
      : undefined;
    if (username) {
      this.openDialog(DialogType.PROGRESS, {
        message: 'login in progress'
      });
      this.signalingService.registerOnSignalingServer(username, true);
    } else {
      this.openDialog(DialogType.APP_LOGIN);
    }
    this.snackBar.dismiss();
  }

  /**
   * handle messages received via server or via webrtc datachannel
   *
   *
   * while sending any message to other user app gives first priority to existing
   * datachannel between two users to exchange any messages(see the existing
   * supported message types below) between them if it found one else it will
   * send the messages to other user via signaling server only
   *
   *
   * @param signalingMessage received signaling message
   *
   */
  async onRouterMessage(signalingMessage: any) {
    try {
      LoggerUtil.log('received message via ' + signalingMessage.via + ': ' + JSON.stringify(signalingMessage));
      switch (signalingMessage.type) {
        case AppConstants.REGISTER:
          await this.handleRegister(signalingMessage);
          break;

        default:
          LoggerUtil.log('received unknown signaling message with type: ' + signalingMessage.type);
      }
      this.applicationRef.tick();
    } catch (err) {
      LoggerUtil.log('error occured while handling received signaling message');
      LoggerUtil.log(JSON.stringify(signalingMessage));
      LoggerUtil.log(err);
    }
  }

  /**
   * handle to handle received messages of type 'register'
   * 
   * @param signalingMessage received signaling message
   * 
   */
  async handleRegister(signalingMessage: any): Promise<void> {
    if (signalingMessage.success) {

      /**
       * this is the case when user was successfully able to register with
       * the server
       *
       *
       * received 'register' type message will have a boolean 'success'
       * property as a user registration status
       *
       * a. set the registered status property within signaling service
       *
       * b. set the chosen username in userContext
       *
       * c. set the username in the browser's storage
       *
       * d. fetch all the active users
       */
      this.signalingService.isRegistered = signalingMessage.success;
      this.userContextService.username = signalingMessage.username;
      this.coreAppUtilService.setStorageValue(AppConstants.STORAGE_USER, signalingMessage.username);
      this.closeDialog();

      /**
       * 
       * onopen event handler won't be needed after user is registered as even
       * in the disconnect cases we will manage reconnect handler only
       * 
       */
      this.signalingService.signalingRouter.off('connect');
      try {
        await this.registerApplicationUser(AppConstants.APPLICATION_NAMES.FILE_TRANSFER);
        await this.fetchActiveUsersList();
      } catch (error) {
        LoggerUtil.log(error);
        this.router.navigateByUrl('app');
      }

    } else {

      /**
       * user registeration failed case - 
       * 
       * close current progress dialog and open app login dialog again
       **/
      this.openDialog(DialogType.APP_LOGIN);
    }
  }

  /**
   * open appropriate dialog
   * 
   * @param dialogType type of dialog
   * @param data data to be passed to close handler
   */
  openDialog(dialogType: DialogType, data = {}) {
    this.closeDialog();
    switch (dialogType) {
      case DialogType.APP_LOGIN:
        this.dialogRef = this.dialog.open(AppLoginDialogComponent, {
          disableClose: true,
          panelClass: 'dialog-class',
          data,
          width: this.userContextService.isMobile ? '300px' : undefined
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

      case DialogType.ICONS_POPUP:
        this.dialogRef = this.dialog.open(IconsDialogComponent, {
          data,
          width: this.userContextService.isMobile ? '300px' : undefined
        });
        break;

      default:
      //do nothing here
    }
    this.dialogRef.afterClosed().subscribe(this.handleDialogClose.bind(this));
  }

  /**
   * this will handle dialog close
   * @param dialogCloseResult result data sent by the component contained in the dialog which got closed
   * 
   */
  handleDialogClose(dialogCloseResult?: DialogCloseResult) {
    if (dialogCloseResult === undefined) {
      return;
    }
    LoggerUtil.log(`dialog got closed with result: ${JSON.stringify(dialogCloseResult)}`);
    switch (dialogCloseResult.type) {
      case DialogCloseResultType.APP_LOGIN:
        this.openDialog(DialogType.PROGRESS, {
          message: 'login in progress'
        });
        this.signalingService.registerOnSignalingServer(dialogCloseResult.data.username, true);
        break;

      case DialogCloseResultType.MEDIA_VIEWER:
        LoggerUtil.log(`media viewer dialog closed for content type: ${dialogCloseResult.data.contentType}`);
        break;

      default:
      //do nothing here
    }
  }

  /**
   * close currently open dialog with appropriate data
   * 
   * @param data data to be passed to close handler
   * 
   */
  closeDialog(data = {}) {
    if (this.dialogRef) {
      this.dialogRef.close(data);
    }
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
