import { IconRegistryService } from "./services/icon/icon-registry.service";
import { Component } from "@angular/core";

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
})
export class AppComponent {
  constructor(private iconService: IconRegistryService) {}
}
