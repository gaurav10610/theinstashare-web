import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { GroupChatLoginComponent } from '../group-chat-login/group-chat-login.component';

const routes: Routes = [
  { path: '', component: GroupChatLoginComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class GroupChatLoginWindowRoutingModule { }
