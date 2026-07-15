import { Component } from '@angular/core';

@Component({
  selector: 'app-header',
  standalone: true,
  template: `
    <header class="text-white py-4 mb-4 shadow-sm" style="background: var(--primary-gradient); border-bottom: 3px solid rgba(255,255,255,0.1);">
      <div class="container d-flex flex-wrap justify-content-between align-items-center">
        <div>
          <h1 class="h3 fw-bold mb-0" style="font-family: var(--font-family-heading); font-weight: 800 !important; letter-spacing: -0.02em;">Detector de Manos</h1>
          <p class="mb-0 text-white-50 small">Clasificador MobileNet • Inteligencia Artificial</p>
        </div>
        <div class="bg-white rounded p-2 mt-2 mt-sm-0 shadow-sm" style="opacity: 0.95; border-left: 4px solid #8b5cf6;">
          <span class="text-dark fw-bold small">🤖 IA Inferencia</span>
        </div>
      </div>
    </header>
  `
})
export class HeaderComponent {}
