import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { LoggerUtil } from '../services/logging/LoggerUtil';
import { ApiService } from '../services/api/api.service';
import { Router } from '@angular/router';
import { SignalingService } from '../services/signaling/signaling.service';
import { AppConstants } from '../services/AppConstants';
import { UserContextService } from '../services/context/user.context.service';
import { environment } from '../../environments/environment';
import { CoreMediaCaptureService } from '../services/media-capture/core-media-capture.service';

@Component({
  selector: 'app-signin-root',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {

  constructor(
    private apiService: ApiService,
    private router: Router,
    public signalingService: SignalingService,
    private userContextService: UserContextService,
    private coreMediaCaptureService: CoreMediaCaptureService
  ) { }

  /**
   * view binding property 
   */
  connecting = false;

  @ViewChild('username', { static: false }) usernameInput: ElementRef;

  //assets path
  assetsPath = environment.is_native_app ? 'assets/' : '../../assets/';

  stopNotification: boolean = true;

  /**
   * this is flagged error text
   */
  flaggedErrorText: string = undefined;

  //This contains any errors encountered within app
  errors = [];

  async ngOnInit() {
    LoggerUtil.log('ngOnit of login component');
    setTimeout(() => { this.stopNotification = false; }, 5000);

    //resetting instance variables
    this.connecting = false;
    this.flaggedErrorText = undefined;

    try {
      const message: string = await this.coreMediaCaptureService.takeCameraAndMicrophoneAccess();
      LoggerUtil.log('got camera/microphone permissions');
    } catch (errorMessage) {
      this.flagError(errorMessage);
    }

    /**
     * if user is navigated to login component after pressing back button 
     * without logging out(usually happens in mobile) then de-register the user
     */
    if (this.signalingService.isRegistered) {
      this.signalingService.deRegisterOnSignalingServer(this.userContextService.getUserName());
    }
    this.userContextService.userSignOut();
    this.setUpSignaling();
  }

  /**
   * Form submit event
   */
  formSubmit() {
    this.register();
    return false;
  }

  /**
   * This will register all the event listeners
   */
  setUpSignaling() {
    this.signalingService.signalingRouter.off('connect');
    this.signalingService.signalingRouter.off('reconnect');
    this.signalingService.signalingRouter.off('message');
    const eventsConfig = {
      onmessage: this.onRouterMessage.bind(this)
    };
    this.signalingService.registerEventListeners(eventsConfig);
  }

  /**
   * this will handle registration with signaling server
   */
  async register() {
    if (!this.connecting) {
      this.connecting = true;

      //remove the error text first
      this.flaggedErrorText = undefined;
      const username: string = this.usernameInput.nativeElement.value;

      /**
       * validate username value
       */
      if (username === '') {
        // this.flagError('username cannot be left empty');
        this.flaggedErrorText = 'username cannot be left empty';
        this.connecting = false;
      } else {
        this.apiService.get('status/' + username).subscribe((data: any) => {
          if (data.status) {
            // this.flagError('username is taken. Please try again!');
            this.flaggedErrorText = 'username is taken. Please try again!';
            this.connecting = false;
          } else {
            this.signalingService.registerOnSignalingServer(username, false);
          }
        });
      }
    } else {
      LoggerUtil.log('Already sent request for registering.');
    }
  }

  /**
   * On message handler for signaling message router
   * 
   * @param message : Message received via signaling server
   */
  onRouterMessage(message: any) {
    // LoggerUtil.log(message);
    switch (message.type) {
      case AppConstants.REGISTER:
        // successfully registered
        if (message.success) {
          this.signalingService.isRegistered = message.success;
          this.userContextService.username = message[AppConstants.USERNAME];
          sessionStorage.setItem(AppConstants.STORAGE_USER, message[AppConstants.USERNAME]);

          // Removing message listener of login component
          this.signalingService.signalingRouter.off('message');
          /* Routing towards talk window */
          // this.router.navigateByUrl('talk');
          this.router.navigateByUrl('app');
        } else {
          // failed to register
          // this.flagError('username has already been taken. Try again!');
          this.flaggedErrorText = 'username has already been taken. Try again!';
          this.connecting = false;
        }
        break;
      default:
        LoggerUtil.log('unknown message type');
    }
  }

  /**
   * this will flag an error message in the app for a time period and then will
   * remove it
   *
   * @param errorMessage error message that needs to be displayed
   */
  flagError(errorMessage: string) {
    this.errors.push(errorMessage);
    setTimeout(() => {
      const index = this.errors.indexOf(errorMessage);
      if (index > -1) {
        this.errors.splice(index, 1);
      }
    }, AppConstants.ERROR_FLAG_TIMEOUT);
  }
}
