import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CoreFileSharingService {

  fileReader: any;

  constructor() {
    this.fileReader = new FileReader();
  }
}
