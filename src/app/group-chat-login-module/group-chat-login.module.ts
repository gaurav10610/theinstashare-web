import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GroupChatLoginRoutingModule } from './group-chat-login-routing.module';
import { GroupChatLoginComponent } from '../group-chat-login/group-chat-login.component';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@NgModule({
  declarations: [
    GroupChatLoginComponent
  ],
  imports: [
    CommonModule,
    GroupChatLoginRoutingModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule
  ]
})
export class GroupChatLoginModule { }
