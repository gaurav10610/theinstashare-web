import { AfterViewInit, ApplicationRef, Component, ElementRef, OnDestroy, OnInit, Renderer2, ViewChild } from '@angular/core';
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
import { MessageContext } from '../services/contracts/context/MessageContext';
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
export class FileTransferWindowComponent implements OnInit, OnDestroy, AfterViewInit {

  constructor(
    public userContextService: UserContextService,
    public contextService: FileTransferContextService,
    private utilityService: FileTransferUtilityService,
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
    private renderer: Renderer2,
  ) { }

  @ViewChild('textMessage', { static: false }) messageInput: ElementRef;
  @ViewChild('messageHistoryDiv', { static: false }) messageHistoryDiv: ElementRef;

  dialogRef: MatDialogRef<any>;

  //assets path
  assetsPath = environment.is_native_app ? 'assets/' : '../../assets/';

  messages: any[] = [
    { name: 'gaurav', message: 'I am good. How\'re you?', timestamp: new Date().toLocaleString('en-US'), sent: true, status: 'sent' },
    { name: 'gaurav', message: 'I am good. How\'re you?', timestamp: new Date().toLocaleString('en-US'), sent: true, status: 'received' },
    { name: 'gaurav', message: 'I am good. How\'re you?', timestamp: new Date().toLocaleString('en-US'), sent: false },
    { name: 'gaurav', message: 'I am good. How\'re you?', timestamp: new Date().toLocaleString('en-US'), sent: false }
  ];

  currentTab: String = 'cloud-upload'; // or 'chat'

  async ngOnInit(): Promise<void> {
    this.gaService.pageView('/file-transfer', 'File Transfer');
    await this.setupSignaling();
  }

  ngAfterViewInit() {
  }

  /**
   * do clean up here before this component get destroyed
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
    this.contextService.userStatus.clear();
    //clear active users list
    this.contextService.activeUsers = [];
    data.users.forEach((user: string) => {
      this.utilityService.updateUserStatus(true, user);
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

        case AppConstants.USER_ACTIVE_STATUS:
          this.utilityService.updateUserStatus(signalingMessage.connected, signalingMessage.username);
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
   * this will handle selecting user from sidepanel
   * 
   * @param username 
   */
  selectUser(username: string) {
    this.userContextService.userToChat = username;
  }

  /**
   * back to contacts click handler
   *
   * this button is available only on mobile screen view
   */
  backToContacts() {
    const userToChat = this.userContextService.userToChat;
    this.userContextService.userToChat = undefined;
  }

  /**
   * send text message from input
   */
  sendTextMessage(event?: KeyboardEvent) {
    //get the currenty selected user
    const userToChat = this.userContextService.userToChat;

    /**
     * 
     * call made via keyup input message event
     */
    if (event) {
      //when user hits 'Enter' button to send message
      if (event.code === 'Enter') {
        /**
         * send typed text message over webrtc datachannel
         */
        this.sendMessageOnChannel(this.messageInput.nativeElement.value, userToChat);
        //clear the text box
        this.renderer.setProperty(this.messageInput.nativeElement, 'value', '');
        /**
         * @TODO see if this is a good practice
         */
        this.messageInput.nativeElement.focus();
      }
    } else {
      // when user hits the send message button
      this.sendMessageOnChannel(this.messageInput.nativeElement.value, userToChat);
      this.renderer.setProperty(this.messageInput.nativeElement, 'value', '');
      /**
       * @TODO see if this is a good practice
       */
      this.messageInput.nativeElement.focus();
    }
  }

  /**
   * sent text message via data channel
   * 
   * @param textMessage text message to be sent
   * @param username username of the user to whom message has to be sent
   * 
   */
  sendMessageOnChannel(textMessage: string, username: string) {
    try {
      if (textMessage !== '') {

      }
    } catch (error) {
      LoggerUtil.log(error);
      LoggerUtil.log('error occured while sending message: ' + textMessage + ' to user: ' + username);
    }
  }

  /**
    * this will update text message sent/received via data channel in the appropriate
    * user's message context and in the current chat window as well if message
    * sender is the currently selected user
    *
    * @param messageContext json payload containing the message
    *
    * @return a promise containing the message read status i.e 'seen','received' etc
    */
  async updateChatMessages(messageContext: MessageContext): Promise<string> {

    /**
     * initialize the message status as 'NA' for a start and this will be
     * updated later on
     */
    let messageStatus: string = AppConstants.CHAT_MESSAGE_STATUS.NOT_APPLICABLE;
    this.contextService.initializeMessageContext(messageContext[AppConstants.USERNAME]);

    /**
     * if the message is received then,
     * a. play the message received app sound
     * b. update the peviously initialized message status to 'DELIVERED'
     *
     */
    if (!messageContext.isSent) {
      this.playIncomeingMessageTune(true);
      messageStatus = AppConstants.CHAT_MESSAGE_STATUS.DELIVERED;
      messageContext.status = AppConstants.CHAT_MESSAGE_STATUS.DELIVERED;
    }

    if (this.userContextService.userToChat === messageContext[AppConstants.USERNAME]) {

      /**
       * if user is currently chatting with the user with whom this message 
       * has been exchanged then update previously initialized message status as seen
       *
       */
      if (!messageContext.isSent) {
        messageStatus = AppConstants.CHAT_MESSAGE_STATUS.SEEN;
        messageContext.status = AppConstants.CHAT_MESSAGE_STATUS.DELIVERED;
      }
    } else {

      /**
       * if the user with whom this message has been exchanged is not visible
       * in viewport then update user's position to the top in the online
       * active users list
       *
       */
      const listElement: any = this.renderer.selectRootElement(`#contact-${messageContext[AppConstants.USERNAME]}`, true);
      let isUserVisibleInViewport: any = await this.utilityService.isElementInViewport(listElement);
      if (!isUserVisibleInViewport) {
        LoggerUtil.log(`user ${messageContext.username} is not visible in viewport`);
        this.coreAppUtilService.updateElemntPositionInArray(this.contextService.activeUsers, messageContext[AppConstants.USERNAME], 0);
      }

      //increment unread messages count
      this.userContextService.getUserWebrtcContext(messageContext[AppConstants.USERNAME]).unreadCount++;
    }

    /**
     * store message in user's message context
     */
    this.contextService.getMessageContext(messageContext[AppConstants.USERNAME]).push(messageContext);
    this.scrollMessages();
    this.applicationRef.tick();
    return messageStatus;
  }

  /**
   * scroll down chat message window
   *
   */
  scrollMessages(): void {
    const scrollHeight = this.renderer.selectRootElement('#message-history-div', true).scrollHeight;
    this.renderer.setProperty(this.messageHistoryDiv.nativeElement, 'scrollTop', scrollHeight);
  }

  /**
   * this will play or pause incoming message tune
   * 
   * @param playFlag flag to distinguish between play or stop
   *
   * @TODO refactor it afterwards, see if this can be done in an easy way
   */
  playIncomeingMessageTune(playFlag: boolean): void {
    if (playFlag) {
      this.renderer.selectRootElement('#messageTune', true).play();
    } else {
      this.renderer.selectRootElement('#messageTune', true).pause();
    }
  }

  /**
   * logout from theinstshare file transfer app
   */
  logout() {
    try {
      LoggerUtil.log('logging out.........');
      /**
       * send de-register message to server to notify that user has opted to
       * logout
       */
      this.signalingService.deRegisterOnSignalingServer(this.userContextService.getUserName());
      this.userContextService.applicationSignOut();
      this.userContextService.resetCoreAppContext();
      this.router.navigateByUrl('login');
    } catch (error) {
      LoggerUtil.log('error encounterd while resetting webrtc context');
      this.router.navigateByUrl('login');
    }
  }

}
