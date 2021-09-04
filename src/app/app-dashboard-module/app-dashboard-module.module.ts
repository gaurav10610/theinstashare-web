import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppDashboardModuleRoutingModule } from './app-dashboard-module-routing.module';
import { AppDashboardComponent } from '../app-dashboard/app-dashboard.component';
import { MatGridListModule } from '@angular/material/grid-list';


@NgModule({
  declarations: [
    AppDashboardComponent
  ],
  imports: [
    CommonModule,
    AppDashboardModuleRoutingModule,
    MatGridListModule
  ]
})
export class AppDashboardModuleModule { }
