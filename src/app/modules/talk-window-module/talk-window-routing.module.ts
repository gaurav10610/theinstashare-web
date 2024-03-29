import { NgModule } from "@angular/core";
import { Routes, RouterModule } from "@angular/router";
import { TalkWindowComponent } from "src/app/components/talk-window/talk-window.component";

const routes: Routes = [{ path: "", component: TalkWindowComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TalkWindowRoutingModule {}
