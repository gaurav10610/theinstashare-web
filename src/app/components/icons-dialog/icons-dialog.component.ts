import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TalkWindowContextService } from 'src/app/services/context/talk-window-context.service';
import { UserContextService } from 'src/app/services/context/user.context.service';
import { DialogCloseResult } from 'src/app/services/contracts/dialog/dialog';
import { DialogCloseResultType } from 'src/app/services/contracts/enum/DialogCloseResultType';

@Component({
  selector: 'app-icons-dialog',
  templateUrl: './icons-dialog.component.html',
  styleUrls: ['./icons-dialog.component.scss']
})
export class IconsDialogComponent implements OnInit {

  constructor(
    public userContextService: UserContextService,
    public talkWindowContextService: TalkWindowContextService,
    private dialogRef: MatDialogRef<any>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) { }

  ngOnInit(): void {
  }

  /**
   * this will handle resizing of remote video window on UI
   *
   * @param minimizeFlag boolean flag to distinguish whether to minimize or
   * maximize the remote video
   *
   */
  resizeRemoteVideo(minimizeFlag: Boolean) {
    const result: DialogCloseResult = {
      type: DialogCloseResultType.RESIZE_REMOTE_VIDEO,
      data: {
        minimizeFlag
      }
    };
    this.dialogRef.close(result);
  }

  /**
   *
   * handle dnd
   */
  handleDnd() {
    const result: DialogCloseResult = {
      type: DialogCloseResultType.DND,
      data: {}
    };
    this.dialogRef.close(result);
  }

  /**
   * handle mute
   */
  handleMute() {
    const result: DialogCloseResult = {
      type: DialogCloseResultType.MUTE,
      data: {}
    };
    this.dialogRef.close(result);
  }

  handleMediaStreaming(clickedIcon: String) {
    const result: DialogCloseResult = {
      type: DialogCloseResultType.MEDIA_STREAM,
      data: {
        clickedIcon
      }
    };
    this.dialogRef.close(result);
  }

  /**
   * this will handle remote access start/stop requests for a screen sharing session
   *
   * @param action string param to distinguish whether to start/stop the remote access
   * possible values => 'start', 'stop'
   *
   */
  handleRemoteAccess(action: String) {
    const result: DialogCloseResult = {
      type: DialogCloseResultType.REMOTE_ACCESS,
      data: {
        action
      }
    };
    this.dialogRef.close(result);
  }


  /**
   * on click handler to handle make fullscreen event
   *
   * this feature is available only on desktop view
   *
   * @param makeFullScreenFlag flag to make remote video full screen
   */
  handleVideoFullScreen(makeFullScreenFlag: boolean) {
    const result: DialogCloseResult = {
      type: DialogCloseResultType.FULL_SCREEN,
      data: {
        makeFullScreenFlag
      }
    };
    this.dialogRef.close(result);
  }

  /**
   * handle camera flip event
   */
  handleCameraFlip() {
    const result: DialogCloseResult = {
      type: DialogCloseResultType.CAMERA_FLIP,
      data: {}
    };
    this.dialogRef.close(result);
  }

  /**
   * handle dialog close event
   */
  closeMediaViewer() {
    const result: DialogCloseResult = {
      type: DialogCloseResultType.BLANK_DIALOG_CLOSE,
      data: {}
    };
    this.dialogRef.close(result);
  }

}
