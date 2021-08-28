import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GroupChatLoginWindowRoutingModule } from './group-chat-login-window-routing.module';
import { GroupChatLoginComponent } from '../group-chat-login/group-chat-login.component';

@NgModule({
  declarations: [
    GroupChatLoginComponent
  ],
  imports: [
    CommonModule,
    GroupChatLoginWindowRoutingModule
  ]
})
export class GroupChatLoginWindowModule { }
