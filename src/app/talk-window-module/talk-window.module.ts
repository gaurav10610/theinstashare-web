import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TalkWindowRoutingModule } from './talk-window-routing.module';
import { TalkWindowComponent } from '../talk-window/talk-window.component';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatInputModule } from '@angular/material/input';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MediaViewerDialogComponent } from '../media-viewer-dialog/media-viewer-dialog.component';

@NgModule({
  declarations: [
    TalkWindowComponent,
    MediaViewerDialogComponent
  ],
  imports: [
    CommonModule,
    TalkWindowRoutingModule,
    MatListModule,
    MatDividerModule,
    MatIconModule,
    MatChipsModule,
    MatTabsModule,
    MatInputModule,
    MatGridListModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatToolbarModule,
    MatProgressBarModule
  ]
})
export class TalkWindowModule { }
