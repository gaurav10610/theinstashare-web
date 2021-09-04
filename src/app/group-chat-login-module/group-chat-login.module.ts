import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GroupChatLoginRoutingModule } from './group-chat-login-routing.module';
import { GroupChatLoginComponent } from '../group-chat-login/group-chat-login.component';

@NgModule({
  declarations: [
    GroupChatLoginComponent
  ],
  imports: [
    CommonModule,
    GroupChatLoginRoutingModule
  ]
})
export class GroupChatLoginModule { }
