import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TalkWindowRoutingModule } from './talk-window-routing.module';
import { TalkWindowComponent } from '../talk-window/talk-window.component';

@NgModule({
  declarations: [
    TalkWindowComponent
  ],
  imports: [
    CommonModule,
    TalkWindowRoutingModule
  ]
})
export class TalkWindowModule { }
