document.addEventListener("DOMContentLoaded", () => {
              // Initialize feedback module
              initialiseFeedback();

              // Initialize refiner module
  initialiseRefiner();

              if (!localStorage.getItem('prototype_confirmed')) {
                showConfirmationModal();
              }
            });

            const showConfirmationModal = () => {
              // Inject styles
              const style = document.createElement("style");
              style.textContent = `
        :root {
      --primary-color-modal: #f04a00;
      --primary-hover-modal: #d63d00;
      --primary-light-modal: #ff6b35;
      --secondary-color-modal: #0ea5e9;
      --success-color-modal: #10b981;
      --warning-color-modal: #f59e0b;
      --error-color-modal: #ef4444;
      --gray-50-modal: #f9fafb;
      --gray-100-modal: #f3f4f6;
      --gray-200-modal: #e5e7eb;
      --gray-300-modal: #d1d5db;
      --gray-400-modal: #9ca3af;
      --gray-500-modal: #6b7280;
      --gray-600-modal: #4b5563;
      --gray-700-modal: #374151;
      --gray-800-modal: #1f2937;
      --gray-900-modal: #111827;
      --white: #ffffff;
      --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
      --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    }

    #confirmation-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, rgba(0, 0, 0, 0.8), rgba(240, 74, 0, 0.1));
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
      backdrop-filter: blur(5px);
      overflow-y: auto;
      padding: 20px;
    }

    #confirmation-modal-content {
      background: var(--white);
      padding: 0;
      border-radius: 20px;
      max-width: 780px;
      width: 100%;
      max-height: 88vh;
      box-shadow: var(--shadow-xl);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
      position: relative;
      margin: auto;
      display: flex;
      flex-direction: column;
    }

    .modal-header {
      background: linear-gradient(135deg, var(--primary-color-modal), var(--primary-light-modal));
      color: var(--white);
      padding: 20px;
      text-align: center;
      position: relative;
      flex-shrink: 0;
    }

    .modal-header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.5"/></pattern></defs><rect width="100" height="100" fill="url(%23grid)"/></svg>');
      opacity: 0.3;
    }

    .modal-header h2 {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin: 0;
      font-size: 1.4rem;
      font-weight: 700;
      position: relative;
      z-index: 1;
    }

    .modal-body {
      padding: 24px;
      overflow-y: auto;
      flex: 1;
    }

    .stepper-container {
      margin-bottom: 24px;
    }

    .stepper {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 32px;
      position: relative;
    }

    .stepper::before {
      content: '';
      position: absolute;
      top: 20px;
      left: 20px;
      right: 20px;
      height: 2px;
      background: var(--gray-200-modal);
      z-index: 1;
    }

    .stepper-step {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      flex: 1;
      position: relative;
      z-index: 2;
    }

    .step-circle {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 13px;
      margin-bottom: 8px;
      transition: all 0.3s ease;
      position: relative;
    }

    .step-circle.active {
      background: var(--primary-color-modal);
      color: var(--white);
      transform: scale(1.1);
      box-shadow: 0 0 20px rgba(240, 74, 0, 0.4);
    }

    .step-circle.completed {
      background: var(--primary-color-modal);
      color: var(--white);
    }

    .step-circle.pending {
      background: var(--white);
      color: var(--gray-500-modal);
      border: 2px solid var(--gray-200-modal);
    }

    .step-title {
      font-size: 11px;
      font-weight: 600;
      color: var(--gray-700-modal);
      margin-bottom: 4px;
      max-width: 100px;
    }

    .step-subtitle {
      font-size: 9px;
      color: var(--gray-500-modal);
      max-width: 100px;
      line-height: 1.2;
    }

    .step-circle.active + .step-info .step-title {
      color: var(--primary-color-modal);
    }

    .prototype-info {
      background: linear-gradient(135deg, #fff7ed, #fef3c7);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
      border-left: 4px solid var(--primary-color-modal);
    }

    .prototype-info h3 {
      margin: 0 0 12px 0;
      color: var(--primary-color-modal);
      font-size: 15px;
      font-weight: 600;
    }

    .prototype-info p {
      margin: 0;
      color: #7c2d12;
      font-size: 13px;
      line-height: 1.5;
    }

    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 20px;
    }

    .info-card {
      background: var(--white);
      border-radius: 8px;
      padding: 14px;
      box-shadow: var(--shadow-sm);
      border: 1px solid var(--primary-light-modal);
      transition: all 0.3s ease;
    }

    .info-card:hover {
      box-shadow: var(--shadow-md);
      transform: translateY(-2px);
    }

    .info-card-icon {
      color: var(--primary-color-modal);
      display: inline-block;
      vertical-align: middle;
      margin-bottom: 8px;
    }

    .info-card-icon + h4 {
      display: inline-block;
      vertical-align: middle;
      margin: 0 0 6px 0;
      font-size: 13px;
      font-weight: 600;
      color: var(--gray-700-modal);
    }

    .info-card p {
      margin: 0;
      font-size: 11px;
      color: var(--gray-500-modal);
      line-height: 1.4;
    }

    .feedback-process {
      background: var(--white);
      border: 1px solid var(--gray-200-modal);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 8px;
    }

    .feedback-process .process-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
    }

    .feedback-process .process-header svg {
      color: var(--gray-600-modal);
    }

    .feedback-process .process-header h4 {
      margin: 0;
      font-size: 15px;
      color: var(--gray-700-modal);
      font-weight: 600;
    }

    .process-steps {
      display: grid;
      gap: 14px;
      margin-bottom: 16px;
    }

    .process-step {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      background: var(--gray-50-modal);
      padding: 12px;
      border-radius: 8px;
      border: 1px solid var(--gray-200-modal);
      transition: all 0.3s ease;
    }

    .process-step:hover {
      background: var(--white);
      box-shadow: var(--shadow-sm);
    }

    .step-number {
      background: var(--primary-color-modal);
      color: var(--white);
      width: 20px;
      height: 20px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: bold;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .step-content h5 {
      margin: 0 0 4px 0;
      font-size: 12px;
      font-weight: 600;
      color: var(--gray-700-modal);
    }

    .step-content p {
      margin: 0;
      font-size: 11px;
      color: var(--gray-600-modal);
      line-height: 1.4;
    }

    .go-live-info {
      background: var(--gray-50-modal);
      border: 1px solid var(--gray-200-modal);
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 12px;
    }

    .go-live-info:last-child {
      margin-bottom: 0;
    }

    .go-live-info .golive-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .go-live-info .golive-header svg {
      color: var(--success-color-modal);
      flex-shrink: 0;
    }

    .go-live-info .golive-header h5 {
      margin: 0;
      font-size: 12px;
      color: var(--gray-700-modal);
      font-weight: 600;
    }

    .go-live-info p {
      margin: 0;
      font-size: 11px;
      line-height: 1.4;
      color: var(--gray-600-modal);
    }

    .email-highlight {
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 600;
      color: var(--primary-color-modal);
      background: rgba(240, 74, 0, 0.1);
    }

    .confirmation-section {
      background: var(--gray-50-modal);
      border-radius: 12px;
      padding: 16px;
      margin-top: 8px;
    }

    .checkbox-container {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 18px;
    }

    .checkbox-container input[type="checkbox"] {
      width: 16px;
      height: 16px;
      margin-top: 2px;
      accent-color: var(--primary-color-modal);
      flex-shrink: 0;
    }

    .checkbox-container label {
      font-size: 13px;
      color: var(--gray-700-modal);
      line-height: 1.4;
      cursor: pointer;
    }

    .modal-actions {
      display: flex;
      justify-content: center;
      gap: 16px;
    }

    .btn {
      padding: 10px 28px;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-primary {
      background: var(--primary-color-modal);
      color: var(--white);
    }

    .btn-primary:enabled:hover {
      background: var(--primary-hover-modal);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(240, 74, 0, 0.3);
    }

    .btn-primary:disabled {
      background: var(--gray-300-modal);
      cursor: not-allowed;
      transform: none;
    }

    /* Mobile Responsive Styles */
    @media (max-width: 768px) {
      #confirmation-modal-overlay {
        align-items: flex-start;
        padding: 8px;
      }

      #confirmation-modal-content {
        max-width: 100%;
        width: 100%;
        max-height: 95vh;
        border-radius: 16px;
        margin: 0;
      }

      .modal-header {
        padding: 16px;
      }

      .modal-header h2 {
        font-size: 1.2rem;
        gap: 8px;
      }

      .modal-body {
        padding: 16px;
      }

      .stepper {
        flex-direction: column;
        gap: 12px;
        margin-bottom: 20px;
      }

      .stepper::before {
        display: none;
      }

      .stepper-step {
        flex-direction: row;
        align-items: center;
        justify-content: flex-start;
        text-align: left;
        width: 100%;
        padding: 10px 12px;
        background: var(--gray-50-modal);
        border-radius: 8px;
        gap: 12px;
        border: 1px solid var(--gray-200-modal);
      }

      .stepper-step:hover {
        background: var(--white);
        box-shadow: var(--shadow-sm);
      }

      .step-circle {
        width: 28px;
        height: 28px;
        font-size: 11px;
        margin-bottom: 0;
        flex-shrink: 0;
      }

      .step-info {
        display: flex;
        flex-direction: column;
      }

      .step-title {
        font-size: 11px;
        margin-bottom: 2px;
        max-width: none;
      }

      .step-subtitle {
        font-size: 9px;
        max-width: none;
      }

      .stepper-container {
        margin-bottom: 16px;
      }

      .prototype-info {
        padding: 14px;
        margin-bottom: 16px;
      }

      .prototype-info h3 {
        font-size: 13px;
        margin-bottom: 8px;
      }

      .prototype-info p {
        font-size: 11px;
      }

      .info-grid {
        grid-template-columns: 1fr;
        gap: 12px;
        margin-bottom: 16px;
      }

      .info-card {
        padding: 12px;
      }

      .info-card h4 {
        font-size: 11px;
        margin-bottom: 4px;
      }

      .info-card p {
        font-size: 9px;
      }

      .feedback-process {
        padding: 14px;
        margin-bottom: 8px;
      }

      .feedback-process .process-header h4 {
        font-size: 13px;
      }

      .process-step {
        padding: 10px;
      }

      .step-content h5 {
        font-size: 10px;
      }

      .step-content p {
        font-size: 9px;
      }

      .go-live-info {
        padding: 12px;
      }

      .go-live-info .golive-header h5 {
        font-size: 10px;
      }

      .go-live-info p {
        font-size: 9px;
      }

      .confirmation-section {
        padding: 14px;
        margin-top: 16px;
      }

      .checkbox-container {
        margin-bottom: 14px;
      }

      .checkbox-container label {
        font-size: 11px;
      }

      .btn {
        padding: 10px 24px;
        font-size: 11px;
      }
    }

    /* Very small screens */
    @media (max-width: 480px) {
      #confirmation-modal-overlay {
        padding: 4px;
      }

      .modal-header h2 {
        font-size: 1.1rem;
      }

      .modal-body {
        padding: 12px;
      }

      .stepper-step {
        padding: 8px 10px;
      }

      .step-circle {
        width: 24px;
        height: 24px;
        font-size: 10px;
      }

      .step-title {
        font-size: 10px;
      }

      .step-subtitle {
        font-size: 8px;
      }

      .prototype-info {
        padding: 12px;
      }

      .prototype-info h3 {
        font-size: 12px;
      }

      .prototype-info p {
        font-size: 10px;
      }

      .info-card {
        padding: 10px;
      }

      .info-card h4 {
        font-size: 10px;
      }

      .info-card p {
        font-size: 8px;
      }

      .feedback-process {
        padding: 12px;
      }

      .feedback-process .process-header h4 {
        font-size: 12px;
      }

      .step-content h5 {
        font-size: 9px;
      }

      .step-content p {
        font-size: 8px;
      }

      .go-live-info {
        padding: 10px;
      }

      .go-live-info .golive-header h5 {
        font-size: 9px;
      }

      .go-live-info p {
        font-size: 8px;
      }

      .confirmation-section {
        padding: 12px;
      }

      .checkbox-container label {
        font-size: 10px;
      }

      .btn {
        padding: 8px 20px;
        font-size: 10px;
      }
    }
      `;
              document.head.appendChild(style);

              // Inject modal HTML
              const modalWrapper = document.createElement("div");
              modalWrapper.innerHTML = `
        <div id="confirmation-modal-overlay">
          <div id="confirmation-modal-content">
            <div class="modal-header">
              <h2>
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-circle-alert-icon lucide-circle-alert"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                  Disclaimer!
              </h2>
            </div>
            
            <div class="modal-body">
              <div class="stepper-container">
                <div class="stepper">
                  <div class="stepper-step">
                    <div class="step-circle active">1</div>
                    <div class="step-info">
                      <div class="step-title">Prototype</div>
                      <div class="step-subtitle">Current Stage</div>
                    </div>
                  </div>
                  <div class="stepper-step">
                    <div class="step-circle pending">2</div>
                    <div class="step-info">
                      <div class="step-title">Refinement</div>
                      <div class="step-subtitle">Feedback & Iteration</div>
                    </div>
                  </div>
                  <div class="stepper-step">
                    <div class="step-circle pending">3</div>
                    <div class="step-info">
                      <div class="step-title">Go Live</div>
                      <div class="step-subtitle">Production Ready</div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="prototype-info">
                <h3>🚀 You're experiencing Step 1: Functional Prototype</h3>
                <p>This prototype helps you visualize and validate your business workflows before moving to production.</p>
              </div>

              <div class="info-grid">
                <div class="info-card">
                  <div class="info-card-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M4 12h16M12 4v16"/>
                    </svg>
                  </div>
                  <h4>Isolated Environment</h4>
                  <p>Each prototype version runs independently. Data lives locally in browser and isn't shared between versions.</p>
                </div>

                <div class="info-card">
                  <div class="info-card-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                      <polyline points="7,10 12,15 17,10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  </div>
                  <h4>Data Transfer</h4>
                  <p>Use Import/Export options in the top navigation to transfer data between prototype versions.</p>
                </div>
              </div>

              <div class="feedback-process">
                <div class="process-header">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/>
                    <rect x="8" y="2" width="8" height="4" rx="1"/>
                  </svg>
                  <h4>What's Next?</h4>
                </div>

                <div class="go-live-info">
                  <div class="golive-header">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                    <h5>Refine your prototype</h5>
                  </div>
                  <p>Submit your feedback, Tiram will refine your prototype until satisfication.</p>
                </div>

                <div class="go-live-info">
                  <div class="golive-header">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                      <polyline points="22,4 12,14.01 9,11.01"/>
                    </svg>
                    <h5>Ready to Go Live?</h5>
                  </div>
                  <p>Satisfied with the prototype? Contact <a href="mailto:support@tiram.ai" class="email-highlight">support@tiram.ai</a> to request your production-ready version. This will include secure databases, robust servers, production APIs, enhanced security, and performance optimizations.</p>
                </div>
              </div>

              <div class="confirmation-section">
                <div class="checkbox-container">
                  <input type="checkbox" id="confirm-checkbox" />
                  <label for="confirm-checkbox">
                    I understand this is a prototype environment. I'm ready to explore the functionality and provide constructive feedback.
                  </label>
                </div>
                
                <div class="modal-actions">
                  <button class="btn btn-primary" id="confirm-prototype-button" disabled>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                    Start Exploring Prototype
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
              document.body.appendChild(modalWrapper);

              const checkbox = document.getElementById("confirm-checkbox");
              const button = document.getElementById("confirm-prototype-button");

              checkbox.addEventListener("change", () => {
                if (checkbox.checked) {
                  button.disabled = false;
                } else {
                  button.disabled = true;
                }
              });

              button.addEventListener("click", () => {
                if (checkbox.checked) {
                  hideConfirmationModal();
                }
              });
            };

            const hideConfirmationModal = () => {
              localStorage.setItem('prototype_confirmed', "true");
              const overlay = document.getElementById("confirmation-modal-overlay");
              if (overlay) {
                overlay.style.opacity = "0";
                setTimeout(() => overlay.remove(), 300);
              }
            };
            
            const initialiseFeedback = () => {
              const style = document.createElement("link");
              style.rel = "stylesheet";
              style.href = "https://feedback-lib.tiram.app/tiramai-feedback-lib.css";
              document.body.appendChild(style);

              const script = document.createElement("script");
              script.src = "https://feedback-lib.tiram.app/tiramai-feedback-lib.min.js";

              script.onload = async function () {
                new window.TiramaiFeedbackLib({
                  // Required
                  apiKey: "eyJidXNpbmVzc0lkZWFJZCI6ImQyZGIxOGFiLTBjNDctNDJkZi1iN2U2LTIxMzRmYTMyYzEzNiIsImNyZWF0ZWRBdCI6MTc1Nzk0MjM2NjI4NywiY3JlYXRlZEJ5IjoiY29kZWdlbmVzaXMifQ==",

                  // Context
                  businessIdeaId: "d2db18ab-0c47-42df-b7e6-2134fa32c136",
                  projectName: "Farm Diary",
                  personaRole: "Farmer",
                  email: "N/A",
                  environment: "development"
                });
              };
              document.body.appendChild(script);
            };
            
            /**
 * Initialize the refiner module
 */
const initialiseRefiner = () => {
  console.log('[Main] Initializing Refiner');
  // Add CDN for refiner
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = 'https://refiner-lib.tiram.app/tiramai-refiner-lib.css';
  document.body.appendChild(style);

  const script = document.createElement('script');
  script.src = 'https://refiner-lib.tiram.app/tiramai-refiner-lib.min.js';

  // Initialize the refiner lib on script load
  script.onload = function () {
    // Initialize the Tiramai Refiner
    new window.RefinerLib({
      apiUrl:
        "https://code-genesis-dev.azurewebsites.net/refiner/refine-page?env=dev",
      saveApiUrl:
        "https://code-genesis-dev.azurewebsites.net/refiner/apply-changes-to-deployments?env=dev",
      suggestionsApiUrl:
        "https://code-genesis-dev.azurewebsites.net/refiner/get-element-suggestions?env=dev",
      fabPosition: "bottom-right",
      highlightColor: "#f04a01",
      createdBy: "prototype_email@zpqv.com",
      personaRole: "Farmer",
      appTitle: "Farm Diary",
      appType: "business",
      businessIdeaId: "d2db18ab-0c47-42df-b7e6-2134fa32c136",
      environment: "development",
    });
  };

  document.body.appendChild(script);
};
