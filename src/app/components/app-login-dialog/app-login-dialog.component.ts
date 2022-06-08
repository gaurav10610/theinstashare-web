import { Component, ElementRef, Inject, OnInit, ViewChild } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DialogCloseResult } from 'src/app/services/contracts/dialog/dialog';
import { DialogCloseResultType } from 'src/app/services/contracts/enum/DialogCloseResultType';
import { LoggerUtil } from 'src/app/services/logging/LoggerUtil';
import { SignalingService } from 'src/app/services/signaling/signaling.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-app-login',
  templateUrl: './app-login-dialog.component.html',
  styleUrls: ['./app-login-dialog.component.scss']
})
export class AppLoginDialogComponent implements OnInit {

  constructor(
    private dialogRef: MatDialogRef<any>,
    @Inject(MAT_DIALOG_DATA) private data: any,
    private signalingService: SignalingService
  ) { }

  inputFieldLabel: String = 'Username';
  assetsPath = environment.is_native_app ? 'assets/' : '../../../assets/';

  @ViewChild('usernameInput', { static: false }) usernameInput: ElementRef;

  errorMessage: String;
  isRegistering: Boolean = false;

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
        this.isRegistering = true;
        this.doLogin();
      } else {
        this.errorMessage = undefined;
      }
    } else {
      this.doLogin();
    }
  }

  /**
   * do login processing here
   */
  async doLogin() {
    this.isRegistering = true;
    const username: String = this.usernameInput.nativeElement.value.trim();
    LoggerUtil.logAny(`validating username: ${username}`);
    const isUsernameTaken: Boolean = await this.signalingService.checkIfUsernameTaken(username);
    if (isUsernameTaken) {
      this.errorMessage = 'username is either invalid or already been taken';
      this.isRegistering = false;
    } else {
      LoggerUtil.logAny(`username is valid and available, so trying login`);
      this.isRegistering = false;
      const result: DialogCloseResult = {
        type: DialogCloseResultType.APP_LOGIN,
        data: {
          username
        }
      };
      this.dialogRef.close(result);
    }
  }

}
