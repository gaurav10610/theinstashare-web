import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

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
  get(uri: string) {
    return this.http.get(environment.api_endpoint_base + uri);
  }

  /**
   * This will request a new data channel connection from signaling server
   * @param data : data to be sent in post request
   */
  createRTCConnection(data: any) {
    return this.http.post(environment.rtc_api_endpoint_base + '/channel/create', JSON.stringify(data));
  }
}
