import { Component, ElementRef, Inject, OnInit, ViewChild } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { environment } from '../../environments/environment';
import { DialogCloseResult } from '../services/contracts/dialog/DialogCloseResult';
import { DialogType } from '../services/contracts/enum/DialogType';
import { LoggerUtil } from '../services/logging/LoggerUtil';
import { SignalingService } from '../services/signaling/signaling.service';

@Component({
  selector: 'app-app-login',
  templateUrl: './app-login-dialog.component.html',
  styleUrls: ['./app-login-dialog.component.scss']
})
export class AppLoginDialogComponent implements OnInit {

  constructor(
    private dialogRef: MatDialogRef<any>,
    @Inject(MAT_DIALOG_DATA) private data: any,
    private signalingServer: SignalingService
  ) { }

  inputFieldLabel: String = 'Username';
  assetsPath = environment.is_native_app ? 'assets/' : '../../assets/';

  @ViewChild('usernameInput', { static: false }) usernameInput: ElementRef;

  showError: Boolean = false;
  errorText: String = '*username is either invalid or already been taken';

  ngOnInit(): void {
  }

  /**
   * 
   * login handler
   */
  login(event?: any) {
    if (event) {
      // when user hits enter
      if (event.keyCode === 13) {
        this.doLogin();
      } else {
        this.showError = false;
      }
    } else {
      this.doLogin();
    }
  }

  /**
   * do login processing here
   */
  async doLogin() {
    const username: String = this.usernameInput.nativeElement.value.trim();
    LoggerUtil.log(`validating username: ${username}`);
    try {
      const isUsernameTaken: Boolean = await this.signalingServer.checkIfUsernameTaken(username);
      if (isUsernameTaken) {
        LoggerUtil.log(`username is invalid or not available`);
        this.showError = true;
      } else {
        LoggerUtil.log(`username is valid and available, so trying login`);
        const result: DialogCloseResult = {
          type: DialogType.APP_LOGIN,
          data: {
            username
          }
        };
        this.dialogRef.close(result);
      }
    } catch (error) {
      this.showError = true;
      LoggerUtil.log(error);
    }
  }

}
