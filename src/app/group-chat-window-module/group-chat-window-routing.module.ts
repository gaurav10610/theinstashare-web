import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { GroupChatWindowComponent } from '../group-chat-window/group-chat-window.component';

const routes: Routes = [
  { path: '', component: GroupChatWindowComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class GroupChatWindowRoutingModule { }
