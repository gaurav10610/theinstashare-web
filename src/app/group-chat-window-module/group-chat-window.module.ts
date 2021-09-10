import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GroupChatWindowRoutingModule } from './group-chat-window-routing.module';
import { GroupChatWindowComponent } from '../group-chat-window/group-chat-window.component';

@NgModule({
  declarations: [
   GroupChatWindowComponent
  ],
  imports: [
    CommonModule,
    GroupChatWindowRoutingModule
  ]
})
export class GroupChatWindowModule { }
