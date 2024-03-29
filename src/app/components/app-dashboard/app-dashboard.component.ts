import { Component, OnInit } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { Router } from "@angular/router";
import { GoogleAnalyticsService } from "ngx-google-analytics";
import { MatIconRegistry } from "@angular/material/icon";
import { DomSanitizer } from "@angular/platform-browser";
import { ApiService } from "src/app/services/api/api.service";
import { AppConstants } from "src/app/services/AppConstants";
import { UserContextService } from "src/app/services/context/user.context.service";
import { DashboardAppIconContext } from "src/app/services/contracts/DashboardAppIconContext";
import { LoggerUtil } from "src/app/services/logging/LoggerUtil";
import { SignalingService } from "src/app/services/signaling/signaling.service";
import { CoreAppUtilityService } from "src/app/services/util/core-app-utility.service";
import { environment } from "src/environments/environment";

@Component({
  selector: "app-app-dashboard",
  templateUrl: "./app-dashboard.component.html",
  styleUrls: ["./app-dashboard.component.scss"],
})
export class AppDashboardComponent implements OnInit {
  constructor(
    public signalingService: SignalingService,
    public userContextService: UserContextService,
    private snackBar: MatSnackBar,
    private apiService: ApiService,
    private router: Router,
    private coreAppUtilService: CoreAppUtilityService,
    private gaService: GoogleAnalyticsService,
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer
  ) {
    // adding svg icons
    this.matIconRegistry.addSvgIcon(
      "peer_chat_icon",
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        this.assetsPath + "one-to-one-chat.svg"
      )
    );
    this.matIconRegistry.addSvgIcon(
      "group_chat_icon",
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        this.assetsPath + "group-chat.svg"
      )
    );
    this.matIconRegistry.addSvgIcon(
      "file_tranfer_icon",
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        this.assetsPath + "file-transfer.svg"
      )
    );
    this.matIconRegistry.addSvgIcon(
      "coming_soon_icon",
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        this.assetsPath + "coming-soon.svg"
      )
    );
  }

  appIconsContext: DashboardAppIconContext[] = [];
  //assets path
  assetsPath = environment.is_native_app
    ? "assets/images/icons/"
    : "../../../assets/images/icons/";
  isRegistering: Boolean = false;

  appConfig: any = {
    p2p: {
      iconName: "peer_chat_icon",
      identifier: "p2p",
      iconText: "1:1 Chat",
    },
    group_chat: {
      iconName: "group_chat_icon",
      identifier: "group_chat",
      iconText: "Group Chat",
    },
    file_transfer: {
      iconName: "file_tranfer_icon",
      identifier: "file_transfer",
      iconText: "File Transfer",
    },
    coming_soon_icon: {
      iconName: "coming_soon_icon",
      identifier: "coming_soon_icon",
      iconText: "More Apps..",
    },
  };

  ngOnInit(): void {
    this.gaService.pageView("/app", "App Dashboard", undefined, {
      user: this.userContextService.getUserName(),
    });

    //remove existing signaling event listeners
    this.signalingService.signalingRouter.off("connect");
    this.signalingService.signalingRouter.off("disconnect");
    this.signalingService.signalingRouter.off("message");
    this.signalingService.signalingRouter.off("reconnect");

    //reset values for instance variables
    this.isRegistering = false;
    this.userContextService.selectedApp = undefined;

    for (const appName of environment.apps_config) {
      this.appIconsContext.push(this.appConfig[appName]);
    }
    this.setUpSignaling();
  }

  /**
   * This will register all the event listeners
   */
  setUpSignaling() {
    if (this.signalingService.isRegistered) {
      /**
       * this is the case when user has already been registered with server,
       * usually the scenario when user is routed to this component after logging
       * in via login page
       *
       *
       * a. register the 'reconnect' and 'onmessage' handlers only in this scenario
       *
       */
      const eventsConfig = {
        onmessage: this.onRouterMessage.bind(this),
        onreconnect: this.onRouterConnect.bind(this),
        onclose: () => {
          this.snackBar.open("disconnected from server....");
        },
      };

      this.signalingService.registerEventListeners(eventsConfig);
    } else {
      /**
       * this is the case when user either reloads this page or directly came on
       * this page via its url
       *
       *
       * if username is available then app will try to register user with that
       * username only on to the server else user will be routed to login page
       * to login again
       *
       *
       * a. if username is available then register open, reconnect and message
       * handlers in this scenario
       */
      const username = this.userContextService.getUserName();
      if (username) {
        const eventsConfig = {
          onopen: this.onRouterConnect.bind(this),
          onreconnect: this.onRouterConnect.bind(this),
          onmessage: this.onRouterMessage.bind(this),
          onclose: () => {
            this.snackBar.open("disconnected from server....");
          },
        };
        this.signalingService.registerEventListeners(eventsConfig);
      } else {
        /**
         * route user to login page as username isn't available for registering
         */
        this.router.navigateByUrl("login");
      }
    }
  }

  /**
   * handler to handle messages received via server or via webrtc datachannel
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
      LoggerUtil.logAny(
        `received message via ${signalingMessage.via}: ${JSON.stringify(
          signalingMessage
        )}`
      );
      switch (signalingMessage.type) {
        case AppConstants.REGISTER:
          await this.handleRegister(signalingMessage);
          break;

        default:
          LoggerUtil.logAny(
            "received unknown signaling message with type: " +
              signalingMessage.type
          );
      }
    } catch (err) {
      LoggerUtil.logAny(
        `error occured while handling received signaling message: ${JSON.stringify(
          signalingMessage
        )}`
      );
      LoggerUtil.logAny(err);
    }
  }

  /*
   * handler to handle connection open event with server
   * @TODO this can be removed later
   */
  onRouterConnect() {
    this.signalingService.registerOnSignalingServer(
      this.userContextService.getUserName(),
      true
    );
    this.snackBar.dismiss();
  }

  /**
   * handle to handle received messages of type 'register'
   *
   * @param signalingMessage received signaling message
   * @TODO remove it afterwards as this is a common module
   */
  handleRegister(signalingMessage: any) {
    return new Promise<void>((resolve) => {
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
        this.coreAppUtilService.setStorageValue(
          AppConstants.STORAGE_USER,
          signalingMessage.username
        );
      } else {
        /**
         * this is the case when user registration with server gets failed
         *
         * redirect the user to login page
         */
        this.router.navigateByUrl("login");
      }
      resolve();
    });
  }

  /**
   * register user in selected application
   * @param applicationName name of the selected application
   */
  async registerApplicationUser(applicationName: String) {
    if (applicationName === "coming_soon_icon") {
      return; // coming soon label
    }
    if (this.isRegistering) {
      LoggerUtil.logAny("already registering user");
    } else {
      LoggerUtil.logAny(`user selected application: ${applicationName}`);
      this.userContextService.selectedApp = applicationName;
      this.isRegistering = true;
      try {
        /**
         *
         * make api call to register user
         * @TODO refactor it afterwards, due to few issues do it via socket message only
         *
         */
        const data: any = await this.apiService
          .post(AppConstants.API_ENDPOINTS.REGISTER_APP_USER, {
            username: this.userContextService.username,
            groupName: applicationName,
          })
          .toPromise();

        if (data && data.registered) {
          LoggerUtil.logAny(
            `user was succussfully registered for app: ${this.userContextService.selectedApp}`
          );
          this.coreAppUtilService.setStorageValue(
            AppConstants.STORAGE_APPLICATION,
            applicationName.toString()
          );

          /**
           *
           * onopen event handler won't be needed after user is registered as even
           * in the disconnect cases we will manage reconnect handler only
           *
           */
          this.signalingService.signalingRouter.off("connect");
          this.signalingService.signalingRouter.off("disconnect");
          this.signalingService.signalingRouter.off("message");
          this.signalingService.signalingRouter.off("reconnect");
          /**
           *
           * route to appropriate app
           */
          switch (applicationName) {
            case AppConstants.APPLICATION_NAMES.P2P:
              this.router.navigateByUrl("talk");
              break;

            case AppConstants.APPLICATION_NAMES.GROUP_CHAT:
              this.router.navigateByUrl("group-chat");
              break;

            case AppConstants.APPLICATION_NAMES.FILE_TRANSFER:
              this.router.navigateByUrl("file-transfer");
              break;
          }
        } else {
          LoggerUtil.logAny("user registration was unsuccessful");
        }
      } catch (e) {
        LoggerUtil.logAny(
          "error while registering user for selected application"
        );
        LoggerUtil.logAny(e);
        this.isRegistering = false;
        this.userContextService.selectedApp = undefined;
      }
    }
  }

  /**
   * logout from theinstshare
   */
  logout() {
    LoggerUtil.logAny("logging out.........");
    /**
     * send de-register message to server to notify that user has opted to
     * logout
     */
    this.signalingService.deRegisterOnSignalingServer(
      this.userContextService.getUserName()
    );
    this.userContextService.applicationSignOut();
    this.userContextService.resetCoreAppContext();
    this.userContextService.userSignOut();
    this.router.navigateByUrl("login");
  }
}
