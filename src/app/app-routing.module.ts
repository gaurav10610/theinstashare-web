import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { TalkWindowModule } from './talk-window-module/talk-window.module';
import { GroupChatWindowModule } from './group-chat-window-module/group-chat-window.module';
import { GroupChatLoginWindowModule } from './group-chat-login-window-module/group-chat-login-window.module';

const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'talk', loadChildren: () => TalkWindowModule },
  { path: 'group-chat', loadChildren: () => GroupChatWindowModule },
  { path: 'group-login', loadChildren: () => GroupChatLoginWindowModule }
];  

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
