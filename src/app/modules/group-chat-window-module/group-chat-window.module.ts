import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { GroupChatWindowRoutingModule } from "./group-chat-window-routing.module";
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
import { GroupChatWindowComponent } from "src/app/components/group-chat-window/group-chat-window.component";
import { GroupLoginDialogComponent } from "src/app/components/group-login-dialog/group-login-dialog.component";

@NgModule({
  declarations: [GroupLoginDialogComponent, GroupChatWindowComponent],
  imports: [
    CommonModule,
    GroupChatWindowRoutingModule,
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
  ],
})
export class GroupChatWindowModule {}
