import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PredictService, PredictResponse } from './services/predict.service';
import { HeaderComponent } from './components/header/header.component';
import { ImageUploaderComponent, ImageReadyEvent } from './components/image-uploader/image-uploader.component';
import { PredictionResultComponent, FeedbackEvent } from './components/prediction-result/prediction-result.component';
import { SessionStatsComponent, HistoryItem } from './components/session-stats/session-stats.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    ImageUploaderComponent,
    PredictionResultComponent,
    SessionStatsComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  // Estado global y carga
  loading = false;
  error = '';
  result: PredictResponse | null = null;
  sourceInfo = '';

  // Estadísticas globales e Historial de Sesión
  history: HistoryItem[] = [];
  processedCount = 0;
  lastConfidence = '-';

  constructor(private predictService: PredictService) {}

  // Orquesta la predicción cuando el ImageUploader emite los datos de imagen listos
  onPredict(event: ImageReadyEvent): void {
    this.loading = true;
    this.error = '';
    this.result = null;
    this.sourceInfo = event.file ? event.file.name : 'Enlace URL';

    const request$ = event.file
      ? this.predictService.predictByFile(event.file)
      : this.predictService.predictByUrl(event.imageUrl);

    request$.subscribe({
      next: (res: PredictResponse) => {
        this.loading = false;
        if (res.error) {
          this.error = res.error;
          return;
        }

        this.result = res;

        // Añadir a estadísticas e historial si la clasificación es exitosa
        if (res.classification) {
          const confidencePct = res.confidence ? Math.round(res.confidence * 100) : 0;
          this.processedCount++;
          this.lastConfidence = `${confidencePct}%`;

          this.history.unshift({
            time: new Date().toLocaleTimeString('es-ES'),
            source: this.sourceInfo,
            classification: res.classification,
            confidence: confidencePct
          });
        }
      },
      error: (err: any) => {
        console.error('Error de predicción:', err);
        this.error = 'No se pudo procesar la imagen. Verifica que el servidor de Flask esté activo.';
        this.loading = false;
      }
    });
  }

  // Recibe la retroalimentación enviada por el PredictionResultComponent
  onFeedback(event: FeedbackEvent): void {
    console.log('Retroalimentación global recibida en el padre:', {
      isCorrect: event.isCorrect,
      manualLabel: event.manualLabel,
      imageSource: this.sourceInfo
    });
  }

  // Resetea el resultado de la predicción cuando se limpia el cargador
  onCleared(): void {
    this.result = null;
    this.error = '';
    this.sourceInfo = '';
  }
}
