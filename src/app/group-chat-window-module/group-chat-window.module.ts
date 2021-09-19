import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GroupChatWindowRoutingModule } from './group-chat-window-routing.module';
import { GroupChatWindowComponent } from '../group-chat-window/group-chat-window.component';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatInputModule } from '@angular/material/input';
import { MatGridListModule } from '@angular/material/grid-list';

@NgModule({
  declarations: [
    GroupChatWindowComponent
  ],
  imports: [
    CommonModule,
    GroupChatWindowRoutingModule,
    MatListModule,
    MatDividerModule,
    MatIconModule,
    MatChipsModule,
    MatTabsModule,
    MatInputModule,
    MatGridListModule
  ]
})
export class GroupChatWindowModule { }
