import { NgModule } from "@angular/core";
import { Routes, RouterModule } from "@angular/router";
import { LoginComponent } from "./components/login/login.component";
import { AppDashboardModuleModule } from "./modules/app-dashboard-module/app-dashboard-module.module";
import { FileTransferWindowModule } from "./modules/file-transfer-window-module/file-transfer-window-module";
import { GroupChatWindowModule } from "./modules/group-chat-window-module/group-chat-window.module";
import { TalkWindowModule } from "./modules/talk-window-module/talk-window.module";

const routes: Routes = [
  { path: "", redirectTo: "login", pathMatch: "full" },
  { path: "login", component: LoginComponent },
  { path: "app", loadChildren: () => AppDashboardModuleModule },
  { path: "talk", loadChildren: () => TalkWindowModule },
  { path: "group-chat", loadChildren: () => GroupChatWindowModule },
  { path: "file-transfer", loadChildren: () => FileTransferWindowModule },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
