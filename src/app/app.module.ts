import { BrowserModule } from "@angular/platform-browser";
import { NgModule } from "@angular/core";
import { AppRoutingModule } from "./app-routing.module";
import { HttpClientModule } from "@angular/common/http";
import { AppComponent } from "./app.component";
import { LoginComponent } from "./login/login.component";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { ProgressDialogComponent } from "./progress-dialog/progress-dialog.component";
import { AppLoginDialogComponent } from "./app-login-dialog/app-login-dialog.component";
import { InformationDialogComponent } from "./information-dialog/information-dialog.component";
import { MatListModule } from "@angular/material/list";
import { MatDividerModule } from "@angular/material/divider";
import { MatIconModule } from "@angular/material/icon";
import { MatChipsModule } from "@angular/material/chips";
import { MatTabsModule } from "@angular/material/tabs";
import { MatInputModule } from "@angular/material/input";
import { MatGridListModule } from "@angular/material/grid-list";
import { MatDialogModule } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatButtonModule } from "@angular/material/button";
import { MatToolbarModule } from "@angular/material/toolbar";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatSnackBarModule } from "@angular/material/snack-bar";
import { NgxGoogleAnalyticsModule } from "ngx-google-analytics";
import { MatBadgeModule } from "@angular/material/badge";
import { environment } from "src/environments/environment";

const moduleImports: any[] = [
  BrowserModule,
  AppRoutingModule,
  HttpClientModule,
  BrowserAnimationsModule,
  MatSnackBarModule,
  MatProgressSpinnerModule,
  MatListModule,
  MatDividerModule,
  MatIconModule,
  MatChipsModule,
  MatTabsModule,
  MatGridListModule,
  MatDialogModule,
  MatFormFieldModule,
  MatInputModule,
  MatButtonModule,
  MatToolbarModule,
  MatProgressBarModule,
  MatBadgeModule,
];

if (environment.production) {
  moduleImports.push(
    NgxGoogleAnalyticsModule.forRoot(environment.google_tracking_id)
  );
}

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    ProgressDialogComponent,
    AppLoginDialogComponent,
    InformationDialogComponent,
  ],
  imports: moduleImports,
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
