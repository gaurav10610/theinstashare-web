import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FileTransferWindowComponent } from '../file-transfer-window/file-transfer-window.component';

const routes: Routes = [
  { path: '', component: FileTransferWindowComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class FileTransferWindowRoutingModule { }
