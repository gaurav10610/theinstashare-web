import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { TalkWindowModule } from './talk-window-module/talk-window.module';
import { GroupChatWindowModule } from './group-chat-window-module/group-chat-window.module';
import { GroupChatLoginModule } from './group-chat-login-module/group-chat-login.module';
import { AppDashboardModuleModule } from './app-dashboard-module/app-dashboard-module.module';

const routes: Routes = [
  { path: '', redirectTo: 'group-chat', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'talk', loadChildren: () => TalkWindowModule },
  { path: 'group-chat', loadChildren: () => GroupChatWindowModule },
  { path: 'group-login', loadChildren: () => GroupChatLoginModule },
  { path: 'app', loadChildren: () => AppDashboardModuleModule }
];  

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
