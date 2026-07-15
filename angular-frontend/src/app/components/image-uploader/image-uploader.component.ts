import { Component, OnDestroy, ElementRef, ViewChild, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface ImageReadyEvent {
  file: File | null;
  imageUrl: string;
  previewUrl: string;
}

@Component({
  selector: 'app-image-uploader',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './image-uploader.component.html',
  styleUrl: './image-uploader.component.css'
})
export class ImageUploaderComponent implements OnDestroy {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;

  @Input() loading = false;

  @Output() predict = new EventEmitter<ImageReadyEvent>();
  @Output() cleared = new EventEmitter<void>();

  // Estado de pestañas: 'file' | 'url' | 'webcam'
  activeTab: 'file' | 'url' | 'webcam' = 'file';

  // Selección y Previsualización
  selectedFile: File | null = null;
  imageUrl = '';
  previewUrl: string | null = null;

  // Drag & Drop
  isDragOver = false;

  // Webcam
  webcamActive = false;
  videoStream: MediaStream | null = null;

  // Alertas locales de error
  @Input() error = '';

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

  // --- Disparar Predicción ---
  triggerPredict(): void {
    if (!this.selectedFile && !this.imageUrl) {
      this.error = 'Por favor, carga una imagen o ingresa una URL primero.';
      return;
    }

    this.predict.emit({
      file: this.selectedFile,
      imageUrl: this.imageUrl,
      previewUrl: this.previewUrl || ''
    });
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
    this.error = '';
    this.cleared.emit();
  }

  ngOnDestroy(): void {
    this.stopWebcam();
    if (this.previewUrl && this.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.previewUrl);
    }
  }
}
