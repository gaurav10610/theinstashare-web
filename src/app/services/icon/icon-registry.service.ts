import { Injectable } from "@angular/core";
import { MatIconRegistry } from "@angular/material/icon";
import { DomSanitizer } from "@angular/platform-browser";
import { environment } from "src/environments/environment";

@Injectable({
  providedIn: "root",
})
export class IconRegistryService {
  //assets path
  assetsPath = environment.is_native_app ? "assets/" : "../../../assets/";

  iconsPath = "images/icons/";

  constructor(
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer
  ) {
    this.init();
  }

  init() {
    // adding svg icons
    this.matIconRegistry.addSvgIcon(
      "generic_file_icon",
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        this.assetsPath + this.iconsPath + "generic-file.svg"
      )
    );
    this.matIconRegistry.addSvgIcon(
      "audio_file_icon",
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        this.assetsPath + this.iconsPath + "audio-file.svg"
      )
    );
    this.matIconRegistry.addSvgIcon(
      "video_file_icon",
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        this.assetsPath + this.iconsPath + "video-file.svg"
      )
    );
    this.matIconRegistry.addSvgIcon(
      "text_file_icon",
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        this.assetsPath + this.iconsPath + "text-file.svg"
      )
    );
    this.matIconRegistry.addSvgIcon(
      "zip_file_icon",
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        this.assetsPath + this.iconsPath + "zip-file.svg"
      )
    );
    this.matIconRegistry.addSvgIcon(
      "image_file_icon",
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        this.assetsPath + this.iconsPath + "image-file.svg"
      )
    );
    this.matIconRegistry.addSvgIcon(
      "pdf_file_icon",
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        this.assetsPath + this.iconsPath + "pdf-file.svg"
      )
    );
    this.matIconRegistry.addSvgIcon(
      "download_icon",
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        this.assetsPath + this.iconsPath + "download.svg"
      )
    );
    this.matIconRegistry.addSvgIcon(
      "bin_icon",
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        this.assetsPath + this.iconsPath + "bin.svg"
      )
    );
    this.matIconRegistry.addSvgIcon(
      "user_online_icon",
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        this.assetsPath + this.iconsPath + "user-online.svg"
      )
    );
    this.matIconRegistry.addSvgIcon(
      "user_offline_icon",
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        this.assetsPath + this.iconsPath + "user-offline.svg"
      )
    );

    this.matIconRegistry.addSvgIcon(
      "error_icon",
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        this.assetsPath + this.iconsPath + "error.svg"
      )
    );
    this.matIconRegistry.addSvgIcon(
      "refresh_icon",
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        this.assetsPath + this.iconsPath + "refresh.svg"
      )
    );
    this.matIconRegistry.addSvgIcon(
      "app_icon",
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        this.assetsPath + this.iconsPath + "app-icon.svg"
      )
    );
    this.matIconRegistry.addSvgIcon(
      "info_icon",
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        this.assetsPath + this.iconsPath + "info.svg"
      )
    );
  }
}
