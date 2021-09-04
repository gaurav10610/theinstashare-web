import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AppDashboardComponent } from '../app-dashboard/app-dashboard.component';

const routes: Routes = [
  { path: '', component: AppDashboardComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AppDashboardModuleRoutingModule { }
