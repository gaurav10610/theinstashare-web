import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppDashboardModuleRoutingModule } from './app-dashboard-module-routing.module';
import { AppDashboardComponent } from '../app-dashboard/app-dashboard.component';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@NgModule({
  declarations: [
    AppDashboardComponent
  ],
  imports: [
    CommonModule,
    AppDashboardModuleRoutingModule,
    MatGridListModule,
    MatProgressSpinnerModule,
    MatToolbarModule,
    MatSnackBarModule,
    MatIconModule,
    MatButtonModule
  ]
})
export class AppDashboardModuleModule { }
