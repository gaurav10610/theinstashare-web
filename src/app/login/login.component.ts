import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { LoggerUtil } from '../services/logging/LoggerUtil';
import { ApiService } from '../services/api/api.service';
import { Router } from '@angular/router';
import { SignalingService } from '../services/signaling/signaling.service';
import { AppConstants } from '../services/AppConstants';
import { UserContextService } from '../services/context/user.context.service';
import { environment } from '../../environments/environment';
import { CoreMediaCaptureService } from '../services/media-capture/core-media-capture.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { GoogleAnalyticsService } from 'ngx-google-analytics';
import { MatIconRegistry } from "@angular/material/icon";
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'app-signin-root',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {

  constructor(
    private router: Router,
    public signalingService: SignalingService,
    private userContextService: UserContextService,
    private coreMediaCaptureService: CoreMediaCaptureService,
    private snackBar: MatSnackBar,
    private gaService: GoogleAnalyticsService,
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer
  ) {
    // adding github icon in registry
    this.matIconRegistry.addSvgIcon('github', this.domSanitizer
      .bypassSecurityTrustResourceUrl(this.assetsPath + 'images/icons/github-icon.svg'));
  }

  inputFieldLabel: String = 'Username';
  assetsPath = environment.is_native_app ? 'assets/' : '../../assets/';

  @ViewChild('usernameInput', { static: false }) usernameInput: ElementRef;

  errorMessage: String;
  isRegistering: Boolean = false;

  async ngOnInit() {

    this.gaService.pageView('/login', 'Login');

    LoggerUtil.log('ngOnit of login component');

    // setTimeout(() => { this.stopNotification = false; }, 5000);

    try {
      const message: string = await this.coreMediaCaptureService.takeCameraAndMicrophoneAccess();
      LoggerUtil.log('got camera/microphone permissions');
    } catch (errorMessage) {
      this.snackBar.open(errorMessage);
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
   * This will register all the event listeners
   */
  setUpSignaling() {
    this.signalingService.signalingRouter.off('connect');
    this.signalingService.signalingRouter.off('reconnect');
    this.signalingService.signalingRouter.off('message');
    const eventsConfig = {
      onopen: () => {
        this.snackBar.dismiss();
      },
      onreconnect: () => {
        this.snackBar.dismiss();
      },
      onmessage: this.onRouterMessage.bind(this),
      onclose: () => {
        this.snackBar.open('disconnected from server....');
      }
    };
    this.signalingService.registerEventListeners(eventsConfig);
  }

  /**
   * 
   * login handler
   */
  login(event?: any) {
    if (event) {
      // when user hits enter
      if (event.keyCode === 13) {
        this.isRegistering = true;
        this.register();
      } else {
        this.errorMessage = undefined;
      }
    } else {
      this.register();
    }
  }

  /**
   * this will handle registration with signaling server
   */
  async register() {
    this.isRegistering = true;
    const username: String = this.usernameInput.nativeElement.value
      ? this.usernameInput.nativeElement.value.trim()
      : undefined;

    /**
     * validate username value
     */
    if (username === undefined || username === '') {
      this.errorMessage = 'username is either invalid or already been taken';
      this.isRegistering = false;
      return;
    }

    const isUsernameTaken: Boolean = await this.signalingService.checkIfUsernameTaken(username);
    if (isUsernameTaken) {
      this.errorMessage = 'username is either invalid or already been taken';
      this.isRegistering = false;
    } else {
      this.signalingService.registerOnSignalingServer(username, false);
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

          this.errorMessage = undefined;
          this.isRegistering = false;

          this.signalingService.signalingRouter.off('message');
          this.signalingService.signalingRouter.off('connect');
          this.gaService.event('login_event', 'user_logged_in', 'User logged in', message[AppConstants.USERNAME], true);
          this.router.navigateByUrl('app');
        } else {
          this.errorMessage = 'username is either invalid or already been taken';
          this.isRegistering = false;
        }
        break;
      default:
        LoggerUtil.log('unknown message type');
    }
  }

  redirectToCodeRepo() {
    window.open('https://github.com/gaurav10610/theinstashare-web', '_blank');
  }
}
