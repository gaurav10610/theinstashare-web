import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TalkWindowModuleRoutingModule } from './talk-window-module-routing.module';
import { TalkWindowComponent } from '../talk-window/talk-window.component';


@NgModule({
  declarations: [
    TalkWindowComponent
  ],
  imports: [
    CommonModule,
    TalkWindowModuleRoutingModule
  ]
})
export class TalkWindowModuleModule { }
