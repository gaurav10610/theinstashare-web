import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppDashboardModuleRoutingModule } from './app-dashboard-module-routing.module';
import { AppDashboardComponent } from '../app-dashboard/app-dashboard.component';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@NgModule({
  declarations: [
    AppDashboardComponent
  ],
  imports: [
    CommonModule,
    AppDashboardModuleRoutingModule,
    MatGridListModule,
    MatSnackBarModule,
    MatProgressSpinnerModule
  ]
})
export class AppDashboardModuleModule { }
