import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PredictResponse {
  classification?: string;
  confidence?: number;
  message?: string;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class PredictService {
  private readonly gatewayUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  predictByFile(file: File): Observable<PredictResponse> {
    const formData = new FormData();
    formData.append('image', file);
    return this.http.post<PredictResponse>(this.gatewayUrl, formData);
  }

  predictByUrl(imageUrl: string): Observable<PredictResponse> {
    const formData = new FormData();
    formData.append('image_url', imageUrl);
    return this.http.post<PredictResponse>(this.gatewayUrl, formData);
  }
}
