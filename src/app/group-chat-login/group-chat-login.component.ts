import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from 'src/environments/environment';
import { ApiService } from '../services/api/api.service';
import { UserContextService } from '../services/context/user.context.service';
import { LoggerUtil } from '../services/logging/LoggerUtil';
import { SignalingService } from '../services/signaling/signaling.service';

@Component({
  selector: 'app-group-chat-login',
  templateUrl: './group-chat-login.component.html',
  styleUrls: ['./group-chat-login.component.css']
})
export class GroupChatLoginComponent implements OnInit {

  constructor(
    private apiService: ApiService,
    private router: Router,
    public signalingService: SignalingService,
    private userContextService: UserContextService,
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

  ngOnInit(): void {
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
   * Form submit event
   */
  formSubmit() {
    this.register();
    return false;
  }
}
