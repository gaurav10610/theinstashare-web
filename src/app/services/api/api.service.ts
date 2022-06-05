import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AppConstants } from '../AppConstants';
import { Observable } from 'rxjs';

/*
 * Service for Rest APIs
 */
@Injectable({
  providedIn: 'root'
})
export class ApiService {

  constructor(
    private http: HttpClient
  ) { }

  /**
   * [get description]
   * @param  uri :uri for requested resource
   * @return     observable
   */
  get(uri: String, baseURiIdentifier?: String) {
    const baseURI: string = (baseURiIdentifier && baseURiIdentifier === AppConstants.MEDIA_SERVER)
      ? environment.api_media_server_base
      : environment.api_endpoint_base;
    return this.http.get(baseURI + uri);
  }

  /**
   * make post rest api request
   * @param uri 
   * @param body 
   * @returns 
   */
  post(uri: String, body: Object, baseURiIdentifier?: String): Observable<Object> {
    const baseURI: string = (baseURiIdentifier && baseURiIdentifier === AppConstants.MEDIA_SERVER)
      ? environment.api_media_server_base
      : environment.api_endpoint_base;
    return this.http.post(baseURI + uri, body);
  }
}
