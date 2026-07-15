import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PredictService, PredictResponse, HistoricalStats } from './services/predict.service';
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
export class AppComponent implements OnInit {
  // Estado global y carga
  loading = false;
  error = '';
  result: PredictResponse | null = null;
  sourceInfo = '';

  // Historial de Sesión local
  history: HistoryItem[] = [];

  // Estadísticas históricas de la base de datos
  historicalStats: HistoricalStats | null = null;

  constructor(private predictService: PredictService) {}

  ngOnInit(): void {
    this.loadStats();
  }

  // Carga las estadísticas acumuladas desde SQLite
  loadStats(): void {
    this.predictService.getStats().subscribe({
      next: (stats) => {
        this.historicalStats = stats;
      },
      error: (err) => {
        console.error('Error cargando estadísticas históricas:', err);
      }
    });
  }

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
        this.loadStats(); // Recargar estadísticas de SQLite para actualizar el total

        // Añadir a historial local si la clasificación es exitosa
        if (res.classification) {
          const confidencePct = res.confidence ? Math.round(res.confidence * 100) : 0;
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

  // Recibe la retroalimentación enviada por el PredictionResultComponent y la persiste en SQLite
  onFeedback(event: FeedbackEvent): void {
    if (this.result && this.result.id) {
      this.predictService.sendFeedback(this.result.id, event.isCorrect, event.manualLabel).subscribe({
        next: () => {
          console.log('Feedback guardado en base de datos.');
          this.loadStats(); // Recargar estadísticas de SQLite para actualizar la tasa de precisión
        },
        error: (err) => {
          console.error('Error guardando feedback:', err);
        }
      });
    }
  }

  // Resetea el resultado de la predicción cuando se limpia el cargador
  onCleared(): void {
    this.result = null;
    this.error = '';
    this.sourceInfo = '';
  }
}
