import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HistoricalStats } from '../../services/predict.service';

export interface HistoryItem {
  time: string;
  source: string;
  classification: string;
  confidence: number;
}

@Component({
  selector: 'app-session-stats',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './session-stats.component.html',
  styles: [`
    .list-group-item {
      transition: background-color 0.2s ease;
    }
    .list-group-item:hover {
      background-color: rgba(255, 255, 255, 0.02) !important;
    }
  `]
})
export class SessionStatsComponent {
  @Input() stats: HistoricalStats | null = null;
  @Input() history: HistoryItem[] = [];
}
