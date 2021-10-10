import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TalkWindowContextService } from '../services/context/talk-window-context.service';
import { DialogCloseResult } from '../services/contracts/dialog/DialogCloseResult';
import { DialogCloseResultType } from '../services/contracts/enum/DialogCloseResultType';

@Component({
  selector: 'app-media-viewer-dialog',
  templateUrl: './media-viewer-dialog.component.html',
  styleUrls: ['./media-viewer-dialog.component.scss']
})
export class MediaViewerDialogComponent implements OnInit {

  constructor(
    private dialogRef: MatDialogRef<any>,
    @Inject(MAT_DIALOG_DATA) private data: any,
    private talkWindowContextService: TalkWindowContextService,
  ) { }

  contentType: String;
  content: any;

  ngOnInit(): void {
    this.contentType = this.talkWindowContextService.mediaViewerContext['contentType'];
    this.content = this.talkWindowContextService.sharedContent[
      this.talkWindowContextService.mediaViewerContext['contentId']
    ];
  }

  /**
   * close the media viewer dialog
   * @param event 
   */
  closeMediaViewer(contentType: String) {
    const result: DialogCloseResult = {
      type: DialogCloseResultType.MEDIA_VIEWER,
      data: {
        contentType
      }
    };
    this.dialogRef.close(result);
  }
}
