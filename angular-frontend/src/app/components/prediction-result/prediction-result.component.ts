import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PredictResponse } from '../../services/predict.service';

export interface FeedbackEvent {
  isCorrect: boolean;
  manualLabel?: string;
}

@Component({
  selector: 'app-prediction-result',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './prediction-result.component.html'
})
export class PredictionResultComponent {
  protected readonly Math = Math;

  private _result: PredictResponse | null = null;

  @Input()
  set result(value: PredictResponse | null) {
    this._result = value;
    this.resetFeedback();
  }
  get result(): PredictResponse | null {
    return this._result;
  }

  @Input() sourceInfo = '';

  @Output() feedback = new EventEmitter<FeedbackEvent>();

  // Estado del Feedback
  feedbackSubmitted = false;
  feedbackMessage = '';
  showCorrectionInput = false;
  manualLabel = '';

  sendFeedback(isCorrect: boolean): void {
    if (isCorrect) {
      this.feedbackSubmitted = true;
      this.feedbackMessage = '¡Excelente! Gracias por ayudarnos a validar la precisión.';
      this.feedback.emit({ isCorrect: true });
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

    this.showCorrectionInput = false;
    this.feedbackSubmitted = true;
    this.feedbackMessage = `¡Gracias! Hemos registrado la etiqueta correcta como "${label}" para entrenamientos futuros.`;

    this.feedback.emit({
      isCorrect: false,
      manualLabel: label
    });
  }

  resetFeedback(): void {
    this.feedbackSubmitted = false;
    this.feedbackMessage = '';
    this.showCorrectionInput = false;
    this.manualLabel = '';
  }
}
