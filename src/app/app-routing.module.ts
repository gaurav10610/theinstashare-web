import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { TalkWindowModule } from './talk-window-module/talk-window.module';
import { GroupChatWindowModule } from './group-chat-window-module/group-chat-window.module';
import { AppDashboardModuleModule } from './app-dashboard-module/app-dashboard-module.module';
import { FileTransferWindowModule } from './file-transfer-window-module/file-transfer-window-module';

const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'app', loadChildren: () => AppDashboardModuleModule },
  { path: 'talk', loadChildren: () => TalkWindowModule },
  { path: 'group-chat', loadChildren: () => GroupChatWindowModule },
  { path: 'file-transfer', loadChildren: () => FileTransferWindowModule },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
