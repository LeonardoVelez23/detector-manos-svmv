import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PredictResponse {
  id?: string;
  classification?: string;
  confidence?: number;
  message?: string;
  error?: string;
}

export interface HistoricalStats {
  total: number;
  accuracy: string;
  class_counts: {
    Abierta: number;
    Cerrada: number;
    "No seguro": number;
  };
}

@Injectable({ providedIn: 'root' })
export class PredictService {
  private readonly gatewayUrl = environment.apiUrl;
  private readonly feedbackUrl = this.gatewayUrl.replace('/predict', '/feedback');
  private readonly statsUrl = this.gatewayUrl.replace('/predict', '/stats');

  constructor(private readonly http: HttpClient) {}

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

  sendFeedback(id: string, isCorrect: boolean, manualLabel?: string): Observable<any> {
    const payload = {
      id,
      is_correct: isCorrect,
      corrected_label: manualLabel
    };
    return this.http.post<any>(this.feedbackUrl, payload);
  }

  getStats(): Observable<HistoricalStats> {
    return this.http.get<HistoricalStats>(this.statsUrl);
  }
}
