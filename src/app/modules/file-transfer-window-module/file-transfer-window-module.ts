import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FileTransferWindowRoutingModule } from "./file-transfer-window-routing.module";
import { MatListModule } from "@angular/material/list";
import { MatDividerModule } from "@angular/material/divider";
import { MatIconModule } from "@angular/material/icon";
import { MatChipsModule } from "@angular/material/chips";
import { MatInputModule } from "@angular/material/input";
import { MatGridListModule } from "@angular/material/grid-list";
import { MatDialogModule } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatButtonModule } from "@angular/material/button";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatToolbarModule } from "@angular/material/toolbar";
import { MatCardModule } from "@angular/material/card";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatBadgeModule } from "@angular/material/badge";
import { FileTransferWindowComponent } from "src/app/components/file-transfer-window/file-transfer-window.component";

@NgModule({
  declarations: [FileTransferWindowComponent],
  imports: [
    CommonModule,
    FileTransferWindowRoutingModule,
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
    MatCardModule,
    MatProgressBarModule,
    MatBadgeModule,
  ],
})
export class FileTransferWindowModule {}
