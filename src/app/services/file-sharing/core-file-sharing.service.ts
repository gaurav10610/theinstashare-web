import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CoreFileSharingService {

  fileReader: FileReader;

  constructor() {
    this.fileReader = new FileReader();
  }
}
