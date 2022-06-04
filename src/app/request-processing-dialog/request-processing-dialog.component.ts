import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TalkWindowContextService } from '../services/context/talk-window-context.service';
import { DialogCloseResult } from '../services/contracts/dialog/dialog';
import { DialogCloseResultType } from '../services/contracts/enum/DialogCloseResultType';

@Component({
  selector: 'app-request-processing-dialog',
  templateUrl: './request-processing-dialog.component.html',
  styleUrls: ['./request-processing-dialog.component.scss']
})
export class RequestProcessingDialogComponent implements OnInit {

  constructor(
    private dialogRef: MatDialogRef<any>,
    @Inject(MAT_DIALOG_DATA) private data: any,
    public talkWindowContextService: TalkWindowContextService,
  ) { }

  //material icons map
  iconsMap: Object = {
    'video': 'videocam',
    'audio': 'phone_enabled',
    'screen': 'desktop_windows',
    'sound': 'volume_up',
    'remoteControl': 'mouse'
  };

  // decline icons map
  declineIconsMap: Object = {
    'video': 'videocam_off',
    'audio': 'phone_disabled',
    'screen': 'desktop_access_disabled',
    'sound': 'volume_off',
    'remoteControl': 'mouse'
  };

  ngOnInit(): void {
  }

  /**
   * handler to decline/cancel media stream request
   *
   * @param action type of action i.e 'disconnect', 'close' or 'decline'
   *
   * @param channel media type i.e 'audio', 'video' etc.
   */
  closeCall(action: String, channel: String) {
    const result: DialogCloseResult = {
      type: DialogCloseResultType.CLOSE_CALL,
      data: {
        action,
        channel
      }
    };
    this.dialogRef.close(result);
  }

  /**
   * this will handle any media stream request acceptance
   *
   * @param channel media type i.e 'audio', 'video' etc.
   *
   */
  acceptCall(channel: String) {
    const result: DialogCloseResult = {
      type: DialogCloseResultType.ACCEPT_CALL,
      data: {
        channel
      }
    };
    this.dialogRef.close(result);
  }

}
