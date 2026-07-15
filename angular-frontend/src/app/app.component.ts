import { Component, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PredictService, PredictResponse } from './services/predict.service';

interface HistoryItem {
  time: string;
  source: string;
  classification: string;
  confidence: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnDestroy {
  protected readonly Math = Math;
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;

  // Estado de pestañas: 'file' | 'url' | 'webcam'
  activeTab: 'file' | 'url' | 'webcam' = 'file';

  // Selección y Previsualización
  selectedFile: File | null = null;
  imageUrl = '';
  previewUrl: string | null = null;

  // Carga y Errores
  loading = false;
  error = '';
  result: PredictResponse | null = null;

  // Drag & Drop
  isDragOver = false;

  // Webcam
  webcamActive = false;
  videoStream: MediaStream | null = null;

  // Historial y Estadísticas de Sesión
  history: HistoryItem[] = [];
  processedCount = 0;
  lastConfidence = '-';

  // Sistema de Feedback
  feedbackSubmitted = false;
  feedbackMessage = '';
  showCorrectionInput = false;
  manualLabel = '';

  constructor(private predictService: PredictService) {}

  selectTab(tab: 'file' | 'url' | 'webcam'): void {
    this.activeTab = tab;
    this.clearSelections();
    if (tab === 'webcam') {
      this.startWebcam();
    }
  }

  // --- Drag & Drop y Selección de Archivo ---
  onFileSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      this.handleFile(file);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(): void {
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.handleFile(file);
    }
  }

  private handleFile(file: File): void {
    if (!file.type.startsWith('image/')) {
      this.error = 'Por favor selecciona un archivo de imagen válido (PNG, JPG, etc.).';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.error = 'La imagen debe ser menor a 5MB.';
      return;
    }

    this.selectedFile = file;
    this.imageUrl = '';
    this.error = '';
    this.result = null;
    this.resetFeedback();

    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
    }
    this.previewUrl = URL.createObjectURL(file);
  }

  // --- Lógica de URL ---
  onUrlLoaded(): void {
    const url = this.imageUrl.trim();
    if (!url) {
      this.error = 'Ingresa una URL válida.';
      return;
    }

    this.selectedFile = null;
    this.error = '';
    this.result = null;
    this.resetFeedback();

    // Verificamos cargando la imagen para ver si es válida
    const img = new Image();
    img.src = url;
    img.onload = () => {
      this.previewUrl = url;
    };
    img.onerror = () => {
      this.error = 'No se pudo cargar la imagen desde la URL. Verifica que sea un enlace directo válido.';
      this.previewUrl = null;
    };
  }

  // --- Lógica de Webcam ---
  async startWebcam(): Promise<void> {
    this.webcamActive = true;
    this.error = '';
    try {
      this.videoStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 }
      });
      if (this.videoElement) {
        this.videoElement.nativeElement.srcObject = this.videoStream;
      }
    } catch (err) {
      console.error('Error al acceder a la cámara:', err);
      this.error = 'No se pudo acceder a la cámara web. Asegúrate de dar los permisos correspondientes.';
      this.webcamActive = false;
    }
  }

  stopWebcam(): void {
    if (this.videoStream) {
      this.videoStream.getTracks().forEach((track) => track.stop());
      this.videoStream = null;
    }
    this.webcamActive = false;
  }

  captureFrame(): void {
    if (!this.videoElement || !this.videoStream) return;

    const video = this.videoElement.nativeElement;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `captured_webcam_${Date.now()}.jpg`, {
            type: 'image/jpeg'
          });
          this.handleFile(file);
          this.stopWebcam();
        }
      }, 'image/jpeg', 0.95);
    }
  }

  // --- Predicción ---
  predict(): void {
    if (!this.selectedFile && !this.imageUrl) {
      this.error = 'Por favor, carga una imagen o ingresa una URL primero.';
      return;
    }

    this.loading = true;
    this.error = '';
    this.result = null;

    const request$ = this.selectedFile
      ? this.predictService.predictByFile(this.selectedFile)
      : this.predictService.predictByUrl(this.imageUrl);

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
            source: this.selectedFile ? this.selectedFile.name : 'Enlace URL',
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

  // --- Retroalimentación (Feedback) ---
  resetFeedback(): void {
    this.feedbackSubmitted = false;
    this.feedbackMessage = '';
    this.showCorrectionInput = false;
    this.manualLabel = '';
  }

  sendFeedback(isCorrect: boolean): void {
    console.log('Retroalimentación enviada:', {
      isCorrect,
      image: this.selectedFile ? this.selectedFile.name : this.imageUrl
    });

    if (isCorrect) {
      this.feedbackSubmitted = true;
      this.feedbackMessage = '¡Excelente! Gracias por ayudarnos a validar la precisión.';
    } else {
      this.showCorrectionInput = true;
    }
  }

  submitCorrection(): void {
    const label = this.manualLabel.trim();
    if (!label) {
      alert('Ingresa una etiqueta correcta.');
      return;
    }

    console.log('Corrección enviada:', {
      correctedLabel: label,
      image: this.selectedFile ? this.selectedFile.name : this.imageUrl
    });

    this.showCorrectionInput = false;
    this.feedbackSubmitted = true;
    this.feedbackMessage = `¡Gracias! Hemos registrado la etiqueta correcta como "${label}" para entrenamientos futuros.`;
  }

  // --- Limpieza ---
  clearSelections(): void {
    this.stopWebcam();
    this.selectedFile = null;
    this.imageUrl = '';
    if (this.previewUrl && this.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.previewUrl);
    }
    this.previewUrl = null;
    this.result = null;
    this.error = '';
    this.resetFeedback();
  }

  ngOnDestroy(): void {
    this.stopWebcam();
    if (this.previewUrl && this.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.previewUrl);
    }
  }
}
