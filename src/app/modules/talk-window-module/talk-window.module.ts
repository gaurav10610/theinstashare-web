import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TalkWindowRoutingModule } from "./talk-window-routing.module";
import { MatListModule } from "@angular/material/list";
import { MatDividerModule } from "@angular/material/divider";
import { MatIconModule } from "@angular/material/icon";
import { MatChipsModule } from "@angular/material/chips";
import { MatGridListModule } from "@angular/material/grid-list";
import { MatInputModule } from "@angular/material/input";
import { MatDialogModule } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatButtonModule } from "@angular/material/button";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatToolbarModule } from "@angular/material/toolbar";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { IconsDialogComponent } from "src/app/components/icons-dialog/icons-dialog.component";
import { MediaViewerDialogComponent } from "src/app/components/media-viewer-dialog/media-viewer-dialog.component";
import { RequestProcessingDialogComponent } from "src/app/components/request-processing-dialog/request-processing-dialog.component";
import { TalkWindowComponent } from "src/app/components/talk-window/talk-window.component";

@NgModule({
  declarations: [
    TalkWindowComponent,
    MediaViewerDialogComponent,
    IconsDialogComponent,
    RequestProcessingDialogComponent,
  ],
  imports: [
    CommonModule,
    TalkWindowRoutingModule,
    MatListModule,
    MatDividerModule,
    MatIconModule,
    MatChipsModule,
    MatInputModule,
    MatGridListModule,
    MatDialogModule,
    MatFormFieldModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatToolbarModule,
    MatProgressBarModule,
  ],
})
export class TalkWindowModule {}
